import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Switch, Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
import Constants from 'expo-constants'
import { getServerUrl, setServerUrl, api } from '../../src/api/client'
import { getReceiptPref, setReceiptPref } from '../../src/api/sales'
import { syncProductCache } from '../../src/api/products'
import { getCacheInfo, clearProductCache } from '../../src/db/productCache'
import { getPendingCount, clearQueue } from '../../src/db/saleQueue'
import { useAuthStore } from '../../src/stores/authStore'
import { useCashStore } from '../../src/stores/cashStore'
import { usePrinterStore } from '../../src/stores/printerStore'
import { getPairedPrinters, type BtDevice } from '../../src/services/printer'
import tw, { colors } from '../../src/utils/tw'

export default function SettingsScreen() {
  const { user, logout } = useAuthStore()
  const { session: cashSession, clearSession: clearCash } = useCashStore()
  const printer = usePrinterStore()

  const [serverUrl, setServerUrlLocal]     = useState(getServerUrl())
  const [testing, setTesting]              = useState(false)
  const [isOnline, setIsOnline]            = useState<boolean | null>(null)
  const [receiptAuto, setReceiptAutoLocal] = useState(() => getReceiptPref())
  const [cacheInfo, setCacheInfo]          = useState<{ count: number; at: Date } | null>(null)
  const [pendingCount, setPendingCount]    = useState(0)
  const [syncing, setSyncing]              = useState(false)

  // Printer
  const [showPrinterPicker, setShowPrinterPicker] = useState(false)
  const [btDevices, setBtDevices]                 = useState<BtDevice[]>([])
  const [loadingDevices, setLoadingDevices]       = useState(false)
  const [printerStoreName, setPrinterStoreName]   = useState(printer.storeName)

  useEffect(() => {
    getCacheInfo().then(setCacheInfo).catch(() => {})
    getPendingCount().then(setPendingCount).catch(() => {})
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? null)
    })
    return unsub
  }, [])

  const handleSaveUrl = () => {
    const trimmed = serverUrl.trim().replace(/\/$/, '')
    if (!trimmed) { Alert.alert('URL inválida', 'Ingresa una URL válida'); return }
    setServerUrl(trimmed)
    setServerUrlLocal(trimmed)
    Alert.alert('Guardado', 'URL del servidor actualizada')
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      await api.get('/config', { timeout: 5000 })
      Alert.alert('Conexión exitosa', `Servidor respondió correctamente.\n${getServerUrl()}`)
    } catch (err: any) {
      Alert.alert('Sin conexión', err?.message ?? `No se pudo conectar a ${getServerUrl()}`)
    } finally {
      setTesting(false)
    }
  }

  const handleLoadDevices = async () => {
    setLoadingDevices(true)
    try {
      const devices = await getPairedPrinters()
      setBtDevices(devices)
      setShowPrinterPicker(true)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo obtener dispositivos BT')
    } finally {
      setLoadingDevices(false)
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      cashSession ? 'Tienes una sesión de caja abierta. Al cerrar sesión perderás la referencia local. ¿Continuar?' : '¿Salir del sistema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir', style: 'destructive',
          onPress: () => {
            clearCash()
            logout()
            router.replace('/(auth)/login')
          },
        },
      ],
    )
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      {/* Header */}
      <View style={[tw`bg-white px-5 py-4 flex-row items-center`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
        <Feather name="settings" size={20} color={colors.primary} style={{ marginRight: 10 }} />
        <Text style={[tw`font-bold text-gray-800 flex-1`, { fontSize: 20 }]}>Configuración</Text>
        {isOnline !== null && (
          <View style={[tw`flex-row items-center px-3 py-1 rounded-full`, { backgroundColor: isOnline ? '#dcfce7' : '#fee2e2', gap: 5 }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? '#16a34a' : '#dc2626' }} />
            <Text style={[tw`font-semibold`, { color: isOnline ? '#15803d' : '#dc2626', fontSize: 13 }]}>
              {isOnline ? 'En línea' : 'Sin red'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={tw`p-5 pb-10`} keyboardShouldPersistTaps="handled">

        {/* Session info */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Sesión activa</Text>
          <View style={tw`flex-row items-center gap-3 mb-2`}>
            <View style={[tw`w-10 h-10 rounded-full items-center justify-center`, { backgroundColor: `${colors.primary}20` }]}>
              <Feather name="user" size={18} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`font-semibold text-gray-800`, { fontSize: 16 }]}>{user?.full_name ?? user?.username}</Text>
              <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14 }]}>
                {user?.role === 'admin' ? 'Administrador' : 'Cajero'}
              </Text>
            </View>
          </View>
          {cashSession && (
            <View style={[tw`flex-row items-center gap-2 mt-1 px-3 py-2 rounded-xl`, { backgroundColor: '#dcfce7' }]}>
              <Feather name="dollar-sign" size={14} color="#15803d" />
              <Text style={[tw`font-semibold`, { color: '#15803d', fontSize: 14 }]}>Caja abierta</Text>
            </View>
          )}
        </View>

        {/* Server URL */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Servidor</Text>
          <Text style={[tw`text-sm mb-2`, { color: colors.gray500, fontSize: 14 }]}>URL del servidor FastAPI (ej: http://192.168.1.10:8001)</Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrlLocal}
            placeholder="http://192.168.1.x:8001"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[tw`border rounded-xl px-4 py-3 text-gray-800 mb-3`, { borderColor: colors.gray200, borderWidth: 1, fontSize: 15 }]}
          />
          <View style={[tw`flex-row`, { gap: 10 }]}>
            <TouchableOpacity
              onPress={handleSaveUrl}
              style={[tw`flex-1 rounded-xl items-center justify-center py-3`, { backgroundColor: colors.primary }]}
            >
              <Text style={[tw`font-semibold text-white`, { fontSize: 15 }]}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTestConnection}
              disabled={testing}
              style={[tw`flex-1 rounded-xl items-center justify-center py-3 flex-row`, { backgroundColor: colors.gray100, gap: 6 }]}
            >
              {testing
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="wifi" size={16} color={colors.gray500} />
              }
              <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 15 }]}>Probar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Receipt settings */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Boletas</Text>
          <TouchableOpacity
            onPress={() => {
              const next = !receiptAuto
              setReceiptAutoLocal(next)
              setReceiptPref(next)
            }}
            activeOpacity={0.7}
            style={tw`flex-row items-center justify-between py-1`}
          >
            <View style={tw`flex-1 mr-4`}>
              <Text style={[tw`font-semibold text-gray-800`, { fontSize: 16 }]}>Emitir boleta automáticamente</Text>
              <Text style={[tw`text-sm mt-0.5`, { color: colors.gray400, fontSize: 13 }]}>
                {receiptAuto
                  ? 'Se comparte el PDF al confirmar cada venta'
                  : 'Solo disponible desde el historial de ventas'}
              </Text>
            </View>
            <Switch
              value={receiptAuto}
              onValueChange={(v) => { setReceiptAutoLocal(v); setReceiptPref(v) }}
              trackColor={{ false: colors.gray200, true: `${colors.primary}60` }}
              thumbColor={receiptAuto ? colors.primary : '#fff'}
            />
          </TouchableOpacity>
        </View>

        {/* Impresora BT */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Impresora Bluetooth</Text>

          <>
              <View style={[tw`flex-row items-center rounded-xl p-3 mb-3`, { backgroundColor: `${colors.primary}10`, gap: 10 }]}>
                <Feather name="info" size={15} color={colors.primary} />
                <Text style={[tw`flex-1 text-sm`, { color: colors.primary, fontSize: 13 }]}>
                  La impresión usa el sistema nativo del dispositivo (WiFi, AirPrint, Bluetooth via Android Print).
                </Text>
              </View>
              {/* Nombre del negocio */}
              <Text style={[tw`text-sm mb-1`, { color: colors.gray500, fontSize: 13 }]}>Nombre del negocio (encabezado del ticket)</Text>
              <View style={[tw`flex-row mb-3`, { gap: 8 }]}>
                <TextInput
                  value={printerStoreName}
                  onChangeText={setPrinterStoreName}
                  placeholder="Mi Tienda"
                  style={[tw`flex-1 border rounded-xl px-4 py-3 text-gray-800`, { borderColor: colors.gray200, borderWidth: 1, fontSize: 15 }]}
                />
                <TouchableOpacity
                  onPress={() => { printer.setStoreName(printerStoreName.trim() || 'Mi Tienda'); Alert.alert('Guardado', 'Nombre del negocio actualizado') }}
                  style={[tw`rounded-xl items-center justify-center px-4`, { backgroundColor: colors.primary }]}
                >
                  <Feather name="check" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Impresora seleccionada */}
              <View style={[tw`flex-row items-center justify-between py-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                <View style={tw`flex-1 mr-3`}>
                  <Text style={[tw`font-semibold text-gray-800`, { fontSize: 15 }]}>Impresora activa</Text>
                  <Text style={[tw`text-sm mt-0.5`, { color: printer.macAddress ? colors.primary : colors.gray400, fontSize: 13 }]}>
                    {printer.deviceName ?? 'Sin impresora seleccionada'}
                  </Text>
                </View>
                <View style={[tw`flex-row`, { gap: 6 }]}>
                  {printer.macAddress && (
                    <TouchableOpacity
                      onPress={() => { printer.clearDevice(); Alert.alert('Impresora eliminada') }}
                      style={[tw`rounded-xl items-center justify-center px-3 py-2`, { backgroundColor: colors.red100 }]}
                    >
                      <Feather name="x" size={15} color={colors.red600} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleLoadDevices}
                    disabled={loadingDevices}
                    style={[tw`flex-row items-center rounded-xl px-3 py-2`, { backgroundColor: colors.gray100, gap: 5 }]}
                  >
                    {loadingDevices
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Feather name="bluetooth" size={15} color={colors.primary} />
                    }
                    <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 14 }]}>
                      {printer.macAddress ? 'Cambiar' : 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auto-print toggle */}
              <TouchableOpacity
                onPress={() => printer.setAutoPrint(!printer.autoPrint)}
                activeOpacity={0.7}
                style={tw`flex-row items-center justify-between py-3`}
              >
                <View style={tw`flex-1 mr-4`}>
                  <Text style={[tw`font-semibold text-gray-800`, { fontSize: 15 }]}>Imprimir automáticamente</Text>
                  <Text style={[tw`text-sm mt-0.5`, { color: colors.gray400, fontSize: 13 }]}>
                    {printer.autoPrint ? 'Se imprime al confirmar cada venta' : 'Solo desde el historial de ventas'}
                  </Text>
                </View>
                <Switch
                  value={printer.autoPrint}
                  onValueChange={printer.setAutoPrint}
                  trackColor={{ false: colors.gray200, true: `${colors.primary}60` }}
                  thumbColor={printer.autoPrint ? colors.primary : '#fff'}
                />
              </TouchableOpacity>
          </>
        </View>

        {/* BT device picker modal */}
        <Modal visible={showPrinterPicker} transparent animationType="slide" onRequestClose={() => setShowPrinterPicker(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={[tw`bg-white`, { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' }]}>
              <View style={[tw`flex-row items-center justify-between px-5 py-4`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                <Text style={[tw`font-bold`, { color: colors.gray800, fontSize: 18 }]}>Dispositivos emparejados</Text>
                <TouchableOpacity onPress={() => setShowPrinterPicker(false)}>
                  <Feather name="x" size={20} color={colors.gray500} />
                </TouchableOpacity>
              </View>
              {btDevices.length === 0 ? (
                <View style={tw`items-center py-12`}>
                  <Feather name="bluetooth" size={36} color={colors.gray200} />
                  <Text style={[tw`mt-3 font-semibold`, { color: colors.gray400, fontSize: 16 }]}>Sin dispositivos emparejados</Text>
                  <Text style={[tw`text-sm mt-1 text-center px-8`, { color: colors.gray400 }]}>
                    Empareja la impresora en los ajustes de Bluetooth del teléfono primero.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={btDevices}
                  keyExtractor={(d) => d.macAddress}
                  contentContainerStyle={tw`pb-8`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => { printer.setDevice(item.macAddress, item.deviceName); setShowPrinterPicker(false) }}
                      style={[tw`px-5 py-4 flex-row items-center`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}
                    >
                      <View style={[tw`w-10 h-10 rounded-full items-center justify-center mr-3`, { backgroundColor: `${colors.primary}15` }]}>
                        <Feather name="printer" size={18} color={colors.primary} />
                      </View>
                      <View style={tw`flex-1`}>
                        <Text style={[tw`font-semibold text-gray-800`, { fontSize: 16 }]}>{item.deviceName}</Text>
                        <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 13 }]}>{item.macAddress}</Text>
                      </View>
                      {printer.macAddress === item.macAddress && (
                        <Feather name="check-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Datos offline */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Datos offline</Text>

          {/* Cache de productos */}
          <View style={[tw`flex-row items-center justify-between py-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={[tw`font-semibold text-gray-800`, { fontSize: 15 }]}>Caché de productos</Text>
              <Text style={[tw`text-sm mt-0.5`, { color: colors.gray400, fontSize: 13 }]}>
                {cacheInfo
                  ? `${cacheInfo.count} productos · ${cacheInfo.at.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                  : 'Sin caché local'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                setSyncing(true)
                try {
                  const n = await syncProductCache()
                  const info = await getCacheInfo()
                  setCacheInfo(info)
                  Alert.alert('Caché actualizado', `${n} productos sincronizados`)
                } catch (e: any) {
                  Alert.alert('Error', e?.message ?? 'No se pudo sincronizar')
                } finally {
                  setSyncing(false)
                }
              }}
              disabled={syncing}
              style={[tw`flex-row items-center rounded-xl px-3 py-2`, { backgroundColor: colors.gray100, gap: 5 }]}
            >
              {syncing
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="refresh-cw" size={15} color={colors.primary} />
              }
              <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 14 }]}>Sync</Text>
            </TouchableOpacity>
          </View>

          {/* Cola de ventas pendientes */}
          <View style={[tw`flex-row items-center justify-between py-3`]}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={[tw`font-semibold text-gray-800`, { fontSize: 15 }]}>Ventas pendientes</Text>
              <Text style={[tw`text-sm mt-0.5`, { color: pendingCount > 0 ? '#d97706' : colors.gray400, fontSize: 13 }]}>
                {pendingCount > 0
                  ? `${pendingCount} venta${pendingCount !== 1 ? 's' : ''} en cola`
                  : 'Sin ventas pendientes'}
              </Text>
            </View>
            {pendingCount > 0 && (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Limpiar cola',
                    `¿Eliminar las ${pendingCount} venta${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar', style: 'destructive',
                        onPress: async () => {
                          await clearQueue()
                          setPendingCount(0)
                        },
                      },
                    ],
                  )
                }
                style={[tw`flex-row items-center rounded-xl px-3 py-2`, { backgroundColor: colors.red100, gap: 5 }]}
              >
                <Feather name="trash-2" size={15} color={colors.red600} />
                <Text style={[tw`font-semibold`, { color: colors.red600, fontSize: 14 }]}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* App info */}
        <View style={[tw`bg-white rounded-2xl px-5 py-4 mb-4`, { elevation: 1 }]}>
          <Text style={[tw`font-semibold mb-3`, { color: colors.gray500, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Aplicación</Text>
          <View style={[tw`flex-row justify-between py-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
            <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>Versión</Text>
            <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 15 }]}>{appVersion}</Text>
          </View>
          <View style={[tw`flex-row justify-between py-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
            <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>Servidor activo</Text>
            <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 14 }]} numberOfLines={1}>{getServerUrl()}</Text>
          </View>
          <View style={tw`flex-row justify-between py-2`}>
            <Text style={[tw`text-gray-800`, { fontSize: 15 }]}>Conectividad</Text>
            <Text style={[tw`font-semibold`, { color: isOnline ? '#16a34a' : isOnline === false ? colors.red600 : colors.gray400, fontSize: 15 }]}>
              {isOnline === null ? 'Verificando...' : isOnline ? 'En línea' : 'Sin red'}
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[tw`rounded-2xl items-center justify-center py-4 flex-row`, { backgroundColor: '#fee2e2', gap: 8 }]}
        >
          <Feather name="log-out" size={18} color={colors.red600} />
          <Text style={[tw`font-bold`, { color: colors.red600, fontSize: 16 }]}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}
