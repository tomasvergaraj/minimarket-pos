import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { listProducts, updateProduct } from '../../src/api/products'
import { adjustStock } from '../../src/api/kardex'
import { clp } from '../../src/utils/currency'
import tw, { colors } from '../../src/utils/tw'
import type { Product } from '../../src/types'
import type { KardexMovementType } from '../../src/api/kardex'

const MOVEMENT_TYPES: { key: KardexMovementType; label: string; icon: string; color: string }[] = [
  { key: 'restock',    label: 'Entrada',  icon: 'plus-circle',  color: colors.green600 },
  { key: 'adjustment', label: 'Ajuste',   icon: 'edit-2',       color: colors.primary  },
  { key: 'shrinkage',  label: 'Merma',    icon: 'minus-circle', color: colors.red600   },
]

export default function ProductsScreen() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [search, setSearch]             = useState('')
  const [debounced, setDebounced]       = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [products, setProducts]         = useState<Product[]>([])
  const [loading, setLoading]           = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  const [selected, setSelected]         = useState<Product | null>(null)

  // Price edit
  const [newPrice, setNewPrice]       = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  // Stock adjustment
  const [movType, setMovType]         = useState<KardexMovementType>('restock')
  const [adjQty, setAdjQty]           = useState('')
  const [adjNotes, setAdjNotes]       = useState('')
  const [savingStock, setSavingStock] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await listProducts({
        search:      debounced.trim() || undefined,
        active_only: false,
        limit:       200,
      })
      setProducts(data)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo cargar el inventario')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [debounced])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const filtered = lowStockOnly
    ? products.filter((p) => p.stock <= (p.min_stock ?? 0))
    : products

  const noStockCount  = products.filter((p) => p.stock <= 0).length
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= (p.min_stock ?? 0)).length

  const openDetail = (p: Product) => {
    setSelected(p)
    setNewPrice('')
    setAdjQty('')
    setAdjNotes('')
    setMovType('restock')
  }

  const handleSavePrice = async () => {
    if (!selected) return
    const price = parseFloat(newPrice)
    if (isNaN(price) || price < 0) { Alert.alert('Error', 'Precio inválido'); return }
    setSavingPrice(true)
    try {
      const updated = await updateProduct(selected.id, { sell_price: price })
      setSelected(updated)
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p))
      setNewPrice('')
      Alert.alert('✓ Precio actualizado', `${updated.name}: ${clp(updated.sell_price)}`)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo actualizar el precio')
    } finally {
      setSavingPrice(false)
    }
  }

  const handleAdjustStock = async () => {
    if (!selected) return
    const qty = parseInt(adjQty)
    if (isNaN(qty) || qty <= 0) { Alert.alert('Error', 'Ingresa una cantidad válida'); return }
    setSavingStock(true)
    try {
      const entry = await adjustStock({
        product_id:    selected.id,
        movement_type: movType,
        quantity:      qty,
        notes:         adjNotes.trim() || undefined,
      })
      const updatedProduct = { ...selected, stock: entry.stock_after }
      setSelected(updatedProduct)
      setProducts((prev) => prev.map((p) => p.id === selected.id ? updatedProduct : p))
      setAdjQty('')
      setAdjNotes('')
      Alert.alert('✓ Stock actualizado', `${entry.stock_before} → ${entry.stock_after} unidades`)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo ajustar el stock')
    } finally {
      setSavingStock(false)
    }
  }

  const renderProduct = ({ item: p }: { item: Product }) => {
    const noStock  = p.stock <= 0
    const lowStock = !noStock && p.stock <= (p.min_stock ?? 0)
    return (
      <TouchableOpacity
        onPress={() => openDetail(p)}
        activeOpacity={0.7}
        style={[
          tw`bg-white rounded-2xl px-4 py-3.5 mb-2.5 flex-row items-center`,
          { elevation: 1, borderWidth: 1, borderColor: noStock ? colors.red100 : lowStock ? '#fde68a' : colors.gray100 },
        ]}
      >
        <View style={[
          tw`w-10 h-10 rounded-xl items-center justify-center mr-3`,
          { backgroundColor: noStock ? colors.red100 : lowStock ? '#fef3c7' : `${colors.primary}12` },
        ]}>
          <Feather
            name="package"
            size={18}
            color={noStock ? colors.red600 : lowStock ? '#d97706' : colors.primary}
          />
        </View>
        <View style={tw`flex-1`}>
          <Text style={[tw`font-semibold`, { color: colors.gray800, fontSize: 14 }]} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>
            SKU: {p.sku}{p.category ? ` · ${p.category}` : ''}
          </Text>
        </View>
        <View style={tw`items-end ml-2`}>
          <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 14 }]}>{clp(p.sell_price)}</Text>
          {noStock ? (
            <View style={[tw`flex-row items-center gap-0.5 px-1.5 py-0.5 rounded-full mt-0.5`, { backgroundColor: colors.red100 }]}>
              <Feather name="alert-triangle" size={9} color={colors.red600} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.red600 }}>Sin stock</Text>
            </View>
          ) : lowStock ? (
            <View style={[tw`flex-row items-center gap-0.5 px-1.5 py-0.5 rounded-full mt-0.5`, { backgroundColor: '#fef3c7' }]}>
              <Feather name="alert-triangle" size={9} color="#d97706" />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#d97706' }}>{p.stock} restantes</Text>
            </View>
          ) : (
            <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>Stock: {p.stock}</Text>
          )}
        </View>
        {isAdmin && <Feather name="chevron-right" size={14} color={colors.gray200} style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`} edges={['top']}>

      {/* Header */}
      <View style={[tw`bg-white px-4 pt-4 pb-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={[tw`font-bold`, { fontSize: 20, color: colors.gray800 }]}>Inventario</Text>
          <View style={tw`flex-row gap-2`}>
            {noStockCount > 0 && (
              <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-full`, { backgroundColor: colors.red100 }]}>
                <Feather name="alert-triangle" size={10} color={colors.red600} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.red600 }}>{noStockCount} sin stock</Text>
              </View>
            )}
            {lowStockCount > 0 && (
              <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-full`, { backgroundColor: '#fef3c7' }]}>
                <Feather name="alert-triangle" size={10} color="#d97706" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#d97706' }}>{lowStockCount} bajo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={[tw`flex-row items-center rounded-xl px-3 py-2 mb-2`, { backgroundColor: colors.gray100, gap: 8 }]}>
          <Feather name="search" size={15} color={colors.gray400} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre, SKU, código..."
            style={[tw`flex-1 text-gray-800`, { fontSize: 14 }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Low stock toggle */}
        <TouchableOpacity
          onPress={() => setLowStockOnly((v) => !v)}
          style={[
            tw`flex-row items-center gap-2 py-1.5 px-3 rounded-xl border`,
            {
              alignSelf: 'flex-start',
              borderColor:     lowStockOnly ? '#d97706' : colors.gray200,
              backgroundColor: lowStockOnly ? '#fef3c7' : 'transparent',
            },
          ]}
        >
          <Feather name="alert-triangle" size={12} color={lowStockOnly ? '#d97706' : colors.gray400} />
          <Text style={[tw`text-xs font-semibold`, { color: lowStockOnly ? '#d97706' : colors.gray500 }]}>
            Solo stock bajo / sin stock
          </Text>
        </TouchableOpacity>
      </View>

      {/* Product list */}
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[tw`px-4 py-3`, filtered.length === 0 && tw`flex-1`]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchProducts(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={tw`flex-1 items-center justify-center py-16`}>
              <Feather name="package" size={48} color={colors.gray200} />
              <Text style={[tw`font-semibold mt-4`, { color: colors.gray400, fontSize: 16 }]}>
                {lowStockOnly ? 'Sin productos con stock bajo' : 'Sin productos'}
              </Text>
            </View>
          }
          renderItem={renderProduct}
        />
      )}

      {/* Detail / Edit Modal */}
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
                <View style={tw`flex-1 mr-3`}>
                  <Text style={[tw`font-bold`, { fontSize: 18, color: colors.gray800 }]} numberOfLines={2}>
                    {selected.name}
                  </Text>
                  <Text style={[tw`text-sm mt-0.5`, { color: colors.gray400 }]}>
                    SKU: {selected.sku}{selected.category ? ` · ${selected.category}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={[tw`w-9 h-9 rounded-full items-center justify-center`, { backgroundColor: colors.gray100 }]}
                >
                  <Feather name="x" size={18} color={colors.gray500} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={tw`px-5 py-4 pb-8`} keyboardShouldPersistTaps="handled">

                {/* Stats */}
                <View style={[tw`flex-row gap-3 mb-5`]}>
                  <View style={[tw`flex-1 rounded-2xl p-4 items-center`, { backgroundColor: colors.gray50 }]}>
                    <Text style={[tw`font-bold`, {
                      fontSize: 30,
                      color: selected.stock <= 0
                        ? colors.red600
                        : selected.stock <= (selected.min_stock ?? 0)
                          ? '#d97706'
                          : colors.primary,
                    }]}>
                      {selected.stock}
                    </Text>
                    <Text style={[tw`text-xs mt-1`, { color: colors.gray400 }]}>En stock</Text>
                    {selected.min_stock != null && selected.min_stock > 0 && (
                      <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>Mínimo: {selected.min_stock}</Text>
                    )}
                  </View>
                  <View style={[tw`flex-1 rounded-2xl p-4 items-center`, { backgroundColor: colors.gray50 }]}>
                    <Text style={[tw`font-bold`, { fontSize: 30, color: colors.gray800 }]}>{clp(selected.sell_price)}</Text>
                    <Text style={[tw`text-xs mt-1`, { color: colors.gray400 }]}>Precio venta</Text>
                    {selected.cost_price > 0 && (
                      <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>Costo: {clp(selected.cost_price)}</Text>
                    )}
                  </View>
                </View>

                {isAdmin ? (
                  <>
                    {/* ── Edit price ── */}
                    <Text style={[tw`font-bold mb-3`, { color: colors.gray800, fontSize: 15 }]}>
                      Actualizar precio de venta
                    </Text>
                    <View style={[tw`flex-row gap-2 mb-5`]}>
                      <TextInput
                        value={newPrice}
                        onChangeText={setNewPrice}
                        placeholder={`Actual: ${selected.sell_price}`}
                        keyboardType="numeric"
                        style={[
                          tw`flex-1 border rounded-xl px-4 py-3 font-bold text-gray-800`,
                          { borderWidth: 1.5, borderColor: newPrice ? colors.primary : colors.gray200, fontSize: 20 },
                        ]}
                      />
                      <TouchableOpacity
                        onPress={handleSavePrice}
                        disabled={savingPrice || !newPrice}
                        style={[
                          tw`px-5 rounded-xl items-center justify-center`,
                          { backgroundColor: newPrice ? colors.primary : colors.gray200 },
                        ]}
                      >
                        {savingPrice
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Feather name="check" size={22} color={newPrice ? '#fff' : colors.gray400} />
                        }
                      </TouchableOpacity>
                    </View>

                    {/* ── Stock adjustment ── */}
                    <Text style={[tw`font-bold mb-3`, { color: colors.gray800, fontSize: 15 }]}>
                      Ajuste de stock
                    </Text>

                    {/* Movement type */}
                    <View style={[tw`flex-row mb-3`, { gap: 6 }]}>
                      {MOVEMENT_TYPES.map(({ key, label, icon, color }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setMovType(key)}
                          style={[
                            tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-1 border`,
                            movType === key
                              ? { backgroundColor: color, borderColor: color }
                              : { borderColor: colors.gray200 },
                          ]}
                        >
                          <Feather name={icon as any} size={13} color={movType === key ? '#fff' : colors.gray400} />
                          <Text style={[tw`text-xs font-semibold`, { color: movType === key ? '#fff' : colors.gray500 }]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      value={adjQty}
                      onChangeText={setAdjQty}
                      placeholder="Cantidad"
                      keyboardType="numeric"
                      style={[
                        tw`border rounded-xl px-4 py-3 font-bold text-gray-800 text-center mb-2`,
                        { borderWidth: 1.5, borderColor: adjQty ? colors.primary : colors.gray200, fontSize: 24 },
                      ]}
                    />
                    <TextInput
                      value={adjNotes}
                      onChangeText={setAdjNotes}
                      placeholder="Notas / motivo (opcional)"
                      style={[
                        tw`border rounded-xl px-4 py-3 text-gray-700 mb-4`,
                        { borderWidth: 1, borderColor: colors.gray200 },
                      ]}
                    />

                    <TouchableOpacity
                      onPress={handleAdjustStock}
                      disabled={savingStock || !adjQty}
                      style={[
                        tw`py-4 rounded-2xl items-center flex-row justify-center gap-2`,
                        { backgroundColor: adjQty ? MOVEMENT_TYPES.find((m) => m.key === movType)?.color ?? colors.primary : colors.gray200 },
                      ]}
                    >
                      {savingStock ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Feather
                            name={MOVEMENT_TYPES.find((m) => m.key === movType)?.icon as any ?? 'check'}
                            size={16}
                            color={adjQty ? '#fff' : colors.gray400}
                          />
                          <Text style={[tw`font-bold`, { color: adjQty ? '#fff' : colors.gray400 }]}>
                            Aplicar ajuste
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={[tw`rounded-2xl p-5 items-center`, { backgroundColor: colors.gray50 }]}>
                    <Feather name="lock" size={28} color={colors.gray200} />
                    <Text style={[tw`text-sm mt-3 text-center font-semibold`, { color: colors.gray400 }]}>
                      Solo administradores pueden editar productos
                    </Text>
                  </View>
                )}

              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

    </SafeAreaView>
  )
}
