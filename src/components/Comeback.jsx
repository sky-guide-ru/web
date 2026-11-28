// Блоки «Обзора»: «С возвращением» (перерыв в игре 30+ дней) и «Дела на сегодня» (отметки по профилю).
import { useEffect, useState } from 'react';
import { Card } from './ui.jsx';
import { Rich } from '../guides/Rich.jsx';
import { MiningEventRow } from '../guides/MiningEvents.jsx';
import { api, useProfileStore } from '../api.js';
import { LOCALE } from '../i18n.js';
import { openNewsLink } from '../newsLinks.jsx';

// Без года, если он текущий: «18 сентября»; иначе «18 сентября 2025»
const dateOf = t => { const d = new Date(t); return d.toLocaleDateString(LOCALE, d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ г\.$/, ''); };
const timeOf = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

// Патчноуты SkyBlock (форум Hypixel), вышедшие после начала перерыва. Дата в ленте — текстом («17th November 2026»):
// Date.parse такое не понимает, разбираем сами
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseNewsDate(s) {
  const m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[A-Za-z]*\.?,?\s+(\d{4})/.exec(String(s || ''));
  const mo = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return mo >= 0 ? Date.UTC(Number(m[3]), mo, Number(m[1])) : Date.parse(s);
}
function usePatchesSince(since) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!since) return;
    let off = false;
    api('/news').then(d => {
      if (off) return;
      const all = d?.skyblock || [];
      const dated = all.map(n => ({ ...n, t: parseNewsDate(n.date) })).filter(n => Number.isFinite(n.t));
      setList(dated.length ? dated.filter(n => n.t >= since - 86400_000).slice(0, 5) : all.slice(0, 4));
    }).catch(() => !off && setList([]));
    return () => { off = true; };
  }, [since]);
  return list;
}

export function Returning({ info, steps }) {
  const [closed, setClosed] = useProfileStore('sb-returning-closed', 0);
  const patches = usePatchesSince(info?.since);
  if (!info || closed === info.since) return null;
  const top = (steps || []).slice(0, 3);
  return (
    <Card className="span-12 comeback" news="returning" title={<Rich text={info.title} />}
      right={<button className="x-btn" title="Скрыть до следующего перерыва" aria-label="Скрыть" onClick={() => setClosed(info.since)}>✕</button>}>
      <p className="muted small">
        {info.state === 'away'
          ? <Rich text={`Последняя активность в профиле: ${dateOf(info.since)}. Ниже то, что изменилось и с чего начать.`} />
          : <Rich text={`Перерыв с ${dateOf(info.since)} по ${dateOf(info.backAt)}. Ниже то, что изменилось и с чего начать.`} />}
      </p>
      <div className="comeback-cols">
        <div>
          <h4>С чего начать</h4>
          {top.length ? <ol className="comeback-list">{top.map(s => <li key={s.id}><a className="link" href={`#/roadmap/${encodeURIComponent(s.id)}`}><Rich text={s.title} /></a> <span className="muted tiny">{s.cat}</span></li>)}</ol>
            : <div className="muted small">План пуст: всё основное уже сделано.</div>}
        </div>
        {info.fresh?.length > 0 && (
          <div>
            <h4>Чего ещё нет в профиле</h4>
            <ul className="comeback-list">{info.fresh.map(f => <li key={f.id}><a className="link" href={f.href}><Rich text={f.title} /></a> <span className="muted small"><Rich text={f.text} /></span></li>)}</ul>
          </div>
        )}
        <div>
          <h4>Патчноуты за перерыв</h4>
          {patches == null ? <div className="muted small"><div className="spinner" /></div>
            : patches.length ? <ul className="comeback-list">{patches.map(n => <li key={n.link}><a className="link" href={n.link} target="_blank" rel="noopener noreferrer nofollow">{n.title}</a> <span className="muted tiny">{Number.isFinite(n.t) ? dateOf(n.t) : n.date}</span></li>)}</ul>
              : <div className="muted small">Свежих патчноутов не нашлось. Все — в разделе <a className="link" href="#/news">Новости</a>.</div>}
        </div>
      </div>
    </Card>
  );
}

// Fetchur и Puzzler API не видит: отметку ставит игрок. «day» — до сброса дня, «24h» — сутки после отметки (Puzzler)
const DAY = 86400_000;
function manualState(i, marks, d, now) {
  const t = marks[i.id] || 0;
  if (i.manual === 'day') return { done: t >= d.reset && t < d.next, ready: null };
  const ready = t + DAY;
  return ready > now ? { done: true, ready } : { done: false, ready: null };
}

export function Dailies({ d }) {
  const [marks, setMarks] = useProfileStore('sb-daily-marks', {});
  if (!d?.items?.length) return d?.mining ? <MiningEventRow card /> : null;
  const now = Date.now();
  const items = d.items.map(i => (i.manual ? { ...i, ...manualState(i, marks || {}, d, now) } : i));
  const done = items.filter(i => i.done).length;
  const toggle = i => {
    setMarks({ ...(marks || {}), [i.id]: i.done ? 0 : Date.now() });
  };
  return (
    <Card className="span-12 dailies" news="dailies" title="Дела на сегодня"
      right={<span className="muted small">{done}/{items.length} · новый день в {timeOf(d.next)}</span>}>
      <div className="daily-row">
        {items.map(i => {
          const body = (
            <span className="daily-body">
              <b>{i.title}{i.progress ? <span className="muted"> {i.progress[0]}/{i.progress[1]}</span> : null}</b>
              <span className="muted tiny"><Rich text={i.ready && i.done ? `${i.text} Снова в ${timeOf(i.ready)}.` : i.text} /></span>
            </span>
          );
          // Ручную отметку нельзя класть внутрь ссылки: плитка — блок с кнопкой, ссылка — на названии
          if (i.manual) return (
            <div key={i.id} className={`daily manual ${i.done ? 'done' : ''}`}>
              <button type="button" className="daily-check" aria-pressed={i.done} title={i.done ? 'Снять отметку' : 'Отметить: сделано'} aria-label={`${i.title}: ${i.done ? 'снять отметку' : 'отметить, что сделано'}`} onClick={() => toggle(i)}>{i.done ? '✓' : ''}</button>
              <a className="daily-link" href={i.href || '#/guides'} onClick={i.anchor ? e => { e.preventDefault(); openNewsLink(i.href.replace(/^#\//, ''), i.anchor); } : undefined}>{body}</a>
            </div>
          );
          return (
            <a key={i.id} href={i.href || '#/guides'} className={`daily ${i.done ? 'done' : ''}`}>
              <span className="daily-check" aria-hidden>{i.done ? '✓' : ''}</span>
              {body}
            </a>
          );
        })}
      </div>
      {d.mining && <MiningEventRow />}
      <div className="muted tiny daily-note">{items.some(i => i.manual)
        ? 'Отметки ставятся сами по данным профиля, он обновляется раз в несколько минут. Fetchur и Puzzler игра не показывает: отметьте их сами, нажав на квадрат.'
        : 'Отметки ставятся сами по данным профиля, он обновляется раз в несколько минут.'}</div>
    </Card>
  );
}
