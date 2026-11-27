import { LOCALE } from '../i18n.js';
// «Как получить — пошагово»: каждый способ (рынок, NPC, крафт, Forge, Kat, дроп) — отдельная
// карточка с шагами: куда идти (остров, телепорт, координаты), что нужно открыть (с проверкой по профилю),
// сколько стоит по живым ценам, дерево ингредиентов с источником каждого и ссылка на вики.
import { useState } from 'react';
import { ItemIcon } from './ItemIcon.jsx';
import { coins, useApi } from '../api.js';
import { Rich } from '../guides/Rich.jsx';
import { quoteTitle, priceCoins } from './PriceDuo.jsx';

const KIND = {
  market: { ico: '🏦', cls: 'ob-market' }, npc: { ico: '🧑‍🌾', cls: 'ob-npc' }, craft: { ico: '🛠️', cls: 'ob-craft' },
  forge: { ico: '⚒️', cls: 'ob-forge' }, 'dark-auction': { ico: '🌑', cls: 'ob-da' }, kat: { ico: '🐾', cls: 'ob-kat' }, drop: { ico: '⚔️', cls: 'ob-drop' }, rift: { ico: '🌀', cls: 'ob-rift' }, trade: { ico: '🔁', cls: 'ob-trade' },
};
const VIA = { bazaar: 'Bazaar', ah: 'аукцион', npc: 'NPC', craft: 'крафт', forge: 'Forge', drop: 'дроп', coins: '', currency: 'валюта', rift: 'Rift', none: '?' };
const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

function Req({ req }) {
  if (!req) return null;
  const cls = req.ok === true ? 'ok' : req.ok === false ? 'bad' : 'unk';
  const mark = req.ok === true ? '✔ уже открыто' : req.ok === false ? `✖ пока не открыто${req.missing?.length ? `: не хватает ${req.missing.join(', ')}` : ''}` : '';
  return <>
    {(mark || req.have) && <div className={`ob-req ob-req-${cls}`}>{mark}{mark && req.have ? ' · ' : ''}{req.have}</div>}
    {req.hint && req.ok !== true && <div className="ob-req-hint">💡 <Rich text={req.hint} /></div>}
  </>;
}

// Одна строка ингредиента: иконка, количество, где взять и почём; внутри — из чего крафтится
function Node({ n, open, depth = 0 }) {
  const [show, setShow] = useState(depth < 1 && !!n.children && n.via === 'craft');
  const clickable = !['coins', 'currency'].includes(n.via);
  const viaText = n.via === 'currency' ? n.viaRu : n.via === 'drop' || n.via === 'rift' || n.via === 'none' || (n.via === 'npc' && n.unit == null) || n.via === 'forge' && n.unit == null ? n.viaRu : n.viaRu || VIA[n.via];
  return (
    <li className="ob-node">
      <div className="ob-node-row">
        {n.children ? <button className="ob-tog" onClick={() => setShow(s => !s)} aria-label={show ? 'Свернуть' : 'Из чего крафтится'}>{show ? '▾' : '▸'}</button> : <span className="ob-tog-sp" />}
        {clickable ? <ItemIcon id={n.id} size={26} onClick={() => open(n.id)} title={n.name} /> : <span className="ob-coin">🪙</span>}
        <span className="ob-node-name">
          {n.via === 'coins' ? <b>{coins(n.count)} монет</b> : <>
            <b>{n.count.toLocaleString(LOCALE)}×</b>{' '}
            {clickable ? <a className="link" onClick={() => open(n.id)} role="button" tabIndex={0}>{n.name}</a> : n.name}
          </>}
          {viaText && n.via !== 'coins' && !(n.have > 0 && !n.need) && <span className={`ob-via ob-via-${n.via}`}>{viaText}</span>}
          {n.reqRu && <span className="muted tiny"> · нужно: {n.reqRu}</span>}
        </span>
        {n.have > 0 && <span className={`ob-have ${n.need ? '' : 'full'}`} title={n.from ? `У тебя: ${n.from}` : undefined}>{n.need ? `есть ${n.have.toLocaleString(LOCALE)} · нужно ещё ${n.need.toLocaleString(LOCALE)}` : `✔ есть${n.from ? ` · ${n.from}` : ''}`}</span>}
        {n.via !== 'coins' && <span className="ob-price">{n.have > 0 && !n.need ? '' : n.rest != null && n.total != null ? <span title={`Без запасов: ${coins(n.total)}`}>{n.rest ? coins(n.rest) : '0'}</span> : n.total != null ? coins(n.total) : n.partial ? 'часть без цены' : ''}</span>}
      </div>
      {n.alt?.unit != null && n.unit != null && Math.abs(n.alt.unit - n.unit) / n.unit > 0.03 && (
        <div className="muted tiny ob-alt">{n.alt.viaRu === 'скрафтить' ? 'Скрафтить' : `Купить (${n.alt.viaRu})`}: {coins(n.alt.unit * n.count)}{n.alt.unit > n.unit ? ` — дороже на ${coins((n.alt.unit - n.unit) * n.count)}` : ''}</div>
      )}
      {show && n.children && <ul className="ob-tree">{n.children.map((c, i) => <Node key={i} n={c} open={open} depth={depth + 1} />)}</ul>}
    </li>
  );
}

function Grid({ grid, open }) {
  return (
    <div className="recipe-grid ob-grid">
      {SLOTS.map(k => {
        const s = grid[k];
        if (!s) return <div key={k}><div className="slot-empty" /></div>;
        const i = String(s).lastIndexOf(':');
        const id = i > 0 ? s.slice(0, i) : s, n = i > 0 ? s.slice(i + 1) : 1;
        return <div key={k}><div className="recipe-cell"><ItemIcon id={id} size={34} slot onClick={() => open(id)} title={id} />{Number(n) > 1 && <span className="count">{n}</span>}</div></div>;
      })}
    </div>
  );
}

function Method({ m, open, startOpen }) {
  const k = KIND[m.kind] || KIND.trade;
  return (
    <details className={`ob-method ${k.cls}${m.best ? ' ob-best' : ''}`} open={startOpen}>
      <summary>
        <span className="ob-ico" aria-hidden>{k.ico}</span>
        <span className="ob-title">{m.title}</span>
        {m.best && <span className="ob-badge-best">выгоднее всего</span>}
        {m.req?.ok === false && <span className="ob-badge-lock">🔒 не открыто</span>}
        {m.quote ? <span className="ob-total ob-duo" title={quoteTitle(m.quote)}>
          <span>купить <b>{priceCoins(m.quote.buy)}</b></span>
          {m.quote.sell > 0 && <span className="muted">{m.quote.market === 'ah' && m.quote.sellFrom === 'sales' ? 'продают за' : 'продать'} {priceCoins(m.quote.sell)}</span>}
        </span>
          : <span className="ob-total">{m.total != null ? coins(m.total) : m.minBid ? `ставка от ${coins(m.minBid)}` : m.chance ? `${m.amountRu ? `${m.amountRu} · ` : ''}шанс ${m.chance}` : ''}</span>}
      </summary>
      <ol className="ob-steps">
        {m.steps.map((s, i) => (
          <li key={i} className={s.warn ? 'ob-warn' : ''}>
            <div><Rich text={s.text} /></div>
            {s.note && <div className="muted tiny"><Rich text={s.note} /></div>}
            <Req req={s.req} />
            {s.items?.length > 0 && !(s.items.length === 1 && s.items[0].via === 'coins') && <ul className="ob-tree">{s.items.map((n, j) => <Node key={j} n={n} open={open} />)}</ul>}
            {s.tree && <ul className="ob-tree">{s.tree.map((n, j) => <Node key={j} n={n} open={open} />)}</ul>}
          </li>
        ))}
      </ol>
      {m.fromStock > 0 && <div className="ob-stock small">Из своих запасов: −{coins(m.fromStock)}{m.total != null ? `, докупить на ${coins(Math.max(0, m.total - m.fromStock))}` : ''}</div>}
      {m.grid && <div className="ob-grid-wrap"><div className="muted tiny">Как разложить на верстаке:</div><Grid grid={m.grid} open={open} /></div>}
      {m.guide && <a className="link small" href={`#/guides/${m.guide}`}>Подробный гайд на сайте →</a>}
    </details>
  );
}

/** extra — строки items-ru, которых нет в шагах (например, «Community Shop», «Источник: …» у книг) */
export function ObtainGuide({ id, open, extra = [], fallbackText }) {
  const { data, error } = useApi(`/item/${encodeURIComponent(id)}/obtain`, [id]);
  if (error && !/404/.test(error)) return <div className="muted small">Не удалось загрузить способы получения: {error}</div>;
  if (!data && !error) return <div className="loader"><div className="spinner" /></div>;
  const methods = data?.methods || [];
  const wiki = data?.wiki;
  return (
    <div className="obtain">
      {data?.cheapest && methods.length > 1 && (
        <div className="ob-summary">💡 Дешевле всего сейчас: <b>{data.cheapest.title.replace(/^./, c => c.toLowerCase())}</b> — {coins(data.cheapest.total)} монет</div>
      )}
      {methods.map((m, i) => <Method key={`${id}-${i}`} m={m} open={open} startOpen={m.best || i === 0 || (methods.length <= 3 && m.kind !== 'trade')} />)}
      {extra.length > 0 && (
        <ul className="where">
          {extra.map((w, i) => <li key={i} className={`where-${w.kind}`}><span>{w.textRu}</span></li>)}
        </ul>
      )}
      {!methods.length && !extra.length && <div className="muted small">{fallbackText || 'В базе нет способа получения для этого предмета.'}</div>}
      {wiki && (
        <div className="ob-wiki">
          {wiki.page
            ? <a className="btn-wiki" href={wiki.page} target="_blank" rel="noreferrer">📖 Полная страница на вики Hypixel SkyBlock →</a>
            : <a className="btn-wiki" href={wiki.search} target="_blank" rel="noreferrer">📖 Найти на вики Hypixel SkyBlock →</a>}
          <span className="muted tiny"> вики на английском</span>
        </div>
      )}
    </div>
  );
}
