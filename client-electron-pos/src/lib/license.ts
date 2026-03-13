import type { LicenseStatus } from "@/types";

export interface LicenseBlock {
  code: string;
  message: string;
}

export function normalizeLicenseCode(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .replace(/-/g, "_")
    .toUpperCase();
}

export function isLicenseErrorCode(value?: string | null): boolean {
  const code = normalizeLicenseCode(value);
  return (
    code === "TRIAL_EXPIRED" ||
    code === "CLOCK_TAMPERED" ||
    code === "HARDWARE_MISMATCH" ||
    code.startsWith("LICENSE_")
  );
}

export function getLicenseBlockFromStatus(status: LicenseStatus | null): LicenseBlock | null {
  if (!status || status.is_active) return null;

  return {
    code: normalizeLicenseCode(status.status),
    message: status.message,
  };
}
