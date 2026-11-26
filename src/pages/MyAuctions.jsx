// Вкладка «Мои лоты» на странице «Заработок»: свои лоты Auction House (продан, истёк, висит, есть дешевле) и ставки.
// Данные — /api/my-auctions (core/src/player-auctions.js): лоты с Hypixel не чаще раза в 3 минуты, ставки из скана аукциона.
import { useEffect, useState } from 'react';
import { Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, useApi, ago, RARITY_COLOR } from '../api.js';
import { Rich } from '../guides/Rich.jsx';

// Сколько осталось: «2 д 5 ч», «5 ч 10 мин», «12 мин»
function left(ts, now) {
  const m = Math.max(0, Math.round((ts - now) / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d} д ${h} ч` : h ? (m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`) : `${m} мин`;
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

// Строка лота: что за предмет, что с ним и что делать
function lotState(l, now) {
  if (l.status === 'sold') return { cls: 'ok', text: `Продан · забрать ${coins(l.coins)}` };
  if (l.status === 'expired') return { cls: 'mute', text: 'Истёк · забрать предмет' };
  if (!l.bin) return { cls: l.bids ? 'ok' : 'mute', text: l.bids ? `Ставка ${coins(l.price)} · ставок ${l.bids}` : 'Ставок пока нет', end: left(l.end, now) };
  if (l.undercut) return { cls: 'warn', text: `Есть дешевле на ${coins(l.undercut)} · ${coins(l.lowest)}`, end: left(l.end, now) };
  if (l.cheapest) return { cls: 'ok', text: l.next ? `Самый дешёвый · следующий ${coins(l.next)}` : 'Самый дешёвый', end: left(l.end, now) };
  return { cls: 'mute', text: 'Висит', end: left(l.end, now) };
}

function Row({ id, name, tier, state, price, openItem }) {
  return (
    <li className={`myah-row ${state.cls}`}>
      {id ? <button className="mt-item-btn" onClick={() => openItem?.(id)} title="Открыть карточку предмета"><ItemIcon id={id} size={28} /></button> : <span className="myah-noico" />}
      <span className="myah-main">
        <span className="myah-name" style={{ color: RARITY_COLOR[tier] }}>{name}</span>
        <span className={`myah-state ${state.cls}`}>{state.text}</span>
      </span>
      <span className="myah-side">
        <b>{price}</b>
        {state.end && <span className="muted tiny">ещё {state.end}</span>}
      </span>
    </li>
  );
}

export default function MyAuctions({ openItem }) {
  const { data: d } = useApi('/my-auctions', []);
  const now = useNow();
  if (!d) return <div className="loader"><div className="spinner" /></div>;
  if (d.status === 'error') return <Empty>Лоты не загрузились: {d.error}</Empty>;
  if (d.status !== 'ok') return <Empty>Открой свой профиль, чтобы увидеть лоты.</Empty>;
  const s = d.summary;
  const chips = [
    s.coins > 0 && ['ok', `Забрать ${coins(s.coins)}`],
    s.expired > 0 && ['mute', `Истекло: ${s.expired}`],
    s.active > 0 && ['', `Висит: ${s.active}`],
    s.undercut > 0 && ['warn', `Есть дешевле: ${s.undercut}`],
    s.outbid > 0 && ['warn', `Перебили ставок: ${s.outbid}`],
  ].filter(Boolean);
  return (
    <div className="myah" data-news="auctions">
      {chips.length > 0 && <div className="myah-chips">{chips.map(([c, t]) => <span key={t} className={`myah-chip ${c}`}>{t}</span>)}</div>}
      {d.error && <div className="muted tiny myah-note">Hypixel не ответил, показаны лоты на {ago(d.at)}.</div>}
      {d.listings.length ? (
        <ul className="myah-list">
          {d.listings.map(l => <Row key={l.id} id={l.key} name={l.count > 1 ? `${l.count}× ${l.name}` : l.name} tier={l.tier} state={lotState(l, now)} price={coins(l.status === 'sold' ? l.coins : l.price)} openItem={openItem} />)}
        </ul>
      ) : <Empty>На Auction House нет лотов.</Empty>}
      {d.bids.length > 0 && <>
        <h4 className="sub-h">Ставки</h4>
        <ul className="myah-list">
          {d.bids.map(b => <Row key={b.id} id={b.key} name={b.name} tier={b.tier} price={coins(b.top)} openItem={openItem}
            state={b.status === 'outbid' ? { cls: 'warn', text: `Перебили · твоя ${coins(b.mine)}`, end: left(b.end, now) } : { cls: 'ok', text: 'Твоя ставка выше всех', end: left(b.end, now) }} />)}
        </ul>
      </>}
      <p className="muted tiny myah-note"><Rich text={`Лоты обновляются раз в 3 минуты, последний раз ${ago(d.at)}. Ордера Bazaar Hypixel не показывает: их увидит только мод в игре.`} /></p>
    </div>
  );
}
