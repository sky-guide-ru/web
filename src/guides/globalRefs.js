// Общий словарь игровых терминов для всего сайта. Грузится один раз (GET /api/refs/lexicon): предметы NEU, чары
// с уровнями, статы, скиллы, мэры, острова, слееры, этажи, редкости, reforges, меню (server/guides/refs.js + terms.js).
// <Rich text=…/> сам находит в строке термины, которых нет в refs страницы; данные подсказки для найденного
// термина подтягиваются пачкой (GET /api/refs/data) и кешируются до перезагрузки страницы.

let phrases = null;   // Map: фраза (с ' вместо ’) → ref
let loading = false;
let refetch = false; // словарь был неполным (сервер грузил базу) — перезапросить
let version = 0;
const subs = new Set();
const data = new Map();
const missing = new Set();
const pending = new Set();
let timer = null;

const bump = () => { version++; subs.forEach(f => f()); };
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const getVersion = () => version;

export function ensureLexicon() {
  if ((phrases && !refetch) || loading || typeof fetch === 'undefined') return;
  refetch = false;
  loading = true;
  fetch('/api/refs/lexicon')
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j?.phrases) throw new Error('нет словаря');
      phrases = new Map(Object.entries(j.phrases).map(([p, r]) => [p.replace(/’/g, '\''), r]));
      bump();
      // Сервер только что запустился и ещё грузит предметы: пока пользуемся тем, что есть, и спросим ещё раз
      if (j.ready === false) setTimeout(() => { loading = false; refetch = true; ensureLexicon(); }, 30_000);
      else loading = false;
    })
    .catch(() => { setTimeout(() => { loading = false; ensureLexicon(); }, 60_000); }); // сервер недоступен — попробуем позже
}

function flush() {
  timer = null;
  const list = [...pending].slice(0, 150);
  list.forEach(r => pending.delete(r));
  if (pending.size) timer = setTimeout(flush, 0);
  if (!list.length) return;
  fetch(`/api/refs/data?r=${encodeURIComponent(list.join('|'))}`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(j => { for (const r of list) { if (j[r]) data.set(r, j[r]); else missing.add(r); } bump(); })
    // Сеть или сервер подвели — ref не помечаем отсутствующими: следующий показ запросит их снова
    .catch(() => {});
}

/** Данные подсказки или null (тогда запрос уже в пути, компонент перерисуется по subscribe). */
export function globalData(ref) {
  const d = data.get(ref);
  if (d) return d;
  if (!missing.has(ref) && !pending.has(ref)) {
    pending.add(ref);
    if (!timer) timer = setTimeout(flush, 30);
  }
  return null;
}

// Тот же разбор, что на сервере (findPhrases): слова, самая длинная фраза с каждой позиции
const WORD = /[\p{L}\p{N}+][\p{L}\p{N}'’\-+]*/gu;
const MAX_WORDS = 7;
// ™ ® © словарь не хранит («InfiniVacuum™ Hooverius» → «InfiniVacuum Hooverius»), между словами они допустимы
const GAP = /^[™®©]?(\s|\.\s|\s&\s|\s-\s)$/;
const MARKS = /[™®©]/g;

/** Разбивает строку на куски текста и { ref, text } по общему словарю. */
export function splitGlobal(s) {
  if (!phrases || !s || !/[A-Za-zА-Яа-яЁё]/.test(s)) return [s];
  const words = [];
  for (const m of s.matchAll(WORD)) {
    const raw = m[0].replace(/['’\-]+$/, '');
    words.push({ start: m.index, end: m.index + raw.length });
  }
  const out = [];
  let last = 0;
  for (let i = 0; i < words.length;) {
    let hit = 0, ref = null;
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      let ok = true;
      for (let k = i + 1; k < i + n; k++) if (!GAP.test(s.slice(words[k - 1].end, words[k].start))) { ok = false; break; }
      if (!ok) continue;
      const r = phrases.get(s.slice(words[i].start, words[i + n - 1].end).replace(/’/g, '\'').replace(MARKS, ''));
      if (r) { hit = n; ref = r; break; }
    }
    if (!hit) { i++; continue; }
    const a = words[i].start, b = words[i + hit - 1].end;
    if (a > last) out.push(s.slice(last, a));
    out.push({ ref, text: s.slice(a, b), global: true });
    last = b;
    i += hit;
  }
  if (!out.length) return [s];
  if (last < s.length) out.push(s.slice(last));
  return out;
}
