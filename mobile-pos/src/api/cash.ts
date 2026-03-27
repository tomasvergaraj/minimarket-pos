import { api } from './client'
import type { CashRegister, CashSession } from '../types'

export async function listRegisters(): Promise<CashRegister[]> {
  const { data } = await api.get<CashRegister[]>('/cash/registers')
  return data
}

export async function openCashSession(
  register_id: string,
  opening_amount: number,
): Promise<CashSession> {
  const { data } = await api.post<CashSession>('/cash/sessions/open', {
    register_id,
    opening_amount,
  })
  return data
}

export async function closeCashSession(
  session_id: string,
  closing_amount: number,
): Promise<CashSession> {
  const { data } = await api.post<CashSession>(`/cash/sessions/${session_id}/close`, {
    closing_amount,
  })
  return data
}

export async function getActiveSessions(): Promise<CashSession[]> {
  const { data } = await api.get<CashSession[]>('/cash/sessions/active')
  return data
}

export async function getCashSession(sessionId: string): Promise<CashSession> {
  const { data } = await api.get<CashSession>(`/cash/sessions/${sessionId}`)
  return data
}
