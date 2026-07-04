import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The app talks to the backend via the absolute VITE_API_BASE_URL (see src/lib/axios.js),
// so no dev proxy is needed.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
