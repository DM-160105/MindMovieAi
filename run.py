"""
run.py — Start both the FastAPI backend and Next.js frontend
with a single command:  python3 run.py

  Backend  → http://localhost:8000
  Frontend → http://localhost:3000
"""

import subprocess
import sys
import os
import signal
import time
import threading
import shutil

ROOT_DIR    = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

# ── ANSI colour helpers ──────────────────────────────────────────────────────
GREEN  = "\033[92m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def banner():
    print(f"""
{BOLD}{CYAN}
  ╔══════════════════════════════════════════════╗
  ║        🎬  Mind Movie Ai  — Dev Launcher         ║
  ║  Backend  → http://localhost:8000            ║
  ║  Frontend → http://localhost:3000            ║
  ╚══════════════════════════════════════════════╝
{RESET}""")

# ── Process registry ─────────────────────────────────────────────────────────
processes: list[subprocess.Popen] = []

def cleanup(signum=None, frame=None):
    """Gracefully terminate all child processes."""
    print(f"\n{RED}🛑 Shutting down both servers…{RESET}")
    for proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    print(f"{YELLOW}👋 Bye!{RESET}")
    sys.exit(0)

signal.signal(signal.SIGINT,  cleanup)
signal.signal(signal.SIGTERM, cleanup)

# ── Streaming log thread ─────────────────────────────────────────────────────
def stream_output(proc: subprocess.Popen, prefix: str, colour: str):
    """Stream stdout+stderr from a subprocess with a coloured prefix."""
    for line in proc.stdout:              # type: ignore[union-attr]
        print(f"{colour}[{prefix}]{RESET} {line}", end="")
    # Stream stderr too (when combined this won't trigger, but kept for safety)

# ── Dependency checks ────────────────────────────────────────────────────────
def check_tools():
    """Ensure essential tools are available."""
    if shutil.which("bun") is None:
        print(f"{YELLOW}⚠️  Bun not found. It's recommended for faster JS execution.{RESET}")
        print(f"{YELLOW}   Falling back to npm...{RESET}")
        if shutil.which("node") is None or shutil.which("npm") is None:
            print(f"{RED}✗ Node.js and npm are not installed. Install from https://nodejs.org or install bun.{RESET}")
            sys.exit(1)

def ensure_backend_deps(python_exe: str):
    """Run pip install on requirements.txt to catch any missing dependencies quickly."""
    print(f"{CYAN}🐍 Checking backend dependencies...{RESET}")
    result = subprocess.run(
        [python_exe, "-m", "pip", "install", "-r", "backend/requirements.txt", "--disable-pip-version-check"],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL, # Hide noisy pip output unless it fails
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0:
        print(f"{RED}✗ Backend dependency install failed!{RESET}")
        print(result.stderr)
        sys.exit(1)
    print(f"{GREEN}✓ Backend dependencies satisfied{RESET}")

def ensure_frontend_deps():
    """Run `bun install` or `npm install`."""
    nm = os.path.join(FRONTEND_DIR, "node_modules")
    if shutil.which("bun") is not None:
        cmd = ["bun", "install"]
    else:
        cmd = ["npm", "install"]
        
    print(f"{CYAN}📦 Checking frontend dependencies...{RESET}")
    result = subprocess.run(cmd, cwd=FRONTEND_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode != 0:
        print(f"{RED}✗ Frontend install failed{RESET}")
        sys.exit(1)
    print(f"{GREEN}✓ Frontend dependencies satisfied{RESET}")

# ── Resolve Python executable ────────────────────────────────────────────────
def resolve_python() -> str:
    """Return the Python executable — prefer the venv if present."""
    venv_python_unix = os.path.join(ROOT_DIR, ".venv", "bin", "python")
    venv_python_win  = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    if os.path.exists(venv_python_unix):
        return venv_python_unix
    if os.path.exists(venv_python_win):
        return venv_python_win
    return sys.executable

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    banner()

    # Pre-flight checks
    check_tools()
    
    python_exe = resolve_python()
    if not os.path.exists(python_exe):
        print(f"{RED}✗ Virtual environment not fully setup. Running setup...{RESET}")
        subprocess.run([sys.executable, "setup.py"], cwd=ROOT_DIR)
        python_exe = resolve_python()
        
    ensure_backend_deps(python_exe)
    ensure_frontend_deps()

    # ── 1. Backend (FastAPI + Uvicorn) ───────────────────────────────────────
    print(f"{GREEN}🚀 Starting backend   →  http://localhost:8000{RESET}")
    backend = subprocess.Popen(
        [
            python_exe, "-m", "uvicorn", "api:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload",
        ],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    processes.append(backend)
    threading.Thread(target=stream_output, args=(backend, "API ", GREEN), daemon=True).start()

    # Give the backend a moment to bind its port before starting the frontend
    time.sleep(2)

    # ── 2. Frontend (Next.js dev server) ────────────────────────────────────
    print(f"{CYAN}🚀 Starting frontend  →  http://localhost:3000{RESET}")
    frontend_cmd = ["bun", "run", "dev"] if shutil.which("bun") else ["npm", "run", "dev"]
    frontend = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    processes.append(frontend)
    threading.Thread(target=stream_output, args=(frontend, "NEXT", CYAN), daemon=True).start()

    print(f"""
{BOLD}✅  Both servers started!
   Backend  → {GREEN}http://localhost:8000{RESET}{BOLD}
   Frontend → {CYAN}http://localhost:3000{RESET}{BOLD}
   Press {RED}Ctrl+C{RESET}{BOLD} to stop both.{RESET}
""")

    # Keep alive — exit automatically if either process crashes
    try:
        while True:
            for proc, name in [(backend, "Backend"), (frontend, "Frontend")]:
                if proc.poll() is not None:
                    print(f"\n{RED}⚠️  {name} exited with code {proc.returncode}{RESET}")
                    cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
