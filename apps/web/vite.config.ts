import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Dedupe React to avoid multiple copies
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      // Resolve dexie packages for pnpm compatibility
      'dexie': path.resolve(__dirname, './node_modules/dexie'),
      'dexie-react-hooks': path.resolve(__dirname, './node_modules/dexie-react-hooks')
    },
    preserveSymlinks: false,
    dedupe: ['react', 'react-dom', 'dexie']
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  optimizeDeps: {
    include: [
      '@tanstack/react-query',
      'dexie',
      'dexie-react-hooks'
    ]
  }
})
