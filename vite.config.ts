import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    // Divide and conquer the bundle: app code, framework, and the map engine
    // each become their own cacheable chunk instead of one 2.1 MB file.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('maplibre-gl')) return 'vendor-map';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
