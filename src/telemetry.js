// Свой учёт посещений и ошибок: события уходят только на наш сервер (POST /api/t), без cookie и сторонних счётчиков.
// Что отправляется: раздел сайта (#/money → money), откуда пришли и метки utm (только при входе), время загрузки страницы,
// гость или вошедший, тексты ошибок JavaScript и подвисания страницы (сколько раз и насколько браузер был занят
// дольше 0,1 с, по разделам). Если в браузере включено «Не отслеживать» — просмотры и подвисания не считаются.
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

// ---------- Подвисания ----------
// Браузер выполняет код страницы в одном потоке: пока идёт долгая задача, клики и прокрутка ждут.
// Считаем задачи дольше 0,1 с (столько человек уже замечает) по разделам: сколько секунд раздел был открыт,
// сколько раз подвис, самое долгое и суммарное подвисание. Отправляем одной записью при уходе со вкладки
// и раз в 5 минут. Работает в Chrome, Edge, Opera и на Android; Safari и Firefox такого замера не дают.
const JANK_MIN = 100;
if (!dnt && typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
  const acc = {}; // раздел → [секунд открыт, подвисаний, самое долгое мс, всего мс]
  const row = p => (acc[p] ||= [0, 0, 0, 0]);
  let shown = document.hidden ? 0 : performance.now();
  let shownIn = section();
  const tick = () => {
    if (shown) { row(shownIn)[0] += (performance.now() - shown) / 1000; shown = document.hidden ? 0 : performance.now(); }
    shownIn = section();
  };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.duration < JANK_MIN) continue;
        const r = row(section()), d = Math.round(e.duration);
        r[1]++; r[2] = Math.max(r[2], d); r[3] += d;
      }
    }).observe({ type: 'longtask' });
  } catch { /* старый браузер */ }
  const send = () => {
    tick();
    const out = {};
    for (const [p, r] of Object.entries(acc)) if (r[0] >= 3 || r[1]) out[p] = [Math.round(r[0]), r[1], r[2], r[3]];
    for (const k of Object.keys(acc)) delete acc[k];
    if (Object.keys(out).length) push({ t: 'jank', s: out });
  };
  addEventListener('hashchange', tick);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { send(); flush(); } else { shown = performance.now(); shownIn = section(); } });
  addEventListener('pagehide', () => { send(); flush(); });
  setInterval(send, 5 * 60_000);
}
