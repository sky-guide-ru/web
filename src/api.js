import { LOCALE, EN } from './i18n.js';
import { useEffect, useState, useCallback, useRef } from 'react';
import { onBuild } from './update.js';

const checkBuild = () => fetch('/api/version').then(r => (r.ok ? r.json() : null)).then(v => v && onBuild(v.build)).catch(() => {});

// localStorage может быть недоступен (приватный режим, переполнен) — сохранение не должно ронять страницу
export function saveLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* не сохранилось — не страшно */ }
}

// ---------- Кто вошёл ----------
// Сервер кладёт ник в читаемую cookie sb_me при загрузке страницы (вход — по нику и паролю сайта).
// Без неё (старый сервер, dev-режим) считаем, что это владелец.
function readMe() {
  try {
    const raw = document.cookie.split(/;\s*/).find(c => c.startsWith('sb_me='));
    if (!raw) return null;
    const j = JSON.parse(decodeURIComponent(raw.slice(6)));
    if (j?.g) return { guest: true, name: null, role: 'guest', admin: false, profile: '' }; // гость без входа: смотрит профили по нику
    return j?.n ? { name: j.n, role: j.r, admin: j.r === 'admin', profile: j.p || '', local: !!j.l } : null;
  } catch { return null; }
}
// Без cookie считаем владельцем только на самом ПК (dev-режим); где угодно ещё — гость с пустыми данными
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
export const me = readMe() || (LOCAL ? { name: null, role: 'admin', admin: true, profile: '' } : { guest: true, name: null, role: 'guest', admin: false, profile: '' });

// В этом браузере вошёл другой человек — его выбор игрока, избранное, кэш профиля и отметки не должны достаться следующему
const PER_USER_KEYS = ['sb-view', 'sb-owner', 'sb-state-cache', 'sb-state-cache-en', 'sb-favorites', 'sb-roadmap-done', 'sb-roadmap-hide-done', 'sb-farming-fortune', 'sb-compare'];
try {
  const prev = localStorage.getItem('sb-user');
  if (me.name && prev && prev.toLowerCase() !== me.name.toLowerCase()) {
    PER_USER_KEYS.forEach(k => localStorage.removeItem(k));
    // и отметки по чужим профилям (ключи вида «sb-roadmap-done@ник/профиль»)
    for (const k of Object.keys(localStorage)) if (/^sb-(roadmap-done|farming-fortune|bits|fame)@/.test(k)) localStorage.removeItem(k);
  }
  if (me.name) localStorage.setItem('sb-user', me.name);
  // Вышли из аккаунта (или вход истёк): гость за этим браузером не должен видеть чужое избранное и выбранный профиль
  if (me.guest && prev) {
    PER_USER_KEYS.forEach(k => localStorage.removeItem(k));
    for (const k of Object.keys(localStorage)) if (/^sb-(roadmap-done|farming-fortune|bits|fame)@/.test(k)) localStorage.removeItem(k);
    localStorage.removeItem('sb-user');
  }
} catch { /* localStorage недоступен — нечего чистить */ }

// ---------- Чей профиль смотрим ----------
// null — свой основной профиль (у друга, вошедшего под своим ником, — его профиль). Иначе { player, profile } — друг, кооп-сосед или свой другой профиль.
// Выбор живёт в адресе (?player=Steve&profile=Apple — ссылкой можно поделиться) и в localStorage.
// Друзья анонимны: никаких ников, зашитых в код сайта; быстрый выбор друзей владельцу даёт сервер (/api/me).
const VIEW_KEY = 'sb-view';
const FAVS_KEY = 'sb-favorites';
export const DEFAULT_FAVORITES = [];
function readView() {
  try {
    const u = new URLSearchParams(location.search);
    if (u.has('player')) { const p = u.get('player').trim(); return p ? { player: p, profile: (u.get('profile') || '').trim() } : null; }
    if (me.guest) return null; // гость без ника в адресе начинает со стартовой страницы, а не с прошлого профиля
    return JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
  } catch { return null; }
}
let currentView = readView();
export const getView = () => currentView;
export const viewKey = v => (v ? `${v.player.toLowerCase()}/${(v.profile || '').toLowerCase()}` : '');
export function viewHeaders(v = currentView) {
  return v ? { 'X-SB-Player': encodeURIComponent(v.player), 'X-SB-Profile': encodeURIComponent(v.profile || '') } : {};
}
const viewListeners = new Set();
export function onViewChange(f) { viewListeners.add(f); return () => viewListeners.delete(f); }
export function setView(v) {
  const next = v?.player ? { player: v.player.trim(), profile: (v.profile || '').trim() } : null;
  currentView = next;
  if (next) saveLocal(VIEW_KEY, JSON.stringify(next)); else { try { localStorage.removeItem(VIEW_KEY); } catch { /* */ } }
  const u = new URL(location.href);
  if (next) { u.searchParams.set('player', next.player); if (next.profile) u.searchParams.set('profile', next.profile); else u.searchParams.delete('profile'); }
  else { u.searchParams.delete('player'); u.searchParams.delete('profile'); }
  history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  viewListeners.forEach(f => f(next));
}
export function getFavorites() {
  try { const f = JSON.parse(localStorage.getItem(FAVS_KEY) || 'null'); return Array.isArray(f) ? f : DEFAULT_FAVORITES; } catch { return DEFAULT_FAVORITES; }
}
export function saveFavorites(list) { saveLocal(FAVS_KEY, JSON.stringify(list.slice(0, 30))); }

/**
 * Ключ браузерного хранилища для данных конкретного профиля («сделано» в плане, Farming Fortune, Bits).
 * Свой профиль — старый ключ (отметки не теряются), чужой — с ником и профилем: отметки владельца не прячут шаги соседа.
 */
export const profileKey = (base, v = currentView) => (v ? `${base}@${viewKey(v)}` : base);
function readStored(key, init) {
  try { const s = localStorage.getItem(key); return s == null ? init : JSON.parse(s); } catch { return init; }
}
/** useState, который хранится отдельно для каждого открытого профиля и перечитывается при переключении */
export function useProfileStore(base, init) {
  const v = useView();
  const key = profileKey(base, v);
  const [st, setSt] = useState(() => ({ key, val: readStored(key, init) }));
  const val = st.key === key ? st.val : readStored(key, init);
  useEffect(() => { if (st.key !== key) setSt({ key, val: readStored(key, init) }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = x => { setSt({ key, val: x }); saveLocal(key, JSON.stringify(x)); };
  return [val, set];
}

export function useView() {
  const [v, setV] = useState(getView);
  useEffect(() => onViewChange(setV), []);
  return v;
}

export async function api(path, opts = {}) {
  // Вкладка в фоне: сервер отдаст данные из кэша и не станет ради неё спрашивать Hypixel (лимит ключа)
  const bg = typeof document !== 'undefined' && document.hidden ? { 'X-SB-Hidden': '1' } : {};
  const r = await fetch(`/api${path}`, { ...opts, headers: { ...viewHeaders(), ...bg, ...(opts.headers || {}) } });
  if (r.status === 401 && me.guest) throw new Error('Это доступно после входа на сайт');
  // Вход истёк (сменили пароль на другом устройстве, «выйти везде»): после входа вернёмся на ту же страницу сайта (#/guides/…)
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`; throw new Error('Нужен вход'); }
  if (r.status === 403 && r.headers.get('content-type')?.includes('json')) {
    const j = await r.json().catch(() => ({}));
    if (j.mustChange) { location.href = '/account?must=1'; throw new Error('Сначала придумай свой пароль'); }
    throw new Error(j.error || 'Ошибка 403');
  }
  if (!r.ok) {
    // Текст ошибки оставляем прежним («Ошибка 503» — по нему страницы узнают вид ошибки), а понятное объяснение сервера
    // и его код (STARTING — сайт только что обновился, NETWORK — Hypixel не ответил) кладём рядом
    const j = r.headers.get('content-type')?.includes('json') ? await r.json().catch(() => ({})) : {};
    throw Object.assign(new Error(`Ошибка ${r.status}`), { status: r.status, code: j.errorCode || null, serverMessage: j.error || '' });
  }
  return r.json();
}

// Сайт только что обновился и ещё загружает профиль — через сколько повторить запрос и сколько раз (≈2 минуты)
const RETRY_STARTING_MS = 5000, RETRY_STARTING_TIMES = 24;

// Кэш — только для своего профиля (чужие большие и меняются реже, хранить их в браузере незачем)
// По языку: русская копия в английской версии показала бы русский текст, пока не придёт свежий ответ
const STATE_CACHE = EN ? 'sb-state-cache-en' : 'sb-state-cache';
function readStateCache() {
  if (getView() || me.guest) return null; // гостю — никаких сохранённых профилей: по умолчанию данных нет
  try { const s = JSON.parse(localStorage.getItem(STATE_CACHE) || 'null'); return s?.member ? { ...s, fromCache: true, _vk: '' } : null; } catch { return null; }
}
// Сериализация и запись мегабайтного состояния в localStorage — десятки миллисекунд синхронной работы.
// Делаем это в простое браузера, а не в том же кадре, где перерисовывается страница (иначе раз в минуту рывок)
const idle = (fn, o) => (window.requestIdleCallback ? window.requestIdleCallback(fn, o) : setTimeout(fn, 200));
let pendingCache = null;
function writeStateCache(s) {
  if (me.guest || !s?.member || s.demo || s.view?.owner === false) return; // демо и чужие профили не кэшируем
  const queued = pendingCache;
  pendingCache = s;
  if (queued) return; // уже ждёт простоя — запишется последнее состояние
  idle(() => {
    const json = JSON.stringify(pendingCache);
    pendingCache = null;
    if (json.length < 2_500_000) saveLocal(STATE_CACHE, json);
  }, { timeout: 5000 });
}

// Подписка на живые обновления (SSE) + перезагрузка состояния
export function useLiveState() {
  // Последнее состояние кэшируется в браузере: сайт показывает профиль мгновенно при открытии
  // и остаётся полезным, даже если сервер на ПК выключен (индикатор в шапке пишет, насколько данные старые)
  const view = useView();
  const vk = viewKey(view);
  const [state, setState] = useState(readStateCache);
  const [pulse, setPulse] = useState(0);
  // offline: сервер трекера не отвечает (выключен ПК, упал процесс, пропала сеть)
  const [offline, setOffline] = useState(false);
  const quick = useRef({});
  const startTries = useRef(0);
  const load = useCallback(() => {
    const asked = viewKey(getView());
    return api('/state')
      .then(s => {
        if (asked !== viewKey(getView())) return; // пока грузилось, переключились на другого игрока
        if (s.errorCode === 'PASSIVE') return; // вкладка в фоне, профиль ещё не загружен: спросим, когда её откроют
        // Сервер только запускается (или первый запрос к Hypixel упал) и профиля ещё нет —
        // держим профиль из кэша, но показываем настоящий статус сервера
        setState(prev => (!s.member && prev?.fromCache && prev._vk === asked ? { ...prev, status: s.status, error: s.error } : { ...s, _vk: asked }));
        setPulse(p => p + 1); setOffline(false); writeStateCache(s);
        // Сайт только что обновился и профиль ещё грузится (обычно секунды): спрашиваем каждые 2 с, а не ждём события
        // потока, — оно теряется, если поток переподключился позже, и шапка висела в «Подключаюсь…» до опроса раз в минуту
        if (s.status === 'starting' && !s.member) {
          if (startTries.current < 30) { startTries.current++; setTimeout(() => { if (viewKey(getView()) === asked) load(); }, 2000); }
          return;
        }
        startTries.current = 0;
        // Чужой профиль из старого кэша сервера: сервер уже обновляет его в фоне — спросим ещё раз через пару секунд,
        // а не через минуту (иначе новичок первую минуту видит «Давно не обновлялось»). Не больше двух раз подряд
        if (s.status === 'ok' && getView() && Date.now() - (s.updatedAt || 0) > 10 * 60_000) {
          if ((quick.current[asked] || 0) < 2) { quick.current[asked] = (quick.current[asked] || 0) + 1; setTimeout(() => { if (viewKey(getView()) === asked) load(); }, 5000); }
        } else quick.current[asked] = 0;
      })
      .catch(() => setOffline(true));
  }, []);
  // Переключили игрока: сразу убираем старый профиль, чтобы не показать чужие данные под новым ником
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState(readStateCache());
    load();
  }, [vk, load]);
  useEffect(() => {
    load();
    let es = null, retry = null, tries = 0, opened = false;
    const connect = () => {
      es = new EventSource('/api/stream');
      // События профиля — про свой профиль; чужой обновляется опросом ниже
      es.addEventListener('profile', () => { if (!getView()) load(); });
      es.addEventListener('prices', load);
      // Новая сборка сайта на сервере → загрузится при переходе в другой раздел (update.js)
      es.addEventListener('hello', e => { try { onBuild(JSON.parse(e.data).build); } catch { /* старый сервер */ } });
      es.onerror = () => {
        setOffline(true);
        // Пока сервер перезапускается, прокси отвечает ошибкой (502), и браузер закрывает поток насовсем:
        // ни живых событий, ни «Подключаюсь…» → «Live» до перезагрузки вкладки. Открываем поток заново сами
        if (es.readyState === 2 && !retry) retry = setTimeout(() => { retry = null; connect(); }, Math.min(30_000, 2000 * 2 ** tries++));
      };
      // После переподключения потока сразу подтягиваем свежие данные. Первое открытие пропускаем:
      // состояние уже запрошено выше, второй такой же /api/state при каждом открытии сайта не нужен
      es.onopen = () => { tries = 0; if (opened) load(); opened = true; checkBuild(); };
    };
    connect();
    // Запасной путь, если поток не переподключился сам: раз в 30 с и при возврате на вкладку
    const t = setInterval(checkBuild, 30_000);
    // Вернулись на вкладку: свежие данные сразу (пока вкладка была в фоне, сервер профиль ради неё не обновлял)
    const vis = () => { if (!document.hidden) { checkBuild(); load(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { es.close(); clearTimeout(retry); clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);
  // Чужой профиль (и свой профиль друга) сервер обновляет по запросу, пока его смотрят: спрашиваем каждую минуту.
  // Профиль владельца обновляется сам и приходит событием — ему хватит редкой проверки
  useEffect(() => {
    const t = setInterval(load, view || !me.admin ? 60_000 : 120_000);
    return () => clearInterval(t);
  }, [vk, load]);
  // Пока сервер недоступен — пробуем чаще, чтобы сайт ожил сам, как только сервер вернётся
  useEffect(() => {
    if (!offline) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [offline, load]);
  // Состояние помечено, чей это профиль: пока ответ про нового игрока не пришёл, старый не показываем
  // (иначе пару секунд под ником друга видны свои цифры)
  return { state: state && state._vk === vk ? state : null, reload: load, pulse, offline, view };
}

export function useApi(path, deps = [], { keep = false } = {}) {
  // Данные помечены путём: при переходе на другой предмет не показываем старый, пока грузится новый
  const [res, setRes] = useState({ path: null, data: null });
  const [error, setError] = useState(null);
  const [errorText, setErrorText] = useState(null);
  const vk = viewKey(useView()); // другой игрок — те же пути, но другие данные (инвентарь, план заработка)
  useEffect(() => {
    if (!path) return;
    let alive = true, timer = null, tries = 0;
    setError(null); setErrorText(null);
    const load = () => api(path).then(d => { if (alive) { setRes({ path, vk, data: d }); setError(null); setErrorText(null); } }).catch(e => {
      if (!alive) return;
      // Сразу после обновления сайта профиль ещё грузится: не показываем ошибку навсегда, а тихо пробуем снова
      if (e.code === 'STARTING' && tries++ < RETRY_STARTING_TIMES) { setErrorText(e.serverMessage); timer = setTimeout(load, RETRY_STARTING_MS); return; }
      setError(e.message); setErrorText(e.serverMessage || e.message);
    });
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [path, vk, ...deps]);
  // error — как раньше («Ошибка 503»); errorText — понятный текст от сервера, если он есть (пока идут повторы — тоже он)
  return { data: (keep && res.vk === vk) || (res.path === path && res.vk === vk) ? res.data : null, error, errorText };
}

// Кусок профиля для раздела (снаряжение, аксессуары, нижние блоки «Прогресса», Pet Score, карта): /api/part/:name?v=версия.
// В /api/state приходят только версии кусков (state.parts), сами данные раздел берёт при открытии.
// Тот же адрес с той же версией браузер отдаёт из своего кэша без сети. Цены меняются каждую минуту, а с ними и версия
// снаряжения, — поэтому новую версию из-за одних цен берём не чаще раза в 5 минут; обновился сам профиль — сразу.
// legacy — то же поле из старого состояния (кэш браузера до этого обновления), пока версий ещё нет.
const PART_PRICE_MS = 5 * 60_000;
export function usePart(state, name, legacy = null) {
  const vk = viewKey(useView());
  const want = state?.parts?.[name] || null;
  const upd = state?.updatedAt || 0;
  const held = useRef(null);
  let v = want;
  const h = held.current;
  if (h && h.vk === vk && want && h.v !== want && h.upd === upd && Date.now() - h.at < PART_PRICE_MS) v = h.v;
  else if (!h || h.v !== want || h.vk !== vk) held.current = { v: want, upd, vk, at: Date.now() };
  const res = useApi(v ? `/part/${name}?v=${v}` : null, [], { keep: true });
  if (!state?.parts) return legacy;
  return res.data?.status === 'ok' ? res.data.data : null;
}

// Единица выбирается после округления: 999 960 — «1 млн», а не «1 000 тыс.»
const COIN_UNITS = [[1e3, 'тыс.', 1], [1e6, 'млн', 2], [1e9, 'млрд', 2], [1e12, 'трлн', 2]];
export function coins(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  let i = COIN_UNITS.findLastIndex(([v]) => a >= v);
  if (i < 0) return Math.round(n).toLocaleString(LOCALE);
  const round = j => { const [v, , d] = COIN_UNITS[j]; return Math.round((a / v) * 10 ** d) / 10 ** d; };
  while (i < COIN_UNITS.length - 1 && round(i) >= 1000) i++;
  const [v, u, d] = COIN_UNITS[i];
  return `${(n / v).toLocaleString(LOCALE, { maximumFractionDigits: d })}${EN ? '' : '\u00a0'}${u}`; // неразрывный пробел: «75,8 млн» не рвётся
}

// Стоимость предмета: 0/нет данных — это «цена неизвестна», а не «бесплатно»
export const itemValue = v => (v > 0 ? coins(v) : '—');

// Технические ошибки сервера → понятный текст
export function friendlyError(e) {
  const t = String(e || '');
  if (/fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network/i.test(t)) return 'нет связи с Hypixel';
  if (/429|rate.?limit/i.test(t)) return 'Hypixel ограничил частоту запросов';
  if (/403|invalid api key/i.test(t)) return 'ключ API не подходит';
  if (/5\d\d/.test(t)) return 'Hypixel временно не отвечает';
  return t;
}

export const num = n => (n == null ? '—' : Math.round(n).toLocaleString(LOCALE));

// id из API по-человечески: fortuitous → Fortuitous, golden_dragon → Golden Dragon
export const prettyId = id => (id ? String(id).split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : null);

// Чем отличаются два предмета с одним названием, если редкость тоже совпала: «данжевая версия», а не сырой STARRED_BAT_WAND
export const variantLabel = id => (/^STARRED_/.test(id) ? 'данжевая версия ✪' : /^DUNGEON_/.test(id) ? 'из данжа' : id);

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function ago(ts) {
  if (!ts) return 'никогда';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'только что';
  if (s < 60) return `${s} сек назад`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

export const RARITY_COLOR = {
  COMMON: '#ffffff', UNCOMMON: '#55ff55', RARE: '#5555ff', EPIC: '#aa00aa', LEGENDARY: '#ffaa00',
  MYTHIC: '#ff55ff', DIVINE: '#55ffff', SPECIAL: '#ff5555', 'VERY SPECIAL': '#ff5555', VERY_SPECIAL: '#ff5555', ULTIMATE: '#aa0000',
};
// Редкость — как в игре, на английском (имя RARITY_RU оставлено, чтобы не трогать все страницы)
export const RARITY_RU = {
  COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic', DIVINE: 'Divine', SPECIAL: 'Special', 'VERY SPECIAL': 'Very Special', VERY_SPECIAL: 'Very Special', ULTIMATE: 'Ultimate', // у питомцев (Phoenix) — с «_»
};

// Недавно открытые предметы (для пустого поиска и вики)
// У каждого языка свой список: названия сохраняются на том языке, на котором предмет открывали
const RECENT_KEY = EN ? 'sb-recent-items-en' : 'sb-recent-items';
export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
export function pushRecent(it) {
  if (!it?.id) return;
  const list = [{ id: it.id, name: it.name, rarity: it.rarity }, ...getRecent().filter(x => x.id !== it.id)].slice(0, 12);
  saveLocal(RECENT_KEY, JSON.stringify(list));
}

// Вкладка страницы живёт в адресе (#/money/crops): переживает перезагрузку, ссылкой можно поделиться.
// Без новой записи в истории — «Назад» уводит со страницы, а не листает вкладки.
export function useHashTab(page, sub, ids, def) {
  const pick = v => (ids.includes(v) ? v : def);
  const [tab, setTabRaw] = useState(() => pick(sub));
  // Переход по ссылке без вкладки (#/money из меню) возвращает вкладку по умолчанию
  useEffect(() => { setTabRaw(pick(sub)); }, [sub]);
  const setTab = v => {
    setTabRaw(v);
    const want = v === def ? `#/${page}` : `#/${page}/${v}`;
    if (location.hash !== want) history.replaceState(history.state, '', want);
  };
  return [tab, setTab];
}
