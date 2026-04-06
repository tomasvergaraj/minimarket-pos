import type { SaleCreate } from '../types'

const QUEUE_KEY = 'pos_offline_queue'

export interface QueuedSale {
  id: string
  data: SaleCreate
  queued_at: string
  attempts: number
}

export function getQueue(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedSale[]
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedSale[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(data: SaleCreate): QueuedSale {
  const entry: QueuedSale = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    data,
    queued_at: new Date().toISOString(),
    attempts: 0,
  }
  saveQueue([...getQueue(), entry])
  return entry
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter((e) => e.id !== id))
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function queueCount(): number {
  return getQueue().length
}
