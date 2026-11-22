import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Demo online: percorsi relativi, perché la pagina è servita da una sottocartella.
  base: process.env.VITE_DEMO === '1' ? './' : '/',
  server: {
    port: 5173,
    strictPort: true,
    // In sviluppo l'API è servita sotto la stessa origine tramite proxy: cookie first-party.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
