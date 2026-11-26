import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import i18n from '@sky-guide/core/i18n/vite.js';

// React и библиотеки — отдельным файлом: они не меняются от выкладки к выкладке, браузер берёт их из кэша,
// и после обновления сайта качается только свой код (при медленном канале до сервера это секунды)
const VENDOR = /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/;

export default defineConfig({
  root: '.',
  plugins: [i18n(), react()],
  build: {
    outDir: 'dist', emptyOutDir: true,
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'vendor', test: VENDOR }] } } },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
