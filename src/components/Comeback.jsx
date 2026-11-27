// Блоки «Обзора»: «С возвращением» (перерыв в игре 30+ дней) и «Дела на сегодня» (отметки по профилю).
import { useEffect, useState } from 'react';
import { Card } from './ui.jsx';
import { Rich } from '../guides/Rich.jsx';
import { api, useProfileStore } from '../api.js';
import { LOCALE } from '../i18n.js';

// Без года, если он текущий: «18 сентября»; иначе «18 сентября 2025»
const dateOf = t => { const d = new Date(t); return d.toLocaleDateString(LOCALE, d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ г\.$/, ''); };
const timeOf = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

// Патчноуты SkyBlock (форум Hypixel), вышедшие после начала перерыва. Дата в ленте — текстом («17 November 2026»)
function usePatchesSince(since) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!since) return;
    let off = false;
    api('/news').then(d => {
      if (off) return;
      const all = d?.skyblock || [];
      const dated = all.map(n => ({ ...n, t: Date.parse(n.date) })).filter(n => Number.isFinite(n.t));
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
            : patches.length ? <ul className="comeback-list">{patches.map(n => <li key={n.link}><a className="link" href={n.link} target="_blank" rel="noopener noreferrer nofollow">{n.title}</a> <span className="muted tiny">{n.date}</span></li>)}</ul>
              : <div className="muted small">Свежих патчноутов не нашлось. Все — в разделе <a className="link" href="#/news">Новости</a>.</div>}
        </div>
      </div>
    </Card>
  );
}

export function Dailies({ d }) {
  if (!d?.items?.length) return null;
  return (
    <Card className="span-12 dailies" news="dailies" title="Дела на сегодня"
      right={<span className="muted small">{d.done}/{d.total} · новый день в {timeOf(d.next)}</span>}>
      <div className="daily-row">
        {d.items.map(i => (
          <a key={i.id} href={i.href || '#/guides'} className={`daily ${i.done ? 'done' : ''}`}>
            <span className="daily-check" aria-hidden>{i.done ? '✓' : ''}</span>
            <span className="daily-body">
              <b>{i.title}{i.progress ? <span className="muted"> {i.progress[0]}/{i.progress[1]}</span> : null}</b>
              <span className="muted tiny"><Rich text={i.ready && i.done ? `${i.text} Снова в ${timeOf(i.ready)}.` : i.text} /></span>
            </span>
          </a>
        ))}
      </div>
      <div className="muted tiny daily-note">Отметки ставятся сами по данным профиля, он обновляется раз в несколько минут.</div>
    </Card>
  );
}
