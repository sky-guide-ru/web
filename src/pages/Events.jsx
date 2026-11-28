import { LOCALE } from '../i18n.js';
// Страница «События»: мэр и министр с перками, выборы, что идёт сейчас и что скоро, весь год SkyBlock сеткой.
// Данные — /api/calendar (общие для всех, не зависят от профиля). Время показываем в часовом поясе браузера.
import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApi } from '../api.js';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import { ElectionCard, NextMayorsCard } from '../components/Election.jsx';

/** Текущее время, тикает раз в секунду (для обратного отсчёта). */
export function useNow(step = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), step); return () => clearInterval(t); }, [step]);
  return now;
}

/** «через 12 мин», «2 ч 5 мин», «1 д 4 ч»; секунды — только в последнюю минуту («7:35» читалось как время на часах). */
export function left(ms) {
  if (ms <= 0) return 'сейчас';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return `${d} д ${h % 24} ч`;
  if (h) return `${h} ч ${m % 60} мин`;
  if (m) return `${m} мин`;
  return `${s} с`;
}

const when = t => new Date(t).toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const hm = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// Перк: русское название и описание. Английское имя из игры — только во всплывающей подсказке
const perkName = p => p.title || p.name;
function Perk({ p }) {
  return (
    <li className="ev-perk" title={p.title ? `В игре: ${p.name}` : undefined}>
      <b>{perkName(p)}</b>
      <span className={p.ru ? '' : 'muted'}>{p.ru || 'Новый перк: описания на русском пока нет, оно появится после обновления сайта.'}</span>
    </li>
  );
}

function MayorCard({ cal, now }) {
  const m = cal.mayor, mi = cal.minister;
  if (!m) return <Card title="Мэр" className="span-6"><Empty>Данные выборов ещё не загрузились: сервер обновляет их раз в 20 минут.</Empty></Card>;
  return (
    <Card title="Мэр сейчас" className="span-6 ev-mayor ev-fit" style={{ '--ev': m.color }}
      right={<span className="muted small" title={when(cal.termEnd)}>сменится через {left(cal.termEnd - now)}</span>}>
      <div className="ev-mayor-head">
        {m.icon && <ItemIcon id={m.icon} size={48} />}
        <div>
          <div className="ev-mayor-name">{m.name}{m.role && <Badge color={m.color}>{m.role}</Badge>}</div>
          {m.tip && <div className="small">{m.tip}</div>}
        </div>
      </div>
      <ul className="ev-perks">{m.perks.map(p => <Perk key={p.name} p={p} />)}</ul>
      {cal.money?.length > 0 && (
        <RefsProvider refs={cal.moneyRefs}>
          <div className="ev-money">
            <div className="muted small">Что это значит для заработка</div>
            <ul className="ev-perks">{cal.money.map(h => (
              <li key={h.perk} className="ev-perk"><b>{h.title}</b><span><Rich text={h.note} />{h.pct ? <span className={h.pct > 0 ? 'green' : 'red'}> (доход {h.pct > 0 ? '+' : ''}{h.pct}%)</span> : null}</span></li>
            ))}</ul>
            <a className="link-btn small" href="#/money">Открыть «Заработок»: множители уже учтены →</a>
          </div>
        </RefsProvider>
      )}
      {mi && (
        <div className="ev-minister">
          <div className="muted small">Министр (второе место на выборах, один перк)</div>
          <div className="ev-mayor-head">
            {mi.icon && <ItemIcon id={mi.icon} size={32} />}
            <div className="grow"><b>{mi.name}</b>{mi.role && <span className="muted small"> · {mi.role}</span>}
              {mi.perk && <ul className="ev-perks"><Perk p={mi.perk} /></ul>}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function EventRow({ e, now, active }) {
  const [open, setOpen] = useState(false);
  const dur = e.end - e.start;
  return (
    <li className={`ev-row ${active ? 'is-active' : ''}`} style={{ '--ev': e.color }}>
      <button className="ev-row-main" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {e.icon && <ItemIcon id={e.icon} size={32} />}
        <span className="grow">
          <b>{e.name}</b>
          <small className="muted">{e.what}</small>
        </span>
        <span className="ev-when">
          <b>{active ? `ещё ${left(e.end - now)}` : `через ${left(e.start - now)}`}</b>
          <small className="muted">{active ? `до ${sameDay(e.end, now) ? hm(e.end) : when(e.end)}` : `${sameDay(e.start, now) ? hm(e.start) : when(e.start)}${dur < 3600_000 ? `, ${Math.round(dur / 60000)} мин` : ''}`}</small>
        </span>
      </button>
      {open && (
        <div className="ev-tip small">
          <span className="ev-tip-what">{e.what} </span>{e.tip}{e.approx ? ' Точные дни этого ивента API не отдаёт.' : ''}
          {e.guide && <> <a className="link" href={`#/guides/${e.guide}`}>Гайд →</a></>}
        </div>
      )}
    </li>
  );
}

const DAY_MS = 1200_000; // день SkyBlock = 20 минут

function YearGrid({ grid, now, onYear, baseYear }) {
  const [pick, setPick] = useState(null);
  // день → события (для заливки клеток)
  const byDay = useMemo(() => {
    const map = new Map();
    for (const b of grid.bars) for (const [m, d0, d1] of b.spans) for (let d = d0; d <= d1; d++) {
      const k = m * 32 + d;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(b);
    }
    return map;
  }, [grid]);
  const legend = useMemo(() => {
    const seen = new Map();
    for (const b of grid.bars) if (!seen.has(b.name)) seen.set(b.name, b);
    return [...seen.values()];
  }, [grid]);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const tc = grid.termChange;
  const sel = pick || grid.today;
  const selList = sel ? byDay.get(sel.m * 32 + sel.d) || [] : [];
  const selTerm = sel && tc && tc[0] === sel.m && tc[1] === sel.d;
  return (
    <Card title={`Весь год SkyBlock (${grid.year})`} className="span-12 ev-year"
      right={
        <div className="ev-year-nav">
          <button className="chip" disabled={grid.year <= baseYear} onClick={() => { setPick(null); onYear(grid.year - 1); }} aria-label="Предыдущий год">◀</button>
          <span className="muted small">{grid.year === baseYear ? 'этот год' : 'следующий'}</span>
          <button className="chip" disabled={grid.year >= baseYear + 1} onClick={() => { setPick(null); onYear(grid.year + 1); }} aria-label="Следующий год">▶</button>
        </div>
      }>
      <p className="muted small">Строка — месяц, клетка — день. День SkyBlock длится 20 минут, весь год проходит за 5 суток. Нажми на день, чтобы увидеть, что в нём.</p>
      <div className="ev-grid-wrap">
        <div className="ev-grid">
          <div className="ev-grid-head"><span />{days.map(d => <span key={d}>{d % 5 === 0 || d === 1 ? d : ''}</span>)}</div>
          {grid.months.map(mo => (
            <div key={mo.i} className="ev-grid-row">
              <span className="ev-mon" title={`Начало: ${when(mo.start)}`}>{mo.ru}</span>
              {days.map(d => {
                const list = byDay.get(mo.i * 32 + d) || [];
                const isToday = grid.today && grid.today.m === mo.i && grid.today.d === d;
                const isSel = pick && pick.m === mo.i && pick.d === d;
                const isTerm = tc && tc[0] === mo.i && tc[1] === d;
                const past = mo.start + d * DAY_MS < now;
                return (
                  <button key={d} className={`ev-day ${isToday ? 'is-today' : ''} ${isSel ? 'is-sel' : ''} ${isTerm ? 'is-term' : ''} ${past ? 'is-past' : ''}`}
                    onClick={() => setPick({ m: mo.i, d })} aria-label={`${d}, ${mo.ru}`}
                    style={list.length ? { background: list.length > 1 ? `linear-gradient(${list.map((b, i) => `${b.color} ${i / list.length * 100}% ${(i + 1) / list.length * 100}%`).join(', ')})` : list[0].color } : undefined} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="ev-day-info small">
        {sel && (
          <><b>{sel.d} число, {grid.months[sel.m].ru.toLowerCase()}</b>{grid.today && sel === grid.today ? ' (сегодня)' : ''} <span className="muted">— {when(grid.months[sel.m].start + (sel.d - 1) * DAY_MS)}</span>: {[...selList.map(b => b.name), ...(selTerm ? ['смена мэра'] : [])].join(', ') || 'особых событий нет'}</>
        )}
      </div>
      <div className="ev-legend">
        {legend.map(b => <span key={b.name} title={b.what}><i style={{ background: b.color }} />{b.name}</span>)}
        {tc && <span><i className="ev-legend-term" />смена мэра</span>}
        <span><i className="ev-legend-today" />сегодня</span>
      </div>
      {grid.wholeTerm?.length > 0 && (
        <p className="small ev-whole">Весь срок нынешнего мэра, до {when(grid.wholeTerm[0].until)}: {grid.wholeTerm.map((w, i) => <span key={w.id}>{i ? ', ' : ''}<b style={{ color: w.color }}>{w.name}</b>{w.guide && <> (<a className="link" href={`#/guides/${w.guide}`}>гайд</a>)</>}</span>)}.</p>
      )}
      <p className="muted tiny">Каждый час: конкурс фермеров Jacob в :15 и Тёмный аукцион в :55. События нового мэра станут известны после выборов.</p>
    </Card>
  );
}

export default function Events() {
  const now = useNow(1000);
  const minute = Math.floor(now / 60_000);
  const [year, setYear] = useState(null);
  const { data: cal, error } = useApi(`/calendar${year ? `?year=${year}` : ''}`, [minute], { keep: true });
  if (error && !cal) return <Empty>Календарь не загрузился: {error}</Empty>;
  if (!cal) return <div className="muted small"><div className="spinner" />Считаю календарь…</div>;
  const active = cal.active.filter(e => e.end > now);
  const upcoming = cal.upcoming.filter(e => e.end > now);
  return (
    <div className="grid">
      <div className="span-12 ev-now muted small">
        Сейчас в SkyBlock: <b>{cal.sb.day} число, {cal.sb.monthRu.toLowerCase()}</b>, {String(cal.sb.hour).padStart(2, '0')}:{String(cal.sb.minute).padStart(2, '0')}, год {cal.sb.year}
      </div>
      <MayorCard cal={cal} now={now} />
      <ElectionCard cal={cal} now={now} />
      <NextMayorsCard now={now} />
      <Card title="Идёт сейчас" className="span-6 ev-fit">
        {active.length ? <ul className="ev-list">{active.map(e => <EventRow key={e.id + e.start} e={e} now={now} active />)}</ul>
          : <Empty>Сейчас ничего не идёт. Ближайшее — справа.</Empty>}
      </Card>
      <Card title="Скоро" className="span-6 ev-fit">
        <ul className="ev-list">{upcoming.map(e => <EventRow key={e.id + e.start} e={e} now={now} />)}</ul>
      </Card>
      <YearGrid grid={cal.grid} now={now} baseYear={cal.sb.year} onYear={y => setYear(y === cal.sb.year ? null : y)} />
    </div>
  );
}

/** Полоска «Сейчас в игре» для «Обзора»: мэр, что идёт, что ближайшее. */
export function EventsStrip({ className = '' }) {
  const now = useNow(30_000);
  const { data: cal } = useApi('/calendar', [Math.floor(now / 300_000)], { keep: true });
  if (!cal) return null;
  const active = cal.active.filter(e => e.end > now && e.tier === 'big');
  const next = cal.upcoming.filter(e => e.start > now).slice(0, 2);
  return (
    <a href="#/events" className={`card ev-strip ${className}`} title="Мэр, выборы и календарь событий">
      {cal.mayor && <span className="ev-strip-item" style={{ '--ev': cal.mayor.color }}>{cal.mayor.icon && <ItemIcon id={cal.mayor.icon} size={22} />}<span>Мэр <b>{cal.mayor.name}</b>{cal.minister ? <span className="muted">, министр {cal.minister.name}</span> : null}</span></span>}
      {active.map(e => <span key={e.id} className="ev-strip-item is-active" style={{ '--ev': e.color }}><i />{e.name} <span className="muted">ещё {left(e.end - now)}</span></span>)}
      {next.map(e => <span key={e.id} className="ev-strip-item" style={{ '--ev': e.color }}><i />{e.name} <span className="muted">через {left(e.start - now)}</span></span>)}
      <span className="link ev-strip-more">календарь →</span>
    </a>
  );
}
