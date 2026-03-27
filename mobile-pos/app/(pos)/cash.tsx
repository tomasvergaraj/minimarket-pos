import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, RefreshControl, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useCashStore } from '../../src/stores/cashStore'
import { useCartStore } from '../../src/stores/cartStore'
import { useAuthStore } from '../../src/stores/authStore'
import { listRegisters, openCashSession, closeCashSession, getCashSession } from '../../src/api/cash'
import { clp } from '../../src/utils/currency'
import tw, { colors } from '../../src/utils/tw'
import type { CashRegister } from '../../src/types'

/** Server returns naive UTC datetimes — append Z to parse correctly */
function parseServerDate(s: string): Date {
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

export default function CashScreen() {
  const { session, register, setSession, updateSession, clearSession } = useCashStore()
  const clearCart = useCartStore((s) => s.clear)
  const { logout } = useAuthStore()

  const [registers, setRegisters]         = useState<CashRegister[]>([])
  const [selected, setSelected]           = useState<CashRegister | null>(null)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [loading, setLoading]             = useState(false)
  const [loadingRegs, setLoadingRegs]     = useState(false)
  const [refreshing, setRefreshing]       = useState(false)

  useEffect(() => {
    if (!session) {
      setLoadingRegs(true)
      listRegisters()
        .then(setRegisters)
        .catch(() => Alert.alert('Error', 'No se pudieron cargar las cajas'))
        .finally(() => setLoadingRegs(false))
    }
  }, [session])

  // Refresh session totals from server
  const handleRefresh = async () => {
    if (!session) return
    setRefreshing(true)
    try {
      const fresh = await getCashSession(session.id)
      updateSession(fresh)
    } catch {}
    setRefreshing(false)
  }

  // ── Open session ──────────────────────────────────────────────────────────
  const handleOpen = async () => {
    if (!selected) { Alert.alert('Selecciona una caja'); return }
    setLoading(true)
    try {
      const newSession = await openCashSession(selected.id, parseFloat(openingAmount || '0'))
      setSession(newSession, selected)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo abrir la sesión')
    } finally {
      setLoading(false)
    }
  }

  // ── Close session ─────────────────────────────────────────────────────────
  const handleClose = () => {
    Alert.alert(
      'Cerrar sesión de caja',
      '¿Seguro que quieres cerrar la caja? El carrito activo se vaciará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar caja', style: 'destructive',
          onPress: async () => {
            if (!session) return
            setLoading(true)
            try {
              await closeCashSession(session.id, parseFloat(closingAmount || '0'))
              clearCart()
              clearSession()
              setClosingAmount('')
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo cerrar la sesión')
            } finally {
              setLoading(false)
            }
          },
        },
      ],
    )
  }

  // ── Active session ────────────────────────────────────────────────────────
  if (session) {
    const cashSales     = session.total_cash_sales     ?? 0
    const cardSales     = session.total_card_sales     ?? 0
    const transferSales = session.total_transfer_sales ?? 0
    const sessionTotal  = cashSales + cardSales + transferSales

    const openedAt = parseServerDate(session.opened_at)
    const timeStr  = openedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const dateStr  = openedAt.toLocaleDateString('es-CL')

    // Expected cash = opening + cash sales
    const expectedCash = (session.opening_amount ?? 0) + cashSales

    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50`}>
        <ScrollView
          contentContainerStyle={tw`p-4`}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {/* Status card */}
          <View style={[tw`bg-white rounded-2xl p-5 mb-4`, { elevation: 2 }]}>
            <View style={tw`flex-row items-center gap-2 mb-3`}>
              <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: colors.green600 }]} />
              <Image source={require('../../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 4 }} />
              <Text style={[tw`font-bold text-base`, { color: colors.green600 }]}>Sesión abierta</Text>
            </View>
            <Text style={tw`text-2xl font-bold text-gray-800`}>{register?.name ?? 'Caja'}</Text>
            <Text style={[tw`text-sm mt-1`, { color: colors.gray500 }]}>
              Abierta a las {timeStr} del {dateStr}
            </Text>
            <Text style={[tw`text-sm`, { color: colors.gray400 }]}>
              {session.total_sales_count ?? 0} venta{(session.total_sales_count ?? 0) !== 1 ? 's' : ''} · Apertura: {clp(session.opening_amount ?? 0)}
            </Text>
          </View>

          {/* Sales totals */}
          <View style={[tw`bg-white rounded-2xl p-5 mb-4`, { elevation: 2 }]}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={tw`font-bold text-gray-700`}>Ventas del turno</Text>
              <TouchableOpacity onPress={handleRefresh} style={tw`flex-row items-center gap-1`}>
                <Feather name="refresh-cw" size={14} color={colors.primary} />
                <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>Actualizar</Text>
              </TouchableOpacity>
            </View>
            {(
              [
                ['dollar-sign', 'Efectivo',      cashSales],
                ['credit-card', 'Tarjeta',       cardSales],
                ['send',        'Transferencia', transferSales],
              ] as [string, string, number][]
            ).map(([icon, label, value]) => (
              <View
                key={label}
                style={[tw`flex-row items-center justify-between py-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}
              >
                <View style={tw`flex-row items-center gap-2`}>
                  <Feather name={icon as any} size={14} color={colors.gray400} />
                  <Text style={{ color: colors.gray500 }}>{label}</Text>
                </View>
                <Text style={tw`font-semibold text-gray-800`}>{clp(value)}</Text>
              </View>
            ))}
            <View style={tw`flex-row items-center justify-between mt-3`}>
              <Text style={tw`font-bold text-gray-700`}>Total ventas</Text>
              <Text style={[tw`text-xl font-bold`, { color: colors.primary }]}>{clp(sessionTotal)}</Text>
            </View>
          </View>

          {/* Cash count helper */}
          <View style={[tw`bg-white rounded-2xl p-5 mb-4`, { elevation: 2 }]}>
            <Text style={tw`font-bold text-gray-700 mb-1`}>Efectivo esperado en caja</Text>
            <Text style={[tw`text-3xl font-bold mb-1`, { color: colors.primary }]}>{clp(expectedCash)}</Text>
            <Text style={[tw`text-xs`, { color: colors.gray400 }]}>
              Apertura {clp(session.opening_amount ?? 0)} + ventas efectivo {clp(cashSales)}
            </Text>
          </View>

          {/* Close session */}
          <View style={[tw`bg-white rounded-2xl p-5 mb-4`, { elevation: 2 }]}>
            <Text style={tw`font-bold text-gray-700 mb-3`}>Cerrar caja</Text>
            <Text style={[tw`text-sm mb-2`, { color: colors.gray500 }]}>
              Efectivo físico contado al cerrar
            </Text>
            <TextInput
              value={closingAmount}
              onChangeText={setClosingAmount}
              placeholder="0"
              keyboardType="numeric"
              style={[tw`border rounded-xl px-4 py-3 text-xl font-bold text-gray-800 mb-2`, { borderWidth: 1, borderColor: colors.gray200 }]}
            />
            {/* Quick fill: exact expected */}
            <TouchableOpacity
              onPress={() => setClosingAmount(String(Math.round(expectedCash)))}
              style={[tw`py-2 rounded-xl items-center mb-4`, { backgroundColor: `${colors.primary}18` }]}
            >
              <Text style={[tw`text-sm font-semibold`, { color: colors.primary }]}>
                Efectivo esperado: {clp(expectedCash)}
              </Text>
            </TouchableOpacity>
            {/* Difference preview */}
            {closingAmount !== '' && (
              <View style={[
                tw`rounded-xl px-4 py-3 mb-4 flex-row justify-between`,
                { backgroundColor: Math.abs(parseFloat(closingAmount) - expectedCash) > 500 ? '#fff7ed' : '#ecfdf5' }
              ]}>
                <Text style={{ color: colors.gray500 }}>Diferencia</Text>
                <Text style={[tw`font-bold`, { color: parseFloat(closingAmount) >= expectedCash ? colors.green600 : colors.red600 }]}>
                  {parseFloat(closingAmount) >= expectedCash ? '+' : ''}{clp(parseFloat(closingAmount) - expectedCash)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              style={[tw`py-4 rounded-xl items-center`, { backgroundColor: loading ? colors.gray200 : colors.red600 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={tw`text-white font-bold`}>Cerrar sesión de caja</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Logout card */}
          <View style={[tw`bg-white rounded-2xl p-4 mb-4`, { elevation: 2 }]}>
            <TouchableOpacity
              onPress={() => Alert.alert('Cerrar sesión', '¿Salir del sistema?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login') } },
              ])}
              style={[tw`flex-row items-center justify-center gap-2 py-3 rounded-xl`, { backgroundColor: colors.gray100 }]}
            >
              <Feather name="log-out" size={16} color={colors.gray500} />
              <Text style={[tw`font-semibold text-sm`, { color: colors.gray500 }]}>Cerrar sesión del sistema</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Open session ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <ScrollView contentContainerStyle={tw`p-4`} keyboardShouldPersistTaps="handled">
        <Text style={tw`text-xl font-bold text-gray-800 mb-5`}>Abrir sesión de caja</Text>

        {/* Register list */}
        <View style={[tw`bg-white rounded-2xl p-4 mb-4`, { elevation: 2 }]}>
          <Text style={tw`font-semibold text-gray-700 mb-3`}>Selecciona la caja</Text>
          {loadingRegs ? (
            <ActivityIndicator color={colors.primary} style={tw`py-4`} />
          ) : registers.length === 0 ? (
            <Text style={[tw`text-center py-4`, { color: colors.gray400 }]}>
              No hay cajas activas
            </Text>
          ) : (
            registers.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => setSelected(r)}
                style={[
                  tw`flex-row items-center px-4 py-3 rounded-xl mb-2 border`,
                  selected?.id === r.id
                    ? { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }
                    : { borderColor: colors.gray200 },
                ]}
              >
                <View style={[
                  tw`w-4 h-4 rounded-full border-2 mr-3`,
                  selected?.id === r.id
                    ? { borderColor: colors.primary, backgroundColor: colors.primary }
                    : { borderColor: colors.gray400 },
                ]} />
                <Text style={[tw`font-semibold`, { color: selected?.id === r.id ? colors.primary : colors.gray800 }]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Opening amount */}
        <View style={[tw`bg-white rounded-2xl p-4 mb-5`, { elevation: 2 }]}>
          <Text style={tw`font-semibold text-gray-700 mb-2`}>Efectivo inicial en caja</Text>
          <TextInput
            value={openingAmount}
            onChangeText={setOpeningAmount}
            placeholder="0"
            keyboardType="numeric"
            style={[tw`border rounded-xl px-4 py-3 text-xl font-bold text-gray-800`, { borderWidth: 1, borderColor: colors.gray200 }]}
          />
        </View>

        <TouchableOpacity
          onPress={handleOpen}
          disabled={loading || !selected}
          style={[tw`py-4 rounded-xl items-center mb-4`, { backgroundColor: !selected || loading ? colors.gray200 : colors.primary }]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={[tw`font-bold text-base`, { color: !selected ? colors.gray400 : '#fff' }]}>
              Abrir caja
            </Text>
          )}
        </TouchableOpacity>

        {/* Logout card */}
        <View style={[tw`bg-white rounded-2xl p-4 mb-4`, { elevation: 2 }]}>
          <TouchableOpacity
            onPress={() => Alert.alert('Cerrar sesión', '¿Salir del sistema?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login') } },
            ])}
            style={[tw`flex-row items-center justify-center gap-2 py-3 rounded-xl`, { backgroundColor: colors.gray100 }]}
          >
            <Feather name="log-out" size={16} color={colors.gray500} />
            <Text style={[tw`font-semibold text-sm`, { color: colors.gray500 }]}>Cerrar sesión del sistema</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
