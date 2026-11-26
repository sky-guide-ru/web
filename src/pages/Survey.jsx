// Раздел «Опрос»: каким быть советчику. Вопросы по темам, у каждого — варианты и поле «свой вариант».
// Ответ сохраняется сразу (POST /api/survey/answer), любой вопрос можно пропустить, вернуться и изменить в любой момент.
// Владелец видит вкладку «Итоги» (GET /api/survey/results). Вопросы — server/survey/questions.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { Rich } from '../guides/Rich.jsx';
import { me } from '../api.js';

export const SURVEY_DONE_KEY = 'sb-survey-done';
const mark = n => { try { if (n >= 10) localStorage.setItem(SURVEY_DONE_KEY, '1'); } catch { /* приватный режим */ } };

async function post(body) {
  const r = await fetch('/api/survey/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
}

// Варианты ответа — обычным текстом: подсказки по терминам внутри кнопки открывали бы карточку предмета вместо выбора
function Question({ q, n, value, onSave }) {
  const [other, setOther] = useState(value?.other || '');
  const [saved, setSaved] = useState('');
  const timer = useRef(null);
  useEffect(() => setOther(value?.other || ''), [value?.other]);
  const picked = new Set(value?.o || []);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const pending = useRef(null); // текст «своего варианта», ещё не отправленный (ждёт 800 мс)
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  // Ушли с темы или из опроса раньше 800 мс — не теряем набранное, а отправляем сразу
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (pending.current != null) saveRef.current(q.id, { o: [...pickedRef.current], other: pending.current }).catch(() => {});
  }, [q.id]);
  const send = (o, oth) => {
    clearTimeout(timer.current); // отложенное сохранение текста не должно вернуть старый выбор
    pending.current = null;
    setSaved('…');
    onSave(q.id, { o, other: oth }).then(() => setSaved('✓ сохранено')).catch(e => setSaved(e.message));
  };
  const toggle = id => {
    let o;
    if (q.multi) {
      o = picked.has(id) ? [...picked].filter(x => x !== id) : [...picked, id];
      if (q.max && o.length > q.max) o = o.slice(o.length - q.max);
    } else o = picked.has(id) ? [] : [id];
    send(o, other);
  };
  const typeOther = v => {
    setOther(v);
    clearTimeout(timer.current);
    pending.current = v;
    timer.current = setTimeout(() => send([...pickedRef.current], v), 800);
  };
  return (
    <div className={`sv-q${picked.size || other ? ' done' : ''}`}>
      <div className="sv-q-head">
        <span className="sv-n">{n}</span>
        <div className="sv-q-text"><Rich text={q.text} />{q.multi && <span className="muted small"> · {q.max ? `можно до ${q.max}` : 'можно несколько'}</span>}</div>
        {saved && <span className="sv-saved tiny muted" role="status">{saved}</span>}
      </div>
      <div className="sv-opts" role={q.multi ? 'group' : 'radiogroup'} aria-label={q.text}>
        {q.options.map(([id, label]) => (
          <button key={id} type="button" className={`sv-opt${picked.has(id) ? ' on' : ''}`} aria-pressed={picked.has(id)} onClick={() => toggle(id)}>
            <span className={`sv-mark${q.multi ? ' sq' : ''}`} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <input className="sv-other" value={other} maxLength={300} onChange={e => typeOther(e.target.value)} placeholder="Свой вариант…" aria-label={`Свой вариант: ${q.text}`} />
    </div>
  );
}

function Results() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/survey/results').then(r => r.json()).then(j => (j.error ? setErr(j.error) : setD(j))).catch(e => setErr(e.message)); }, []);
  if (err) return <Empty>{err}</Empty>;
  if (!d) return <p className="muted">Считаю…</p>;
  let group = '';
  return (
    <div className="sv-results">
      <p className="muted">Прошли опрос (10+ ответов): <b>{d.respondents}</b> из {d.goal}{d.byLang ? ` (RU ${d.byLang.ru} · EN ${d.byLang.en})` : ''} · начали: {d.started} · <a className="link" href="/api/survey/results.csv" download>⬇ Скачать CSV</a> (откроется в Excel и Google Таблицах)</p>
      {d.questions.map(q => {
        const head = q.group !== group ? (group = q.group) : null;
        return (
          <div key={q.id}>
            {head && <h3 className="sv-r-group">{head}</h3>}
            <div className="sv-r-q">
              <div className="sv-q-text"><Rich text={q.text} /> <span className="muted small">· ответили {q.answered}</span></div>
              {q.options.map(o => (
                <div key={o.id} className="sv-r-row">
                  <span className="sv-r-label"><Rich text={o.label} /></span>
                  <span className="goal-bar"><i style={{ width: `${Math.max(1, o.pct)}%` }} /></span>
                  <b>{o.pct}%</b><span className="muted small">{o.n}</span>
                </div>
              ))}
              {q.others.length > 0 && (
                <details className="sv-r-others">
                  <summary>Свои варианты ({q.others.length})</summary>
                  <ul>{q.others.map((x, i) => <li key={i}>{x.lang === 'en' && <span className="muted">EN · </span>}{x.text}</li>)}</ul>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Survey() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState({});
  const [count, setCount] = useState(0);
  const [tab, setTab] = useState(0);
  const [results, setResults] = useState(false);
  const top = useRef(null);
  useEffect(() => {
    fetch('/api/survey').then(r => r.json()).then(j => { setD(j); setMine(j.mine || {}); setCount(j.count || 0); mark(Object.keys(j.mine || {}).length); }).catch(e => setErr(e.message));
  }, []);
  const total = useMemo(() => (d?.groups || []).reduce((a, g) => a + g.questions.length, 0), [d]);
  const answered = Object.keys(mine).length;

  const save = async (qid, ans) => {
    const empty = !ans.o.length && !ans.other.trim();
    const r = await post({ q: qid, o: ans.o, other: ans.other });
    setMine(m => { const x = { ...m }; if (empty) delete x[qid]; else x[qid] = { o: ans.o, other: ans.other }; return x; });
    setCount(r.count ?? count);
    mark(r.answered || 0);
  };

  if (err) return <Card title="Опрос"><Empty>Не удалось загрузить опрос: {err}</Empty></Card>;
  if (!d) return <div className="skeleton-page" aria-label="Загружаю опрос…"><div className="sk sk-hero" /></div>;
  const g = d.groups[tab];
  let n = d.groups.slice(0, tab).reduce((a, x) => a + x.questions.length, 0);
  const go = i => { setTab(i); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="survey" ref={top}>
      <Card className="sv-hero">
        <h2>🧠 Каким быть советчику?</h2>
        <p>Мы делаем личного советчика по профилю: он будет смотреть твой прогресс и отвечать на вопросы. Расскажи, что ему стоит уметь. Сколько вопросов ответишь, решаешь ты: любой можно пропустить, ответы сохраняются сами, вернуться и поменять их можно когда угодно.</p>
        <div className="sv-progress">
          <div className="goal" style={{ '--g': 'var(--accent)' }}><span className="goal-label">Твои ответы</span><span className="goal-bar"><i style={{ width: `${Math.max(2, answered / total * 100)}%` }} /></span><b>{answered} / {total}</b></div>
          <div className="goal" style={{ '--g': 'var(--gold)' }}><span className="goal-label">До пилота</span><span className="goal-bar"><i style={{ width: `${Math.max(2, Math.min(1, count / d.goal) * 100)}%` }} /></span><b>{count} / {d.goal}</b></div>
        </div>
        <p className="muted small">Когда опрос пройдут {d.goal} игроков (от {d.countFrom} ответов), советчик откроется для всех как пилотная часть сайта.{me.guest ? ' Ответы привязаны к этому браузеру.' : ''}</p>
        {me.admin && !me.guest && <button type="button" className="chip" onClick={() => setResults(v => !v)}>{results ? '← К вопросам' : '📊 Итоги опроса'}</button>}
      </Card>

      {results ? <Card title="Итоги"><Results /></Card> : (
        <>
          <nav className="sv-tabs" aria-label="Темы опроса">
            {d.groups.map((x, i) => {
              const done = x.questions.filter(q => mine[q.id]).length;
              return (
                <button key={x.id} type="button" className={`sv-tab${i === tab ? ' on' : ''}${done === x.questions.length ? ' full' : ''}`} onClick={() => go(i)} aria-current={i === tab ? 'step' : undefined}>
                  <span aria-hidden="true">{x.icon}</span> {x.title} <span className="sv-tab-n">{done}/{x.questions.length}</span>
                </button>
              );
            })}
          </nav>
          <Card title={`${g.icon} ${g.title}`}>
            <p className="muted"><Rich text={g.intro} /></p>
            <div className="sv-list">
              {g.questions.map(q => <Question key={q.id} q={q} n={++n} value={mine[q.id]} onSave={save} />)}
            </div>
            <div className="sv-nav">
              {tab > 0 ? <button type="button" className="btn ghost" onClick={() => go(tab - 1)}>← {d.groups[tab - 1].title}</button> : <span />}
              {tab < d.groups.length - 1
                ? <button type="button" className="btn" onClick={() => go(tab + 1)}>{d.groups[tab + 1].title} →</button>
                : <span className="muted">{answered ? 'Спасибо! Ответы сохранены, поменять их можно в любой момент.' : ''}</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
