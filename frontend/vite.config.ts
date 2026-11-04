import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api and /ws are proxied to the FastAPI backend (see backend/README section in the root README).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
})
