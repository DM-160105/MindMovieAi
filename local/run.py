#!/usr/bin/env python3
"""
run.py — Mind Movie AI: Clone-and-Run Launcher
================================================
One command to set up and run the entire project locally.

  git clone <repo>
  cd Movie-Recommender-System-Using-Machine-Learning-master
  python3 local/run.py

This script will automatically:
  1. Verify prerequisites (Python ≥3.9, Node.js ≥18)
  2. Create a virtual environment and install Python dependencies
  3. Prompt for environment variables (MongoDB URI, TMDB key, etc.)
  4. Download ML artifacts from Hugging Face if missing
  5. Install frontend Node.js dependencies
  6. Start the FastAPI backend + Next.js frontend
  7. Stream logs from both servers in a single terminal
"""

import subprocess
import sys
import os
import signal
import time
import threading
import shutil
import platform
import re
from pathlib import Path
from typing import List, Optional

# ── Resolve project paths ────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent          # local/
ROOT_DIR     = SCRIPT_DIR.parent                        # project root
FRONTEND_DIR = ROOT_DIR / "frontend"
BACKEND_DIR  = ROOT_DIR / "backend"
VENV_DIR     = ROOT_DIR / ".venv"

BACKEND_PORT  = 8000
FRONTEND_PORT = 3000


# ══════════════════════════════════════════════════════════════════════════════
# ── Terminal UI ───────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class C:
    """ANSI color codes."""
    GREEN  = "\033[38;5;82m"
    CYAN   = "\033[38;5;45m"
    YELLOW = "\033[38;5;226m"
    RED    = "\033[38;5;196m"
    DIM    = "\033[2m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"
    MAGENTA = "\033[38;5;213m"


def log(msg: str, icon: str = "ℹ️ ", color: str = C.CYAN):
    print(f"{color}{icon} {msg}{C.RESET}")


def log_ok(msg: str):
    log(msg, "✅", C.GREEN)


def log_warn(msg: str):
    log(msg, "⚠️ ", C.YELLOW)


def log_err(msg: str):
    log(msg, "❌", C.RED)


def log_step(step: int, total: int, msg: str):
    bar = f"[{step}/{total}]"
    print(f"\n{C.BOLD}{C.MAGENTA}{'━' * 60}")
    print(f"  {bar}  {msg}")
    print(f"{'━' * 60}{C.RESET}\n")


def banner():
    print(f"""
{C.BOLD}{C.CYAN}
  ╔══════════════════════════════════════════════════════════╗
  ║           🎬  MIND MOVIE AI — LOCAL DEV SETUP            ║
  ║                                                          ║
  ║    Clone → Run → Everything Just Works™                  ║
  ╚══════════════════════════════════════════════════════════╝
{C.RESET}""")


# ══════════════════════════════════════════════════════════════════════════════
# ── Process Management ────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

active_processes: List[subprocess.Popen] = []


def cleanup(signum=None, frame=None):
    """Gracefully terminate all child processes."""
    print(f"\n{C.RED}🛑 Shutting down servers...{C.RESET}")
    for proc in active_processes:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    print(f"{C.YELLOW}👋 Goodbye!{C.RESET}")
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)


# ══════════════════════════════════════════════════════════════════════════════
# ── Utility Helpers ───────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def run_quiet(cmd: list, cwd: Optional[str] = None, env=None) -> subprocess.CompletedProcess:
    """Run a command quietly, only showing output on failure."""
    result = subprocess.run(
        cmd, cwd=cwd, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if result.returncode != 0:
        log_err(f"Command failed: {' '.join(str(c) for c in cmd)}")
        print(result.stdout[-2000:] if result.stdout else "")
    return result


def get_cmd_version(cmd: str) -> Optional[str]:
    """Get version string from a command (e.g., 'python3 --version')."""
    try:
        result = subprocess.run(
            [cmd, "--version"], capture_output=True, text=True, timeout=10,
        )
        return result.stdout.strip() or result.stderr.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def get_python_exe() -> str:
    """Return the virtual environment Python if it exists, else system."""
    if platform.system() == "Windows":
        venv_py = VENV_DIR / "Scripts" / "python.exe"
    else:
        venv_py = VENV_DIR / "bin" / "python"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable


def kill_ports():
    """Free up ports 8000 and 3000 if something is stuck on them."""
    ports = [BACKEND_PORT, FRONTEND_PORT]
    if platform.system() == "Windows":
        for port in ports:
            try:
                subprocess.run(
                    f'FOR /F "tokens=5" %a in (\'netstat -aon ^| find ":{port}" ^| find "LISTENING"\') do taskkill /f /pid %a',
                    shell=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                )
            except Exception:
                pass
    else:
        port_flags = " ".join(f"-i:{p}" for p in ports)
        try:
            subprocess.run(
                f"kill -9 $(lsof -t {port_flags}) 2>/dev/null || true",
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass


def stream_logs(proc: subprocess.Popen, prefix: str, color: str):
    """Stream stdout from a subprocess with a colored prefix."""
    try:
        if proc.stdout:
            for line in iter(proc.stdout.readline, ""):
                if line:
                    print(f"{color}[{prefix}]{C.RESET} {line}", end="")
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 1: Prerequisites Check ──────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def check_prerequisites():
    """Verify Python ≥3.9 and Node.js ≥18 are available."""
    log_step(1, 7, "Checking Prerequisites")

    # Python version
    py_ver = sys.version_info
    if py_ver < (3, 9):
        log_err(f"Python 3.9+ required, found {py_ver.major}.{py_ver.minor}")
        log("Install from https://www.python.org/downloads/", "💡", C.YELLOW)
        sys.exit(1)
    log_ok(f"Python {py_ver.major}.{py_ver.minor}.{py_ver.micro}")

    # Node.js
    node_ver_str = get_cmd_version("node")
    if not node_ver_str:
        log_err("Node.js not found. Install from https://nodejs.org/ (v18+)")
        sys.exit(1)
    match = re.search(r"v?(\d+)", node_ver_str)
    if match and int(match.group(1)) < 18:
        log_err(f"Node.js 18+ required, found {node_ver_str}")
        sys.exit(1)
    log_ok(f"Node.js {node_ver_str}")

    # npm or bun
    pkg_manager = "bun" if shutil.which("bun") else "npm"
    pm_ver = get_cmd_version(pkg_manager)
    log_ok(f"Package manager: {pkg_manager} ({pm_ver})")

    return pkg_manager


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 2: Virtual Environment & Python Dependencies ─────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def setup_python_env():
    """Create venv and install backend Python dependencies."""
    log_step(2, 7, "Setting Up Python Environment")

    py_exe = get_python_exe()

    # Create venv if needed
    if not VENV_DIR.exists():
        log("Creating virtual environment at .venv/...", "🐍", C.GREEN)
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        py_exe = get_python_exe()
        log_ok("Virtual environment created")
    else:
        log_ok("Virtual environment already exists")

    # Upgrade pip quietly
    log("Upgrading pip...", "📦", C.DIM)
    run_quiet([py_exe, "-m", "pip", "install", "--upgrade", "pip"])

    # Install backend dependencies
    req_file = BACKEND_DIR / "requirements.txt"
    if req_file.exists():
        log("Installing Python dependencies (this may take a few minutes on first run)...", "📦", C.GREEN)
        result = run_quiet([
            py_exe, "-m", "pip", "install", "-r", str(req_file),
            "--disable-pip-version-check",
        ])
        if result.returncode != 0:
            log_err("Failed to install Python dependencies. See output above.")
            sys.exit(1)
        log_ok("Python dependencies installed")
    else:
        log_warn(f"requirements.txt not found at {req_file}")

    return py_exe


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 3: Environment Variables (Interactive Prompt) ────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def prompt_env_var(name: str, description: str, default: str = "", secret: bool = False) -> str:
    """Prompt the user for an environment variable value."""
    if default:
        hint = f"{C.DIM}(press Enter for default){C.RESET}"
    else:
        hint = f"{C.DIM}(press Enter to skip){C.RESET}"

    prompt_text = f"  {C.CYAN}{name}{C.RESET} — {description}\n  {hint}: "
    value = input(prompt_text).strip()
    return value if value else default


def setup_env_files():
    """Create backend/.env and frontend/.env.local with interactive prompts."""
    log_step(3, 7, "Configuring Environment Variables")

    backend_env = BACKEND_DIR / ".env"
    frontend_env = FRONTEND_DIR / ".env.local"

    # ── Backend .env ─────────────────────────────────────────────────────────
    if backend_env.exists():
        log_ok("backend/.env already exists — skipping")
    else:
        print(f"\n{C.BOLD}  Backend needs a few config values to run properly.{C.RESET}")
        print(f"  {C.DIM}Press Enter to skip any — the app will start but some features may not work.{C.RESET}\n")

        mongodb_uri = prompt_env_var(
            "MONGODB_URI",
            "MongoDB connection string (Atlas or local)",
            default="mongodb://localhost:27017/mindmovieai",
        )

        jwt_secret = prompt_env_var(
            "JWT_SECRET_KEY",
            "Secret key for JWT tokens",
            default="dev_secret_key_change_in_production_" + str(int(time.time())),
            secret=True,
        )

        tmdb_key = prompt_env_var(
            "TMDB_API_KEY",
            "TMDB API key for movie posters (free at themoviedb.org)",
            default="8265bd1679663a7ea12ac168da84d2e8",
        )

        hf_token = prompt_env_var(
            "HF_TOKEN",
            "Hugging Face token for dataset downloads (huggingface.co/settings/tokens)",
            default="",
        )

        google_client_id = prompt_env_var(
            "GOOGLE_CLIENT_ID",
            "Google OAuth Client ID (optional, for Google Sign-In)",
            default="",
        )

        env_content = f"""# Backend Environment Variables — Auto-generated by local/run.py
# Edit this file to update your configuration.

# ─── Database (MongoDB Atlas or local) ────────────────────────────────────────
MONGODB_URI={mongodb_uri}

# ─── Authentication ───────────────────────────────────────────────────────────
JWT_SECRET_KEY={jwt_secret}

# ─── External APIs ────────────────────────────────────────────────────────────
TMDB_API_KEY={tmdb_key}

# ─── CORS / Frontend ─────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:{FRONTEND_PORT}

# ─── Hugging Face Dataset ────────────────────────────────────────────────────
HUGGINGFACE_DATASET_REPO=dev1601/MindMovieAi
HF_TOKEN={hf_token}

# ─── Email / SMTP (optional — OTP verification) ──────────────────────────────
# SMTP_SERVER=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASSWORD=your_app_password

# ─── Google OAuth (optional) ─────────────────────────────────────────────────
GOOGLE_CLIENT_ID={google_client_id}
"""
        backend_env.write_text(env_content)
        log_ok("Created backend/.env")

        # Show warnings for missing critical values
        if "localhost" in mongodb_uri:
            log_warn("Using local MongoDB — make sure mongod is running, or switch to Atlas.")
        if not hf_token:
            log_warn("No HF_TOKEN — ML artifacts must be present locally (backend/artifacts/).")

    # ── Frontend .env.local ──────────────────────────────────────────────────
    if frontend_env.exists():
        log_ok("frontend/.env.local already exists — skipping")
    else:
        # Read Google Client ID from backend env if we just created it
        google_id = ""
        if backend_env.exists():
            for line in backend_env.read_text().splitlines():
                if line.startswith("GOOGLE_CLIENT_ID=") and "=" in line:
                    google_id = line.split("=", 1)[1].strip()

        frontend_content = f"""# Frontend Environment Variables — Auto-generated by local/run.py

# ─── Backend API URL ──────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:{BACKEND_PORT}

# ─── Google OAuth (optional) ─────────────────────────────────────────────────
NEXT_PUBLIC_GOOGLE_CLIENT_ID={google_id}
"""
        frontend_env.write_text(frontend_content)
        log_ok("Created frontend/.env.local")


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 4: Download ML Artifacts ─────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def download_artifacts(py_exe: str):
    """Download ML artifacts from Hugging Face if not present locally."""
    log_step(4, 7, "Checking ML Artifacts")

    artifacts_dir = BACKEND_DIR / "artifacts"
    artifacts_dir.mkdir(exist_ok=True)

    required_artifacts = ["movie_dict.pkl", "movies.index"]
    missing = [f for f in required_artifacts if not (artifacts_dir / f).exists()]

    if not missing:
        log_ok("All ML artifacts present")
        return

    log(f"Missing artifacts: {', '.join(missing)}", "📥", C.YELLOW)
    log("Attempting to download from Hugging Face...", "🤗", C.CYAN)

    # Use the backend's hf_utils to download
    download_script = f"""
import sys, os
sys.path.insert(0, '{BACKEND_DIR}')
os.chdir('{BACKEND_DIR}')
from hf_utils import get_artifact_file
for name in {missing!r}:
    try:
        path = get_artifact_file(name)
        print(f"  ✅ {{name}} → {{path}}")
    except Exception as e:
        print(f"  ⚠️  {{name}} — {{e}}")
"""
    result = subprocess.run(
        [py_exe, "-c", download_script],
        cwd=str(BACKEND_DIR), capture_output=True, text=True,
    )
    print(result.stdout)
    if result.stderr:
        # Only show non-warning stderr
        for line in result.stderr.splitlines():
            if "warning" not in line.lower():
                print(f"  {C.DIM}{line}{C.RESET}")

    # Verify
    still_missing = [f for f in required_artifacts if not (artifacts_dir / f).exists()]
    if still_missing:
        log_warn(f"Could not download: {', '.join(still_missing)}")
        log_warn("Set HF_TOKEN in backend/.env or run local/generate_artifacts.py to build them.")
    else:
        log_ok("All ML artifacts ready")


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 5: Ensure Data Directories ──────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def ensure_data_dirs():
    """Create data directories the backend expects."""
    log_step(5, 7, "Preparing Data Directories")

    dirs = [
        BACKEND_DIR / "artifacts",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

    log_ok("Data directories ready")


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 6: Frontend Dependencies ─────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def setup_frontend(pkg_manager: str):
    """Install frontend Node.js dependencies."""
    log_step(6, 7, "Setting Up Frontend")

    node_modules = FRONTEND_DIR / "node_modules"
    if node_modules.exists() and any(node_modules.iterdir()):
        log_ok("Frontend dependencies already installed")
        return

    log(f"Installing frontend dependencies with {pkg_manager}...", "📦", C.CYAN)
    result = run_quiet([pkg_manager, "install"], cwd=str(FRONTEND_DIR))
    if result.returncode != 0:
        log_err(f"Frontend install failed. Try running '{pkg_manager} install' in frontend/ manually.")
        sys.exit(1)
    log_ok("Frontend dependencies installed")


# ══════════════════════════════════════════════════════════════════════════════
# ── Step 7: Launch Servers ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def launch_servers(py_exe: str, pkg_manager: str):
    """Start backend and frontend servers."""
    log_step(7, 7, "Launching Servers")

    kill_ports()

    # ── Backend ──────────────────────────────────────────────────────────────
    log(f"Starting Backend (FastAPI) on port {BACKEND_PORT}...", "🚀", C.GREEN)
    backend_proc = subprocess.Popen(
        [py_exe, "-m", "uvicorn", "api:app",
         "--host", "0.0.0.0",
         "--port", str(BACKEND_PORT),
         "--reload"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    active_processes.append(backend_proc)
    threading.Thread(
        target=stream_logs, args=(backend_proc, "API ", C.GREEN), daemon=True,
    ).start()

    # Wait for backend to start
    time.sleep(2)

    # ── Frontend ─────────────────────────────────────────────────────────────
    log(f"Starting Frontend (Next.js) on port {FRONTEND_PORT}...", "🚀", C.CYAN)
    frontend_proc = subprocess.Popen(
        [pkg_manager, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    active_processes.append(frontend_proc)
    threading.Thread(
        target=stream_logs, args=(frontend_proc, "NEXT", C.CYAN), daemon=True,
    ).start()

    # ── Ready Banner ─────────────────────────────────────────────────────────
    time.sleep(1)
    print(f"""
{C.BOLD}{C.GREEN}
  ╔══════════════════════════════════════════════════════════╗
  ║               🎬  SERVERS ARE RUNNING!                   ║
  ║                                                          ║
  ║    Backend  → {C.CYAN}http://localhost:{BACKEND_PORT}{C.GREEN}                   ║
  ║    Frontend → {C.CYAN}http://localhost:{FRONTEND_PORT}{C.GREEN}                   ║
  ║                                                          ║
  ║    Press {C.YELLOW}Ctrl+C{C.GREEN} to stop both servers                  ║
  ╚══════════════════════════════════════════════════════════╝
{C.RESET}""")

    # ── Watchdog Loop ────────────────────────────────────────────────────────
    try:
        while True:
            for proc, name in [(backend_proc, "Backend"), (frontend_proc, "Frontend")]:
                if proc.poll() is not None:
                    log_warn(f"{name} exited with code {proc.returncode}")
                    cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()


# ══════════════════════════════════════════════════════════════════════════════
# ── Main ──────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def main():
    banner()

    # Phase 1: Prerequisites
    pkg_manager = check_prerequisites()

    # Phase 2: Python environment
    py_exe = setup_python_env()

    # Phase 3: Environment variables (interactive)
    setup_env_files()

    # Phase 4: ML artifacts
    download_artifacts(py_exe)

    # Phase 5: Data directories
    ensure_data_dirs()

    # Phase 6: Frontend
    setup_frontend(pkg_manager)

    # Phase 7: Launch
    launch_servers(py_exe, pkg_manager)


if __name__ == "__main__":
    main()
