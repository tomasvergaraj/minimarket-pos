from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiError


class LicenseStatusOut(BaseModel):
    status: str
    message: str
    is_active: bool
    verification_ready: bool
    installation_id: str
    hardware_hash: str
    request_code: str
    request_payload_json: str
    trial_started_at: datetime | None = None
    trial_expires_at: datetime | None = None
    trial_days_remaining: int | None = None
    activated_at: datetime | None = None
    license_id: str | None = None
    customer_name: str | None = None
    license_type: str | None = None
    license_expires_at: datetime | None = None
    updates_until: datetime | None = None
    max_registers: int | None = None
    features: list[str] = []
    register_count: int = 0
    last_validation_error: str | None = None


class LicenseStatusResponse(BaseModel):
    success: bool = True
    data: LicenseStatusOut
    error: ApiError | None = None


class LicenseActivateRequest(BaseModel):
    license_document: str
