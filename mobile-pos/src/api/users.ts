import api from './client'
import type { ApiResponse, AuthSession } from '../types'

export async function loginPin(pin: string): Promise<AuthSession> {
  const { data } = await api.post<ApiResponse<AuthSession>>('/users/login/pin', { pin })
  return data.data
}

export async function logoutSession(refreshToken: string): Promise<void> {
  await api.post('/users/logout', { refresh_token: refreshToken })
}
