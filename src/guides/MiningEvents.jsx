// Ивенты майнинга сейчас: /v1/mining-events (сводка трекера Soopy по лобби), раз в минуту.
// Живой блок в гайде Mining и строка в «Делах на сегодня».
import { useEffect, useState } from 'react';
import { EN } from '../i18n.js';
import { Rich } from './Rich.jsx';
import { Card } from '../components/ui.jsx';
import { useNow, left } from '../pages/Events.jsx';

const URL = `/v1/mining-events${EN ? '?lang=en' : ''}`;
let shared = { data: null, at: 0, pending: null };
const subs = new Set();

async function load() {
  if (shared.pending) return shared.pending;
  shared.pending = fetch(URL).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => {
    shared = { data: d, at: Date.now(), pending: null };
    subs.forEach(f => f(d));
    return d;
  });
  return shared.pending;
}

/** Сводка ивентов; одна загрузка на все блоки страницы, обновление раз в минуту, пока вкладка открыта. */
export function useMiningEvents() {
  const [data, setData] = useState(shared.data);
  useEffect(() => {
    subs.add(setData);
    if (Date.now() - shared.at > 55_000) load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    return () => { subs.delete(setData); clearInterval(t); };
  }, []);
  return data;
}

/** Самый полезный идущий ивент: 2x Powder первым, дальше — где больше лобби. */
export function headline(d) {
  const now = Date.now();
  const all = (d?.islands || []).flatMap(i => (i.now || []).filter(e => e.ends > now).map(e => ({ ...e, island: i.name })));
  all.sort((a, b) => (b.hot - a.hot) || (b.lobbies - a.lobbies));
  return all[0] || null;
}

function Island({ isl, now }) {
  const running = (isl.now || []).filter(e => e.ends > now);
  const soon = (isl.soon || []).filter(e => e.from > now).slice(0, 1);
  return (
    <div className="me-isl">
      <h4>{isl.name}</h4>
      {running.map(e => (
        <div key={e.id} className="me-ev-wrap">
          <div className="me-now">
            <span className={`me-ev ${e.hot ? 'hot' : ''}`}>{e.name}</span>
            <span className="muted small me-left">ещё {left(e.ends - now)} · {isl.lobbies ? `${e.lobbies} из ${isl.lobbies} лобби` : `${e.lobbies} лобби`}</span>
          </div>
          {e.tip && <div className="muted tiny"><Rich text={e.tip} /></div>}
        </div>
      ))}
      {soon.map(e => <div key={e.id} className="muted small">Скоро: <b>{e.name}</b>, через {left(e.from - now)}</div>)}
      {!running.length && !soon.length && <div className="muted small">{isl.lobbies ? 'Ивентов нет.' : 'Нет данных: в лобби сейчас нет игроков с модами.'}</div>}
    </div>
  );
}

/** Секция гайда kind: 'miningEvents' */
export function MiningEventsLive() {
  const d = useMiningEvents();
  const now = useNow(15_000);
  if (!d) return <div className="muted small">Загрузка…</div>;
  if (!d.islands?.length) return <div className="muted small">Трекер ивентов сейчас не отвечает. Что идёт в лобби, видно в игре: таблица справа на экране.</div>;
  return (
    <>
      <div className="me-grid">{d.islands.map(isl => <Island key={isl.id} isl={isl} now={now} />)}</div>
      <div className="muted tiny me-foot">Данные: трекер Soopy · обновлено {left(now - d.at)} назад</div>
    </>
  );
}

/** Строка в «Делах на сегодня»: что идёт сейчас (только у тех, кто уже копает в Dwarven Mines). */
export function MiningEventRow({ card = false }) {
  const d = useMiningEvents();
  const now = useNow(15_000);
  const e = headline(d);
  if (!e) return null;
  // Других дел на сегодня нет — строка одна, в своей карточке
  if (card) return <Card className="span-12 dailies" news="dailies" title="Дела на сегодня"><MiningEventRow /></Card>;
  return (
    <a className={`me-row ${e.hot ? 'hot' : ''}`} href="#/guides/mining">
      <span className="badge warn">⛏ сейчас</span>
      <b>{e.name}</b>
      <span className="muted small">{e.island} · ещё {left(e.ends - now)}{e.tip ? ' · ' : ''}{e.tip && <Rich text={e.tip} />}</span>
      <span className="link small me-row-more">Ивенты майнинга →</span>
    </a>
  );
}
