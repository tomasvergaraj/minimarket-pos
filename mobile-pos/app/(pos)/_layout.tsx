import { Tabs } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../src/utils/tw'
import { useCartStore, cartCount } from '../../src/stores/cartStore'
import { useAuthStore } from '../../src/stores/authStore'

export default function PosLayout() {
  const count   = useCartStore(cartCount)
  const insets  = useSafeAreaInsets()
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: colors.gray200,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Venta',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            fontSize: 12,
          },
          tabBarIcon: ({ color }) => <Feather name="shopping-cart" size={25} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Historial',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="list" size={25} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Inventario',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="package" size={25} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cash"
        options={{
          title: 'Caja',
          tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={25} color={color} />,
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  )
}
