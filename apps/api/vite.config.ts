import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    watch: {
      usePolling: true, // Mejora la recarga en algunos entornos
    },
  },
});