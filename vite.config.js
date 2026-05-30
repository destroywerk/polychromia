import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
