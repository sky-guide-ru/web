import { LOCALE } from '../i18n.js';
// Гайд по Рифту: шапка, шаги, полоса зон, обозреватель Enigma Souls с ручными отметками, остальные секции.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Card, Progress } from '../components/ui.jsx';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { Rich } from './Rich.jsx';

const STATUS = {
  found: { text: 'найдена', cls: 'good' },
  maybe: { text: 'возможно найдена', cls: 'warn' },
  missing: { text: 'не найдена', cls: 'bad' },
};

function copy(text) {
  try { navigator.clipboard?.writeText(text); } catch { /* буфер недоступен — не страшно */ }
}

function AreaStrip({ areas, current, active, onPick }) {
  return (
    <div className="rift-areas">
      {areas.map((a, i) => {
        const done = a.souls.found >= a.souls.total;
        return (
          <button key={a.id} className={`rift-area ${a.visited ? '' : 'locked'} ${a.id === current ? 'current' : ''} ${active === a.id ? 'active' : ''} ${done ? 'done' : ''}`}
            onClick={() => onPick(active === a.id ? null : a.id)} title={a.visited ? `${a.name}: показать души` : `${a.name}: ещё не открыта`}>
            <span className="rift-area-n">{done ? '✓' : i + 1}</span>
            <b>{a.name}</b>
            <small className="muted">{a.ru}</small>
            <Progress value={a.souls.total ? a.souls.found / a.souls.total : 0} max={done} />
            <small>{a.souls.found}{a.souls.maybe ? <span className="tone-warn"> +{a.souls.maybe}?</span> : null} / {a.souls.total} душ</small>
          </button>
        );
      })}
    </div>
  );
}

function Souls({ rift, onMark, busy }) {
  const [area, setArea] = useState(null);
  const [show, setShow] = useState('left');
  const list = useMemo(() => rift.souls
    .filter(s => !area || s.area === area)
    .filter(s => show === 'all' || (show === 'left' ? s.status !== 'found' : s.status === 'found')), [rift.souls, area, show]);
  return (
    <Card title={`Enigma Souls: ${rift.found} из ${rift.total}`} className="rift-souls"
      right={<span className="muted small">+{rift.found * 20} с к Rift Time от плаща</span>}>
      {rift.unexplained > 0 && (
        <p className="small rift-warn">
          Hypixel записал {rift.unexplained} из найденных душ кодами, которые нельзя сопоставить с конкретной душой.
          Души с пометкой «возможно» — кандидаты. Нажми «Найдена» у тех, что ты уже собрал, и список станет точным.
        </p>
      )}
      <AreaStrip areas={rift.areas} current={rift.current} active={area} onPick={setArea} />
      <div className="chips" style={{ margin: '10px 0' }}>
        {[['left', 'недостающие'], ['found', 'найденные'], ['all', 'все']].map(([k, t]) =>
          <button key={k} className={show === k ? 'chip active' : 'chip'} onClick={() => setShow(k)}>{t}</button>)}
        {area && <button className="chip" onClick={() => setArea(null)}>все зоны ×</button>}
      </div>
      {list.length ? (
        <div className="rift-soul-grid">
          {list.map(s => (
            <div key={s.id} className={`rift-soul ${s.status}`}>
              <div className="rift-soul-head">
                <b>{s.name}</b>
                <span className={`tone-${STATUS[s.status].cls} small`}>{STATUS[s.status].text}{s.marked ? ' · отмечено' : ''}</span>
              </div>
              <div className="muted small">{s.areaName}</div>
              <div className="small"><Rich text={s.hint} /></div>
              <div className="rift-soul-foot">
                {s.pos && <button className="chip tiny" title="Скопировать координаты" onClick={() => copy(s.pos.split(':').join(' '))}>📍 {s.pos.split(':').join(' ')}</button>}
                {s.status !== 'found' && <button className="chip tiny" disabled={busy} onClick={() => onMark(s.id, true)}>Найдена</button>}
                {s.marked && <button className="chip tiny" disabled={busy} onClick={() => onMark(s.id, null)}>Сбросить</button>}
                {s.status === 'maybe' && <button className="chip tiny" disabled={busy} onClick={() => onMark(s.id, false)}>Нет</button>}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="muted">{show === 'left' ? 'Здесь все души найдены 🎉' : 'Пусто.'}</p>}
    </Card>
  );
}

export default function Rift({ guide: initial }) {
  const [guide, setGuide] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setGuide(initial), [initial]);
  const onMark = async (id, value) => {
    setBusy(true); setErr('');
    try {
      await api('/rift/marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value }) });
      setGuide(await api('/guides/rift'));
    } catch (e) {
      // Чужой профиль (друг открыл профиль владельца) или сервер недоступен — говорим, почему отметка не сохранилась
      setErr(/Ошибка \d|fetch/i.test(e.message) ? 'Отметка не сохранилась: сервер не отвечает' : e.message);
    }
    setBusy(false);
  };
  const r = guide.rift;
  // Таблица недостающих душ заменена интерактивным списком
  const sections = (guide.sections || []).filter(s => !s.title.startsWith('Недостающие Enigma Souls'));
  return (
    <>
      <GuideHero guide={guide}>
        {r && (
          <div className="rift-stats">
            <span>Motes: <b>{r.motes.toLocaleString(LOCALE)}</b></span>
            <span>Таймчармы: <b>{r.charms.filter(c => c.secured).length}/{r.charms.length}</b></span>
            <span>Глаза Porhtal: <b>{r.eyes.filter(e => e.done).length}/{r.eyes.length}</b></span>
            <span>Montezuma: <b>{r.cats}/9</b></span>
            <span>Vampire Slayer: <b>{r.vamp.level}/{r.vamp.max}</b></span>
          </div>
        )}
      </GuideHero>
      <NextSteps guide={guide} />
      {err && <div className="card warn-card span-12" role="alert">{err}</div>}
      {r && <Souls rift={r} onMark={onMark} busy={busy} />}
      {sections.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
