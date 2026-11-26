// Уборка скрытых шагов плана (без зависимостей от браузера — её проверяет server/test/roadmap-hidden.test.js).
const GONE_MS = 24 * 3600_000;

/** Та же уборка, что на сервере (server/roadmap/hidden.js → pruneHidden). */
export function pruneHidden(hidden = {}, stepIds, now = Date.now()) {
  const ids = new Set(stepIds || []);
  if (!ids.size) return { hidden, changed: false };
  const out = {};
  let changed = false;
  for (const [id, v0] of Object.entries(hidden)) {
    const v = v0 && typeof v0 === 'object' ? v0 : { at: typeof v0 === 'number' ? v0 : 0 };
    if (v !== v0) changed = true;
    if (ids.has(id)) {
      if (v.gone) { changed = true; out[id] = { at: v.at }; } else out[id] = v;
    } else if (!v.gone) { changed = true; out[id] = { ...v, gone: now }; }
    else if (now - v.gone > GONE_MS) changed = true;
    else out[id] = v;
  }
  return { hidden: changed ? out : hidden, changed };
}
