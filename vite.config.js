import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import i18n from '@sky-guide/core/i18n/vite.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Что показать в подвале: коммит web и его дата из git, версия core — из node_modules. Сам текст не правится руками.
// В Docker папки .git при сборке нет: её читает стадия meta в Dockerfile и кладёт build.json.
// GIT_SHA и GIT_DATE в окружении перекрывают и то, и другое.
function buildInfo() {
  const json = f => { try { return JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8')); } catch { return null; } };
  const git = (...args) => {
    try { return execFileSync('git', args, { cwd: new URL('.', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return ''; }
  };
  const file = json('./build.json') || {};
  return {
    sha: process.env.GIT_SHA || file.sha || git('rev-parse', 'HEAD'),
    date: process.env.GIT_DATE || file.date || git('log', '-1', '--format=%cs') || new Date().toISOString().slice(0, 10),
    core: json('./node_modules/@sky-guide/core/package.json')?.version || '',
  };
}
const BUILD = buildInfo();

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
