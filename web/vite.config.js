import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(process.cwd(), 'web'),
  build: {
    outDir: path.resolve(process.cwd(), 'web/dist'),
    emptyOutDir: true
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3099',
        changeOrigin: true
      }
    }
  }
});
