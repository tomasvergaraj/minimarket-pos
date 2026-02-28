import { create } from "zustand";
import api from "@/services/api";
import type { User, CashRegister, CashSession } from "@/types";

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
    const { data } = await api.post("/users/login/pin", { pin });
    set({ user: data });
  },

  logout: () => set({ user: null, session: null, register: null }),

  fetchRegisters: async () => {
    const { data } = await api.get("/cash/registers");
    set({ registers: data });
  },

  selectRegister: (reg) => set({ register: reg }),

  openSession: async (openingAmount: number) => {
    const { register, user } = get();
    if (!register) throw new Error("No register selected");
    const { data } = await api.post("/cash/sessions/open", {
      register_id: register.id,
      user_id: user?.id,
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
