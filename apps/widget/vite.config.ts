import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../public/widget',
    lib: {
      entry: './src/main.tsx',
      name: 'HuronChatWidget',
      formats: ['umd'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        // Inline all styles into the JS bundle
        inlineDynamicImports: true,
        assetFileNames: 'widget.[ext]',
      },
    },
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
  server: {
    port: 5174,
  },
});
