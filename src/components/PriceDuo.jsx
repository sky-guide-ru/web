// Две живые цены предмета: «купить» и «продать» (Bazaar: Instant Buy / Instant Sell; аукцион: самый дешёвый BIN /
// медиана недавних продаж). Нажатие открывает предмет на «Рынке» с полным графиком.
// <PriceDuo q={quote} onOpen={…} /> — котировка уже есть (карточка предмета);
// <LivePrice id="…" /> — котировка подтягивается сама, запросы со всей страницы собираются в один.
import { useEffect, useState } from 'react';
import { LOCALE } from '../i18n.js';
import { api, coins } from '../api.js';

/** Цена без округления до «1,3 тыс.» для дешёвых товаров: у Bazaar купить и продать иначе выглядят одинаково */
export const priceCoins = v => (Math.abs(v) < 1e5 ? Math.round(v).toLocaleString(LOCALE) : coins(v));

const pct = v => `${v > 0 ? '▲' : v < 0 ? '▼' : ''}${Math.abs(v).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;

/** Подсказка: откуда каждая цена */
export function quoteTitle(q) {
  if (!q) return '';
  if (q.market === 'bazaar') return `Bazaar. Купить — Instant Buy (сразу, по самому дешёвому ордеру на продажу). Продать — Instant Sell, после налога Bazaar ≈ ${coins(q.sellNet)}.`;
  return `Auction House. Купить — самый дешёвый лот BIN${q.lots ? ` (лотов: ${q.lots})` : ''}. Продать — ${q.sellFrom === 'sales' ? `средняя цена недавних продаж${q.sold7 ? ` (за неделю продано ${q.sold7})` : ''}` : q.sellFrom === 'cap' ? 'не дороже самого дешёвого лота (дорогие продажи — это копии с улучшениями)' : 'следующий по цене лот (продаж за неделю не было)'}, после комиссий аукциона ≈ ${coins(q.sellNet)}.`;
}

/** Строка тренда «за сутки ▲2% · за неделю ▼5%» */
export function QuoteTrend({ q }) {
  if (!q || (q.d1 == null && q.d7 == null)) return null;
  const part = (v, l) => v == null ? null : <span className={v > 0 ? 'green' : v < 0 ? 'red' : 'muted'}>{l} {pct(v)}</span>;
  return <span className="pd-trend tiny">{[part(q.d1, 'за сутки'), part(q.d7, 'за неделю')].filter(Boolean).reduce((a, b) => [a, ' · ', b])}</span>;
}

export function PriceDuo({ q, onOpen, compact = false, trend = false }) {
  if (!q) return null;
  const sellLabel = q.market === 'ah' && q.sellFrom === 'sales' ? 'Продают за' : 'Продать';
  const body = <>
    <span className="pd-src">{q.market === 'bazaar' ? 'Bazaar' : 'AH'}</span>
    {q.buy > 0 && <span className="pd-buy">{compact ? '' : 'Купить '}<b>{priceCoins(q.buy)}</b></span>}
    {q.sell > 0 && <span className="pd-sell">{compact ? '/ ' : `${sellLabel} `}<b>{priceCoins(q.sell)}</b></span>}
    {!compact && q.market === 'ah' && q.lots > 0 && <span className="pd-lots muted">{q.lots} лот.</span>}
  </>;
  return (
    <span className={`price-duo${compact ? ' compact' : ''}`}>
      {onOpen ? <button type="button" className="pd-btn" title={`${quoteTitle(q)} Нажми — график на «Рынке».`} onClick={onOpen}>{body}<span className="pd-go" aria-hidden>📈</span></button>
        : <span className="pd-btn static" title={quoteTitle(q)}>{body}</span>}
      {trend && <QuoteTrend q={q} />}
    </span>
  );
}

// Сборщик запросов: все <LivePrice> страницы за один тик уходят одним /api/quotes?ids=…, ответ живёт минуту
const cache = new Map(); // id → { at, q }
let pending = null;
function loadQuote(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.at < 60_000) return Promise.resolve(c.q);
  if (!pending) {
    const batch = { ids: new Set(), done: null };
    batch.done = new Promise(r => setTimeout(r, 30)).then(() => {
      pending = null;
      const ids = [...batch.ids];
      const chunks = [];
      for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
      return Promise.all(chunks.map(ch => api(`/quotes?ids=${ch.map(encodeURIComponent).join(',')}`).catch(() => ({}))))
        .then(rs => { const all = Object.assign({}, ...rs); for (const k of ids) cache.set(k, { at: Date.now(), q: all[k] || null }); return all; });
    });
    pending = batch;
  }
  pending.ids.add(id);
  return pending.done.then(all => all[id] || null);
}

/** Живые цены по ID предмета; нет на рынке — fallback (по умолчанию «не продаётся»). */
export function LivePrice({ id, compact = true, fallback, onOpen }) {
  const [q, setQ] = useState(() => cache.get(id)?.q);
  useEffect(() => {
    let alive = true;
    if (id) loadQuote(id).then(r => alive && setQ(r));
    return () => { alive = false; };
  }, [id]);
  if (q === undefined) return <span className="muted tiny">…</span>;
  if (!q) return fallback === undefined ? <span className="muted tiny" title="Предмет сейчас нельзя купить на Bazaar и аукционе">не продаётся</span> : fallback;
  return <PriceDuo q={q} compact={compact} onOpen={onOpen} />;
}
