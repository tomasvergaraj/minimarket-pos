import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FavoriteSlot } from '../types'

const STORAGE_KEY      = 'pos_favorites'
const GRID_SIZE_KEY    = 'pos_favorites_grid_size'
const DEFAULT_SIZE     = 12
const MIN_SIZE         = 4
const MAX_SIZE         = 100

interface FavoritesState {
  slots: (FavoriteSlot | null)[]
  gridSize: number
  loaded: boolean
  load: () => Promise<void>
  setSlot: (slot: number, product: Omit<FavoriteSlot, 'slot'>) => void
  clearSlot: (slot: number) => void
  setGridSize: (size: number) => void
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  slots: Array(DEFAULT_SIZE).fill(null),
  gridSize: DEFAULT_SIZE,
  loaded: false,

  load: async () => {
    try {
      const [rawSlots, rawSize] = await AsyncStorage.multiGet([STORAGE_KEY, GRID_SIZE_KEY])
      const gridSize = rawSize[1] ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, parseInt(rawSize[1]) || DEFAULT_SIZE)) : DEFAULT_SIZE
      if (rawSlots[1]) {
        const parsed = JSON.parse(rawSlots[1]) as (FavoriteSlot | null)[]
        const slots = Array.from({ length: gridSize }, (_, i) => parsed[i] ?? null)
        set({ slots, gridSize, loaded: true })
        return
      }
      set({ gridSize, slots: Array(gridSize).fill(null), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setSlot: (slot, product) => {
    const { slots, gridSize } = get()
    const newSlots = Array.from({ length: gridSize }, (_, i) => slots[i] ?? null)
    newSlots[slot] = { slot, ...product }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots)).catch(() => {})
    set({ slots: newSlots })
  },

  clearSlot: (slot) => {
    const { slots, gridSize } = get()
    const newSlots = Array.from({ length: gridSize }, (_, i) => slots[i] ?? null)
    newSlots[slot] = null
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots)).catch(() => {})
    set({ slots: newSlots })
  },

  setGridSize: (size) => {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
    const { slots } = get()
    const newSlots = Array.from({ length: clamped }, (_, i) => slots[i] ?? null)
    AsyncStorage.multiSet([[GRID_SIZE_KEY, String(clamped)], [STORAGE_KEY, JSON.stringify(newSlots)]]).catch(() => {})
    set({ gridSize: clamped, slots: newSlots })
  },
}))
