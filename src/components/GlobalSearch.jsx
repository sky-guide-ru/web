import { useEffect, useRef, useState } from 'react';
import { LivePrice } from './PriceDuo.jsx';
import { ItemIcon } from './ItemIcon.jsx';
import { EN as EN_SITE } from '../i18n.js';
import { api, coins, RARITY_COLOR, RARITY_RU, getRecent, variantLabel, setView, me } from '../api.js';

// Разделы сайта и слова, по которым их ищут (своими словами, сленгом и по-английски)
const SECTIONS = [
  { id: 'overview', label: 'Обзор', icon: 'nether_star', words: 'обзор главная профиль overview home' },
  { id: 'roadmap', label: 'Что делать', icon: 'map', words: 'что делать план шаги советы прогрессия roadmap plan' },
  { id: 'skills', label: 'Прогресс', icon: 'experience_bottle', words: 'прогресс скиллы навыки уровень слееры катакомбы skills slayer' },
  { id: 'gear', label: 'Снаряжение', icon: 'diamond_sword', words: 'снаряжение броня оружие сеты гардероб инвентарь рюкзак хранилище gear armor weapon wardrobe' },
  { id: 'accessories', label: 'Аксессуары', icon: 'ender_eye', words: 'аксессуары талисманы магическая сила mp accessories talisman magical power' },
  { id: 'pets', label: 'Питомцы', icon: 'bone', words: 'питомцы петы пет pets pet' },
  { id: 'guides', label: 'Гайды', icon: 'written_book', words: 'гайды гайд руководство guides guide' },
  { id: 'compare', label: 'Сравнение', icon: 'comparator', words: 'сравнение сравнить друзья compare' },
  { id: 'money', label: 'Заработок', icon: 'gold_ingot', words: 'заработок деньги монеты фарм профит доход money coins profit' },
  { id: 'market', label: 'Рынок', icon: 'emerald', words: 'рынок базар аукцион цены флипы bazaar auction ah market prices' },
  { id: 'wiki', label: 'Вики', icon: 'book', words: 'вики предметы энциклопедия wiki items' },
];
// Лишние слова для гайдов, которых нет в их названии
const GUIDE_WORDS = { dungeons: 'данж данжи катакомбы dungeon catacombs мастер', kuudra: 'куудра кудра', rift: 'рифт rift', fishing: 'рыбалка рыба fishing',
  mining: 'шахта майнинг копать mining', farming: 'ферма фарм сад огород garden farming', foraging: 'лес дерево деревья foraging форейджинг форагинг форагенг форажинг лесоруб рубка топор galatea галатея hotf heart forest', minions: 'миньоны миньон minions',
  hunting: 'хантинг охота охотник осколки осколок шард шарды атрибуты атрибут shards attributes huntingbox ловушки соль фьюжн', chocolate: 'шоколад шоколадная фабрика кролики кролик хоппити hoppity cf яйца' };

// Неверная раскладка: «руззукшщт» → «hyperion» и обратно
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = 'йцукенгшщзхъфывапролджэячсмитьбю';
const swapLayout = t => [...t].map(c => { let i = EN.indexOf(c); if (i >= 0) return RU[i]; i = RU.indexOf(c); return i >= 0 ? EN[i] : c; }).join('');
const norm = t => t.toLowerCase().replace(/ё/g, 'е').trim();
// Слово подходит, если запрос — его начало, или запрос — то же слово в другом падеже («рыбалку» → «рыбалка»)
const wordHit = (q, word) => word.startsWith(q) || (q.length >= 5 && word.length >= 5 && q.startsWith(word.slice(0, word.length - 2)));
function matches(q, text) {
  const words = norm(text).split(/[^a-zа-я0-9]+/).filter(Boolean);
  const qs = norm(q).split(/\s+/).filter(Boolean);
  return qs.length > 0 && qs.every(p => words.some(w => wordHit(p, w)));
}
const NICK = /^[A-Za-z0-9_]{3,16}$/;

// Поиск из шапки на любой странице: предметы, разделы, гайды и профиль игрока по нику.
// Ctrl+K или «/» — фокус, стрелки — выбор, Enter — открыть, Esc — закрыть.
export function GlobalSearch({ onOpen }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false); // нет связи: не говорим «ничего не найдено», когда искать было негде
  const [guides, setGuides] = useState(null);
  const input = useRef(null);
  const box = useRef(null);
  // Список гайдов грузим один раз, когда поиском впервые воспользовались
  useEffect(() => { if (open && !guides) api('/guides').then(r => setGuides(r.guides || []), () => setGuides([])); }, [open, guides]);

  useEffect(() => {
    const f = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if ((e.key === 'k' || e.key === 'л') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); input.current?.focus(); input.current?.select(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  useEffect(() => {
    const f = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    addEventListener('mousedown', f);
    return () => removeEventListener('mousedown', f);
  }, []);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes([]); setLoading(false); return; }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(s)}`)
      .then(r => { if (alive) { setRes(r.slice(0, 8)); setSel(0); setFailed(false); } })
      .catch(() => { if (alive) { setRes([]); setFailed(true); } })
      .finally(() => alive && setLoading(false)), 150);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  // Одинаковые названия (питомец Wolf четырёх редкостей, два God Potion) различаем подписью: редкость, а если и она совпала — ID
  const sub = r => {
    const same = res.filter(x => x.name === r.name);
    // русское название — подсказка только на русской версии; на /en/ оно было бы русским текстом посреди английского
    const parts = [!EN_SITE && r.nameRu && r.nameRu !== r.name && r.nameRu];
    // у питомцев редкость уже есть в русском названии: «Питомец Wolf (легендарный)»
    if (same.length > 1 && !(r.id.includes(';') && parts[0])) {
      parts.push(RARITY_RU[r.rarity]);
      if (!RARITY_RU[r.rarity] || same.filter(x => x.rarity === r.rarity).length > 1) parts.push(variantLabel(r.id));
    }
    return parts.filter(Boolean).join(' · ');
  };
  const close = () => { setOpen(false); input.current?.blur(); };
  const pick = r => { onOpen(r.id); close(); };
  const s = q.trim();
  // Разделы и гайды ищем прямо в браузере, и в обычной, и в «перепутанной» раскладке
  const local = [];
  if (s.length >= 2) {
    const variants = [s, swapLayout(s.toLowerCase())];
    const hit = text => variants.some(v => matches(v, text));
    for (const g of guides || []) if (hit(`${g.title} ${g.id.replace(/-/g, ' ')} ${GUIDE_WORDS[g.id] || ''}`)) local.push({ kind: 'guide', key: `g:${g.id}`, label: g.title, sub: 'Гайд', icon: g.icon, href: `#/guides/${g.id}` });
    for (const p of SECTIONS) if (hit(`${p.label} ${p.words}`)) local.push({ kind: 'page', key: `p:${p.id}`, label: p.label, sub: 'Раздел сайта', tex: p.icon, href: `#/${p.id}` });
  }
  const places = local.slice(0, 4);
  // Похоже на ник Minecraft — предлагаем открыть профиль этого игрока
  const nick = NICK.test(s) ? s : null;
  // Один общий список для стрелок: разделы/гайды → предметы → игрок → «все результаты».
  // Если предметы нашлись только «похожие» (ник Refraction → книги Reflection), ник — это точнее: игрок идёт перед ними
  const items = res.map(r => ({ kind: 'item', key: r.id, r }));
  const player = nick ? [{ kind: 'player', key: `u:${nick}` }] : [];
  const nickFirst = nick && !loading && !res.some(r => !r.close);
  const entries = nickFirst ? [...places, ...player, ...items] : [...places, ...items, ...player];
  const choose = e => {
    if (!e) return;
    if (e.kind === 'item') return pick(e.r);
    close();
    if (e.kind === 'player') { setView({ player: nick, profile: '' }); location.hash = '#/overview'; }
    else location.hash = e.href;
  };
  const all = () => { location.hash = `#/wiki/${encodeURIComponent(q.trim())}`; close(); };
  // Пустое поле — показываем недавно открытые предметы
  const recent = open && q.trim().length < 2 ? getRecent().slice(0, 6) : [];
  const show = open && q.trim().length >= 2;
  // Стрелки и Enter работают и по «Недавно открытым», когда поле пустое
  const onKey = e => {
    const list = recent.length ? recent : entries;
    const extra = recent.length ? 0 : 1; // пункт «Все результаты» есть только у поиска
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, Math.max(0, list.length - 1 + extra))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { if (recent.length ? recent[sel] : entries[sel]) (recent.length ? pick(recent[sel]) : choose(entries[sel])); else if (s.length >= 2) all(); }
    else if (e.key === 'Escape') close();
  };

  return (
    <div className="gsearch" ref={box}>
      <input
        ref={input}
        className="gsearch-input"
        placeholder="Поиск…"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); setSel(0); }}
        onFocus={() => { setOpen(true); setSel(0); }}
        onKeyDown={onKey}
        aria-label="Поиск по сайту: предметы, разделы, гайды, игроки"
        title="Предметы (можно сленгом: терма, рекомб), разделы, гайды и ник игрока"
      />
      <kbd className="gsearch-kbd">Ctrl K</kbd>
      {recent.length > 0 && (
        <div className="gsearch-pop" role="listbox">
          <div className="muted tiny gsearch-empty">Недавно открытые</div>
          {recent.map((r, i) => (
            <div key={r.id} role="option" aria-selected={i === sel} className={`gsearch-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onMouseDown={e => { e.preventDefault(); pick(r); }}>
              <ItemIcon id={r.id} size={28} />
              <div className="grow" style={{ color: RARITY_COLOR[r.rarity] }}>{r.name || r.id}</div>
            </div>
          ))}
        </div>
      )}
      {show && (
        <div className="gsearch-pop" role="listbox">
          {entries.map((e, i) => {
            const props = { key: e.key, role: 'option', 'aria-selected': i === sel, className: `gsearch-item ${i === sel ? 'sel' : ''}`, onMouseEnter: () => setSel(i), onMouseDown: ev => { ev.preventDefault(); choose(e); } };
            if (e.kind === 'item') {
              const r = e.r;
              return (
                <div {...props}>
                  <ItemIcon id={r.id} size={28} />
                  <div className="grow">
                    <div style={{ color: RARITY_COLOR[r.rarity] }}>{r.name}</div>
                    {sub(r) && <div className="muted tiny">{sub(r)}</div>}
                  </div>
                  {r.price ? <span className="price small"><LivePrice id={r.id} fallback={coins(r.price)} /></span> : null}
                </div>
              );
            }
            if (e.kind === 'player') return (
              <div {...props}>
                <img className="gsearch-head" src={`/api/head/${encodeURIComponent(nick)}?size=64`} width={28} height={28} alt="" onError={ev => { ev.currentTarget.style.visibility = 'hidden'; }} />
                <div className="grow"><div>Профиль игрока <b>{nick}</b></div><div className="muted tiny">{me.guest ? 'Открыть его прогресс по нику' : 'Посмотреть его прогресс, как свой'}</div></div>
              </div>
            );
            return (
              <div {...props}>
                {e.icon ? <ItemIcon id={e.icon} size={28} /> : <img className="gsearch-tex" src={`/api/texture/${e.tex}`} width={22} height={22} alt="" />}
                <div className="grow"><div>{e.label}</div><div className="muted tiny">{e.sub}</div></div>
                <span className="muted tiny">→</span>
              </div>
            );
          })}
          {!entries.length && <div className="muted small gsearch-empty">{loading ? 'Ищу…' : failed ? 'Нет связи с сервером, поиск не сработал. Проверь интернет и попробуй ещё раз.' : 'Ничего не найдено. Попробуй по-английски или короче.'}</div>}
          {loading && entries.length > 0 && !res.length && <div className="muted tiny gsearch-empty">Ищу предметы…</div>}
          {res.length > 0 && (
            <div className={`gsearch-item gsearch-all ${sel === entries.length ? 'sel' : ''}`} onMouseEnter={() => setSel(entries.length)} onMouseDown={e => { e.preventDefault(); all(); }}>
              Все предметы в вики →
            </div>
          )}
        </div>
      )}
    </div>
  );
}
