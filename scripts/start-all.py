"""All-in-One Runner for Bank Buddy.
Launches:
1. OpenThai 2.1 OCR Service (Port 8001)
2. ngrok Tunnel (or Cloudflare Tunnel)
3. Auto-registers public URL to Supabase system_settings
4. Next.js Web App (npm run dev / npm start)
"""
from __future__ import annotations

import argparse
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
NGROK_EXE = ROOT_DIR / "ngrok.exe" if sys.platform == "win32" else ROOT_DIR / "ngrok"


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
        print(f"[All-in-One] Warning: Failed to sync with Supabase: {e}", file=sys.stderr)
        return False


def get_ngrok_url(timeout_secs: int = 15) -> str | None:
    api_url = "http://127.0.0.1:4040/api/tunnels"
    deadline = time.time() + timeout_secs
    while time.time() < deadline:
        try:
            req = urllib.request.Request(api_url)
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                tunnels = data.get("tunnels", [])
                for t in tunnels:
                    pub = t.get("public_url", "")
                    if pub.startswith("https://"):
                        return pub
                    if pub.startswith("http://"):
                        return pub
        except Exception:
            pass
        time.sleep(0.5)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Bank Buddy All-in-One Runner")
    parser.add_argument("--prod", action="store_true", help="Run 'npm start' instead of 'npm run dev'")
    parser.add_argument("--skip-app", action="store_true", help="Skip starting the Next.js app")
    args = parser.parse_args()

    env = load_env()
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    python_exec = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable
    port = int(env.get("OPENTHAI_PORT", "8001"))

    print("\n========================================================")
    print("   Bank Buddy — Complete System All-in-One Runner")
    print("========================================================\n")

    # 1. Start OpenThai OCR Server
    print(f"[1/4] Starting OpenThai OCR Server on port {port}...")
    server_proc = subprocess.Popen(
        [python_exec, str(SERVER_SCRIPT), "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    # 2. Determine and Start Tunnel (ngrok preferred if present, else cloudflared)
    tunnel_proc = None
    tunnel_url = None

    if NGROK_EXE.is_file():
        print(f"[2/4] Starting ngrok Tunnel for port {port} (using {NGROK_EXE.name})...")
        tunnel_proc = subprocess.Popen(
            [str(NGROK_EXE), "http", str(port)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        tunnel_url = get_ngrok_url()
    else:
        print(f"[2/4] ngrok.exe not found in root, attempting cloudflared...")
        try:
            tunnel_proc = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
            assert tunnel_proc.stdout is not None
            for line in tunnel_proc.stdout:
                m = pattern.search(line)
                if m:
                    tunnel_url = m.group(0)
                    break
        except FileNotFoundError:
            print("[All-in-One] Neither ngrok.exe nor cloudflared was found.", file=sys.stderr)

    if tunnel_url:
        ocr_endpoint = f"{tunnel_url}/ocr"
        print(f"      -> Public Tunnel URL: {tunnel_url}")
        print(f"      -> OCR API Endpoint : {ocr_endpoint}")

        # 3. Auto-sync to Supabase
        print("[3/4] Registering URL to Supabase system_settings...")
        if supabase_url and service_key:
            ok = update_supabase_registry(supabase_url, service_key, ocr_endpoint)
            if ok:
                print("      [OK] Successfully synchronized! Vercel is immediately live.")
            else:
                print("      [WARNING] Supabase sync returned error.")
        else:
            print("      [SKIP] Supabase credentials not found in environment.")
    else:
        print("[2/4] Warning: Tunnel URL not established. Running local-only mode.")

    # 4. Start Next.js App
    app_proc = None
    if not args.skip_app:
        app_cmd = ["npm", "start"] if args.prod else ["npm", "run", "dev"]
        shell_val = sys.platform == "win32"
        mode_str = "production (npm start)" if args.prod else "development (npm run dev)"
        print(f"[4/4] Starting Next.js App in {mode_str}...")
        app_proc = subprocess.Popen(app_cmd, shell=shell_val)

    print("\n--------------------------------------------------------")
    print("  All systems active! Press Ctrl+C to stop all services.")
    print("--------------------------------------------------------\n")

    def shutdown(signum: int = 0, frame: Any = None) -> None:
        print("\n[All-in-One] Stopping all services...")
        for proc in [app_proc, tunnel_proc, server_proc]:
            if proc:
                try:
                    proc.terminate()
                except Exception:
                    pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(1)
            if server_proc.poll() is not None:
                print("[All-in-One] OCR server stopped.")
                break
            if app_proc and app_proc.poll() is not None:
                print("[All-in-One] Next.js app stopped.")
                break
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
