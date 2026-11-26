import { useEffect, useRef, useState } from 'react';
import { saveLocal } from '../api.js';

const ICON = { coins: 'gold_ingot', level: 'experience_bottle', slayer: 'rotten_flesh', advice: 'map', item: 'chest_minecart' };

// Всплывашки о новых событиях профиля («+1 уровень Боя», «+5 млн в банке»), пока сайт открыт
// Что уже показано, помним по профилю в localStorage: перезагрузка страницы, рестарт сервера после обновления сайта
// и переключение профиля не показывают старые события заново. События старше 15 минут не всплывают вовсе.
const SEEN_KEY = 'sb-toasts-seen';
const STALE_MS = 15 * 60_000;
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; } };

export default function LiveToasts({ feed, profileKey }) {
  const seen = useRef(null); // { key, t }
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    if (!feed || !profileKey) return;
    const newest = feed[0]?.t || 0;
    const remember = t => {
      seen.current = { key: profileKey, t };
      const all = readSeen();
      all[profileKey] = t;
      saveLocal(SEEN_KEY, JSON.stringify(Object.fromEntries(Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, 30))));
    };
    const switched = seen.current?.key !== profileKey;
    // другой профиль — всплывашки прежнего убираем здесь же, до новых (отдельный эффект стёр бы и свежие)
    if (switched) setToasts([]);
    if (switched) {
      // открыли сайт или другой профиль: показываем только то, что новее запомненного и не старше 15 минут
      const stored = readSeen()[profileKey];
      if (stored == null) { if (feed.length) remember(newest); else seen.current = { key: profileKey, t: Date.now() }; return; }
      seen.current = { key: profileKey, t: stored };
    }
    const since = Math.max(seen.current.t, Date.now() - STALE_MS);
    const fresh = feed.filter(e => e.t > since).slice(0, 3);
    if (newest > seen.current.t) remember(newest);
    if (!fresh.length) return;
    const add = fresh.map((e, i) => ({ ...e, id: `${e.t}-${i}-${Math.random()}` }));
    setToasts(t => [...add, ...t].slice(0, 4));
    add.forEach(a => setTimeout(() => setToasts(t => t.filter(x => x.id !== a.id)), 6000));
  }, [feed, profileKey]);
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}>
          <img src={`/api/texture/${ICON[t.kind] || 'nether_star'}`} alt="" onError={e => { const img = e.currentTarget; img.onerror = null; if (img.dataset.fb) { img.style.visibility = 'hidden'; return; } img.dataset.fb = '1'; img.src = '/api/texture/nether_star'; }} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
