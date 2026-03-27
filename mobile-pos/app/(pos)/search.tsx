import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCartStore, cartCount } from '../../src/stores/cartStore'
import { searchProducts } from '../../src/api/products'
import { clp } from '../../src/utils/currency'
import tw, { colors } from '../../src/utils/tw'
import type { Product } from '../../src/types'

export default function SearchScreen() {
  const [query, setQuery]       = useState('')
  const [debounced, setDebounced] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(false)

  const addItem = useCartStore((s) => s.addItem)
  const count   = useCartStore(cartCount)

  // 400 ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setProducts([])
      return
    }
    setLoading(true)
    searchProducts(debounced.trim())
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [debounced])

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      {/* Search bar */}
      <View
        style={[
          tw`bg-white px-4 py-3`,
          { borderBottomWidth: 1, borderBottomColor: colors.gray200 },
        ]}
      >
        <View style={tw`flex-row items-center gap-3`}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre, SKU o código de barras..."
            returnKeyType="search"
            style={[
              tw`flex-1 rounded-xl px-4 py-2 text-gray-800`,
              { backgroundColor: colors.gray100 },
            ]}
          />
          {count > 0 && (
            <View
              style={[
                tw`rounded-full px-2 py-1 items-center justify-center`,
                { backgroundColor: colors.primary, minWidth: 28 },
              ]}
            >
              <Text style={tw`text-white text-xs font-bold`}>{count}</Text>
            </View>
          )}
        </View>
      </View>

      {loading && (
        <View style={tw`items-center py-8`}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={tw`p-3`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && debounced.trim().length >= 2 ? (
            <View style={tw`items-center py-16`}>
              <Text style={tw`text-4xl mb-2`}>🔍</Text>
              <Text style={{ color: colors.gray400 }}>
                Sin resultados para "{debounced}"
              </Text>
            </View>
          ) : !loading && query.length === 0 ? (
            <View style={tw`items-center py-16`}>
              <Text style={tw`text-4xl mb-2`}>🔍</Text>
              <Text style={{ color: colors.gray400 }}>
                Escribe al menos 2 caracteres
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const price =
            item.is_on_offer && item.discount_price != null
              ? item.discount_price
              : item.sell_price
          const hasDiscount = item.is_on_offer && item.discount_price != null

          return (
            <View
              style={[
                tw`bg-white rounded-xl px-4 py-3 mb-2 flex-row items-center`,
                { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
              ]}
            >
              {/* Info */}
              <View style={tw`flex-1`}>
                <Text style={tw`font-semibold text-gray-800`} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={tw`flex-row items-center gap-2 mt-0.5`}>
                  <Text style={{ color: colors.gray400, fontSize: 11 }}>
                    SKU: {item.sku}
                  </Text>
                  <Text
                    style={[
                      { fontSize: 11 },
                      item.stock <= (item.min_stock ?? 0)
                        ? { color: colors.red600 }
                        : { color: colors.gray400 },
                    ]}
                  >
                    Stock: {item.stock}
                  </Text>
                </View>
              </View>

              {/* Price */}
              <View style={tw`items-end mr-3`}>
                <Text
                  style={[
                    tw`font-bold text-base`,
                    { color: hasDiscount ? colors.red600 : colors.gray800 },
                  ]}
                >
                  {clp(price)}
                </Text>
                {hasDiscount && (
                  <Text
                    style={[
                      tw`text-xs line-through`,
                      { color: colors.gray400 },
                    ]}
                  >
                    {clp(item.sell_price)}
                  </Text>
                )}
              </View>

              {/* Add button */}
              <TouchableOpacity
                onPress={() => addItem(item)}
                style={[
                  tw`w-9 h-9 rounded-full items-center justify-center`,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', lineHeight: 26 }}>
                  +
                </Text>
              </TouchableOpacity>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}
