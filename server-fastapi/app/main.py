from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import products, sales, cash, kardex, reports, users
from app.tax.sii.boleta import router as sii_router

app = FastAPI(title="MiniMarket POS Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
