"""OpenThai 2.1 OCR HTTP Server and CLI Runner for Bank Buddy.
Provides high-performance local OCR inference using OpenVINO / ONNX Runtime.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# Ensure third_party model directory is in sys.path
MODEL_DIR = Path(__file__).resolve().parent
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from runtime.line_engine import LineOCR

# Global OCR Engine singleton
_OCR_ENGINE: LineOCR | None = None


def get_ocr_engine(threads: int | None = None) -> LineOCR:
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        if threads is None:
            cpu_cores = os.cpu_count() or 4
            threads = min(cpu_cores, 8)
        _OCR_ENGINE = LineOCR(str(MODEL_DIR), threads=threads)
    return _OCR_ENGINE


def process_image_bytes(img_bytes: bytes, ocr: LineOCR) -> dict[str, Any]:
    result = ocr.read(img_bytes)
    return {
        "success": True,
        "text": result.get("text", ""),
        "lines": result.get("lines", []),
        "rotation": result.get("rotation", 0),
        "text_angle": result.get("text_angle", 0.0),
        "timing": result.get("timing", {}),
    }


class OCRRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        if self.path == "/health" or self.path == "/":
            ocr = get_ocr_engine()
            payload = {
                "status": "ok",
                "model": "OpenThai2.1-OCR-Text-20261118",
                "backend": getattr(ocr.det, "backend", "unknown"),
                "version": "2.1.4",
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")

    def do_POST(self) -> None:
        if self.path in ("/ocr", "/predict", "/api/ocr"):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                if content_length <= 0:
                    self.send_error(HTTPStatus.BAD_REQUEST, "Missing or empty request body")
                    return

                raw_body = self.rfile.read(content_length)
                content_type = self.headers.get("Content-Type", "").lower()

                img_bytes: bytes
                if "application/json" in content_type:
                    data = json.loads(raw_body.decode("utf-8"))
                    b64 = data.get("image_base64") or data.get("image")
                    if not b64:
                        self.send_error(HTTPStatus.BAD_REQUEST, "JSON body must contain 'image_base64'")
                        return
                    if "," in b64:
                        b64 = b64.split(",", 1)[1]
                    img_bytes = base64.b64decode(b64)
                else:
                    # Raw image bytes (image/png, image/jpeg, application/octet-stream)
                    img_bytes = raw_body

                ocr = get_ocr_engine()
                res = process_image_bytes(img_bytes, ocr)

                resp_body = json.dumps(res, ensure_ascii=False).encode("utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
            except Exception as e:
                err_body = json.dumps({"success": False, "error": str(e)}).encode("utf-8")
                self.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_body)))
                self.end_headers()
                self.wfile.write(err_body)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")

    def log_message(self, format: str, *args: Any) -> None:
        # Standard quiet logging to stderr
        sys.stderr.write(f"[OpenThaiOCR] {format % args}\n")


def run_cli(image_path: str) -> None:
    path = Path(image_path)
    if not path.is_file():
        print(json.dumps({"success": False, "error": f"File not found: {image_path}"}), file=sys.stderr)
        sys.exit(1)

    ocr = get_ocr_engine()
    data = path.read_bytes()
    res = process_image_bytes(data, ocr)
    print(json.dumps(res, ensure_ascii=False))


def run_server(host: str = "0.0.0.0", port: int = 8001, threads: int = 2) -> None:
    ocr = get_ocr_engine(threads=threads)
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, OCRRequestHandler)
    print(f"[OpenThaiOCR] Listening on http://{host}:{port} (backend: {ocr.det.backend})", file=sys.stderr, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[OpenThaiOCR] Shutting down server...", file=sys.stderr)
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenThai 2.1 OCR Service")
    parser.add_argument("--cli", type=str, help="Process a single image via CLI and print JSON to stdout")
    parser.add_argument("--host", type=str, default=os.getenv("OPENTHAI_HOST", "0.0.0.0"), help="HTTP host")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", os.getenv("OPENTHAI_PORT", "8080"))), help="HTTP port")
    parser.add_argument("--threads", type=int, default=2, help="Number of inference threads")

    args = parser.parse_args()

    if args.cli:
        run_cli(args.cli)
    else:
        run_server(host=args.host, port=args.port, threads=args.threads)
