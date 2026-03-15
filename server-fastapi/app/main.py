from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse

from app.api.deps import require_admin
from app.core.config import ROOT_DIR, settings
from app.api.routes import products, sales, cash, kardex, reports, users, dashboard, orders, license
from app.schemas.config import ConfigUpdate, ConfigResponse
from app.tax.sii.boleta import router as sii_router

app = FastAPI(title="Nexo Server", version="1.0.0")

ADMIN_DIST_DIR = ROOT_DIR.parent / "admin-web" / "dist"
ADMIN_INDEX_FILE = ADMIN_DIST_DIR / "index.html"
ADMIN_INDEX_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}
ADMIN_COMPAT_PATHS = (
    "login",
    "products",
    "sales",
    "inventory",
    "cash",
    "users",
    "reports",
    "config",
)
ADMIN_COMPAT_STORAGE_RESET_SCRIPT = """
(() => {
  try {
    const stored = localStorage.getItem('admin_server_url');
    if (!stored) return;

    const storedUrl = new URL(stored, window.location.origin);
    const currentUrl = new URL(window.location.origin);
    const loopbackHosts = new Set(['localhost', '127.0.0.1']);

    if (
      loopbackHosts.has(storedUrl.hostname) &&
      loopbackHosts.has(currentUrl.hostname) &&
      storedUrl.origin !== currentUrl.origin
    ) {
      localStorage.removeItem('admin_server_url');
    }
  } catch {}
})();
""".strip()

allowed_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(cash.router, prefix="/api")
app.include_router(kardex.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(license.router, prefix="/api")
app.include_router(sii_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "store": settings.STORE_NAME}


@app.get("/api/config", dependencies=[Depends(require_admin)])
def get_config():
    return {
        "store_name": settings.STORE_NAME,
        "store_rut": settings.STORE_RUT,
        "store_address": settings.STORE_ADDRESS,
    }


@app.put("/api/config", response_model=ConfigResponse, dependencies=[Depends(require_admin)])
def update_config(data: ConfigUpdate):
    settings.STORE_NAME = data.store_name
    settings.STORE_RUT = data.store_rut
    settings.STORE_ADDRESS = data.store_address
    return {
        "success": True,
        "data": {
            "store_name": settings.STORE_NAME,
            "store_rut": settings.STORE_RUT,
            "store_address": settings.STORE_ADDRESS,
        },
        "error": None,
    }


def _resolve_admin_asset(full_path: str) -> Path | None:
    if not ADMIN_INDEX_FILE.exists():
        return None

    if not full_path:
        return ADMIN_INDEX_FILE

    candidate = (ADMIN_DIST_DIR / full_path).resolve()
    dist_root = ADMIN_DIST_DIR.resolve()
    if not candidate.is_relative_to(dist_root):
        return None

    if candidate.is_file():
        return candidate

    if candidate.suffix:
        return None

    return ADMIN_INDEX_FILE


@app.get("/admin", include_in_schema=False)
def redirect_admin_web_root():
    return RedirectResponse(url="/admin/", status_code=307, headers=ADMIN_INDEX_HEADERS)


def _redirect_admin_path(path: str) -> RedirectResponse:
    target = path.lstrip("/")
    suffix = f"/{target}" if target else "/"
    return RedirectResponse(url=f"/admin{suffix}", status_code=307, headers=ADMIN_INDEX_HEADERS)


def _render_admin_compat_page(path: str) -> HTMLResponse:
    target = path.lstrip("/")
    suffix = f"/{target}" if target else "/"
    admin_url = f"/admin{suffix}"
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url={admin_url}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to Nexo Admin</title>
  </head>
  <body>
    <script>
{ADMIN_COMPAT_STORAGE_RESET_SCRIPT}
window.location.replace({admin_url!r});
    </script>
    <p>Redirecting to <a href="{admin_url}">{admin_url}</a>...</p>
  </body>
</html>
"""
    return HTMLResponse(content=html, headers=ADMIN_INDEX_HEADERS)


@app.get("/login", include_in_schema=False)
@app.get("/products", include_in_schema=False)
@app.get("/sales", include_in_schema=False)
@app.get("/inventory", include_in_schema=False)
@app.get("/cash", include_in_schema=False)
@app.get("/users", include_in_schema=False)
@app.get("/reports", include_in_schema=False)
@app.get("/config", include_in_schema=False)
def redirect_admin_compat_routes(request: Request):
    path = request.url.path.lstrip("/")
    if path not in ADMIN_COMPAT_PATHS:
        raise HTTPException(status_code=404, detail="Not found")
    return _render_admin_compat_page(path)


@app.get("/vite.svg", include_in_schema=False)
def redirect_legacy_admin_icon():
    return RedirectResponse(url="/admin/icon.svg", status_code=307, headers=ADMIN_INDEX_HEADERS)


@app.get("/admin/", include_in_schema=False)
@app.get("/admin/{full_path:path}", include_in_schema=False)
def serve_admin_web(full_path: str = ""):
    target = _resolve_admin_asset(full_path)
    if not target:
        if not ADMIN_INDEX_FILE.exists():
            raise HTTPException(status_code=404, detail="Admin web is not built")
        raise HTTPException(status_code=404, detail="Admin asset not found")
    headers = ADMIN_INDEX_HEADERS if target == ADMIN_INDEX_FILE else None
    return FileResponse(target, headers=headers)
