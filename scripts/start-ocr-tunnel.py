"""Automated Live Tunnel and Service Discovery for Bank Buddy OpenThai OCR.
Starts local OCR server, launches Cloudflare Tunnel, and synchronizes the
tunnel URL directly to Supabase system_settings so Vercel can access it with zero configuration.
"""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT_DIR / "third_party" / "OpenThai2.1-OCR-Text-20261118"
VENV_PYTHON = (
    MODEL_DIR / ".venv" / "Scripts" / "python.exe"
    if sys.platform == "win32"
    else MODEL_DIR / ".venv" / "bin" / "python"
)
SERVER_SCRIPT = MODEL_DIR / "server.py"


def load_env() -> dict[str, str]:
    env_vars: dict[str, str] = dict(os.environ)
    for env_file in [ROOT_DIR / ".env.local", ROOT_DIR / ".env"]:
        if env_file.is_file():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip("'\"")
                    if k not in env_vars:
                        env_vars[k] = v
    return env_vars


def update_supabase_registry(supabase_url: str, service_key: str, ocr_endpoint: str) -> bool:
    try:
        url = f"{supabase_url.rstrip('/')}/rest/v1/system_settings"
        payload = {
            "key": "OPENTHAI_OCR_URL",
            "value": ocr_endpoint,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        print(f"[LiveOCR] Warning: Failed to sync with Supabase: {e}", file=sys.stderr)
        return False


def main() -> None:
    env = load_env()
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    python_exec = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable
    port = int(env.get("OPENTHAI_PORT", "8001"))

    print("\n========================================================")
    print("  Bank Buddy - OpenThai 2.1 OCR Live Runner")
    print("========================================================\n")

    # 1. Start OCR HTTP server
    print(f"[LiveOCR] Starting OpenThai OCR server on port {port}...")
    server_proc = subprocess.Popen(
        [python_exec, str(SERVER_SCRIPT), "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    # 2. Start Cloudflare Tunnel
    print("[LiveOCR] Starting Cloudflare Tunnel...")
    tunnel_cmd = ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"]
    try:
        tunnel_proc = subprocess.Popen(
            tunnel_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except FileNotFoundError:
        print("\n[LiveOCR] ERROR: 'cloudflared' command not found!")
        print("Please install Cloudflare Tunnel with:")
        print("   winget install Cloudflare.cloudflared -e\n")
        server_proc.terminate()
        sys.exit(1)

    tunnel_url: str | None = None
    pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    # Read tunnel output to extract public URL
    assert tunnel_proc.stdout is not None
    for line in tunnel_proc.stdout:
        sys.stderr.write(line)
        match = pattern.search(line)
        if match:
            tunnel_url = match.group(0)
            break

    if not tunnel_url:
        print("[LiveOCR] ERROR: Could not determine tunnel URL.", file=sys.stderr)
        server_proc.terminate()
        tunnel_proc.terminate()
        sys.exit(1)

    ocr_endpoint = f"{tunnel_url}/ocr"
    print("\n--------------------------------------------------------")
    print(f"[LiveOCR] Public Tunnel URL : {tunnel_url}")
    print(f"[LiveOCR] Full OCR Endpoint : {ocr_endpoint}")

    # 3. Auto-sync to Supabase
    if supabase_url and service_key:
        print("[LiveOCR] Registering URL to Supabase system_settings...")
        success = update_supabase_registry(supabase_url, service_key, ocr_endpoint)
        if success:
            print("[LiveOCR] [OK] Successfully registered! Vercel will auto-route to this URL.")
        else:
            print("[LiveOCR] [WARNING] Could not register to Supabase; manual Vercel env may be needed.")
    else:
        print("[LiveOCR] [NOTE] Supabase credentials not found in env; skipping auto-sync.")

    print("--------------------------------------------------------")
    print("[LiveOCR] Ready to process bank slips. Press Ctrl+C to stop.\n")

    def shutdown(signum: int, frame: Any) -> None:
        print("\n[LiveOCR] Shutting down...")
        try:
            tunnel_proc.terminate()
            server_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep alive
    try:
        while True:
            time.sleep(1)
            if server_proc.poll() is not None:
                print("[LiveOCR] OCR server stopped unexpectedly.")
                break
            if tunnel_proc.poll() is not None:
                print("[LiveOCR] Tunnel stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        shutdown(0, None)


if __name__ == "__main__":
    main()
