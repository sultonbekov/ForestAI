import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages loyiha sayti uchun base yo'l: https://sultonbekov.github.io/ForestAI/
export default defineConfig({
  base: '/ForestAI/',
  plugins: [react()],
  server: { port: 5173, host: true },
})
