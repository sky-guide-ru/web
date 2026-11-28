// Общие части страницы «Гайды»: шапка гайда, «что делать дальше», секции (text / steps / checklist / table / tree / sources).
import { createContext, useContext } from 'react';
import { Card, Progress, Badge, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApp } from '../App.jsx';
import { Rich } from './Rich.jsx';
import { TreeView } from './Tree.jsx';
import { MiningEventsLive } from './MiningEvents.jsx';

export const STATUS = {
  start: { text: 'не начато', color: '#8b90b0' },
  progress: { text: 'в процессе', color: '#22d3ee' },
  done: { text: '✔ пройдено', color: '#4ade80' },
  almost: { text: 'почти готово', color: '#f5c542' },
  locked: { text: 'закрыто', color: '#f87171' },
  error: { text: 'ошибка', color: '#f87171' },
};

export function StatusBadge({ status, almost }) {
  const s = STATUS[almost && status === 'progress' ? 'almost' : status];
  return s ? <Badge color={s.color}>{s.text}</Badge> : null;
}

export function GuideHero({ guide, children }) {
  const lv = guide.level;
  return (
    <Card className="guide-hero">
      <div className="guide-hero-row">
        {guide.icon && <ItemIcon id={guide.icon} size={56} />}
        <div className="guide-hero-text">
          <h2>{guide.title} <StatusBadge status={guide.status} almost={guide.almost} /></h2>
          {guide.summary && <p className="muted"><Rich text={guide.summary} /></p>}
          {guide.guest && <p className="muted"><Rich text="Это общий гайд. Введи свой ник на «Обзоре» — и здесь появятся твой прогресс и шаги под твой профиль." /></p>}
        </div>
      </div>
      {lv && lv.max > 0 && (
        <Progress value={Math.min(1, lv.value / lv.max)} label={`${lv.label}: ${lv.value}`} sub={`из ${lv.max}`} max={lv.value >= lv.max} />
      )}
      {children}
    </Card>
  );
}

// Список всех гайдов (из /api/guides): чтобы «Что дальше» показывало только непройденные связанные гайды
export const GuideListCtx = createContext([]);

/**
 * «Что делать дальше». Пройденный гайд не пустеет: вместо шагов — итог, эндгейм-цели и связанные гайды,
 * а оставшиеся необязательные шаги свёрнуты. Почти пройденный — заголовок «Почти готово».
 */
export function NextSteps({ guide, next = guide?.next }) {
  const list = useContext(GuideListCtx);
  if (guide?.status === 'done') return <DoneCard guide={guide} list={list} />;
  if (!next?.length) return null;
  return (
    <Card title={guide?.almost ? 'Почти готово — осталось' : 'Что делать дальше'} className={`guide-next ${guide?.almost ? 'almost' : ''}`}>
      <ol className="guide-next-list">
        {next.map((n, i) => <NextStep key={i} n={n} i={i} />)}
      </ol>
    </Card>
  );
}

function DoneCard({ guide, list }) {
  const c = guide.complete || { goals: [], related: [] };
  const related = (c.related || []).map(id => list.find(g => g.id === id)).filter(g => g && g.status !== 'done' && g.status !== 'locked');
  const next = guide.next || [];
  return (
    <Card title="✔ Пройдено" className="guide-next guide-done">
      {guide.summary && <p className="guide-done-sum"><Rich text={guide.summary} /></p>}
      {c.goals?.length > 0 && (
        <>
          <div className="guide-done-sub">Что дальше</div>
          <ul className="guide-done-goals">{c.goals.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>
        </>
      )}
      {related.length > 0 && (
        <>
          <div className="guide-done-sub">Следующие гайды</div>
          <div className="guide-done-rel">
            {related.slice(0, 4).map(g => (
              <a key={g.id} href={`#/guides/${g.id}`} className="guide-done-link">
                {g.icon && <ItemIcon id={g.icon} size={22} />}
                <span><b>{g.title}</b>{g.next?.[0] && <small className="muted"> · {g.next[0].title}</small>}</span>
                <StatusBadge status={g.status} almost={g.almost} />
              </a>
            ))}
          </div>
        </>
      )}
      {next.length > 0 && (
        <details className="guide-done-more">
          <summary>Ещё можно сделать ({next.length})</summary>
          <ol className="guide-next-list">{next.map((n, i) => <NextStep key={i} n={n} i={i} />)}</ol>
        </details>
      )}
      <p className="muted small guide-done-foot">Справка ниже осталась: таблицы, механики и подсказки по-прежнему открываются.</p>
    </Card>
  );
}

// Шаг «Что делать»: что и зачем, а если в шаге есть предмет — как его достать и кнопка карточки
function NextStep({ n, i }) {
  const { openItem } = useApp();
  return (
    <li className={i === 0 ? 'first' : ''}>
      <span className="step-num">{i + 1}</span>
      <div className="guide-next-body">
        <b><Rich text={n.title} /></b>
        {n.why && <div className="muted small"><Rich text={n.why} /></div>}
        {(n.how || n.item) && (
          <div className="guide-next-how small">
            {n.item && <ItemIcon id={n.item} size={22} onClick={() => openItem(n.item)} />}
            {n.how && <span><span className="muted">Как: </span><Rich text={n.how} /></span>}
            {n.item && <button className="link-btn" onClick={() => openItem(n.item)}>Пошагово в карточке →</button>}
          </div>
        )}
      </div>
    </li>
  );
}

function Items({ ids }) {
  const { openItem } = useApp();
  if (!ids?.length) return null;
  return <span className="guide-items">{ids.map(id => <ItemIcon key={id} id={id} size={26} onClick={() => openItem(id)} />)}</span>;
}

function Cell({ c }) {
  const { openItem } = useApp();
  if (c == null) return <td className="muted">—</td>;
  if (typeof c !== 'object') return <td>{typeof c === 'string' ? <Rich text={c} /> : c}</td>;
  return (
    <td className={`${c.tone ? `tone-${c.tone}` : ''}${c.auto ? ' auto' : ''}`}>
      <span className="guide-cell">
        {c.item && <ItemIcon id={c.item} size={22} onClick={() => openItem(c.item)} />}
        <span><Rich text={c.text} item={c.item} /></span>
      </span>
    </td>
  );
}

// Фигуры на сетке (окаменелости Fossil Excavator): клетки [x, y], значок с процентом, отметка «сдан»
function Shapes({ items }) {
  const { openItem } = useApp();
  return (
    <div className="guide-shapes">
      {items.map((it, i) => {
        const w = Math.max(...it.cells.map(c => c[0])) + 1;
        const h = Math.max(...it.cells.map(c => c[1])) + 1;
        const on = new Set(it.cells.map(c => `${c[0]},${c[1]}`));
        return (
          <div key={i} className={`guide-shape${it.done ? ' done' : ''}`}>
            <div className="guide-shape-grid" style={{ gridTemplateColumns: `repeat(${w}, var(--cell))` }} aria-hidden="true">
              {Array.from({ length: w * h }, (_, k) => <i key={k} className={on.has(`${k % w},${Math.floor(k / w)}`) ? 'on' : ''} />)}
            </div>
            <div className="guide-shape-body">
              <div className="guide-shape-name">
                {it.item && <ItemIcon id={it.item} size={22} onClick={() => openItem(it.item)} />}
                <b><Rich text={it.name} item={it.item} /></b>
                {it.badge && <span className="guide-shape-badge">{it.badge}</span>}
              </div>
              {it.text && <div className="muted small"><Rich text={it.text} /></div>}
              {it.hint && <div className={`small ${it.done ? 'tone-good' : 'muted'}`}><Rich text={it.hint} /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const lines = t => (Array.isArray(t) ? t : [t]).filter(Boolean);

export function Section({ s }) {
  let body;
  if (s.kind === 'text') {
    body = lines(s.text).map((t, i) => <p key={i}><Rich text={t} /></p>);
  } else if (s.kind === 'steps') {
    body = (
      <ol className="guide-steps">
        {(s.items || []).map((it, i) => (
          <li key={i} className={it.done ? 'done' : it.current ? 'current' : ''}>
            <span className="guide-step-dot">{it.done ? '✓' : i + 1}</span>
            <div>
              <b><Rich text={it.title} /></b> <Items ids={it.items} />
              {lines(it.text).map((t, j) => <div key={j} className="muted small"><Rich text={t} /></div>)}
              {it.link?.guide && <a className="link-btn small" href={`#/guides/${it.link.guide}`}>{it.link.label || 'Открыть гайд'} →</a>}
            </div>
          </li>
        ))}
      </ol>
    );
  } else if (s.kind === 'checklist') {
    body = (
      <ul className="guide-check">
        {(s.items || []).map((it, i) => (
          <li key={i} className={it.done ? 'done' : ''}>
            <span className="guide-check-box">{it.done ? '✓' : ''}</span>
            {it.item && <Items ids={[it.item]} />}
            <span><Rich text={it.text} item={it.item} />{it.hint && <span className="muted small"> · <Rich text={it.hint} /></span>}</span>
          </li>
        ))}
      </ul>
    );
  } else if (s.kind === 'tree') {
    body = <TreeView s={s} />;
  } else if (s.kind === 'sources') {
    body = <Sources s={s} />;
  } else if (s.kind === 'miningEvents') {
    body = <MiningEventsLive />;
  } else if (s.kind === 'shapes') {
    body = <Shapes items={s.items || []} />;
  } else if (s.kind === 'table') {
    body = (
      <div className="table-scroll">
        <table className="table guide-table">
          <thead><tr>{(s.columns || []).map((c, i) => <th key={i}><Rich text={c} /></th>)}</tr></thead>
          <tbody>{(s.rows || []).map((r, i) => <tr key={i} className={s.current === i ? 'current' : ''}>{r.map((c, j) => <Cell key={j} c={c} />)}</tr>)}</tbody>
        </table>
      </div>
    );
  } else {
    body = <Empty>Неизвестный тип секции: {s.kind}</Empty>;
  }
  return (
    <Card title={s.title} className="guide-section" news={s.news}>
      {s.note && <p className="muted small guide-note"><Rich text={s.note} /></p>}
      {body}
      {s.link && <a className="link small guide-sec-link" href={s.link.href}>{s.link.text}</a>}
    </Card>
  );
}

const ext = { target: '_blank', rel: 'noopener noreferrer' };
const LANG = { ru: 'на русском', en: 'на английском' };

/** «Источники»: базы данных, страницы вики и видеогайды. Все ссылки внешние, открываются в новой вкладке. */
function Sources({ s }) {
  return (
    <div className="guide-src">
      {s.videos?.length > 0 && (
        <div className="guide-src-group">
          <div className="guide-src-h">Видеогайды на YouTube</div>
          <ul className="guide-src-videos">
            {s.videos.map(v => (
              <li key={v.id}>
                <a className="guide-src-video" href={v.url} {...ext} title={v.title}>
                  <span className="guide-src-play" aria-hidden="true">▶</span>
                  <span>
                    <b>{v.label}</b>
                    <span className="muted small"> · {v.channel}{v.lang ? ` · ${LANG[v.lang] || v.lang}` : ''}{v.year ? ` · ${v.year}` : ''}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="muted small">Цифры в роликах могли устареть после патчей: если не сходится, верь гайду и игре.</p>
        </div>
      )}
      {s.wiki?.length > 0 && (
        <div className="guide-src-group">
          <div className="guide-src-h">Вики (fandom)</div>
          <div className="guide-src-chips">
            {s.wiki.map(w => <a key={w.url} className="guide-src-chip" href={w.url} {...ext}>{w.title}</a>)}
          </div>
        </div>
      )}
      {s.data?.length > 0 && (
        <div className="guide-src-group">
          <div className="guide-src-h">Данные</div>
          <ul className="guide-src-data">
            {s.data.map(d => <li key={d.url}><a href={d.url} {...ext}>{d.title}</a> <span className="muted small">— {d.what}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Общий вид гайда: шапка, следующие шаги, секции. */
export function GenericGuide({ guide }) {
  return (
    <>
      <GuideHero guide={guide} />
      <NextSteps guide={guide} />
      {(guide.sections || []).map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
