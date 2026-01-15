import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split out heavy 3D and Map libraries
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('maplibre-gl')) {
              return 'vendor-map';
            }
            // Split out framework
            if (id.includes('react')) {
              return 'vendor-react';
            }
            // All other dependencies
            return 'vendor-others';
          }
        }
      }
    }
  }
});