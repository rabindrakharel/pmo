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
      'react-dom': path.resolve(__dirname, './node_modules/react-dom')
    },
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  optimizeDeps: {
    include: [
      'rxjs',
      'rxdb',
      'rxdb/plugins/dev-mode',
      'rxdb/plugins/migration-schema',
      'rxdb/plugins/storage-dexie',
      'rxdb/plugins/leader-election',
      'rxdb/plugins/query-builder',
      'rxdb/plugins/validate-ajv',
      'rxdb/plugins/update'
    ]
  }
})
