import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base` is environment-aware so the same build works everywhere:
//   • Vercel / Netlify / local preview serve from root      → '/' (default)
//   • GitHub Pages project site (destroywerk.github.io/polychromia/)
//     needs the sub-path → the Pages workflow sets BASE_PATH=/polychromia/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/radio-api': {
        target: 'https://de1.api.radio-browser.info',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/radio-api/, ''),
      },
    },
  },
})
