import { create } from "zustand";
import { getLicenseBlockFromStatus, type LicenseBlock } from "@/lib/license";
import type { LicenseStatus } from "@/types";

interface LicenseState {
  licenseStatus: LicenseStatus | null;
  blockingLicense: LicenseBlock | null;
  setBlockingLicense: (blockingLicense: LicenseBlock | null) => void;
  syncLicenseStatus: (licenseStatus: LicenseStatus | null) => void;
  clearLicenseState: () => void;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  licenseStatus: null,
  blockingLicense: null,

  setBlockingLicense: (blockingLicense) => set({ blockingLicense }),

  syncLicenseStatus: (licenseStatus) =>
    set({
      licenseStatus,
      blockingLicense: getLicenseBlockFromStatus(licenseStatus),
    }),

  clearLicenseState: () =>
    set({
      licenseStatus: null,
      blockingLicense: null,
    }),
}));
