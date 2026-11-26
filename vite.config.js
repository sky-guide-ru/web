import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import i18n from '@sky-guide/core/i18n/vite.js';
import { readFileSync } from 'node:fs';

// Версия и дата сборки для подвала сайта (GIT_SHA — по желанию, если сборка знает коммит)
const BUILD = {
  v: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
  date: new Date().toISOString().slice(0, 10),
  sha: process.env.GIT_SHA || '',
};

// React и библиотеки — отдельным файлом: они не меняются от выкладки к выкладке, браузер берёт их из кэша,
// и после обновления сайта качается только свой код (при медленном канале до сервера это секунды)
const VENDOR = /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/;

// npm run dev: всё серверное идёт в api. По умолчанию — локальный (http://localhost:3000),
// SKY_API=https://sky-guide.ru npm run dev — живой сайт (вход и cookie работают на localhost)
const API = process.env.SKY_API || 'http://localhost:3000';
const toApi = { target: API, changeOrigin: true, cookieDomainRewrite: { '*': '' } };
const proxy = Object.fromEntries(['/api', '/v1', '/login', '/logout', '/account'].map(p => [p, toApi]));

export default defineConfig({
  root: '.',
  plugins: [i18n(), react()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rolldownOptions: { output: { advancedChunks: { groups: [{ name: 'vendor', test: VENDOR }] } } },
  },
  server: { port: 5173, proxy },
});
