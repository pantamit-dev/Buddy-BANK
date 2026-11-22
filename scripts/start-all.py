"""All-in-One Runner for Bank Buddy.
Launches:
1. OpenThai 2.1 OCR Service (Port 8001)
2. Cloudflare Tunnel (Quick Tunnel: *.trycloudflare.com)
3. Auto-registers public URL to Supabase system_settings with Live Reconnect Monitoring
4. Next.js Web App (npm run dev / npm start)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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


def find_cloudflared_binary() -> str | None:
    """Finds cloudflared executable in PATH, standard Windows install directories, or project root."""
    in_path = shutil.which("cloudflared")
    if in_path:
        return in_path

    candidates: list[Path] = [
        ROOT_DIR / ("cloudflared.exe" if sys.platform == "win32" else "cloudflared"),
        Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "cloudflared" / "cloudflared.exe",
        Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "cloudflared" / "cloudflared.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "cloudflared.exe",
    ]

    for p in candidates:
        if p.is_file():
            return str(p)
    return None


def update_supabase_registry(supabase_url: str, service_key: str, ocr_endpoint: str) -> bool:
    """Upserts the active OCR endpoint into Supabase system_settings."""
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
        print(f"[CloudflareSync] Warning: Failed to sync with Supabase: {e}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Bank Buddy All-in-One Runner (Cloudflare Tunnel)")
    parser.add_argument("--prod", action="store_true", help="Run 'npm start' instead of 'npm run dev'")
    parser.add_argument("--skip-app", action="store_true", help="Skip starting the Next.js app")
    args = parser.parse_args()

    env = load_env()
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    python_exec = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable
    port = int(env.get("OPENTHAI_PORT", "8001"))

    print("\n========================================================")
    print("   Bank Buddy — Complete System Runner (Cloudflare)")
    print("========================================================\n")

    # 1. Start OpenThai OCR Server
    print(f"[1/4] Starting OpenThai OCR Server on port {port}...")
    server_proc = subprocess.Popen(
        [python_exec, str(SERVER_SCRIPT), "--port", str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    # 2. Locate and Start Cloudflare Tunnel
    cloudflared_bin = find_cloudflared_binary()
    if not cloudflared_bin:
        print("\n[ERROR] 'cloudflared' command not found!", file=sys.stderr)
        print("Please install Cloudflare Tunnel using winget:", file=sys.stderr)
        print("   winget install Cloudflare.cloudflared -e\n", file=sys.stderr)
        server_proc.terminate()
        sys.exit(1)

    print(f"[2/4] Starting Cloudflare Quick Tunnel for port {port}...")
    print(f"      Binary: {cloudflared_bin}")

    tunnel_cmd = [cloudflared_bin, "tunnel", "--url", f"http://127.0.0.1:{port}"]
    tunnel_proc = subprocess.Popen(
        tunnel_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    # State tracking for dynamic reconnection
    state = {
        "current_url": None,
        "initial_event": threading.Event(),
        "is_running": True,
    }

    pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    def tunnel_monitor() -> None:
        """Background thread monitoring cloudflared output for initial connection and reconnects."""
        if not tunnel_proc or not tunnel_proc.stdout:
            return

        for line in tunnel_proc.stdout:
            if not state["is_running"]:
                break
            match = pattern.search(line)
            if match:
                url = match.group(0)
                if url != state["current_url"]:
                    state["current_url"] = url
                    ocr_endpoint = f"{url}/ocr"
                    print(f"\n[Cloudflare] Detected Tunnel URL : {url}")
                    print(f"[Cloudflare] Active OCR Endpoint : {ocr_endpoint}")

                    # Automatically synchronize to Supabase
                    if supabase_url and service_key:
                        ok = update_supabase_registry(supabase_url, service_key, ocr_endpoint)
                        if ok:
                            print("[Cloudflare] [OK] Auto-synced to Supabase system_settings! Vercel is live.\n")
                        else:
                            print("[Cloudflare] [WARNING] Supabase sync failed.\n")
                    state["initial_event"].set()

    monitor_thread = threading.Thread(target=tunnel_monitor, daemon=True)
    monitor_thread.start()

    # Wait up to 25 seconds for the initial tunnel URL
    print("      Connecting to Cloudflare edge...")
    got_url = state["initial_event"].wait(timeout=25.0)

    if not got_url:
        print("[Cloudflare] Warning: Could not detect initial tunnel URL within 25s. Continuing...")
    else:
        print("[3/4] Service Discovery & Supabase Registry Ready.")

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
        state["is_running"] = False
        print("\n[Shutdown] Stopping all services...")
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
            if tunnel_proc and tunnel_proc.poll() is not None:
                print("[All-in-One] Cloudflare tunnel stopped.")
                break
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
