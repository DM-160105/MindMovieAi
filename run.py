#!/usr/bin/env python3
"""
run.py — The ultimate launcher for Mind Movie Ai
Starts both the FastAPI backend and Next.js frontend with automated lifecycle management.

Usage:
  python3 run.py
"""

import subprocess
import sys
import os
import signal
import time
import threading
import shutil
import platform
from typing import List

# ── Configuration ────────────────────────────────────────────────────────────
ROOT_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR  = os.path.join(ROOT_DIR, "backend")
VENV_DIR     = os.path.join(ROOT_DIR, ".venv")

BACKEND_PORT  = 8000
FRONTEND_PORT = 3000

# ── ANSI Styling ─────────────────────────────────────────────────────────────
class Icons:
    SUCCESS = "✅"
    INFO    = "ℹ️ "
    WARN    = "⚠️ "
    ERROR   = "❌"
    ROCKET  = "🚀"
    CLEAN   = "🧹"
    PYTHON  = "🐍"
    NODE    = "📦"
    SPARK   = "✨"

class Colors:
    GREEN  = "\033[38;5;82m"
    CYAN   = "\033[38;5;45m"
    YELLOW = "\033[38;5;226m"
    RED    = "\033[38;5;196m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    RESET  = "\033[0m"

def log(msg, icon=Icons.INFO, color=Colors.CYAN):
    print(f"{color}{icon} {msg}{Colors.RESET}")

def banner():
    print(f"""
{Colors.BOLD}{Colors.CYAN}
  ╔══════════════════════════════════════════════════════╗
  ║           🎬  MIND MOVIE AI — DEV CONSOLE            ║
  ║                                                      ║
  ║    Backend  → {Colors.GREEN}http://localhost:{BACKEND_PORT}{Colors.CYAN}           ║
  ║    Frontend → {Colors.CYAN}http://localhost:{FRONTEND_PORT}{Colors.CYAN}           ║
  ╚══════════════════════════════════════════════════════╝
{Colors.RESET}""")

# ── Process Registry ─────────────────────────────────────────────────────────
active_processes: List[subprocess.Popen] = []

def cleanup(signum=None, frame=None):
    """Gracefully terminate all child processes."""
    print(f"\n{Colors.RED}🛑 Interruption detected. Shutting down servers...{Colors.RESET}")
    for proc in active_processes:
        try:
            # Try gentle termination first
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    print(f"{Colors.YELLOW}👋 Goodbye!{Colors.RESET}")
    sys.exit(0)

signal.signal(signal.SIGINT,  cleanup)
signal.signal(signal.SIGTERM, cleanup)

# ── Utility Functions ────────────────────────────────────────────────────────
def kill_ports():
    """Clear ports to prevent 'Address already in use' errors."""
    log("Cleaning up stuck processes on ports...", icon=Icons.CLEAN)
    ports = [BACKEND_PORT, FRONTEND_PORT]
    
    if platform.system() == "Windows":
        for port in ports:
            try:
                cmd = f'FOR /F "tokens=5" %a in (\'netstat -aon ^| find ":{port}" ^| find "LISTENING"\') do taskkill /f /pid %a'
                subprocess.run(cmd, shell=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            except: pass
    else:
        # macOS/Linux
        port_list = " ".join([f"-i:{p}" for p in ports])
        try:
            subprocess.run(f"kill -9 $(lsof -t {port_list}) 2>/dev/null || true", shell=True)
        except: pass

def get_python_exe() -> str:
    """Resolve the best Python executable (prefer venv)."""
    if platform.system() == "Windows":
        venv_py = os.path.join(VENV_DIR, "Scripts", "python.exe")
    else:
        venv_py = os.path.join(VENV_DIR, "bin", "python")
        
    if os.path.exists(venv_py):
        return venv_py
    return sys.executable

def stream_logs(proc: subprocess.Popen, prefix: str, color: str):
    """Worker to stream stdout/stderr from a process."""
    try:
        if proc.stdout:
            for line in iter(proc.stdout.readline, ""):
                if line:
                    print(f"{color}[{prefix}]{Colors.RESET} {line}", end="")
    except Exception:
        pass

# ── Environment Setup ────────────────────────────────────────────────────────
def setup_environment():
    """Ensure venv exists and dependencies are up to date."""
    py_exe = get_python_exe()
    
    # 1. Check Venv
    if not os.path.exists(VENV_DIR):
        log("Creating fresh virtual environment...", icon=Icons.SPARK, color=Colors.CYAN)
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
        py_exe = get_python_exe()

    # 2. Update Backend Deps
    log("Checking backend dependencies...", icon=Icons.PYTHON, color=Colors.GREEN)
    
    # Upgrade pip to support PEP 660 editable installs from pyproject.toml
    try:
        subprocess.run([py_exe, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        pass
        
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")
    pyproject_file = os.path.join(ROOT_DIR, "pyproject.toml")
    
    try:
        # Prefer pyproject.toml if user requested, but check requirements.txt for backward compatibility
        if os.path.exists(pyproject_file):
            subprocess.run([py_exe, "-m", "pip", "install", "-e", "."], cwd=ROOT_DIR, 
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
        elif os.path.exists(req_file):
            subprocess.run([py_exe, "-m", "pip", "install", "-r", req_file, "--disable-pip-version-check"], 
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError as e:
        log(f"Dependency install failed: {e.stderr.decode()}", icon=Icons.ERROR, color=Colors.RED)
        sys.exit(1)

    # 3. Update Frontend Deps
    log("Checking frontend dependencies...", icon=Icons.NODE, color=Colors.CYAN)
    manager = "bun" if shutil.which("bun") else "npm"
    try:
        subprocess.run([manager, "install"], cwd=FRONTEND_DIR, 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except subprocess.CalledProcessError:
        log(f"Frontend install failed with {manager}", icon=Icons.ERROR, color=Colors.RED)
        sys.exit(1)

# ── Main Execution ───────────────────────────────────────────────────────────
def main():
    banner()
    
    # Pre-flight
    kill_ports()
    setup_environment()
    
    py_exe = get_python_exe()
    
    # Start Backend
    log(f"Launching Backend (FastAPI)...", icon=Icons.ROCKET, color=Colors.GREEN)
    backend_proc = subprocess.Popen(
        [py_exe, "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT), "--reload"],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    active_processes.append(backend_proc)
    threading.Thread(target=stream_logs, args=(backend_proc, "API ", Colors.GREEN), daemon=True).start()
    
    # Short wait for backend to initialize
    time.sleep(1.5)

    # Start Frontend
    log(f"Launching Frontend (Next.js)...", icon=Icons.ROCKET, color=Colors.CYAN)
    manager = "bun" if shutil.which("bun") else "npm"
    frontend_proc = subprocess.Popen(
        [manager, "run", "dev"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    active_processes.append(frontend_proc)
    threading.Thread(target=stream_logs, args=(frontend_proc, "NEXT", Colors.CYAN), daemon=True).start()

    log("Everything is running! Press Ctrl+C to stop.", icon=Icons.SUCCESS, color=Colors.BOLD + Colors.GREEN)

    # Watchdog loop
    try:
        while True:
            for proc, name in [(backend_proc, "Backend"), (frontend_proc, "Frontend")]:
                if proc.poll() is not None:
                    log(f"{name} exited unexpectedly with code {proc.returncode}", icon=Icons.WARN, color=Colors.RED)
                    cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
