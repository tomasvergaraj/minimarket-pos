import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { usePrinterStore } from '../../src/stores/printerStore'
import { listSales, voidSale } from '../../src/api/sales'
import { fetchStoreConfig } from '../../src/api/config'
import ReceiptPreviewModal from '../../src/components/pos/ReceiptPreviewModal'
import { clp } from '../../src/utils/currency'
import { formatServerDate, formatServerTime, formatServerDateTime } from '../../src/utils/date'
import tw, { colors } from '../../src/utils/tw'
import type { Sale } from '../../src/types'

type RangeFilter  = 'today' | 'week' | 'all'
type StatusFilter = 'all' | 'completed' | 'voided'

function localDateStr(daysBack = 0): string {
  const d = new Date()
  if (daysBack > 0) d.setDate(d.getDate() - daysBack)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d)
}

const METHOD_ICON: Record<string, string>  = { cash: 'dollar-sign', card: 'credit-card', transfer: 'send', mixed: 'layers' }
const METHOD_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto' }

export default function SalesScreen() {
  const { user } = useAuthStore()
  const isAdmin   = user?.role === 'admin'
  const printer   = usePrinterStore()

  const [range, setRange]               = useState<RangeFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sales, setSales]               = useState<Sale[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  const [selected, setSelected]         = useState<Sale | null>(null)
  const [voiding, setVoiding]           = useState(false)
  const [receipt, setReceipt]           = useState<Sale | null>(null)
  const [storeName, setStoreName]       = useState(printer.storeName)

  useEffect(() => {
    fetchStoreConfig().then((c) => setStoreName(c.store_name)).catch(() => {})
  }, [])

  const fetchSales = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const today   = localDateStr()
      const weekAgo = localDateStr(7)
      const result  = await listSales({
        date_from: range === 'today' ? today : range === 'week' ? weekAgo : undefined,
        date_to:   range !== 'all'   ? today : undefined,
        status:    statusFilter !== 'all' ? (statusFilter as 'completed' | 'voided') : undefined,
        limit: 100,
      })
      setSales(result.data)
      setTotal(result.meta.total)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range, statusFilter])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleVoid = (sale: Sale) => {
    Alert.alert(
      `Anular venta #${sale.sale_number}`,
      `¿Confirmar anulación de ${clp(sale.total)}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular', style: 'destructive',
          onPress: async () => {
            setVoiding(true)
            try {
              const updated = await voidSale(sale.id)
              setSelected(updated)
              setSales((prev) => prev.map((s) => s.id === updated.id ? updated : s))
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo anular la venta')
            } finally {
              setVoiding(false)
            }
          },
        },
      ],
    )
  }


  const renderSale = ({ item: sale }: { item: Sale }) => {
    const isVoided = sale.status === 'voided'
    return (
      <TouchableOpacity
        onPress={() => setSelected(sale)}
        activeOpacity={0.7}
        style={[
          tw`bg-white rounded-2xl px-4 py-4 mb-3`,
          { elevation: 1, borderWidth: 1, borderColor: isVoided ? colors.red100 : colors.gray100 },
        ]}
      >
        <View style={tw`flex-row items-start justify-between`}>
          <View style={tw`flex-1 mr-3`}>
            <View style={tw`flex-row items-center gap-2 mb-1`}>
              <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 15 }]}>
                #{sale.sale_number}
              </Text>
              <View style={[tw`px-2 py-0.5 rounded-full`, { backgroundColor: isVoided ? colors.red100 : '#dcfce7' }]}>
                <Text style={[tw`text-xs font-semibold`, { color: isVoided ? colors.red600 : colors.green600 }]}>
                  {isVoided ? 'Anulada' : 'Completada'}
                </Text>
              </View>
            </View>
            <Text style={[tw`text-xs mb-1`, { color: colors.gray400 }]}>
              {formatServerTime(sale.created_at)} · {formatServerDate(sale.created_at)}
            </Text>
            <View style={tw`flex-row items-center gap-1`}>
              <Feather name={METHOD_ICON[sale.payment_method] as any} size={11} color={colors.gray400} />
              <Text style={[tw`text-xs`, { color: colors.gray400 }]}>
                {METHOD_LABEL[sale.payment_method]} · {sale.items.length} ítem{sale.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={tw`items-end`}>
            <Text style={[tw`font-bold`, {
              fontSize: 18,
              color: isVoided ? colors.gray400 : colors.gray800,
              textDecorationLine: isVoided ? 'line-through' : 'none',
            }]}>
              {clp(sale.total)}
            </Text>
            <Feather name="chevron-right" size={14} color={colors.gray200} style={{ marginTop: 4 }} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`} edges={['top']}>

      {/* Header */}
      <View style={[tw`bg-white px-4 pt-4 pb-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={[tw`font-bold`, { fontSize: 20, color: colors.gray800 }]}>Historial de ventas</Text>
          <Text style={[tw`text-sm font-semibold`, { color: colors.gray400 }]}>
            {total} venta{total !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Range filter */}
        <View style={[tw`flex-row mb-2`, { gap: 6 }]}>
          {([['today', 'Hoy'], ['week', 'Semana'], ['all', 'Todas']] as [RangeFilter, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setRange(key)}
              style={[
                tw`flex-1 py-2 rounded-xl items-center`,
                { backgroundColor: range === key ? colors.primary : colors.gray100 },
              ]}
            >
              <Text style={[tw`text-sm font-semibold`, { color: range === key ? '#fff' : colors.gray500 }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status filter */}
        <View style={[tw`flex-row`, { gap: 6 }]}>
          {([
            ['all',       'Todas',       colors.gray800],
            ['completed', 'Completadas', colors.green600],
            ['voided',    'Anuladas',    colors.red600],
          ] as [StatusFilter, string, string][]).map(([key, label, activeColor]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setStatusFilter(key)}
              style={[
                tw`flex-1 py-1.5 rounded-lg items-center border`,
                statusFilter === key
                  ? { backgroundColor: activeColor, borderColor: activeColor }
                  : { borderColor: colors.gray200 },
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: statusFilter === key ? '#fff' : colors.gray400 }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          contentContainerStyle={[tw`px-4 py-3`, sales.length === 0 && tw`flex-1`]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchSales(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={tw`flex-1 items-center justify-center py-16`}>
              <Feather name="list" size={48} color={colors.gray200} />
              <Text style={[tw`font-semibold mt-4`, { color: colors.gray400, fontSize: 16 }]}>Sin ventas</Text>
              <Text style={[tw`text-sm mt-1 text-center`, { color: colors.gray400 }]}>
                No hay ventas para el período seleccionado
              </Text>
            </View>
          }
          renderItem={renderSale}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={[tw`bg-white`, { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }]}>

              {/* Modal header */}
              <View style={[tw`flex-row items-start justify-between px-5 pt-5 pb-4`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                <View>
                  <View style={tw`flex-row items-center gap-2`}>
                    <Text style={[tw`font-bold`, { fontSize: 20, color: colors.gray800 }]}>
                      Venta #{selected.sale_number}
                    </Text>
                    <View style={[
                      tw`px-2 py-0.5 rounded-full`,
                      { backgroundColor: selected.status === 'voided' ? colors.red100 : '#dcfce7' },
                    ]}>
                      <Text style={[tw`text-xs font-semibold`, { color: selected.status === 'voided' ? colors.red600 : colors.green600 }]}>
                        {selected.status === 'voided' ? 'Anulada' : 'Completada'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[tw`text-sm mt-0.5`, { color: colors.gray400 }]}>
                    {formatServerDateTime(selected.created_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={[tw`w-9 h-9 rounded-full items-center justify-center`, { backgroundColor: colors.gray100 }]}
                >
                  <Feather name="x" size={18} color={colors.gray500} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={tw`px-5 py-4 pb-8`} showsVerticalScrollIndicator={false}>

                {/* Items */}
                <Text style={[tw`font-semibold mb-2`, { color: colors.gray400, fontSize: 11, letterSpacing: 0.5 }]}>
                  PRODUCTOS ({selected.items.length})
                </Text>
                {selected.items.map((item) => (
                  <View
                    key={item.id}
                    style={[tw`flex-row items-center py-2.5`, { borderBottomWidth: 1, borderBottomColor: colors.gray50 }]}
                  >
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-medium`, { color: colors.gray800, fontSize: 14 }]} numberOfLines={1}>
                        {item.product_name}
                      </Text>
                      <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>
                        {item.product_sku} · {clp(item.unit_price)} c/u
                      </Text>
                    </View>
                    <Text style={[tw`font-semibold`, { color: colors.gray400, fontSize: 14, marginRight: 10 }]}>
                      ×{item.quantity}
                    </Text>
                    <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 14, minWidth: 72, textAlign: 'right' }]}>
                      {clp(item.subtotal)}
                    </Text>
                  </View>
                ))}

                {/* Totals */}
                <View style={[tw`rounded-2xl p-4 mt-4 mb-3`, { backgroundColor: colors.gray50 }]}>
                  {selected.tax_amount > 0 && (
                    <View style={tw`flex-row justify-between mb-2`}>
                      <Text style={{ color: colors.gray500 }}>Subtotal (sin IVA)</Text>
                      <Text style={{ color: colors.gray800, fontWeight: '600' }}>{clp(selected.subtotal)}</Text>
                    </View>
                  )}
                  {selected.tax_amount > 0 && (
                    <View style={tw`flex-row justify-between mb-2`}>
                      <Text style={{ color: colors.gray500 }}>IVA (19%)</Text>
                      <Text style={{ color: colors.gray800, fontWeight: '600' }}>{clp(selected.tax_amount)}</Text>
                    </View>
                  )}
                  {selected.discount_amount > 0 && (
                    <View style={tw`flex-row justify-between mb-2`}>
                      <Text style={{ color: colors.green600 }}>Descuento</Text>
                      <Text style={{ color: colors.green600, fontWeight: '600' }}>-{clp(selected.discount_amount)}</Text>
                    </View>
                  )}
                  <View style={[tw`flex-row justify-between pt-2.5`, { borderTopWidth: 1, borderTopColor: colors.gray200 }]}>
                    <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 16 }]}>Total</Text>
                    <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 22 }]}>{clp(selected.total)}</Text>
                  </View>
                </View>

                {/* Payment */}
                <View style={[tw`rounded-2xl p-4 mb-4`, { backgroundColor: `${colors.primary}08`, borderWidth: 1, borderColor: `${colors.primary}20` }]}>
                  <View style={tw`flex-row items-center gap-2 mb-2`}>
                    <Feather name={METHOD_ICON[selected.payment_method] as any} size={14} color={colors.primary} />
                    <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                      {METHOD_LABEL[selected.payment_method]}
                    </Text>
                  </View>
                  {selected.cash_amount > 0 && (
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.gray500, fontSize: 13 }}>Efectivo recibido</Text>
                      <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 13 }}>{clp(selected.cash_amount)}</Text>
                    </View>
                  )}
                  {selected.card_amount > 0 && (
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.gray500, fontSize: 13 }}>Tarjeta</Text>
                      <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 13 }}>{clp(selected.card_amount)}</Text>
                    </View>
                  )}
                  {selected.transfer_amount > 0 && (
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.gray500, fontSize: 13 }}>Transferencia</Text>
                      <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 13 }}>{clp(selected.transfer_amount)}</Text>
                    </View>
                  )}
                  {selected.change_amount > 0 && (
                    <View style={tw`flex-row justify-between mt-1`}>
                      <Text style={{ color: colors.gray500, fontSize: 13 }}>Vuelto</Text>
                      <Text style={{ color: colors.green600, fontWeight: '700', fontSize: 13 }}>{clp(selected.change_amount)}</Text>
                    </View>
                  )}
                  {selected.points_earned > 0 && (
                    <Text style={[tw`text-xs mt-2 font-semibold`, { color: colors.green600 }]}>
                      +{selected.points_earned} puntos ganados
                    </Text>
                  )}
                  {selected.points_redeemed > 0 && (
                    <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>
                      {selected.points_redeemed} puntos canjeados (-{clp(selected.discount_amount)})
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={[tw`flex-row`, { gap: 10 }]}>
                  <TouchableOpacity
                    onPress={() => setReceipt(selected)}
                    style={[tw`flex-1 flex-row items-center justify-center py-4 rounded-2xl gap-2`, { backgroundColor: colors.gray800 }]}
                  >
                    <Feather name="printer" size={16} color="#fff" />
                    <Text style={tw`font-bold text-white`}>Ver boleta</Text>
                  </TouchableOpacity>
                  {isAdmin && selected.status === 'completed' && (
                    <TouchableOpacity
                      onPress={() => handleVoid(selected)}
                      disabled={voiding}
                      style={[tw`flex-row items-center justify-center py-4 px-5 rounded-2xl gap-1`, { backgroundColor: colors.red100 }]}
                    >
                      {voiding
                        ? <ActivityIndicator color={colors.red600} size="small" />
                        : <><Feather name="x-circle" size={16} color={colors.red600} /><Text style={[tw`font-bold text-sm`, { color: colors.red600 }]}>Anular</Text></>
                      }
                    </TouchableOpacity>
                  )}
                </View>

              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {receipt && (
        <ReceiptPreviewModal
          sale={receipt}
          storeName={storeName}
          onClose={() => setReceipt(null)}
        />
      )}

    </SafeAreaView>
  )
}
