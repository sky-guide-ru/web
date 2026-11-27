// «Нравится / Не хочу» в плане: категории шагов, которые игрок любит или не хочет делать.
// «Нравится» поднимает шаги категории выше, «Не хочу» убирает их из «Что делать» (они остаются в блоке «Не хочу»).
// Хранится в этом браузере, отдельно для каждого открытого профиля. Ironman и Bingo план учитывает сам.
import { useProfileStore } from './api.js';

const KEY = 'sb-plan-interests';
const LIFT = 8; // на сколько мест поднимается шаг из любимой категории

export function useInterests() {
  const [interests, set] = useProfileStore(KEY, {});
  const setCat = (cat, value) => {
    const n = { ...(interests || {}) };
    if (value) n[cat] = value; else delete n[cat];
    set(n);
  };
  return { interests: interests || {}, setCat, clear: () => set({}) };
}

/** Шаги с учётом интересов: «не хочу» — убраны, «нравится» — подняты на несколько мест (порядок плана в остальном тот же). */
export function applyInterests(steps, interests) {
  if (!interests || !Object.keys(interests).length) return steps;
  return steps
    .map((s, i) => ({ s, i, k: i - (interests[s.cat] === 'like' ? LIFT : 0) }))
    .filter(x => interests[x.s.cat] !== 'no')
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map(x => x.s);
}
