"""
Manage the Nexo backend as a native Windows service.

The backend service hosts the API and serves the built admin web at /admin, so
there is no separate admin-web Windows service in production.
"""
from __future__ import annotations

import argparse
import ctypes
import os
import re
import subprocess
import sys
import time
from pathlib import Path


SERVICE_NAME = "MiniMarketPOS-Server"
SERVICE_DISPLAY_NAME = "Nexo Backend"
SERVICE_DESCRIPTION = "Nexo backend API and bundled admin web."
LEGACY_TASK_NAME = "MiniMarketPOS-Server"
SERVER_DIR = Path(__file__).resolve().parent
ADMIN_INDEX_FILE = SERVER_DIR.parent / "admin-web" / "dist" / "index.html"
VENV_PYTHON = SERVER_DIR / "venv" / "Scripts" / "python.exe"
SERVICE_SOURCE = SERVER_DIR / "NexoBackendServiceHost.cs"
SERVICE_EXE = SERVER_DIR / "NexoBackendService.exe"
SERVICE_LOG_FILE = SERVER_DIR / "logs" / "windows-service-host.log"
CSC_CANDIDATES = (
    Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    Path(r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"),
)
SC_STATE_PATTERN = re.compile(r"(?:STATE|ESTADO)\s*:\s*\d+\s+([A-Z_]+)")


def is_windows() -> bool:
    return sys.platform == "win32"


def is_admin() -> bool:
    if not is_windows():
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def ensure_windows() -> None:
    if not is_windows():
        raise SystemExit("This installer only supports Windows.")


def ensure_admin() -> None:
    if not is_admin():
        raise SystemExit("Run this command from an Administrator terminal.")


def run_command(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check)


def ensure_paths() -> None:
    missing: list[str] = []
    for path in (VENV_PYTHON, SERVER_DIR / "serve.py", SERVICE_SOURCE):
        if not path.exists():
            missing.append(str(path))

    if missing:
        raise SystemExit(
            "Missing required files:\n"
            + "\n".join(f"- {path}" for path in missing)
            + "\nInstall the backend first and ensure the service host source exists."
        )


def locate_csc() -> Path:
    for candidate in CSC_CANDIDATES:
        if candidate.exists():
            return candidate
    raise SystemExit("Could not find the .NET C# compiler (csc.exe) required to build the Windows service host.")


def ensure_service_binary() -> None:
    ensure_paths()
    if SERVICE_EXE.exists() and SERVICE_EXE.stat().st_mtime >= SERVICE_SOURCE.stat().st_mtime:
        return

    compiler = locate_csc()
    SERVICE_EXE.parent.mkdir(parents=True, exist_ok=True)
    args = [
        str(compiler),
        "/nologo",
        "/target:exe",
        "/platform:x64",
        f"/out:{SERVICE_EXE}",
        "/r:System.ServiceProcess.dll",
        str(SERVICE_SOURCE),
    ]
    result = run_command(args, check=False)
    if result.returncode != 0:
        raise SystemExit(
            "Could not compile the Windows service host.\n"
            + (result.stdout or "")
            + (result.stderr or "")
        )


def service_exists() -> bool:
    result = run_command(["sc.exe", "query", SERVICE_NAME], check=False)
    return result.returncode == 0


def wait_for_delete(timeout_seconds: int = 30) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if not service_exists():
            return
        time.sleep(1)
    raise SystemExit(f"Service '{SERVICE_NAME}' was marked for deletion but is still present.")


def query_service_state() -> str | None:
    result = run_command(["sc.exe", "query", SERVICE_NAME], check=False)
    if result.returncode != 0:
        return None

    match = SC_STATE_PATTERN.search(result.stdout)
    return match.group(1) if match else None


def wait_for_state(target_state: str, timeout_seconds: int = 30) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        state = query_service_state()
        if state == target_state:
            return
        time.sleep(1)
    raise SystemExit(
        f"Service '{SERVICE_NAME}' did not reach state '{target_state}' in time. "
        f"Current state: '{query_service_state()}'."
    )


def legacy_task_exists() -> bool:
    result = run_command(["schtasks", "/Query", "/TN", LEGACY_TASK_NAME], check=False)
    return result.returncode == 0


def remove_legacy_task() -> None:
    if not legacy_task_exists():
        return

    result = run_command(["schtasks", "/Delete", "/F", "/TN", LEGACY_TASK_NAME], check=False)
    if result.returncode != 0:
        details = result.stderr.strip() or result.stdout.strip() or "unknown error"
        raise SystemExit(f"Could not remove legacy startup task: {details}")


def create_service() -> None:
    quoted_exe = f'"{SERVICE_EXE}"'
    result = run_command(
        [
            "sc.exe",
            "create",
            SERVICE_NAME,
            "binPath=",
            quoted_exe,
            "start=",
            "auto",
            "DisplayName=",
            SERVICE_DISPLAY_NAME,
        ],
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.stdout.strip() or result.stderr.strip() or "Could not create Windows service.")

    run_command(["sc.exe", "description", SERVICE_NAME, SERVICE_DESCRIPTION], check=False)


def start_service() -> None:
    if not service_exists():
        raise SystemExit(f"Service '{SERVICE_NAME}' is not installed.")

    state = query_service_state()
    if state == "RUNNING":
        print(f"Service '{SERVICE_NAME}' is already running.")
        return

    result = run_command(["sc.exe", "start", SERVICE_NAME], check=False)
    if result.returncode != 0 and "SERVICE_ALREADY_RUNNING" not in result.stdout:
        raise SystemExit(result.stdout.strip() or result.stderr.strip() or "Could not start Windows service.")
    wait_for_state("RUNNING", timeout_seconds=45)
    print(f"Service '{SERVICE_NAME}' started.")


def stop_service(ignore_errors: bool = False) -> None:
    if not service_exists():
        if ignore_errors:
            return
        raise SystemExit(f"Service '{SERVICE_NAME}' is not installed.")

    state = query_service_state()
    if state == "STOPPED":
        if not ignore_errors:
            print(f"Service '{SERVICE_NAME}' is already stopped.")
        return

    result = run_command(["sc.exe", "stop", SERVICE_NAME], check=False)
    if result.returncode != 0 and not ignore_errors:
        raise SystemExit(result.stdout.strip() or result.stderr.strip() or "Could not stop Windows service.")

    try:
        wait_for_state("STOPPED")
    except SystemExit:
        if not ignore_errors:
            raise
    else:
        if not ignore_errors:
            print(f"Service '{SERVICE_NAME}' stopped.")


def restart_service() -> None:
    stop_service(ignore_errors=True)
    start_service()


def install_service() -> None:
    ensure_service_binary()
    remove_legacy_task()

    if service_exists():
        stop_service(ignore_errors=True)
        run_command(["sc.exe", "delete", SERVICE_NAME], check=False)
        wait_for_delete()

    create_service()
    start_service()
    print("Backend will start automatically on Windows boot.")
    print("Admin web is served by this same service at /admin; no separate frontend service is required.")
    if not ADMIN_INDEX_FILE.exists():
        print(
            "Warning: admin-web/dist/index.html was not found. "
            "Build admin-web so the /admin panel is available."
        )


def uninstall_service() -> None:
    stop_service(ignore_errors=True)
    if service_exists():
        run_command(["sc.exe", "delete", SERVICE_NAME], check=False)
        wait_for_delete()
        print(f"Windows service '{SERVICE_NAME}' removed.")
    else:
        print(f"Windows service '{SERVICE_NAME}' is not installed.")

    remove_legacy_task()


def status_service() -> None:
    state = query_service_state()
    if state is None and not service_exists():
        print(f"Service '{SERVICE_NAME}': not installed")
    else:
        print(f"Service '{SERVICE_NAME}': {(state or 'UNKNOWN').lower()}")

    if legacy_task_exists():
        print(f"Legacy startup task '{LEGACY_TASK_NAME}': present")
    else:
        print(f"Legacy startup task '{LEGACY_TASK_NAME}': not present")

    if SERVICE_EXE.exists():
        print(f"Service host: {SERVICE_EXE}")
    else:
        print(f"Service host: missing ({SERVICE_EXE})")

    if ADMIN_INDEX_FILE.exists():
        print(f"Admin web bundle: {ADMIN_INDEX_FILE}")
    else:
        print("Admin web bundle: missing (build admin-web to serve /admin)")

    print(f"Service log: {SERVICE_LOG_FILE}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage the Nexo backend Windows service.")
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
    if args.command != "status":
        ensure_admin()

    actions = {
        "install": install_service,
        "uninstall": uninstall_service,
        "start": start_service,
        "stop": stop_service,
        "restart": restart_service,
        "status": status_service,
    }
    actions[args.command]()


if __name__ == "__main__":
    main()
