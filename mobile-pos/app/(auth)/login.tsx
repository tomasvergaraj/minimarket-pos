/**
 * Login PIN — mismo diseño que el POS desktop (LoginPage.tsx)
 * Gradiente: from-blue-900 via-blue-800 to-blue-500 (nexoPalette)
 * Tarjeta blanca central con ícono Nexo, display PIN, numpad
 */
import { useState } from 'react'
import {
  View, Text, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Image, TouchableOpacity, TextInput,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { PinPad } from '../../src/components/pos/PinPad'
import { useAuthStore } from '../../src/stores/authStore'
import { loginPin } from '../../src/api/users'
import { getServerUrl, setServerUrl } from '../../src/api/client'
import tw, { colors } from '../../src/utils/tw'

const PIN_LENGTH = 6

export default function LoginScreen() {
  const [pin, setPin]                 = useState('')
  const [loading, setLoading]         = useState(false)
  const [showConfig, setShowConfig]   = useState(false)
  const [serverUrl, setServerUrlLocal] = useState(getServerUrl())
  const login = useAuthStore((s) => s.login)

  const handleDigit = (d: string) => {
    if (pin.length < PIN_LENGTH) setPin((p) => p + d)
  }

  const handleDelete = () => setPin((p) => p.slice(0, -1))

  const handleSubmit = async () => {
    if (!pin || loading) return
    setLoading(true)
    try {
      const session = await loginPin(pin)
      login(session)
      router.replace('/(pos)')
    } catch (err: any) {
      Alert.alert('PIN incorrecto', err?.message ?? 'Verifica tu PIN e intenta de nuevo')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveServer = () => {
    setServerUrl(serverUrl.trim())
    Alert.alert('Servidor actualizado')
    setShowConfig(false)
  }

  return (
    // Gradiente idéntico al desktop: from-blue-900 via-blue-800 to-blue-500 (nexo cyan)
    <LinearGradient
      colors={[colors.primaryBg, '#155e75', colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={tw`flex-1`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tw`flex-1`}
      >
        <ScrollView
          contentContainerStyle={tw`flex-1 items-center justify-center px-6 py-10`}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tarjeta blanca — igual al desktop */}
          <View style={[tw`bg-white rounded-2xl p-8 w-full`, { maxWidth: 380, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 }]}>

            {/* Ícono Nexo */}
            <Image
              source={require('../../assets/icon.png')}
              style={[tw`rounded-xl mb-4`, { width: 64, height: 64, alignSelf: 'center' }]}
              resizeMode="contain"
            />

            <Text style={tw`text-2xl font-bold text-center text-gray-800 mb-1`}>Nexo</Text>
            <Text style={tw`text-center text-gray-500 mb-6`}>Ingrese su PIN</Text>

            {/* PinPad */}
            <PinPad
              pin={pin}
              onDigit={handleDigit}
              onDelete={handleDelete}
              onSubmit={handleSubmit}
              maxLength={PIN_LENGTH}
              loading={loading}
            />

            {/* Configurar servidor */}
            <TouchableOpacity
              onPress={() => setShowConfig((v) => !v)}
              style={tw`mt-5 items-center`}
            >
              <Text style={tw`text-sm text-gray-400`}>Configurar servidor</Text>
            </TouchableOpacity>

            {showConfig && (
              <View style={tw`mt-3 gap-2`}>
                <TextInput
                  value={serverUrl}
                  onChangeText={setServerUrlLocal}
                  placeholder="http://192.168.1.100:8001"
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[tw`border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800`, { borderWidth: 1 }]}
                />
                <TouchableOpacity
                  onPress={handleSaveServer}
                  style={tw`bg-gray-800 rounded-lg py-2 items-center`}
                >
                  <Text style={tw`text-white text-sm font-semibold`}>Guardar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}
