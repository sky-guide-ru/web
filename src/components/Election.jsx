// Выборы мэра: /v1/election (голоса, шанс победы, ближайшие мэры, история выборов), одна загрузка на все блоки, раз в минуту.
//   ElectionCard    — блок «Выборы» на странице «События»
//   NextMayorsCard  — лента «Ближайшие мэры» и как часто мэры побеждают
//   ElectionLine    — строка на главной, пока идут выборы
//   ElectionPopup   — всплывашка в углу окошка новостей: выборы начались, итоги через 3 ч, новый мэр
//   GuideMayorLine  — строка в гайде по теме мэра
import { useEffect, useState } from 'react';
import { EN, LOCALE } from '../i18n.js';
import { Card, Empty } from './ui.jsx';
import { ItemIcon } from './ItemIcon.jsx';
import { useNow, left } from '../pages/Events.jsx';
import { useNewsPopup } from '../news.js';
import { updateInfo } from '../update.js';

const URL = `/v1/election${EN ? '?lang=en' : ''}`;
let shared = { data: null, at: 0, pending: null };
const subs = new Set();

function load() {
  if (shared.pending) return shared.pending;
  shared.pending = fetch(URL).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => {
    shared = { data: d || shared.data, at: Date.now(), pending: null };
    subs.forEach(f => f(shared.data));
    return d;
  });
  return shared.pending;
}

/** Данные выборов; null — ещё грузятся или сервер их не отдаёт. */
export function useElection() {
  const [data, setData] = useState(shared.data);
  useEffect(() => {
    subs.add(setData);
    if (Date.now() - shared.at > 55_000) load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60_000);
    return () => { subs.delete(setData); clearInterval(t); };
  }, []);
  return data;
}

const when = t => new Date(t).toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = t => new Date(t).toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const num = n => Number(n).toLocaleString(LOCALE);
const pct = n => `${Number(n).toLocaleString(LOCALE)}%`;
const perkName = p => p.title || p.name;
const YEAR_MS = 124 * 3600_000; // год SkyBlock = срок мэра

function Trend({ t }) {
  if (t == null || Math.abs(t) < 0.1) return null;
  return <span className={t > 0 ? 'green' : 'red'}> · {t > 0 ? '+' : '−'}{pct(Math.abs(t))} за 3 ч</span>;
}

/** Блок «Выборы» (fallback — старые данные календаря, если /v1/election недоступен). */
export function ElectionCard({ cal, now }) {
  const el = useElection();
  const e = el || cal.election;
  const open = el ? el.open : e.open && e.candidates;
  const cands = el ? el.candidates : e.candidates;
  return (
    <Card title="Выборы" className="span-6 ev-fit" news="election"
      right={<span className="muted small" title={when(open ? e.closes : e.opens)}>{open ? `итоги через ${left(e.closes - now)} · ${when(e.closes)}` : `откроются через ${left(e.opens - now)}`}</span>}>
      {open && cands ? (
        <>
          <div className="ev-cands">
            {cands.map((c, i) => (
              <div key={c.name} className="ev-cand" style={{ '--ev': c.color }}>
                {c.icon && <ItemIcon id={c.icon} size={28} />}
                <div className="grow">
                  <div className="ev-cand-top">
                    <b>{c.name}</b>{c.isNew && <span className="el-new">новый</span>}{c.role && <span className="muted small">{c.role}</span>}
                    {c.chanceText && <span className={`el-chance ${i === 0 && c.chance >= 0.6 ? 'hi' : ''}`} title="Примерный шанс победы: по отрыву, тренду и времени до итогов">{i === 0 ? `шанс ${c.chanceText}` : c.chanceText}</span>}
                    <span className="ev-cand-pct">{c.pct != null ? pct(c.pct) : '—'}</span>
                  </div>
                  <div className="ev-bar"><i style={{ width: `${c.pct || 0}%` }} /></div>
                  <div className="muted tiny">
                    {c.votes != null && <span className="el-votes">{num(c.votes)} {i === 0 ? 'голосов' : ''}</span>}
                    <Trend t={c.trend} />
                    {' · '}{c.perks.map(perkName).join(' · ')}
                    {i === 1 ? ' — станет министром' : ''}
                  </div>
                  {c.why && <div className="tiny el-why">{c.why}</div>}
                  {c.strong && c.isNew && <div className="tiny el-why">Сильные перки обычно поднимают голоса.</div>}
                  {c.ifWin && i < 2 && <div className="el-ifwin">Если победит: {c.ifWin}, {day(e.closes)} – {day(e.closes + YEAR_MS)}.</div>}
                </div>
              </div>
            ))}
          </div>
          <p className="muted small">Голосуют у Election Booth в Hub. Голоса — как в таблице у будки, обновляются раз в 5 минут. Шанс — по отрыву, тренду за последние часы и времени до итогов; второй станет министром с одним перком.</p>
        </>
      ) : (
        <p className="small">Голосование откроется {when(e.opens)} (27 число позднего лета) и продлится до 27 числа поздней весны: примерно 4 дня реального времени. Здесь появятся кандидаты, голоса и шансы.</p>
      )}
    </Card>
  );
}

function Dot({ c }) { return c?.icon ? <ItemIcon id={c.icon} size={28} /> : <span className="el-dot" style={{ background: c?.color || '#9aa4b2' }} />; }

/** Лента «Ближайшие мэры». */
export function NextMayorsCard({ now }) {
  const el = useElection();
  if (!el) return null;
  const rows = el.timeline || [];
  const mayor = el.mayor;
  const nf = mayor ? el.nextFor?.[mayor.key] : null;
  return (
    <Card title="Ближайшие мэры" className="span-6 ev-fit" news="mayors">
      {rows.length ? (
        <ul className="el-tl">
          {rows.map((r, i) => (
            <li key={i} style={{ '--ev': r.color || (r.kind === 'special' ? '#ff6bcb' : '#9aa4b2') }}>
              {r.kind === 'now' || r.kind === 'next' ? <Dot c={r} /> : <span className="el-dot" />}
              <div className="grow">
                {r.kind === 'now' && <><b>{r.name}</b> <span className="muted small">сейчас{r.role ? ` · ${r.role}` : ''}</span></>}
                {r.kind === 'next' && <><b>{r.name}</b> <span className="muted small">скорее всего ({r.chanceText}){r.alt ? `, иначе ${r.alt}` : ''}</span>
                  {r.minister && <div className="muted tiny">министр — вероятно {r.minister}</div>}</>}
                {r.kind === 'election' && <><b>{i === 0 ? 'Выборы' : 'Следующие выборы'}</b> <span className="muted small">кандидаты появятся при открытии</span>
                  {r.skip && <div className="muted tiny">{r.skip} в них не будет: действующий мэр не выдвигается</div>}</>}
                {r.kind === 'special' && <><b>Особый мэр</b> <span className="muted small">{r.likely ? `скорее всего ${r.likely} (идут по кругу: ${r.names.join(', ')})` : r.names.join(', ')}{r.every ? ` — раз в ${r.every} лет SkyBlock` : ''}</span></>}
              </div>
              <div className="el-when">
                {r.kind === 'now' && <><b>до {when(r.until)}</b><div className="muted">ещё {left(r.until - now)}</div></>}
                {r.kind === 'next' && <><b>{day(r.start)} – {day(r.until)}</b><div className="muted">через {left(r.start - now)}</div></>}
                {r.kind === 'election' && <><b>{when(r.start)}</b><div className="muted">голосование до {day(r.until)}</div></>}
                {r.kind === 'special' && <><b>≈ {day(r.start)}</b><div className="muted">через {left(r.start - now)}</div></>}
              </div>
            </li>
          ))}
        </ul>
      ) : <Empty>Данные выборов ещё не загрузились.</Empty>}
      {el.odds?.length > 0 && (
        <>
          <div className="muted small el-odds-title">Как часто побеждают, когда выдвигаются (последние {Math.min(60, el.history?.elections || 0)} выборов)</div>
          <div className="el-odds">
            {el.odds.map(o => (
              <div key={o.key} className="el-odds-row" style={{ '--ev': o.color }} title={`${o.wins} побед из ${o.runs}`}>
                <span>{o.name}</span><div className="ev-bar"><i style={{ width: `${o.rate}%` }} /></div><b>{o.rate}%</b>
              </div>
            ))}
          </div>
        </>
      )}
      {mayor && nf?.next && <p className="muted small">{mayor.name} снова — не раньше выборов {when(nf.next)}: на выборах своего срока мэр не выдвигается.</p>}
    </Card>
  );
}

/** Строка на главной, пока идут выборы. */
export function ElectionLine({ className = '' }) {
  const el = useElection();
  const now = useNow(30_000);
  if (!el?.open || !el.candidates?.length || el.closes <= now) return null;
  const [a, b] = el.candidates;
  return (
    <a href="#/events" className={`card el-line ${className}`} data-news="election-line">
      <span aria-hidden="true">🗳️</span>
      <span className="grow"><b>Выборы:</b> лидирует {a.name}, {pct(Math.round(a.pct))} (шанс {a.chanceText}){b ? ` · ${b.name} ${pct(Math.round(b.pct))}` : ''} · итоги через {left(el.closes - now)}</span>
      <span className="link small">Все кандидаты →</span>
    </a>
  );
}

// ---------- всплывашка ----------
const SEEN = 'sb-election-pop';
const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; } };
const markSeen = k => { try { localStorage.setItem(SEEN, JSON.stringify([...seen().slice(-20), k])); } catch { /* приватный режим */ } };

/** Что показать: итог выборов (6 ч после смены мэра), итоги через 3 ч, начались выборы. Каждое — один раз. */
export function popupOf(el, now = Date.now(), done = seen()) {
  if (!el) return null;
  const s = new Set(done);
  if (el.lastResult && el.mayor && now - el.lastResult.start < 6 * 3600_000) {
    const k = `result-${el.lastResult.year}`;
    if (!s.has(k)) return { key: k, kind: 'result' };
  }
  if (el.open && el.candidates?.length && el.closes > now) {
    const left3 = el.closes - now < 3 * 3600_000;
    const k = `${left3 ? 'final' : 'open'}-${el.year}`;
    if (!s.has(k) && !(left3 === false && s.has(`final-${el.year}`))) return { key: k, kind: left3 ? 'final' : 'open' };
  }
  return null;
}

export function ElectionPopup() {
  const el = useElection();
  const news = useNewsPopup();
  const now = useNow(60_000);
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 4000); return () => clearTimeout(t); }, []);
  const upd = updateInfo();
  const p = popupOf(el, now);
  // одна карточка в углу: новости и «Сайт обновился» важнее, выборы ждут
  if (!ready || !p || news || (upd.pending && !upd.dismissed)) return null;
  const close = () => { markSeen(p.key); bump(x => x + 1); };
  const go = () => { close(); location.hash = '#/events'; };
  const [a, b] = el.candidates || [];
  let head, title, body, btn = 'Открыть выборы';
  if (p.kind === 'result') {
    head = '🏛️ Новый мэр'; title = `${el.mayor.name} стал мэром${el.minister ? `, министр ${el.minister.name}` : ''}`;
    body = <p className="news-pop-text">{el.mayor.tip || el.mayor.role || ''} Срок — до {when(el.termEnd)}.</p>; btn = 'Что даёт мэр';
  } else if (p.kind === 'final') {
    head = `⏳ Выборы: итоги через ${left(el.closes - now)}`;
    title = a.chance >= 0.9 ? `${a.name} почти наверняка победит` : `Лидирует ${a.name}, но исход не решён`;
    body = <p className="news-pop-text">{a.name} {pct(Math.round(a.pct))}{b ? `, ${b.name} ${pct(Math.round(b.pct))}. Министром, скорее всего, станет ${b.name}.` : '.'}{a.ifWin ? ` ${a.name}: ${a.ifWin}.` : ''}</p>;
  } else {
    head = '🗳️ Идут выборы мэра'; title = `Лидирует ${a.name}, ${pct(Math.round(a.pct))} · шанс ${a.chanceText}`; btn = 'Все кандидаты';
    const fresh = el.candidates.find(c => c.isNew);
    const chaser = el.candidates.slice(1).find(c => (c.trend || 0) >= 1.5);
    body = (
      <>
        <div className="el-pop-rows">
          {el.candidates.slice(0, 3).map(c => (
            <div key={c.name} className="el-odds-row" style={{ '--ev': c.color }}>
              <span>{c.name}{c.isNew && <span className="el-new">новый</span>}</span><div className="ev-bar"><i style={{ width: `${c.pct}%` }} /></div><b>{pct(Math.round(c.pct))}</b>
            </div>
          ))}
        </div>
        <p className="news-pop-text muted small">Итоги через {left(el.closes - now)} ({when(el.closes)}).{fresh ? ` Новый кандидат: ${fresh.name}.` : ''}{chaser ? ` ${chaser.name} догоняет: +${pct(chaser.trend)} за 3 ч.` : ''}</p>
      </>
    );
  }
  return (
    <aside className="news-pop el-pop" role="status" aria-label="Выборы мэра">
      <button type="button" className="x-btn news-pop-x" onClick={close} aria-label="Закрыть" title="Закрыть">×</button>
      <div className="news-pop-head">{head}</div>
      <div className="news-pop-title"><b>{title}</b></div>
      {body}
      <div className="news-pop-btns">
        <button type="button" className="btn small" onClick={go}>{btn}</button>
        <button type="button" className="btn ghost small" onClick={close}>Позже</button>
      </div>
    </aside>
  );
}

/** Строка в гайде: мэр этой темы сейчас, на выборах или когда будет. */
export function GuideMayorLine({ id }) {
  const el = useElection();
  const now = useNow(60_000);
  const key = el?.guideMayor?.[id];
  if (!key) return null;
  const n = el.nextFor?.[key];
  if (!n) return null;
  const name = key[0].toUpperCase() + key.slice(1);
  let text;
  if (n.state === 'mayor') text = `${name} — мэр сейчас, ещё ${left(n.until - now)}.`;
  else if (n.state === 'running') text = `${name} на выборах: ${pct(n.pct)} (шанс ${n.chanceText}). Если победит — с ${when(n.start)}.`;
  else if (el.minister?.key === key) text = `${name} сейчас министр. На ближайших выборах его нет.`;
  else text = `${name} в ближайших выборах нет${n.next ? `, следующий шанс — выборы с ${when(n.next)}` : ''}${n.rate != null ? ` (побеждает в ${n.rate}% выборов, где выдвигается)` : ''}.`;
  return <div className="card el-guide small"><b>Мэр для этой темы:</b> {text} <a className="link" href="#/events">Выборы →</a></div>;
}
