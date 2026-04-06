import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['nexo-icon-192.png', 'nexo-icon-512.png'],
      manifest: {
        name: 'Nexo POS',
        short_name: 'Nexo POS',
        description: 'Punto de venta móvil Nexo',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: command === 'build' ? '/pos/' : '/',
        start_url: command === 'build' ? '/pos/' : '/',
        icons: [
          { src: 'nexo-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'nexo-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'nexo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
            },
          },
        ],
      },
    }),
  ],
  base: command === 'build' ? '/pos/' : '/',
  server: { port: 5175 },
}))
