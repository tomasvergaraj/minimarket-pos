import { useState } from 'react'
import type { FavoriteSlot } from '../types'

const FAVORITES_KEY = 'pos_favorites'
const GRID_SIZE_KEY = 'pos_favorites_grid_size'
const DEFAULT_SIZE = 12

export const SIZE_PRESETS = [4, 8, 12, 16, 20, 24]

function loadGridSize(): number {
  const raw = localStorage.getItem(GRID_SIZE_KEY)
  if (!raw) return DEFAULT_SIZE
  const n = parseInt(raw)
  return isNaN(n) ? DEFAULT_SIZE : Math.min(100, Math.max(4, n))
}

function loadSlots(size: number): (FavoriteSlot | null)[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return Array(size).fill(null)
    const parsed = JSON.parse(raw) as (FavoriteSlot | null)[]
    return Array.from({ length: size }, (_, i) => parsed[i] ?? null)
  } catch {
    return Array(size).fill(null)
  }
}

export function useFavorites() {
  const [gridSize, setGridSizeState] = useState<number>(loadGridSize)
  const [slots, setSlotsState] = useState<(FavoriteSlot | null)[]>(() => loadSlots(loadGridSize()))

  function _persist(newSlots: (FavoriteSlot | null)[]) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newSlots))
    setSlotsState(newSlots)
  }

  function setSlot(slot: number, product: Omit<FavoriteSlot, 'slot'>) {
    const newSlots = Array.from({ length: gridSize }, (_, i) => slots[i] ?? null)
    newSlots[slot] = { slot, ...product }
    _persist(newSlots)
  }

  function clearSlot(slot: number) {
    const newSlots = Array.from({ length: gridSize }, (_, i) => slots[i] ?? null)
    newSlots[slot] = null
    _persist(newSlots)
  }

  function setGridSize(size: number) {
    const clamped = Math.min(100, Math.max(4, size))
    const newSlots = Array.from({ length: clamped }, (_, i) => slots[i] ?? null)
    localStorage.setItem(GRID_SIZE_KEY, String(clamped))
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newSlots))
    setGridSizeState(clamped)
    setSlotsState(newSlots)
  }

  return { slots, gridSize, setSlot, clearSlot, setGridSize }
}
