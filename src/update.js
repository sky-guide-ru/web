// Новая версия сайта без принудительной перезагрузки.
// Сервер сообщает имя главного файла сборки (поток /api/stream и /api/version). Раньше вкладка сразу перезагружалась —
// посреди чтения. Теперь: новая версия только запоминается, а загружается при следующем переходе в другой раздел
// (полная загрузка вместо перехода внутри страницы — со стороны выглядит как обычный переход).
// Окошко новостей подтягивается сразу, без перезагрузки (news.js слушает событие ниже).
// Если человек долго остаётся на одной странице — внизу появляется плашка «Сайт обновился» с кнопкой «Обновить».
// Сбой загрузки куска страницы (старых кусков после выкладки на сервере уже нет) — тихая перезагрузка, один раз.
import { savePlace } from './keepPlace.js';


const EV = 'sb-update';
const UPDATED = 'sb-updated';        // sessionStorage: вкладка только что загрузила новую версию сама
const CHUNK = 'sb-chunk-reload';     // sessionStorage: «сборка|время» последней перезагрузки из-за сбоя куска
export const STALE_MS = 5 * 60_000;  // столько версия может ждать перехода, потом — плашка

// Своя версия — имя собранного скрипта (в нём хэш содержимого); сервер присылает то же из dist/index.html
export const loadedBuild = (document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') || '').split('/').pop() || null;

let pending = null;   // новая сборка, главный файл которой уже скачан (точно есть на сервере)
let since = 0;        // когда её заметили
let checking = null;
let dismissed = null; // плашку про эту сборку закрыли крестиком

const ping = () => dispatchEvent(new Event(EV));
export const updateInfo = () => ({ pending, since, dismissed: !!pending && dismissed === pending });
export const onUpdate = f => { addEventListener(EV, f); return () => removeEventListener(EV, f); };

/** Сообщение о версии с сервера. Сразу после выкладки сервер ещё может отвечать 502: новую версию считаем готовой,
 *  только когда её главный файл скачался (потом он возьмётся из кэша), иначе пробуем снова через 10 с. */
export function onBuild(build) {
  if (!build || build === 'dev' || !loadedBuild) return; // режим разработки (vite)
  if (build === loadedBuild || build === pending || build === checking) return;
  checking = build;
  const tryFetch = () => {
    if (checking !== build) return; // пока ждали, вышла ещё более новая
    fetch(`/assets/${encodeURIComponent(build)}`, { cache: 'reload' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(() => { if (checking !== build) return; checking = null; if (!pending) since = Date.now(); pending = build; ping(); })
      .catch(() => setTimeout(tryFetch, 10_000));
  };
  // небольшой разброс — чтобы все открытые вкладки не шли на сервер разом
  setTimeout(tryFetch, 1000 + Math.random() * 4000);
}

let reloading = false; // вкладка уже перезагружается — куски дальше не рисуем

function reloadNow(keep) {
  reloading = true;
  if (keep) savePlace();
  try { sessionStorage.setItem(UPDATED, String(Date.now())); } catch { /* приватный режим */ }
  location.reload();
}

/** Кнопка «Обновить» на плашке или в окошке новостей: место на странице сохранится. */
export const updateNow = () => reloadNow(true);
export const dismissUpdate = () => { dismissed = pending; ping(); };

/** Вкладка только что сама перешла на новую версию (один раз за загрузку). */
let justUpdated = false;
try { justUpdated = Date.now() - Number(sessionStorage.getItem(UPDATED) || 0) < 60_000; sessionStorage.removeItem(UPDATED); } catch { /* */ }
export const wasJustUpdated = () => justUpdated;

// Переход в другой раздел (меню, ссылка, «Назад») при готовой новой версии — полная загрузка уже нового адреса.
// Слушатель ставится при загрузке модуля, раньше слушателя страниц в App, поэтому старая страница не успевает перерисоваться.
// Раздел — первая часть адреса (#/market/ITEM → market): выбор предмета или вкладки внутри раздела не считается переходом
const route = () => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'overview');
let lastRoute = route();
addEventListener('hashchange', () => {
  const now = route();
  const moved = now !== lastRoute;
  lastRoute = now;
  if (moved && pending) reloadNow(false);
});

/** Обёртка для import() страниц и их частей. Старых кусков после выкладки на сервере уже нет:
 *  тихо перезагружаем вкладку (на тот же адрес — человек как раз переходил туда). Не чаще раза в 2 минуты на сборку,
 *  иначе по-настоящему битый кусок гонял бы вкладку по кругу — тогда ошибка уходит дальше, как раньше. */
function mayReload() {
  try {
    const [b, t] = (sessionStorage.getItem(CHUNK) || '').split('|');
    const ok = b !== String(loadedBuild) || Date.now() - Number(t || 0) > 120_000;
    if (ok) sessionStorage.setItem(CHUNK, `${loadedBuild}|${Date.now()}`);
    return ok;
  } catch { return false; } // sessionStorage недоступен — не рискуем циклом
}
// Если сбой поймал слушатель vite:preloadError ниже, import() вернёт undefined — ждём перезагрузки, а не роняем страницу
export const chunk = load => () => load().then(m => (m === undefined && reloading ? new Promise(() => {}) : m), e => {
  const again = mayReload();
  if (again) { reloadNow(true); return new Promise(() => {}); }
  throw e;
});

// Сбой подгрузки зависимостей куска (Vite сообщает отдельным событием) — так же: одна тихая перезагрузка
addEventListener('vite:preloadError', e => {
  const again = mayReload();
  if (again) { e.preventDefault(); reloadNow(true); }
});
