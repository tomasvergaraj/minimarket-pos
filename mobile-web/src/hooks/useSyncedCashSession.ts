import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchCashSession } from '../lib/services'

export function useSyncedCashSession() {
  const { cashState, setCashState } = usePOSAuth()
  const sessionId = cashState?.session.id

  const { data } = useQuery({
    queryKey: ['pos-cash-session', sessionId],
    queryFn: () => fetchCashSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  })

  // Sync fresh server data back to localStorage — but only upgrade, never
  // overwrite an optimistic update that already has more sales than the server returned.
  useEffect(() => {
    if (!cashState || !data || cashState.session.id !== data.id) return
    if (data.total_sales_count < cashState.session.total_sales_count) return
    const s = cashState.session
    const changed =
      s.status !== data.status ||
      s.opening_amount !== data.opening_amount ||
      s.closing_amount !== data.closing_amount ||
      s.total_cash_sales !== data.total_cash_sales ||
      s.total_card_sales !== data.total_card_sales ||
      s.total_transfer_sales !== data.total_transfer_sales ||
      s.total_sales_count !== data.total_sales_count ||
      s.expected_cash !== data.expected_cash ||
      s.difference !== data.difference ||
      s.closed_at !== data.closed_at
    if (!changed) return
    setCashState({ session: data, register: cashState.register })
  }, [cashState, data, setCashState])

  // Return whichever source has the most up-to-date totals.
  // This prevents stale cache from hiding an optimistic update made in POSPage.
  const stored = cashState?.session ?? null
  if (data && stored && data.id === stored.id) {
    return data.total_sales_count >= stored.total_sales_count ? data : stored
  }
  return data ?? stored
}
