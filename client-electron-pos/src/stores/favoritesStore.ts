import { create } from "zustand";
import type { FavoriteSlot } from "@/types";

const GRID_SIZE = 12;
const STORAGE_KEY = "pos_favorites";

function load(): (FavoriteSlot | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as (FavoriteSlot | null)[];
      // Ensure correct length
      const slots = Array(GRID_SIZE).fill(null) as (FavoriteSlot | null)[];
      parsed.forEach((s) => {
        if (s && s.slot >= 0 && s.slot < GRID_SIZE) slots[s.slot] = s;
      });
      return slots;
    }
  } catch {}
  return Array(GRID_SIZE).fill(null);
}

function save(slots: (FavoriteSlot | null)[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

interface FavoritesState {
  slots: (FavoriteSlot | null)[];
  setSlot: (slot: number, product: Omit<FavoriteSlot, "slot">) => void;
  clearSlot: (slot: number) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  slots: load(),

  setSlot: (slot, product) => {
    const slots = [...get().slots];
    slots[slot] = { slot, ...product };
    save(slots);
    set({ slots });
  },

  clearSlot: (slot) => {
    const slots = [...get().slots];
    slots[slot] = null;
    save(slots);
    set({ slots });
  },
}));

export const FAVORITES_GRID_SIZE = GRID_SIZE;
