// Ссылки в тексте новостей: [название](раздел/подраздел#блок). Нажатие открывает раздел (#/раздел/подраздел),
// прокручивает к блоку с data-news="блок" и подсвечивает его пару секунд. Разметка та же, что в server/news/links.js.
import { Rich } from './guides/Rich.jsx';

const LINK = /\[([^\]\n]+)\]\(([a-z0-9][a-z0-9/_-]*)(?:#([a-z0-9-]+))?\)/g;

/** Строка → куски: текст и { label, path, anchor }. */
export function splitNewsLinks(text) {
  const s = String(text ?? '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(LINK)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ label: m[1], path: m[2], anchor: m[3] || null });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Ждёт, пока на открытой странице появится блок (страницы грузятся частями), прокручивает к нему и подсвечивает. */
export function highlightBlock(anchor, { timeout = 10000 } = {}) {
  const t0 = Date.now();
  const tick = () => {
    const el = document.querySelector(`[data-news="${anchor}"]`);
    if (!el) { if (Date.now() - t0 < timeout) setTimeout(tick, 150); return; }
    if (el.tagName === 'DETAILS') el.open = true;
    // Высокий блок (длинный список) — к его началу, иначе к центру экрана
    el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > innerHeight * 0.8 ? 'start' : 'center' });
    el.classList.remove('news-hl');
    void el.offsetWidth; // перезапуск анимации, если жмут второй раз
    el.classList.add('news-hl');
    setTimeout(() => el.classList.remove('news-hl'), 2400);
  };
  setTimeout(tick, 80);
}

export function openNewsLink(path, anchor) {
  const hash = `#/${path}`;
  if (location.hash !== hash) location.hash = hash;
  if (anchor) highlightBlock(anchor);
  else scrollTo({ top: 0, behavior: 'smooth' });
}

/** Текст новости: ссылки на разделы + подсказки по игровым терминам (Rich) в остальном тексте. */
export function NewsText({ text, onGo }) {
  return <>{splitNewsLinks(text).map((p, i) => typeof p === 'string'
    ? <Rich key={i} text={p} />
    : <a key={i} className="news-link" href={`#/${p.path}`}
        onClick={e => { e.preventDefault(); onGo?.(); openNewsLink(p.path, p.anchor); }}>{p.label}</a>)}</>;
}
