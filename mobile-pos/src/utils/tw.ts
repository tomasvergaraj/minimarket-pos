import { create } from 'twrnc'

// Paleta idéntica al desktop POS (client-electron-pos/tailwind.config.js)
const nexoPalette = {
  50:  '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#0f172a',
}

const tw = create({
  theme: {
    extend: {
      colors: {
        primary: nexoPalette,
        // re-map 'blue' → nexo cyan para usar clases como bg-blue-600
        blue: nexoPalette,
      },
    },
  },
})

export default tw

// Colores constantes para uso directo en estilos inline
export const colors = {
  primary:     '#06b6d4',
  primaryDark: '#0e7490',
  primaryBg:   '#0f172a',
  // Gradiente login: from-blue-900 via-blue-800 to-blue-500
  gradientLogin: ['#0f172a', '#155e75', '#06b6d4'] as string[],
  white:       '#ffffff',
  gray50:      '#f9fafb',
  gray100:     '#f3f4f6',
  gray200:     '#e5e7eb',
  gray400:     '#9ca3af',
  gray500:     '#6b7280',
  gray800:     '#1f2937',
  red100:      '#fee2e2',
  red600:      '#dc2626',
  green600:    '#059669',
  green700:    '#047857',
}
