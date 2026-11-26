// Скрытые шаги плана («скрыть у меня»).
// - Владелец профиля, вошедший на сайт: хранятся на сервере (/api/roadmap/hidden), видны на всех его устройствах.
// - Гость: только в этом браузере (localStorage, свой ключ на каждый открытый ник) — гость часто смотрит свой ник.
// - Вошедший смотрит чужой план: скрывать нельзя, план показывается целиком.
// Шаги и так уходят сами, когда по данным игры сделаны; отметка шага, которого нет в плане дольше суток, удаляется.
import { useEffect, useState } from 'react';
import { api, me, useView, viewKey, profileKey, useProfileStore } from './api.js';
import { pruneHidden } from './hiddenPrune.js';

const LOCAL_KEY = 'sb-roadmap-done'; // старое имя ключа: отметки «сделано» гостей не теряются

// Общий для всех страниц кэш серверных отметок: «Обзор», «План» и «Skills» видят одно и то же сразу
const srv = { vk: null, hidden: {}, loading: null };
const listeners = new Set();
const emit = () => listeners.forEach(f => f({ ...srv }));

async function loadServer(vk, v) {
  if (srv.vk === vk && srv.loading) return srv.loading;
  srv.vk = vk; srv.hidden = {};
  srv.loading = (async () => {
    try {
      let { hidden = {}, canWrite } = await api('/roadmap/hidden');
      // Первый вход: перенести на сервер то, что раньше отмечалось «сделано» в этом браузере
      const lk = profileKey(LOCAL_KEY, v);
      let old = {};
      try { old = JSON.parse(localStorage.getItem(lk) || '{}') || {}; } catch { /* пусто */ }
      const ids = Object.keys(old).filter(id => old[id] && !hidden[id]);
      if (canWrite && ids.length) {
        ({ hidden } = await api('/roadmap/hidden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(0, 200), value: true }) }));
      }
      if (canWrite) { try { localStorage.removeItem(lk); } catch { /* */ } }
      if (srv.vk === vk) { srv.hidden = hidden; emit(); }
    } catch { /* сервер не ответил — план покажется целиком */ }
    return srv.hidden;
  })();
  return srv.loading;
}

/**
 * @returns {{ hidden: Object, mode: 'server'|'local'|'none', hide: (id:string)=>void, unhide: (id:string)=>void, error: string }}
 */
export function useHiddenSteps(state) {
  const steps = state?.analysis?.roadmap || [];
  const mode = me.guest ? 'local' : state?.view?.owner ? 'server' : 'none';
  const v = useView();
  const vk = viewKey(v);
  const [local, setLocal] = useProfileStore(LOCAL_KEY, {});
  const [s, setS] = useState(() => ({ ...srv }));
  const [error, setError] = useState('');
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  useEffect(() => { if (mode === 'server' && srv.vk !== vk) loadServer(vk, v); }, [mode, vk]); // eslint-disable-line react-hooks/exhaustive-deps
  // Гость: убрать отметки шагов, которых в плане давно нет (сделаны по данным игры)
  const idsSig = steps.map(x => x.id).join('|');
  useEffect(() => {
    if (mode !== 'local' || !steps.length) return;
    const r = pruneHidden(local, steps.map(x => x.id));
    if (r.changed) setLocal(r.hidden);
  }, [mode, idsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const hidden = mode === 'local' ? local : mode === 'server' && s.vk === vk ? s.hidden : {};
  const change = async (id, value) => {
    setError('');
    if (mode === 'local') {
      const n = { ...local };
      if (value) n[id] = { at: Date.now() }; else delete n[id];
      setLocal(n);
      return;
    }
    if (mode !== 'server') return;
    const before = srv.hidden;
    const n = { ...before };
    if (value) n[id] = { at: Date.now() }; else delete n[id];
    srv.hidden = n; emit();
    try {
      const r = await api('/roadmap/hidden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value: value || null }) });
      if (srv.vk === vk) { srv.hidden = r.hidden || {}; emit(); }
    } catch (e) {
      if (srv.vk === vk) { srv.hidden = before; emit(); }
      setError(/Ошибка \d|fetch/i.test(e.message) ? 'Не сохранилось: сервер не отвечает' : e.message);
    }
  };
  return { hidden, mode, hide: id => change(id, true), unhide: id => change(id, false), error };
}
