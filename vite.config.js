import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Development only: proxy /api to the local Express backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('connection', 'keep-alive');
          });
        },
      },
    },
  },
  build: {
    // Output to dist/ (Express serves this in production)
    outDir: 'dist',
    // Generate source maps for easier debugging in production
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }
          if (id.includes('react-google-recaptcha')) {
            return 'recaptcha';
          }
        },
      },
    },
  },
})
