import { create } from "zustand";
import type { FavoriteSlot } from "@/types";

const DEFAULT_GRID_SIZE = 12;
const STORAGE_KEY = "pos_favorites";
const GRID_SIZE_KEY = "pos_favorites_grid_size";

function loadGridSize(): number {
  try {
    const v = localStorage.getItem(GRID_SIZE_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 4 && n <= 100) return n;
    }
  } catch {}
  return DEFAULT_GRID_SIZE;
}

function load(gridSize: number): (FavoriteSlot | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as (FavoriteSlot | null)[];
      // Build a map by slot index, expand to current gridSize
      const map = new Map<number, FavoriteSlot>();
      parsed.forEach((s) => { if (s) map.set(s.slot, s); });
      return Array.from({ length: gridSize }, (_, i) => map.get(i) ?? null);
    }
  } catch {}
  return Array(gridSize).fill(null);
}

function save(slots: (FavoriteSlot | null)[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots.filter(Boolean)));
}

interface FavoritesState {
  slots: (FavoriteSlot | null)[];
  gridSize: number;
  setSlot: (slot: number, product: Omit<FavoriteSlot, "slot">) => void;
  clearSlot: (slot: number) => void;
  setGridSize: (size: number) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => {
  const gridSize = loadGridSize();
  return {
    slots: load(gridSize),
    gridSize,

    setSlot: (slot, product) => {
      const { slots, gridSize } = get();
      // Grow array if needed
      const newSlots = [...slots];
      while (newSlots.length <= slot) newSlots.push(null);
      newSlots[slot] = { slot, ...product };
      save(newSlots);
      set({ slots: newSlots });
    },

    clearSlot: (slot) => {
      const slots = [...get().slots];
      if (slot < slots.length) slots[slot] = null;
      save(slots);
      set({ slots });
    },

    setGridSize: (size) => {
      const clamped = Math.max(4, Math.min(100, size));
      const { slots } = get();
      // Expand or shrink preserving existing assignments
      const newSlots = Array.from({ length: clamped }, (_, i) => slots[i] ?? null);
      try { localStorage.setItem(GRID_SIZE_KEY, String(clamped)); } catch {}
      save(newSlots);
      set({ slots: newSlots, gridSize: clamped });
    },
  };
});

/** @deprecated use useFavoritesStore().gridSize instead */
export const FAVORITES_GRID_SIZE = DEFAULT_GRID_SIZE;
