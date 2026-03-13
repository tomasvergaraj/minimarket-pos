"""
Manage backend auto-start on Windows using Task Scheduler.

This replaces the old NSSM-based flow with a built-in Windows mechanism,
so the backend can start automatically without external dependencies.
"""
from __future__ import annotations

import argparse
import ctypes
import subprocess
import sys
from pathlib import Path


TASK_NAME = "MiniMarketPOS-Server"
SERVER_DIR = Path(__file__).resolve().parent
LAUNCHER_PATH = SERVER_DIR / "start-service.cmd"
VENV_PYTHON = SERVER_DIR / "venv" / "Scripts" / "python.exe"


def is_windows() -> bool:
    return sys.platform == "win32"


def is_admin() -> bool:
    if not is_windows():
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def run_command(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"> {' '.join(args)}")
    return subprocess.run(args, text=True, check=check, capture_output=False)


def task_command() -> str:
    return f'cmd.exe /d /c "{LAUNCHER_PATH}"'


def ensure_windows() -> None:
    if not is_windows():
        raise SystemExit("This installer only supports Windows.")


def ensure_admin() -> None:
    if not is_admin():
        raise SystemExit("Run this command from an Administrator terminal.")


def ensure_paths() -> None:
    missing: list[str] = []
    if not LAUNCHER_PATH.exists():
        missing.append(str(LAUNCHER_PATH))
    if not VENV_PYTHON.exists():
        missing.append(str(VENV_PYTHON))

    if missing:
        raise SystemExit(
            "Missing required files:\n"
            + "\n".join(f"- {path}" for path in missing)
            + "\nInstall the backend first and create the virtual environment."
        )


def install_task() -> None:
    ensure_paths()
    run_command(
        [
            "schtasks",
            "/Create",
            "/F",
            "/SC",
            "ONSTART",
            "/RL",
            "HIGHEST",
            "/RU",
            "SYSTEM",
            "/TN",
            TASK_NAME,
            "/TR",
            task_command(),
        ]
    )
    start_task()
    print(f"\nStartup task '{TASK_NAME}' installed.")
    print("API will start automatically on Windows boot.")


def uninstall_task() -> None:
    stop_task(ignore_errors=True)
    run_command(["schtasks", "/Delete", "/F", "/TN", TASK_NAME])
    print(f"\nStartup task '{TASK_NAME}' removed.")


def start_task() -> None:
    run_command(["schtasks", "/Run", "/TN", TASK_NAME])
    print(f"\nTask '{TASK_NAME}' started.")


def stop_task(ignore_errors: bool = False) -> None:
    run_command(["schtasks", "/End", "/TN", TASK_NAME], check=not ignore_errors)
    if not ignore_errors:
        print(f"\nTask '{TASK_NAME}' stopped.")


def restart_task() -> None:
    stop_task(ignore_errors=True)
    start_task()


def status_task() -> None:
    run_command(["schtasks", "/Query", "/TN", TASK_NAME, "/V", "/FO", "LIST"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage Nexo backend auto-start.")
    parser.add_argument(
        "command",
        nargs="?",
        default="install",
        choices=["install", "uninstall", "start", "stop", "restart", "status"],
        help="Action to execute. Defaults to 'install'.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_windows()
    ensure_admin()

    actions = {
        "install": install_task,
        "uninstall": uninstall_task,
        "start": start_task,
        "stop": stop_task,
        "restart": restart_task,
        "status": status_task,
    }
    actions[args.command]()


if __name__ == "__main__":
    main()
