import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev proxy: the frontend talks to a same-origin "/api" (see apiClient.js /
// websocket.js), and Vite forwards those calls to the backend on :8000.
// This mirrors the production same-origin setup (FastAPI serves the SPA) and
// keeps the httpOnly refresh cookie working without CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
