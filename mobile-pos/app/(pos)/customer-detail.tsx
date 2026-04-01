import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { getCustomer, getCustomerHistory, adjustCustomerPoints } from '../../src/api/customers'
import { useAuthStore } from '../../src/stores/authStore'
import { clp } from '../../src/utils/currency'
import { formatServerDate, formatServerTime } from '../../src/utils/date'
import tw, { colors } from '../../src/utils/tw'
import type { Customer, Sale } from '../../src/types'

const METHOD_ICON: Record<string, string>  = { cash: 'dollar-sign', card: 'credit-card', transfer: 'send', mixed: 'layers' }
const METHOD_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto' }

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [history, setHistory]     = useState<Sale[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)

  // Adjust points
  const [showAdjust, setShowAdjust]   = useState(false)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustNote, setAdjustNote]   = useState<'add' | 'sub'>('add')
  const [adjusting, setAdjusting]     = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [c, h] = await Promise.all([getCustomer(id), getCustomerHistory(id, 30)])
      setCustomer(c)
      setHistory(h)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo cargar el cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAdjust = async () => {
    const n = parseInt(adjustDelta)
    if (!n || n <= 0 || !customer) return
    const delta = adjustNote === 'sub' ? -n : n
    setAdjusting(true)
    try {
      const updated = await adjustCustomerPoints(customer.id, delta)
      setCustomer(updated)
      setShowAdjust(false)
      setAdjustDelta('')
      Alert.alert(
        'Puntos ajustados',
        `${adjustNote === 'add' ? '+' : '-'}${n} pts → Nuevo saldo: ${updated.points_balance} pts`,
      )
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo ajustar los puntos')
    } finally {
      setAdjusting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50 items-center justify-center`}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!customer) {
    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50 items-center justify-center px-6`}>
        <Feather name="user-x" size={40} color={colors.gray200} />
        <Text style={[tw`font-semibold mt-4`, { color: colors.gray400, fontSize: 17 }]}>Cliente no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={tw`mt-6`}>
          <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>

      {/* Header */}
      <View style={[tw`bg-white px-4 py-4 flex-row items-center`, { borderBottomWidth: 1, borderBottomColor: colors.gray200, gap: 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[tw`rounded-xl items-center justify-center`, { width: 40, height: 40, backgroundColor: colors.gray100 }]}
        >
          <Feather name="arrow-left" size={20} color={colors.gray500} />
        </TouchableOpacity>
        <View style={[tw`w-10 h-10 rounded-full items-center justify-center`, { backgroundColor: `${colors.primary}20` }]}>
          <Feather name="user" size={20} color={colors.primary} />
        </View>
        <View style={tw`flex-1`}>
          <Text style={[tw`font-bold text-gray-800`, { fontSize: 18 }]} numberOfLines={1}>{customer.name}</Text>
          {(customer.rut || customer.phone) && (
            <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 13 }]}>
              {[customer.rut, customer.phone].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={tw`p-4 pb-10`} showsVerticalScrollIndicator={false}>

        {/* Stats cards */}
        <View style={[tw`flex-row mb-4`, { gap: 10 }]}>
          <View style={[tw`flex-1 rounded-2xl px-4 py-4 items-center`, { backgroundColor: `${colors.primary}12`, elevation: 0 }]}>
            <Feather name="star" size={18} color={colors.primary} />
            <Text style={[tw`font-bold mt-1`, { color: colors.primary, fontSize: 22 }]}>{customer.points_balance}</Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.primary, fontSize: 12 }]}>Puntos</Text>
          </View>
          <View style={[tw`flex-1 rounded-2xl px-4 py-4 items-center`, { backgroundColor: '#ecfdf5', elevation: 0 }]}>
            <Feather name="shopping-bag" size={18} color={colors.green600} />
            <Text style={[tw`font-bold mt-1`, { color: colors.green600, fontSize: 22 }]}>{customer.visit_count}</Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.green600, fontSize: 12 }]}>Visitas</Text>
          </View>
          <View style={[tw`flex-1 rounded-2xl px-4 py-4 items-center`, { backgroundColor: '#fef3c7', elevation: 0 }]}>
            <Feather name="trending-up" size={18} color="#d97706" />
            <Text style={[tw`font-bold mt-1`, { color: '#d97706', fontSize: 18, textAlign: 'center' }]} numberOfLines={1}>
              {clp(customer.total_purchases)}
            </Text>
            <Text style={[tw`text-xs mt-0.5`, { color: '#d97706', fontSize: 12 }]}>Total</Text>
          </View>
        </View>

        {/* Contact info */}
        {(customer.email || customer.rut || customer.phone) && (
          <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
            <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Contacto</Text>
            {customer.rut && (
              <View style={[tw`flex-row items-center mb-2`, { gap: 10 }]}>
                <Feather name="credit-card" size={15} color={colors.gray400} />
                <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>{customer.rut}</Text>
              </View>
            )}
            {customer.phone && (
              <View style={[tw`flex-row items-center mb-2`, { gap: 10 }]}>
                <Feather name="phone" size={15} color={colors.gray400} />
                <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>{customer.phone}</Text>
              </View>
            )}
            {customer.email && (
              <View style={[tw`flex-row items-center`, { gap: 10 }]}>
                <Feather name="mail" size={15} color={colors.gray400} />
                <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>{customer.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* Admin: adjust points */}
        {isAdmin && (
          <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                Ajuste de puntos
              </Text>
              <TouchableOpacity onPress={() => setShowAdjust((v) => !v)}>
                <Feather name={showAdjust ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray400} />
              </TouchableOpacity>
            </View>
            {showAdjust && (
              <View style={tw`mt-3`}>
                {/* +/- toggle */}
                <View style={[tw`flex-row rounded-xl overflow-hidden mb-3`, { backgroundColor: colors.gray100 }]}>
                  {(['add', 'sub'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setAdjustNote(t)}
                      style={[
                        tw`flex-1 items-center py-2`,
                        adjustNote === t && { backgroundColor: t === 'add' ? colors.green600 : colors.red600 },
                      ]}
                    >
                      <Text style={[tw`font-semibold`, { color: adjustNote === t ? '#fff' : colors.gray500, fontSize: 15 }]}>
                        {t === 'add' ? '+ Sumar' : '− Restar'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={[tw`flex-row`, { gap: 10 }]}>
                  <TextInput
                    value={adjustDelta}
                    onChangeText={setAdjustDelta}
                    placeholder="Cantidad de puntos"
                    keyboardType="numeric"
                    style={[tw`flex-1 border rounded-xl px-4 py-3 text-gray-800`, { borderColor: colors.gray200, borderWidth: 1, fontSize: 16 }]}
                  />
                  <TouchableOpacity
                    onPress={handleAdjust}
                    disabled={adjusting || !adjustDelta || parseInt(adjustDelta) <= 0}
                    style={[
                      tw`rounded-xl items-center justify-center px-5`,
                      { backgroundColor: (adjusting || !adjustDelta) ? colors.gray200 : colors.primary },
                    ]}
                  >
                    {adjusting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Feather name="check" size={20} color="#fff" />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Purchase history */}
        <Text style={[tw`font-semibold mb-3 px-1`, { color: colors.gray500, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Últimas compras ({history.length})
        </Text>

        {history.length === 0 ? (
          <View style={[tw`bg-white rounded-2xl items-center py-10`, { elevation: 1 }]}>
            <Feather name="shopping-cart" size={32} color={colors.gray200} />
            <Text style={[tw`mt-3 font-semibold`, { color: colors.gray400, fontSize: 16 }]}>Sin compras registradas</Text>
          </View>
        ) : (
          history.map((sale) => {
            const isOpen = expanded === sale.id
            return (
              <TouchableOpacity
                key={sale.id}
                onPress={() => setExpanded(isOpen ? null : sale.id)}
                activeOpacity={0.7}
                style={[tw`bg-white rounded-2xl mb-3`, { elevation: 1, overflow: 'hidden' }]}
              >
                {/* Row */}
                <View style={[tw`px-4 py-4 flex-row items-center`, { gap: 12 }]}>
                  <View style={[tw`w-9 h-9 rounded-full items-center justify-center`, { backgroundColor: colors.gray100 }]}>
                    <Feather name={METHOD_ICON[sale.payment_method] as any} size={15} color={colors.gray500} />
                  </View>
                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center justify-between`}>
                      <Text style={[tw`font-semibold text-gray-800`, { fontSize: 15 }]}>
                        Boleta #{sale.sale_number}
                      </Text>
                      <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 16 }]}>{clp(sale.total)}</Text>
                    </View>
                    <View style={[tw`flex-row items-center mt-1`, { gap: 8 }]}>
                      <Text style={{ color: colors.gray400, fontSize: 13 }}>
                        {formatServerDate(sale.created_at)} {formatServerTime(sale.created_at)}
                      </Text>
                      <Text style={{ color: colors.gray400, fontSize: 13 }}>·</Text>
                      <Text style={{ color: colors.gray400, fontSize: 13 }}>{METHOD_LABEL[sale.payment_method]}</Text>
                      {sale.points_earned > 0 && (
                        <>
                          <Text style={{ color: colors.gray400, fontSize: 13 }}>·</Text>
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>+{sale.points_earned} pts</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray400} />
                </View>

                {/* Expanded items */}
                {isOpen && (
                  <View style={[tw`px-4 pb-4`, { borderTopWidth: 1, borderTopColor: colors.gray100 }]}>
                    <View style={tw`pt-3`}>
                      {sale.items.map((item) => (
                        <View key={item.id} style={[tw`flex-row items-center justify-between py-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                          <View style={tw`flex-1 mr-3`}>
                            <Text style={[tw`text-gray-800`, { fontSize: 14 }]} numberOfLines={1}>{item.product_name}</Text>
                            <Text style={{ color: colors.gray400, fontSize: 12 }}>x{item.quantity} · {clp(item.unit_price)} c/u</Text>
                          </View>
                          <Text style={[tw`font-semibold`, { color: colors.gray800, fontSize: 14 }]}>{clp(item.subtotal)}</Text>
                        </View>
                      ))}
                      <View style={[tw`flex-row justify-between pt-3`]}>
                        <Text style={{ color: colors.gray500, fontSize: 13 }}>Subtotal neto</Text>
                        <Text style={{ color: colors.gray500, fontSize: 13 }}>{clp(sale.subtotal)}</Text>
                      </View>
                      {sale.discount_amount > 0 && (
                        <View style={tw`flex-row justify-between`}>
                          <Text style={{ color: colors.green600, fontSize: 13 }}>Descuento</Text>
                          <Text style={{ color: colors.green600, fontSize: 13 }}>−{clp(sale.discount_amount)}</Text>
                        </View>
                      )}
                      <View style={[tw`flex-row justify-between pt-1`, { borderTopWidth: 1, borderTopColor: colors.gray200, marginTop: 4 }]}>
                        <Text style={[tw`font-bold text-gray-800`, { fontSize: 15 }]}>Total</Text>
                        <Text style={[tw`font-bold text-gray-800`, { fontSize: 15 }]}>{clp(sale.total)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )
          })
        )}

      </ScrollView>
    </SafeAreaView>
  )
}
