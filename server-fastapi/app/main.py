from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import require_admin
from app.core.config import settings
from app.api.routes import products, sales, cash, kardex, reports, users, dashboard, orders
from app.schemas.config import ConfigUpdate, ConfigResponse
from app.tax.sii.boleta import router as sii_router

app = FastAPI(title="MiniMarket POS Server", version="1.0.0")

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
app.include_router(sii_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "store": settings.STORE_NAME}


@app.get("/api/config")
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
