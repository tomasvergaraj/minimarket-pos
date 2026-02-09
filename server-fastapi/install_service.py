"""
Install FastAPI server as a Windows service using NSSM.
Download NSSM from https://nssm.cc/download and place nssm.exe in PATH.
"""
import subprocess
import sys
import os

SERVICE_NAME = "MiniMarketPOS-Server"
PYTHON_PATH = sys.executable
SCRIPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "run.py")
WORK_DIR = os.path.dirname(os.path.abspath(__file__))


def install():
    print(f"Installing service: {SERVICE_NAME}")
    print(f"Python: {PYTHON_PATH}")
    print(f"Script: {SCRIPT_PATH}")

    cmds = [
        ["nssm", "install", SERVICE_NAME, PYTHON_PATH, SCRIPT_PATH],
        ["nssm", "set", SERVICE_NAME, "AppDirectory", WORK_DIR],
        ["nssm", "set", SERVICE_NAME, "DisplayName", "MiniMarket POS Server"],
        ["nssm", "set", SERVICE_NAME, "Description", "FastAPI server for MiniMarket POS"],
        ["nssm", "set", SERVICE_NAME, "Start", "SERVICE_AUTO_START"],
        ["nssm", "start", SERVICE_NAME],
    ]

    for cmd in cmds:
        print(f"  > {' '.join(cmd)}")
        subprocess.run(cmd, check=True)

    print(f"\nService '{SERVICE_NAME}' installed and started.")
    print(f"API available at http://0.0.0.0:8000")


def uninstall():
    subprocess.run(["nssm", "stop", SERVICE_NAME], check=False)
    subprocess.run(["nssm", "remove", SERVICE_NAME, "confirm"], check=True)
    print(f"Service '{SERVICE_NAME}' removed.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "uninstall":
        uninstall()
    else:
        install()
