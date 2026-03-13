from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.deps import require_admin
from app.core.config import ROOT_DIR, settings
from app.api.routes import products, sales, cash, kardex, reports, users, dashboard, orders, license
from app.schemas.config import ConfigUpdate, ConfigResponse
from app.tax.sii.boleta import router as sii_router

app = FastAPI(title="Nexo Server", version="1.0.0")

ADMIN_DIST_DIR = ROOT_DIR.parent / "admin-web" / "dist"
ADMIN_INDEX_FILE = ADMIN_DIST_DIR / "index.html"

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
@app.get("/admin/{full_path:path}", include_in_schema=False)
def serve_admin_web(full_path: str = ""):
    target = _resolve_admin_asset(full_path)
    if not target:
        if not ADMIN_INDEX_FILE.exists():
            raise HTTPException(status_code=404, detail="Admin web is not built")
        raise HTTPException(status_code=404, detail="Admin asset not found")
    return FileResponse(target)
