// Оповещение о новостях сайта: число непрочитанных на кнопке «Новости» (и на «Ещё» на телефоне),
// «(N)» в заголовке вкладки и окошко «Что нового» при заходе — один раз на каждую новую запись.
// Сервер отдаёт id всех записей (новые первыми), браузер помнит последнюю прочитанную.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { onUpdate, updateInfo } from './update.js';

const KEY = 'sb-news-seen';       // id последней прочитанной записи
const POP = 'sb-news-popup';      // id записи, окошко про которую уже показали (или закрыли)
const EV = 'sb-news-seen';
let info = null, loading = null;  // { latest, ids, top, refs } с /api/news/latest

const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* приватный режим — просто не запомнится */ } };
const ping = () => dispatchEvent(new Event(EV));

/** Сколько записей вышло после прочитанной. Новый посетитель — записи последнего дня (не все сразу, чтобы не пугать числом). */
export function unreadOf(ids = [], seen = null) {
  if (!ids.length) return 0;
  if (seen) { const i = ids.indexOf(seen); if (i >= 0) return i; }
  return ids.filter(id => id.slice(0, 10) === ids[0].slice(0, 10)).length;
}

/** Отметить новости прочитанными (страница «Новости» при открытии). Окошко про эту запись больше не всплывёт. */
export function markNewsSeen(id) {
  if (!id) return;
  set(KEY, id); set(POP, id);
  ping();
}

/** Окошко закрыли крестиком: прочитанным не считаем (число на кнопке остаётся), но больше не показываем. */
export function dismissNewsPopup() {
  if (info?.latest) set(POP, info.latest);
  ping();
}

const fetchInfo = () => { loading = api('/news/latest').then(r => { info = r || info || null; loading = null; ping(); }).catch(() => { loading = null; }); };
// Сайт обновился, а вкладка ещё на старой версии: свежие новости подтягиваем сразу — окошко «Что нового» всплывёт без перезагрузки
let seenBuild = null;
onUpdate(() => { const b = updateInfo().pending; if (b && b !== seenBuild && !loading) { seenBuild = b; fetchInfo(); } });

function useInfo() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick(x => x + 1);
    addEventListener(EV, f);
    addEventListener('storage', f); // прочитал в другой вкладке
    if (!info && !loading) fetchInfo();
    return () => { removeEventListener(EV, f); removeEventListener('storage', f); };
  }, []);
  return info;
}

/** Число непрочитанных новостей (0 — всё прочитано или ещё не загрузилось). */
export function useNewsUnread() {
  const i = useInfo();
  return i?.latest ? unreadOf(i.ids || [i.latest], get(KEY)) : 0;
}

/** Самая свежая запись для окошка «Что нового», если его про неё ещё не показывали; иначе null. */
export function useNewsPopup() {
  const i = useInfo();
  if (!i?.top || get(KEY) === i.latest || get(POP) === i.latest) return null;
  return { top: i.top, refs: i.refs };
}
