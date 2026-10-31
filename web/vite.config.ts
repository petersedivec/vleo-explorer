import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the site works under a GitHub Pages project path.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Plotly is lazy-loaded in its own chunk; the main chunk carries the atmosphere tables.
  build: { chunkSizeWarningLimit: 1500 },
})
