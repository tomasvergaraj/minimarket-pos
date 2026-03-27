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
      <View style={tw`bg-gray-100 rounded-2xl px-5 py-5 mb-6 items-center`}>
        <Text style={[tw`tracking-widest font-mono text-gray-800`, { fontSize: 34, lineHeight: 42 }]}>
          {'*'.repeat(pin.length)}
          <Text style={[tw`text-gray-300`, { fontSize: 34, lineHeight: 42 }]}>
            {'_'.repeat(Math.max(0, maxLength - pin.length))}
          </Text>
        </Text>
      </View>

      {/* Grid 3×3: dígitos 1–9 */}
      <View style={tw`gap-4`}>
        {[[1,2,3],[4,5,6],[7,8,9]].map((row, ri) => (
          <View key={ri} style={tw`flex-row gap-4`}>
            {row.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => onDigit(String(d))}
                disabled={loading}
                style={[tw`flex-1 bg-gray-100 rounded-2xl items-center justify-center`, { minHeight: 72 }]}
              >
                <Text style={[tw`font-semibold text-gray-800`, { fontSize: 28, lineHeight: 32 }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Última fila: C / 0 / OK */}
        <View style={tw`flex-row gap-4`}>
          {/* C — limpiar todo */}
          <TouchableOpacity
            onPress={onDelete}
            disabled={loading}
            style={[tw`flex-1 bg-red-100 rounded-2xl items-center justify-center`, { minHeight: 72 }]}
          >
            <Text style={[tw`font-semibold text-red-600`, { fontSize: 26, lineHeight: 30 }]}>⌫</Text>
          </TouchableOpacity>

          {/* 0 */}
          <TouchableOpacity
            onPress={() => onDigit('0')}
            disabled={loading}
            style={[tw`flex-1 bg-gray-100 rounded-2xl items-center justify-center`, { minHeight: 72 }]}
          >
            <Text style={[tw`font-semibold text-gray-800`, { fontSize: 28, lineHeight: 32 }]}>0</Text>
          </TouchableOpacity>

          {/* OK */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading || pin.length === 0}
            style={[
              tw`flex-1 rounded-2xl items-center justify-center`,
              { minHeight: 72 },
              { backgroundColor: pin.length > 0 && !loading ? colors.primary : colors.gray200 },
            ]}
          >
            <Text style={[
              tw`font-semibold`,
              { fontSize: 26, lineHeight: 30 },
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
