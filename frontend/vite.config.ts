import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 2020,
    allowedHosts: ['clip.perdafos.my.id', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:2121',
        changeOrigin: true,
      },
      '/downloads': {
        target: 'http://localhost:2121',
        changeOrigin: true,
      },
    },
  },
})
