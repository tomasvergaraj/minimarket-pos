import { useState } from 'react'
import {
  View, Text, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import * as Print from 'expo-print'
import { Feather } from '@expo/vector-icons'
import { clp } from '../../utils/currency'
import { formatServerDate, formatServerTime } from '../../utils/date'
import { buildReceiptHtml } from '../../utils/receiptHtml'
import { downloadReceipt } from '../../api/sales'
import tw, { colors } from '../../utils/tw'
import type { Sale } from '../../types'

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto',
}
const PAYMENT_ICON: Record<string, string> = {
  cash: 'dollar-sign', card: 'credit-card', transfer: 'send', mixed: 'layers',
}

interface Props {
  sale: Sale
  storeName?: string
  onClose(): void
}

export default function ReceiptPreviewModal({ sale, storeName = 'Mi Tienda', onClose }: Props) {
  const [printing,    setPrinting]    = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const html = buildReceiptHtml(sale, storeName)
      await Print.printAsync({ html, width: 227 }) // 80mm ≈ 227pt
    } catch (err: any) {
      // User cancelled = no error to show
      if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
        Alert.alert('Error al imprimir', err?.message ?? 'No se pudo imprimir')
      }
    } finally {
      setPrinting(false)
    }
  }

  const handleShare = async () => {
    setDownloading(true)
    try {
      await downloadReceipt(sale.id, sale.sale_number)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo generar el PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={[tw`bg-white`, { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }]}>

          {/* Handle + header */}
          <View style={tw`items-center pt-3 pb-1`}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray200 }} />
          </View>
          <View style={[tw`flex-row items-center justify-between px-5 pb-4 pt-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
            <View style={tw`flex-row items-center gap-2`}>
              <Feather name="file-text" size={18} color={colors.primary} />
              <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 18 }]}>
                Boleta #{sale.sale_number}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[tw`w-9 h-9 rounded-full items-center justify-center`, { backgroundColor: colors.gray100 }]}
            >
              <Feather name="x" size={18} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={tw`pb-6`} showsVerticalScrollIndicator={false}>

            {/* ── Ticket visual ────────────────────────────────────────── */}
            <View style={[tw`mx-4 mt-4 rounded-2xl overflow-hidden`, { backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }]}>

              {/* Store header */}
              <View style={[tw`items-center py-5 px-4`, { backgroundColor: colors.gray800 }]}>
                <Text style={[tw`font-bold tracking-widest text-white`, { fontSize: 15, letterSpacing: 2 }]}>
                  {storeName.toUpperCase()}
                </Text>
                <Text style={[tw`mt-1`, { color: colors.gray200, fontSize: 12 }]}>Boleta de venta</Text>
              </View>

              {/* Meta */}
              <View style={[tw`px-4 py-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                <View style={tw`flex-row justify-between`}>
                  <Text style={{ color: colors.gray500, fontSize: 12 }}>Boleta Nro</Text>
                  <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 13 }]}>#{sale.sale_number}</Text>
                </View>
                <View style={tw`flex-row justify-between mt-1`}>
                  <Text style={{ color: colors.gray500, fontSize: 12 }}>Fecha</Text>
                  <Text style={{ color: colors.gray800, fontSize: 12 }}>
                    {formatServerDate(sale.created_at)} {formatServerTime(sale.created_at)}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <View style={tw`px-4 py-3`}>
                {sale.items.map((item) => (
                  <View key={item.id} style={[tw`flex-row items-start justify-between py-1.5`, { borderBottomWidth: 1, borderBottomColor: colors.gray50 }]}>
                    <View style={tw`flex-1 mr-3`}>
                      <Text style={[tw`font-semibold`, { color: colors.gray800, fontSize: 12 }]} numberOfLines={2}>
                        {item.product_name}
                      </Text>
                      <Text style={{ color: colors.gray400, fontSize: 11 }}>
                        {item.quantity} × {clp(item.unit_price)}
                      </Text>
                    </View>
                    <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 13 }]}>{clp(item.subtotal)}</Text>
                  </View>
                ))}
              </View>

              {/* Totals */}
              <View style={[tw`px-4 py-3`, { borderTopWidth: 1, borderTopColor: colors.gray100, backgroundColor: colors.gray50 }]}>
                {sale.tax_amount > 0 && (
                  <>
                    <View style={tw`flex-row justify-between mb-1`}>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>Neto</Text>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>{clp(sale.total - sale.tax_amount)}</Text>
                    </View>
                    <View style={tw`flex-row justify-between mb-1`}>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>IVA (19%)</Text>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>{clp(sale.tax_amount)}</Text>
                    </View>
                  </>
                )}
                {sale.discount_amount > 0 && (
                  <View style={tw`flex-row justify-between mb-1`}>
                    <Text style={{ color: colors.green600, fontSize: 12 }}>Descuento</Text>
                    <Text style={{ color: colors.green600, fontSize: 12 }}>-{clp(sale.discount_amount)}</Text>
                  </View>
                )}
                <View style={[tw`flex-row justify-between pt-2`, { borderTopWidth: 1, borderTopColor: colors.gray200, marginTop: 4 }]}>
                  <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 15 }]}>TOTAL</Text>
                  <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 17 }]}>{clp(sale.total)}</Text>
                </View>
              </View>

              {/* Payment */}
              <View style={[tw`px-4 py-3`, { borderTopWidth: 1, borderTopColor: colors.gray100 }]}>
                <View style={[tw`flex-row items-center gap-2 mb-2`]}>
                  <Feather name={PAYMENT_ICON[sale.payment_method] as any} size={13} color={colors.primary} />
                  <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 13 }]}>
                    {PAYMENT_LABEL[sale.payment_method]}
                  </Text>
                </View>
                {sale.cash_amount     > 0 && <View style={tw`flex-row justify-between`}><Text style={{ color: colors.gray500, fontSize: 12 }}>Efectivo</Text><Text style={{ color: colors.gray800, fontSize: 12 }}>{clp(sale.cash_amount)}</Text></View>}
                {sale.card_amount     > 0 && <View style={tw`flex-row justify-between`}><Text style={{ color: colors.gray500, fontSize: 12 }}>Tarjeta</Text><Text style={{ color: colors.gray800, fontSize: 12 }}>{clp(sale.card_amount)}</Text></View>}
                {sale.transfer_amount > 0 && <View style={tw`flex-row justify-between`}><Text style={{ color: colors.gray500, fontSize: 12 }}>Transferencia</Text><Text style={{ color: colors.gray800, fontSize: 12 }}>{clp(sale.transfer_amount)}</Text></View>}
                {sale.change_amount   > 0 && (
                  <View style={tw`flex-row justify-between mt-1`}>
                    <Text style={[tw`font-semibold`, { color: colors.green600, fontSize: 13 }]}>Vuelto</Text>
                    <Text style={[tw`font-bold`, { color: colors.green600, fontSize: 14 }]}>{clp(sale.change_amount)}</Text>
                  </View>
                )}
              </View>

              {/* Loyalty */}
              {(sale.points_earned > 0 || sale.points_redeemed > 0) && (
                <View style={[tw`px-4 py-3`, { borderTopWidth: 1, borderTopColor: colors.gray100 }]}>
                  {sale.points_redeemed > 0 && (
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>Puntos canjeados</Text>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>-{sale.points_redeemed} pts</Text>
                    </View>
                  )}
                  {sale.points_earned > 0 && (
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.gray500, fontSize: 12 }}>Puntos ganados</Text>
                      <Text style={{ color: colors.green600, fontSize: 12, fontWeight: '600' }}>+{sale.points_earned} pts</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Footer */}
              <View style={[tw`items-center py-4`, { backgroundColor: colors.gray50 }]}>
                <Text style={{ color: colors.gray400, fontSize: 10, letterSpacing: 1 }}>
                  *** GRACIAS POR SU COMPRA ***
                </Text>
              </View>
            </View>

            {/* ── Action buttons ───────────────────────────────────────── */}
            <View style={[tw`flex-row mx-4 mt-5`, { gap: 12 }]}>
              <TouchableOpacity
                onPress={handlePrint}
                disabled={printing}
                style={[tw`flex-1 flex-row items-center justify-center py-4 rounded-2xl gap-2`, { backgroundColor: colors.gray800 }]}
              >
                {printing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="printer" size={18} color="#fff" />
                }
                <Text style={[tw`font-bold text-white`, { fontSize: 15 }]}>
                  {printing ? 'Preparando...' : 'Imprimir'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                disabled={downloading}
                style={[tw`flex-row items-center justify-center py-4 px-5 rounded-2xl gap-2`, { backgroundColor: `${colors.primary}15` }]}
              >
                {downloading
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Feather name="share-2" size={18} color={colors.primary} />
                }
                <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 15 }]}>PDF</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
