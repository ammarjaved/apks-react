import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base: the built folder can be dropped anywhere (/apks, /, /foo/bar)
  // without rebuilding, because assets are referenced relative to index.html.
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8070',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8070',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
