import { create } from "zustand";
import api, { clearAuthToken, setAuthToken } from "@/services/api";
import { useLicenseStore } from "@/stores/licenseStore";
import type { AuthSession, User, CashRegister, CashSession } from "@/types";

interface AuthState {
  user: User | null;
  register: CashRegister | null;
  session: CashSession | null;
  registers: CashRegister[];
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => void;
  fetchRegisters: () => Promise<void>;
  selectRegister: (reg: CashRegister) => void;
  openSession: (openingAmount: number) => Promise<void>;
  closeSession: (closingAmount: number) => Promise<CashSession>;
  setSession: (s: CashSession | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  register: null,
  session: null,
  registers: [],

  loginWithPin: async (pin: string) => {
    const response = await api.post("/users/login/pin", { pin });
    const session: AuthSession = response.data.data ?? response.data;
    setAuthToken(session.access_token);
    useLicenseStore.getState().clearLicenseState();
    set({ user: session.user });
  },

  logout: () => {
    clearAuthToken();
    useLicenseStore.getState().clearLicenseState();
    set({ user: null, session: null, register: null });
  },

  fetchRegisters: async () => {
    const { data } = await api.get("/cash/registers");
    set({ registers: data });
  },

  selectRegister: (reg) => set({ register: reg }),

  openSession: async (openingAmount: number) => {
    const { register } = get();
    if (!register) throw new Error("No register selected");
    const { data } = await api.post("/cash/sessions/open", {
      register_id: register.id,
      opening_amount: openingAmount,
    });
    set({ session: data });
  },

  closeSession: async (closingAmount: number) => {
    const { session } = get();
    if (!session) throw new Error("No session open");
    const { data } = await api.post(`/cash/sessions/${session.id}/close`, {
      closing_amount: closingAmount,
    });
    set({ session: null });
    return data;
  },

  setSession: (s) => set({ session: s }),
}));
