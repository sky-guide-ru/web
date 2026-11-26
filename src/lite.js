import { useSyncExternalStore } from 'react';

// Облегчённый режим: без анимированного фона, бесконечных анимаций, размытий, объёмных голов и живой 3D-модели.
// Сайт выглядит так же (цвета, карточки, иконки), но телефону не нужно перерисовывать экран 60 раз в секунду.
// Выбор: 'auto' (по умолчанию), 'on', 'off'. Хранится в localStorage под ключом sb-lite.
// Первое решение принимает маленький скрипт в index.html — до отрисовки, чтобы страница не «моргала» анимацией.
export const LITE_KEY = 'sb-lite';
// Когда сайт заметил медленную отрисовку (время, мс). Пока отметка свежая, «авто» = облегчённый режим с первой отрисовки.
// Через 3 дня отметка гаснет и сайт проверяет заново: вдруг человек включил аппаратное ускорение.
export const SLOW_KEY = 'sb-lite-slow';
const SLOW_TTL = 3 * 24 * 3600_000;
export function slowMarked() {
  try { const t = Number(localStorage.getItem(SLOW_KEY)); return t > 0 && Date.now() - t < SLOW_TTL; } catch { return false; }
}

// Слабое или мобильное устройство. Логика совпадает со скриптом в client/index.html (там — без модулей, до загрузки сайта)
export function autoLite(w = window) {
  try {
    const n = w.navigator || {}, c = n.connection || {}, mm = q => !!w.matchMedia?.(q).matches;
    if (mm('(prefers-reduced-motion: reduce)')) return true; // человек сам попросил меньше движения
    if (slowMarked()) return true; // браузер рисует медленно (обычно выключено аппаратное ускорение)
    if (c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '')) return true; // экономия трафика, медленная сеть
    if ((n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2)) return true;
    return mm('(pointer: coarse)') && mm('(max-width: 900px)'); // телефон или планшет
  } catch { return false; }
}

export function litePref() {
  try { const v = localStorage.getItem(LITE_KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export const liteFor = pref => (pref === 'on' ? true : pref === 'off' ? false : autoLite());

const subs = new Set();
const subscribe = f => { subs.add(f); return () => subs.delete(f); };
let current = typeof document !== 'undefined' ? document.documentElement.classList.contains('lite') : false;
export const isLite = () => current;
let version = 0; // меняется при любом выборе в переключателе, даже если режим остался тем же (сам → включён)

export function setLitePref(pref) {
  try { if (pref === 'auto') localStorage.removeItem(LITE_KEY); else localStorage.setItem(LITE_KEY, pref); } catch { /* приватный режим */ }
  current = liteFor(pref);
  version++;
  document.documentElement.classList.toggle('lite', current);
  subs.forEach(f => f());
}

// Браузер без аппаратного ускорения (например, Firefox со снятой галочкой «использовать аппаратное ускорение») рисует
// всё процессором: анимации сайта роняют его до 15–20 кадров/с. Устройство при этом мощное, и autoLite этого не видит.
// Поэтому в режиме «авто» дважды по 2 с меряем, как быстро идут кадры, когда страница уже загрузилась и ничего не грузит.
// Обычно кадр — 7–17 мс; если середина больше 40 мс оба раза — включаем облегчённый режим и запоминаем на 3 дня.
const SLOW_FRAME_MS = 40;
function sampleFrames(ms = 2000) {
  return new Promise(resolve => {
    const gaps = []; let last = 0, first = 0;
    const step = t => {
      if (document.hidden) return resolve(null); // вкладка в фоне — кадров нет, мерить нечего
      if (last) gaps.push(t - last); else first = t;
      last = t;
      if (t - first < ms) requestAnimationFrame(step); else resolve(gaps);
    };
    requestAnimationFrame(step);
  });
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const wait = ms => new Promise(r => setTimeout(r, ms));
export async function watchSlowRendering({ firstDelay = 5000, gap = 8000 } = {}) {
  if (typeof window === 'undefined' || !window.requestAnimationFrame) return false;
  const still = () => litePref() === 'auto' && !current; // человек сам выбрал режим или он уже облегчённый — не мешаем
  if (!still()) return false;
  await wait(firstDelay);
  let slowRuns = 0;
  for (let run = 0; run < 2; run++) {
    if (run) await wait(gap);
    if (!still()) return false;
    const gaps = await sampleFrames();
    if (!gaps || gaps.length < 5) return false; // вкладка ушла в фон — проверим при следующем заходе
    if (median(gaps) > SLOW_FRAME_MS) slowRuns++; else return false;
  }
  if (slowRuns < 2 || !still()) return false;
  try { localStorage.setItem(SLOW_KEY, String(Date.now())); } catch { /* приватный режим: включим только до перезагрузки */ }
  current = true;
  version++;
  document.documentElement.classList.add('lite');
  subs.forEach(f => f());
  return true;
}

// Хук: включён ли облегчённый режим сейчас (компоненты перерисовываются при переключении)
export function useLite() {
  return useSyncExternalStore(subscribe, isLite, () => false);
}

// Хук для переключателя: выбранная настройка + включён ли режим
export function useLitePref() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const lite = useLite();
  return { pref: litePref(), lite, auto: autoLite(), slow: slowMarked(), set: setLitePref };
}
