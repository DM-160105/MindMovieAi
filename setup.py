import os
import subprocess
import sys
import platform
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
VENV_DIR = os.path.join(ROOT_DIR, ".venv")

def run_command(command, cwd=None, ignore_errors=False):
    """Run a shell command and print the output."""
    print(f"\n> {' '.join(command) if isinstance(command, list) else command}")
    try:
        subprocess.run(command, cwd=cwd, check=True, shell=isinstance(command, str))
    except subprocess.CalledProcessError as e:
        if not ignore_errors:
            print(f"❌ Error executing command: {e}")
            sys.exit(1)
        else:
            print(f"⚠️ Command failed but ignoring error: {e}")

def kill_ports():
    """Kill any stuck processes on the required ports to prevent Address in Use errors."""
    print("\n🧹 1/5: Cleaning up any old processes on ports 8000 and 5173...")
    if platform.system() == "Windows":
        # Windows approach
        run_command("FOR /F \"tokens=5\" %a in ('netstat -aon ^| find \":8000\" ^| find \"LISTENING\"') do taskkill /f /pid %a", ignore_errors=True)
        run_command("FOR /F \"tokens=5\" %a in ('netstat -aon ^| find \":5173\" ^| find \"LISTENING\"') do taskkill /f /pid %a", ignore_errors=True)
    else:
        # macOS / Linux approach
        run_command("kill -9 $(lsof -t -i:8000 -i:5173) 2>/dev/null || true", ignore_errors=True)

def setup_virtualenv():
    """Create a fresh Python virtual environment to avoid macOS code signature binary issues."""
    print("\n🐍 2/5: Setting up a fresh Python Virtual Environment...")
    if os.path.exists(VENV_DIR):
        print("🗑️ Removing old or invalid virtual environment...")
        shutil.rmtree(VENV_DIR)
        
    print("✨ Creating new .venv...")
    run_command([sys.executable, "-m", "venv", ".venv"])

def install_backend_dependencies():
    """Install requirements.txt including missing faiss & urllib3 warning fixes."""
    print("\n📦 3/5: Installing robust backend dependencies...")
    
    # Path to pip inside the virtual environment
    if platform.system() == "Windows":
        pip_exe = os.path.join(VENV_DIR, "Scripts", "pip")
    else:
        pip_exe = os.path.join(VENV_DIR, "bin", "pip")
        
    run_command([pip_exe, "install", "--upgrade", "pip"])
    run_command([pip_exe, "install", "-r", "backend/requirements.txt"])

def install_frontend_dependencies():
    """Run bun install to pull all React/vite JavaScript dependencies."""
    print("\n🌐 4/5: Installing frontend UI dependencies using Bun...")
    if not os.path.exists(FRONTEND_DIR):
        print("❌ Could not find frontend directory!")
        sys.exit(1)
        
    # Check if bun is installed
    try:
        subprocess.run(["bun", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        run_command(["bun", "install"], cwd=FRONTEND_DIR)
    except FileNotFoundError:
        print("⚠️ Bun is not installed globally! Falling back to npm...")
        run_command(["npm", "install"], cwd=FRONTEND_DIR)

def main():
    print("====================================")
    print("🚀 Movie Recommender System Setup 🚀")
    print("====================================")
    
    kill_ports()
    setup_virtualenv()
    install_backend_dependencies()
    install_frontend_dependencies()
    
    print("\n====================================")
    print("✅ Setup Complete! All errors resolved.")
    print("▶️  You can now start the application by running:")
    print("   python run.py")
    print("====================================\n")

if __name__ == "__main__":
    main()
