/**
 * Cola de ventas offline.
 *
 * Si `POST /api/sales/` falla por red, la venta se guarda aquí.
 * Cuando el dispositivo recupera conectividad, se intenta sincronizar
 * la cola en orden FIFO llamando a `flushQueue()`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SaleCreate } from '../types'

const QUEUE_KEY = 'pending_sales_queue_v1'

export interface PendingEntry {
  localId:    string     // identificador local único
  payload:    SaleCreate
  created_at: string
  attempts:   number
}

// ── CRUD de la cola ───────────────────────────────────────────────────────────

export async function getQueue(): Promise<PendingEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as PendingEntry[] } catch { return [] }
}

export async function enqueue(payload: SaleCreate): Promise<PendingEntry> {
  const queue = await getQueue()
  const entry: PendingEntry = {
    localId:    `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    payload,
    created_at: new Date().toISOString(),
    attempts:   0,
  }
  queue.push(entry)
  await _saveQueue(queue)
  return entry
}

export async function removeEntry(localId: string): Promise<void> {
  const queue = await getQueue()
  await _saveQueue(queue.filter((e) => e.localId !== localId))
}

export async function incrementAttempts(localId: string): Promise<void> {
  const queue = await getQueue()
  const updated = queue.map((e) =>
    e.localId === localId ? { ...e, attempts: e.attempts + 1 } : e,
  )
  await _saveQueue(updated)
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY)
}

// ── Intento de sincronización ─────────────────────────────────────────────────

/**
 * Intenta enviar todas las entradas pendientes al servidor.
 * Llama a `createSaleFn` por cada entrada.
 * Devuelve `{ synced, failed }` conteo.
 */
export async function flushQueue(
  createSaleFn: (payload: SaleCreate) => Promise<unknown>,
): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const entry of queue) {
    try {
      await createSaleFn(entry.payload)
      await removeEntry(entry.localId)
      synced++
    } catch {
      await incrementAttempts(entry.localId)
      failed++
    }
  }

  return { synced, failed }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

async function _saveQueue(queue: PendingEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}
