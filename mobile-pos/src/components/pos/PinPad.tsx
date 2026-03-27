/**
 * PinPad — idéntico al diseño del POS desktop (LoginPage.tsx)
 * Filas: 1-9 | C / 0 / OK
 */
import { View, Text, TouchableOpacity } from 'react-native'
import tw, { colors } from '../../utils/tw'

interface Props {
  pin: string
  onDigit: (d: string) => void
  onDelete: () => void
  onSubmit: () => void
  maxLength?: number
  loading?: boolean
}

export function PinPad({ pin, onDigit, onDelete, onSubmit, maxLength = 6, loading = false }: Props) {
  return (
    <View style={tw`w-full`}>
      {/* Display PIN (asteriscos + placeholders) — igual al desktop */}
      <View style={tw`bg-gray-100 rounded-lg p-4 mb-5 items-center`}>
        <Text style={tw`text-3xl tracking-widest font-mono text-gray-800`}>
          {'*'.repeat(pin.length)}
          <Text style={tw`text-gray-300`}>{'_'.repeat(Math.max(0, maxLength - pin.length))}</Text>
        </Text>
      </View>

      {/* Grid 3×3: dígitos 1–9 */}
      <View style={tw`gap-3`}>
        {[[1,2,3],[4,5,6],[7,8,9]].map((row, ri) => (
          <View key={ri} style={tw`flex-row gap-3`}>
            {row.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => onDigit(String(d))}
                disabled={loading}
                style={tw`flex-1 bg-gray-100 py-4 rounded-lg items-center`}
              >
                <Text style={tw`text-xl font-semibold text-gray-800`}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Última fila: C / 0 / OK */}
        <View style={tw`flex-row gap-3`}>
          {/* C — limpiar todo */}
          <TouchableOpacity
            onPress={onDelete}
            disabled={loading}
            style={tw`flex-1 bg-red-100 py-4 rounded-lg items-center`}
          >
            <Text style={tw`text-xl font-semibold text-red-600`}>⌫</Text>
          </TouchableOpacity>

          {/* 0 */}
          <TouchableOpacity
            onPress={() => onDigit('0')}
            disabled={loading}
            style={tw`flex-1 bg-gray-100 py-4 rounded-lg items-center`}
          >
            <Text style={tw`text-xl font-semibold text-gray-800`}>0</Text>
          </TouchableOpacity>

          {/* OK */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading || pin.length === 0}
            style={[
              tw`flex-1 py-4 rounded-lg items-center`,
              { backgroundColor: pin.length > 0 && !loading ? colors.primary : colors.gray200 },
            ]}
          >
            <Text style={[
              tw`text-xl font-semibold`,
              { color: pin.length > 0 && !loading ? colors.white : colors.gray400 },
            ]}>
              {loading ? '…' : 'OK'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
