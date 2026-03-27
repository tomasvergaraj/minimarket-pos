import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'
import tw from '../../utils/tw'

interface Props {
  onPress: () => void
  title: string
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  onPress, title, loading = false, disabled = false,
  variant = 'primary', size = 'md',
}: Props) {
  const base = tw`rounded-2xl items-center justify-center`
  const variantStyle = {
    primary:   tw`bg-primary-700`,
    secondary: tw`bg-gray-200`,
    danger:    tw`bg-red-600`,
  }[variant]
  const sizeStyle = {
    sm: [tw`px-4 py-3`, { minHeight: 48 }],
    md: [tw`px-5 py-4`, { minHeight: 54 }],
    lg: [tw`px-6 py-5`, { minHeight: 60 }],
  }[size]
  const textColor = variant === 'secondary' ? tw`text-gray-800` : tw`text-white`
  const textSize = { sm: tw`text-base`, md: tw`text-lg`, lg: tw`text-xl` }[size]
  const opacity = disabled || loading ? tw`opacity-50` : {}

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[base, variantStyle, sizeStyle, opacity]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'secondary' ? '#374151' : '#fff'} />
        : <Text style={[tw`font-semibold`, textColor, textSize]}>{title}</Text>
      }
    </TouchableOpacity>
  )
}
