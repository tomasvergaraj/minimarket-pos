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
import { formatServerDate, formatServerTime } from '../../src/utils/date'
import tw, { colors } from '../../src/utils/tw'
import type { CashRegister } from '../../src/types'

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

    const timeStr  = formatServerTime(session.opened_at)
    const dateStr  = formatServerDate(session.opened_at)

    // Expected cash = opening + cash sales
    const expectedCash = (session.opening_amount ?? 0) + cashSales

    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50`}>
        <ScrollView
          contentContainerStyle={tw`p-5 pb-8`}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {/* Status card */}
          <View style={[tw`bg-white rounded-3xl p-6 mb-5`, { elevation: 2 }]}>
            <View style={tw`flex-row items-center gap-2 mb-4`}>
              <View style={[tw`rounded-full`, { backgroundColor: colors.green600, width: 14, height: 14 }]} />
              <Image source={require('../../assets/icon.png')} style={{ width: 22, height: 22, borderRadius: 6 }} />
              <Text style={[tw`font-bold`, { color: colors.green600, fontSize: 18 }]}>Sesión abierta</Text>
            </View>
            <Text style={tw`text-3xl font-bold text-gray-800`}>{register?.name ?? 'Caja'}</Text>
            <Text style={[tw`mt-2`, { color: colors.gray500, fontSize: 16, lineHeight: 22 }]}>
              Abierta a las {timeStr} del {dateStr}
            </Text>
            <Text style={[tw`mt-1`, { color: colors.gray400, fontSize: 15, lineHeight: 21 }]}>
              {session.total_sales_count ?? 0} venta{(session.total_sales_count ?? 0) !== 1 ? 's' : ''} · Apertura: {clp(session.opening_amount ?? 0)}
            </Text>
          </View>

          {/* Sales totals */}
          <View style={[tw`bg-white rounded-3xl p-6 mb-5`, { elevation: 2 }]}>
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <Text style={[tw`font-bold text-gray-700`, { fontSize: 19 }]}>Ventas del turno</Text>
              <TouchableOpacity onPress={handleRefresh} style={tw`flex-row items-center gap-2`}>
                <Feather name="refresh-cw" size={16} color={colors.primary} />
                <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 14 }]}>Actualizar</Text>
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
                style={[tw`flex-row items-center justify-between py-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}
              >
                <View style={tw`flex-row items-center gap-3`}>
                  <Feather name={icon as any} size={16} color={colors.gray400} />
                  <Text style={{ color: colors.gray500, fontSize: 16 }}>{label}</Text>
                </View>
                <Text style={[tw`font-semibold text-gray-800`, { fontSize: 17 }]}>{clp(value)}</Text>
              </View>
            ))}
            <View style={tw`flex-row items-center justify-between mt-4`}>
              <Text style={[tw`font-bold text-gray-700`, { fontSize: 18 }]}>Total ventas</Text>
              <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 28 }]}>{clp(sessionTotal)}</Text>
            </View>
          </View>

          {/* Cash count helper */}
          <View style={[tw`bg-white rounded-3xl p-6 mb-5`, { elevation: 2 }]}>
            <Text style={[tw`font-bold text-gray-700 mb-2`, { fontSize: 18 }]}>Efectivo esperado en caja</Text>
            <Text style={[tw`font-bold mb-2`, { color: colors.primary, fontSize: 34, lineHeight: 40 }]}>{clp(expectedCash)}</Text>
            <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14, lineHeight: 20 }]}>
              Apertura {clp(session.opening_amount ?? 0)} + ventas efectivo {clp(cashSales)}
            </Text>
          </View>

          {/* Close session */}
          <View style={[tw`bg-white rounded-3xl p-6 mb-5`, { elevation: 2 }]}>
            <Text style={[tw`font-bold text-gray-700 mb-4`, { fontSize: 20 }]}>Cerrar caja</Text>
            <Text style={[tw`mb-3`, { color: colors.gray500, fontSize: 16, lineHeight: 22 }]}>
              Efectivo físico contado al cerrar
            </Text>
            <TextInput
              value={closingAmount}
              onChangeText={setClosingAmount}
              placeholder="0"
              keyboardType="numeric"
              style={[tw`border rounded-2xl px-4 py-4 font-bold text-gray-800 mb-3`, { borderWidth: 1, borderColor: colors.gray200, fontSize: 28, minHeight: 58 }]}
            />
            {/* Quick fill: exact expected */}
            <TouchableOpacity
              onPress={() => setClosingAmount(String(Math.round(expectedCash)))}
              style={[tw`py-3 rounded-2xl items-center mb-4`, { backgroundColor: `${colors.primary}18`, minHeight: 52 }]}
            >
              <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>
                Efectivo esperado: {clp(expectedCash)}
              </Text>
            </TouchableOpacity>
            {/* Difference preview */}
            {closingAmount !== '' && (
              <View style={[
                tw`rounded-2xl px-4 py-4 mb-4 flex-row justify-between items-center`,
                { backgroundColor: Math.abs(parseFloat(closingAmount) - expectedCash) > 500 ? '#fff7ed' : '#ecfdf5' }
              ]}>
                <Text style={{ color: colors.gray500, fontSize: 16 }}>Diferencia</Text>
                <Text style={[tw`font-bold`, { color: parseFloat(closingAmount) >= expectedCash ? colors.green600 : colors.red600, fontSize: 20 }]}>
                  {parseFloat(closingAmount) >= expectedCash ? '+' : ''}{clp(parseFloat(closingAmount) - expectedCash)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              style={[tw`rounded-2xl items-center justify-center`, { backgroundColor: loading ? colors.gray200 : colors.red600, minHeight: 58 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={[tw`text-white font-bold`, { fontSize: 18 }]}>Cerrar sesión de caja</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Logout card */}
          <View style={[tw`bg-white rounded-3xl p-5 mb-4`, { elevation: 2 }]}>
            <TouchableOpacity
              onPress={() => Alert.alert('Cerrar sesión', '¿Salir del sistema?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login') } },
              ])}
              style={[tw`flex-row items-center justify-center gap-2 rounded-2xl`, { backgroundColor: colors.gray100, minHeight: 54 }]}
            >
              <Feather name="log-out" size={18} color={colors.gray500} />
              <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 16 }]}>Cerrar sesión del sistema</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Open session ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <ScrollView contentContainerStyle={tw`p-5 pb-8`} keyboardShouldPersistTaps="handled">
        <Text style={tw`text-3xl font-bold text-gray-800 mb-6`}>Abrir sesión de caja</Text>

        {/* Register list */}
        <View style={[tw`bg-white rounded-3xl p-5 mb-5`, { elevation: 2 }]}>
          <Text style={[tw`font-semibold text-gray-700 mb-4`, { fontSize: 18 }]}>Selecciona la caja</Text>
          {loadingRegs ? (
            <ActivityIndicator color={colors.primary} style={tw`py-4`} />
          ) : registers.length === 0 ? (
            <Text style={[tw`text-center py-4`, { color: colors.gray400, fontSize: 16 }]}>
              No hay cajas activas
            </Text>
          ) : (
            registers.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => setSelected(r)}
                style={[
                  tw`flex-row items-center px-5 py-4 rounded-2xl mb-3 border`,
                  selected?.id === r.id
                    ? { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }
                    : { borderColor: colors.gray200 },
                ]}
              >
                <View style={[
                  tw`w-5 h-5 rounded-full border-2 mr-4`,
                  selected?.id === r.id
                    ? { borderColor: colors.primary, backgroundColor: colors.primary }
                    : { borderColor: colors.gray400 },
                ]} />
                <Text style={[tw`font-semibold`, { color: selected?.id === r.id ? colors.primary : colors.gray800, fontSize: 17 }]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Opening amount */}
        <View style={[tw`bg-white rounded-3xl p-5 mb-6`, { elevation: 2 }]}>
          <Text style={[tw`font-semibold text-gray-700 mb-3`, { fontSize: 18 }]}>Efectivo inicial en caja</Text>
          <TextInput
            value={openingAmount}
            onChangeText={setOpeningAmount}
            placeholder="0"
            keyboardType="numeric"
            style={[tw`border rounded-2xl px-4 py-4 font-bold text-gray-800`, { borderWidth: 1, borderColor: colors.gray200, fontSize: 28, minHeight: 58 }]}
          />
        </View>

        <TouchableOpacity
          onPress={handleOpen}
          disabled={loading || !selected}
          style={[tw`rounded-2xl items-center justify-center mb-5`, { backgroundColor: !selected || loading ? colors.gray200 : colors.primary, minHeight: 58 }]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={[tw`font-bold`, { color: !selected ? colors.gray400 : '#fff', fontSize: 18 }]}>
              Abrir caja
            </Text>
          )}
        </TouchableOpacity>

        {/* Logout card */}
        <View style={[tw`bg-white rounded-3xl p-5 mb-4`, { elevation: 2 }]}>
          <TouchableOpacity
            onPress={() => Alert.alert('Cerrar sesión', '¿Salir del sistema?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login') } },
            ])}
            style={[tw`flex-row items-center justify-center gap-2 rounded-2xl`, { backgroundColor: colors.gray100, minHeight: 54 }]}
          >
            <Feather name="log-out" size={18} color={colors.gray500} />
            <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 16 }]}>Cerrar sesión del sistema</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
