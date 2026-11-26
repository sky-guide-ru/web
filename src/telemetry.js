// Свой учёт посещений и ошибок: события уходят только на наш сервер (POST /api/t), без cookie и сторонних счётчиков.
// Что отправляется: раздел сайта (#/money → money), откуда пришли и метки utm (только при входе), время загрузки страницы,
// гость или вошедший, и тексты ошибок JavaScript. Если в браузере включено «Не отслеживать» — просмотры не считаются.
import { me } from './api.js';
import { LANG } from './i18n.js';

const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
// Метки utm из адреса входа (?utm_source=discord) — запоминаем сразу, пока страница не поменяла адрес
const utm = /[?&]utm_source=/.test(location.search) ? location.search.slice(0, 500) : '';
const section = () => (location.hash.replace(/^#\/?/, '') || 'overview').split(/[/?]/)[0].toLowerCase().slice(0, 24);
const queue = [];
let timer = null;

function flush() {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  // Пачка не больше ~6 КБ (сервер принимает до 16 КБ): иначе при всплеске ошибок вся пачка отклонится и потеряется
  const batch = [];
  let size = 2;
  while (queue.length && batch.length < 10) {
    const n = new Blob([JSON.stringify(queue[0])]).size + 1;
    if (batch.length && size + n > 6000) break;
    batch.push(queue.shift()); size += n;
  }
  const body = JSON.stringify(batch);
  // Строка уходит как text/plain — простой запрос без лишних проверок браузера; sendBeacon доходит и при закрытии вкладки
  if (!(navigator.sendBeacon && navigator.sendBeacon('/api/t', body))) {
    fetch('/api/t', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  }
  if (queue.length) timer = setTimeout(flush, 1000);
}
function push(e) {
  queue.push(e);
  if (!timer) timer = setTimeout(flush, 1500);
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

// ---------- Просмотры ----------
let lastSection = null;
function view(extra = {}) {
  const p = section();
  if (p === lastSection && !extra.ms) return;
  lastSection = p;
  push({ t: 'view', p, g: me.guest ? 1 : 0, dnt: dnt ? 1 : 0, l: LANG, ...extra });
}
function firstView() {
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  const ms = Math.round(nav ? (nav.loadEventEnd || nav.domContentLoadedEventEnd || nav.duration) : performance.now());
  view({ ms, r: document.referrer || '', ...(utm ? { u: utm } : {}) });
}
if (document.readyState === 'complete') setTimeout(firstView, 0);
else addEventListener('load', () => setTimeout(firstView, 0), { once: true });
let hashTimer = null;
addEventListener('hashchange', () => { clearTimeout(hashTimer); hashTimer = setTimeout(() => { if (lastSection !== null) view(); }, 400); });

// ---------- Ошибки ----------
const sent = new Map();
let total = 0;
const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection captured|Load failed$|Failed to fetch$|NetworkError when attempting|AbortError|The operation was aborted/i;
export function reportError(err, kind = 'error') {
  try {
    const msg = String(err?.message || err?.reason?.message || err || '').slice(0, 500);
    const stack = String(err?.stack || '').slice(0, 1500);
    if (!msg || NOISE.test(msg)) return;
    if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(stack)) return; // ошибки расширений браузера — не наши
    const k = `${kind}|${msg}`;
    const n = sent.get(k) || 0;
    if (n >= 3 || total >= 20) return; // одна и та же ошибка в цикле не должна заваливать сервер
    sent.set(k, n + 1); total++;
    push({ t: 'err', k: kind, m: msg, s: stack, p: section() });
  } catch { /* учёт ошибок сам не должен ломать страницу */ }
}
addEventListener('error', e => {
  if (e.target && e.target !== window) return; // не загрузилась картинка — это не ошибка кода
  reportError(e.error || e.message, 'error');
});
addEventListener('unhandledrejection', e => reportError(e.reason instanceof Error ? e.reason : String(e.reason ?? ''), 'promise'));
