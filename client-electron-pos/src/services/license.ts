import api from "@/services/api";
import type { LicenseStatus } from "@/types";

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const res = await api.get("/license/status");
  return res.data.data ?? res.data;
}

export async function activateLicense(licenseDocument: string): Promise<LicenseStatus> {
  const res = await api.post("/license/activate", { license_document: licenseDocument });
  return res.data.data ?? res.data;
}
