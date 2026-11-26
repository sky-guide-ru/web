// Реклама РСЯ, донат и Яндекс Метрика. Настройки приходят с сервера в window.SB_PUBLIC (из .env, см. server/public.js).
// Пока в .env ничего не задано — блоки не рисуются и ничего чужого не грузится.
//
// Согласие на cookie (152-ФЗ): скрипты Метрики и РСЯ ставят cookie и передают Яндексу IP посетителя, поэтому
// они подгружаются ТОЛЬКО после «Принять» в баннере. «Только необходимые» — ни Метрики, ни рекламы.
// Выбор хранится в localStorage (sb-consent) и меняется ссылкой «Настройки cookie» внизу сайта.
export const pub = (typeof window !== 'undefined' && window.SB_PUBLIC) || { rtb: {}, metrika: null, donateUrl: '', siteUrl: '' };

const CONSENT_KEY = 'sb-consent';
const CONSENT_VERSION = 1; // поднять, если в баннере появятся новые сервисы — тогда спросим снова
const listeners = new Set();

/** Есть ли что-то, на что нужно согласие (Метрика или реклама настроены в .env) */
export const needsConsent = () => !!(pub.metrika || pub.rtb?.bottom || pub.rtb?.landing);

/** null — ещё не спрашивали; true/false — выбор посетителя */
export function getConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return c && c.v === CONSENT_VERSION ? !!c.yes : null;
  } catch { return null; }
}

export function setConsent(yes) {
  const before = getConsent();
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, yes: !!yes, at: new Date().toISOString() })); } catch { /* приватный режим */ }
  if (yes) loadYandex();
  listeners.forEach(fn => fn(!!yes));
  // Отозвал согласие — уже загруженные скрипты из страницы не выгрузить, перезагружаем без них
  if (before === true && !yes) location.reload();
}

/** Подписка на изменение согласия (для блоков рекламы и баннера) */
export function onConsent(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Снова показать баннер (ссылка «Настройки cookie») */
export function reopenConsent() { listeners.forEach(fn => fn(null)); }

function addScript(src) {
  if ([...document.scripts].some(s => s.src === src)) return;
  const s = document.createElement('script');
  s.async = true; s.src = src;
  document.head.appendChild(s);
}

let loaded = false;
/** Подгрузить Метрику и РСЯ — только после согласия */
export function loadYandex() {
  if (loaded || getConsent() !== true) return;
  loaded = true;
  if (pub.metrika) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = 1 * new Date();
    addScript('https://mc.yandex.ru/metrika/tag.js');
    window.ym(pub.metrika, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
    installMetrikaHits();
  }
  if (pub.rtb?.bottom || pub.rtb?.landing) {
    window.yaContextCb = window.yaContextCb || [];
    addScript('https://yandex.ru/ads/system/context.js');
  }
}

// Метрика: сайт одностраничный (#/guides, #/market…) — сообщаем о каждом переходе как о просмотре страницы
let hitsInstalled = false;
export function installMetrikaHits() {
  if (hitsInstalled || !pub.metrika || typeof window.ym !== 'function') return;
  hitsInstalled = true;
  let last = location.href;
  addEventListener('hashchange', () => {
    const url = location.href;
    if (url === last) return;
    window.ym(pub.metrika, 'hit', url, { referer: last, title: document.title });
    last = url;
  });
}

let seq = 0;
/** Нарисовать блок РСЯ в элемент с id. Повторный вызов для того же элемента перерисует блок (смена страницы). */
export function renderRtb(blockId, elId) {
  if (!blockId || getConsent() !== true) return;
  window.yaContextCb = window.yaContextCb || [];
  window.yaContextCb.push(() => {
    try { window.Ya?.Context?.AdvManager?.render({ blockId, renderTo: elId }); } catch { /* блокировщик рекламы или нет сети — без блока */ }
  });
}
export const nextAdId = () => `yandex_rtb_${++seq}`;
