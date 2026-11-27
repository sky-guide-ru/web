import { useState, useMemo, useEffect } from 'react';
import { Card, Empty, Badge, Tabs, Progress } from '../components/ui.jsx';
import { coins, useHashTab, usePart } from '../api.js';
import { useHiddenSteps } from '../hiddenSteps.js';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApp } from '../App.jsx';
import { Rich } from '../guides/Rich.jsx';
import { openNewsLink } from '../newsLinks.jsx';
import { useInterests, applyInterests } from '../interests.js';

const STATUS = { done: 'пройдено', current: 'сейчас', available: 'доступно', locked: 'закрыто' };

// «Нравится / Не хочу»: нажатие по категории переключает её: обычная → нравится → не хочу → обычная
const NEXT = { undefined: 'like', like: 'no', no: undefined };
function Interests({ cats, interests, set, clear }) {
  const like = cats.filter(c => interests[c] === 'like'), no = cats.filter(c => interests[c] === 'no');
  return (
    <details className="interests small" data-news="interests" open={like.length + no.length > 0 || undefined}>
      <summary>Нравится / Не хочу{like.length + no.length > 0 ? `: ♥ ${like.length} · ✕ ${no.length}` : ''}</summary>
      <div className="muted"><Rich text="Нажми категорию: ♥ поднимает её шаги выше, ✕ убирает их из плана, третье нажатие возвращает как было. Ironman и Bingo план учитывает сам." /></div>
      <div className="chips">
        {cats.map(c => <button key={c} className={`chip tiny interest ${interests[c] || ''}`} onClick={() => set(c, NEXT[interests[c]])}>{interests[c] === 'like' ? '♥ ' : interests[c] === 'no' ? '✕ ' : ''}{c}</button>)}
        {like.length + no.length > 0 && <button className="chip tiny" onClick={clear}>сбросить</button>}
      </div>
    </details>
  );
}

function ProgressMap({ map, goStep }) {
  if (!map?.branches?.length) return <Empty>Карта появится после загрузки профиля.</Empty>;
  return (
    <div className="pmap">
      <div className="pmap-overall">Общий прогресс по карте: <b>{Math.round((map.overall?.progress || 0) * 100)}%</b> <span className="muted small">({map.overall?.done}/{map.overall?.total} вех)</span><Progress value={map.overall?.progress || 0} /></div>
      <div className="pmap-legend"><span className="lg done">пройдено</span><span className="lg current">сейчас</span><span className="lg available">можно взять</span><span className="lg locked">закрыто</span></div>
      {map.branches.map((b, bi) => (
        <div key={b.id} className="branch" style={{ animationDelay: `${bi * 50}ms` }}>
          <div className="branch-head"><h4>{b.title}</h4><span className="muted small"><Rich text={b.summary} /></span><span className="branch-pct">{Math.round(b.progress * 100)}%</span></div>
          <div className="nodes">
            {b.nodes.map((n, i) => (
              <div key={n.id} className={`node ${n.status}`} onClick={() => n.stepId && goStep(n.stepId)} title={n.detail || ''}>
                {i > 0 && <span className="connector" />}
                <span className="node-dot" />
                <span className="node-title">{n.title}</span>
                <span className="node-status">{n.detail && n.status !== 'done' ? n.detail : n.detail || STATUS[n.status]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PurchasePlan({ plan, onStep }) {
  if (!plan?.length) return <Empty>План покупок появится, когда загрузятся цены Bazaar и аукциона.</Empty>;
  return (
    <table className="table">
      <thead><tr><th>#</th><th>Что купить</th><th>Цена</th><th>Нарастающим итогом</th><th>Когда</th></tr></thead>
      <tbody>{plan.map((p, i) => (
        <tr key={p.stepId} className="clickable-row" onClick={() => onStep(p.stepId)} title="Открыть шаг плана: что именно и где взять">
          <td>{i + 1}</td><td>{p.title}</td><td>{coins(p.cost)}</td><td>{coins(p.cumulative)}</td>
          <td>{p.affordableNow ? <span className="green">хватает уже сейчас</span> : p.hoursOfFarming != null ? `~${Math.ceil(p.hoursOfFarming)} ч лучшего заработка` : 'нужно накопить'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}


export default function Roadmap({ state, sub }) {
  const [view, setView] = useHashTab('roadmap', sub, ['steps', 'map', 'plan'], 'steps');
  // Карта прогрессии — отдельным куском, только когда открыта её вкладка
  const map = usePart(view === 'map' ? state : null, 'map', state.analysis?.map);
  const { openItem } = useApp();
  // Скрытые шаги: у вошедшего владельца — на сервере, у гостя — в этом браузере, в чужом плане скрывать нельзя
  const { hidden, mode, hide, unhide, error } = useHiddenSteps(state);
  const [cat, setCat] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [flash, setFlash] = useState(null);
  const { interests, setCat: setInterest, clear: clearInterests } = useInterests();
  const allSteps = state.analysis?.roadmap || [];
  const steps = useMemo(() => applyInterests(allSteps, interests), [allSteps, interests]);
  const cats = useMemo(() => {
    const n = new Map();
    for (const s of steps) if (!hidden[s.id]) n.set(s.cat, (n.get(s.cat) || 0) + 1);
    return [...n];
  }, [steps, hidden]);
  // Все категории плана (и те, что убраны «Не хочу») — для строки интересов
  const allCats = useMemo(() => [...new Set(allSteps.map(s => s.cat))], [allSteps]);
  const goStep = id => {
    setView('steps'); setCat('all');
    // Шаг скрыт — раскрываем список скрытых, иначе прокручивать некуда
    if (hidden[id]) setShowHidden(true);
    setTimeout(() => { document.getElementById('step-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(id); setTimeout(() => setFlash(null), 1800); }, 80);
  };
  // Переход с главной: #/roadmap/<id шага> — прокрутить к шагу и подсветить его
  // #/roadmap/cat:<категория> — открыть шаги одной категории (ссылки со страницы «Прогресс»)
  useEffect(() => {
    if (!sub || ['steps', 'map', 'plan'].includes(sub) || !steps.length) return;
    const v = decodeURIComponent(sub);
    if (v.startsWith('cat:')) { setView('steps'); setCat(steps.some(s => s.cat === v.slice(4)) ? v.slice(4) : 'all'); }
    else goStep(v);
  }, [sub, steps.length]);
  if (!allSteps.length) return <Empty>Нет рекомендаций — профиль не загружен.</Empty>;
  const hiddenSteps = steps.filter(s => hidden[s.id]);
  const shown = steps.filter(s => (cat === 'all' || s.cat === cat) && !hidden[s.id]);
  const a = state.analysis;
  return (
    <div className="grid">
      <Card className="span-12" title="Персональный план прогрессии" right={<Tabs value={view} onChange={setView} tabs={[{ id: 'steps', label: 'Шаги' }, { id: 'map', label: 'Карта прогрессии' }, { id: 'plan', label: 'План покупок' }]} />}>
        {a?.summary?.headline && <div className="plan-summary">🎯 <Rich text={a.summary.headline} />{a.summary.quickWins ? ` · быстрых побед: ${a.summary.quickWins}` : ''}</div>}
        {view === 'map' && (map || !state.parts?.map ? <ProgressMap map={map} goStep={goStep} /> : <div className="muted small"><div className="spinner" />Загружаю карту…</div>)}
        {view === 'plan' && <PurchasePlan plan={a?.plan} onStep={goStep} />}
        {view === 'steps' && <div className="chips">
          <button className={cat === 'all' ? 'chip active' : 'chip'} onClick={() => setCat('all')}>Все ({steps.length - hiddenSteps.length})</button>
          {cats.map(([c, n]) => <button key={c} className={cat === c ? 'chip active' : 'chip'} onClick={() => setCat(c)}>{c} ({n})</button>)}
        </div>}
        {view === 'steps' && <Interests cats={allCats} interests={interests} set={setInterest} clear={clearInterests} />}
        {view === 'steps' && (
          <p className="muted small plan-note">
            Шаги уходят из плана сами, когда по данным игры видно, что они сделаны (профиль обновляется раз в несколько минут).{' '}
            {mode === 'server' && 'Шаг, который тебе сейчас не нужен, можно скрыть: это сохраняется в твоём аккаунте и видно на всех твоих устройствах.'}
            {mode === 'local' && 'Шаг, который тебе сейчас не нужен, можно скрыть: это видно только в этом браузере, сам игрок и другие люди план не теряют.'}
            {mode === 'none' && 'Это чужой план: скрывать в нём шаги может только сам игрок, когда войдёт на сайт.'}
          </p>
        )}
        {error && <div className="step-undo small warn" role="alert">{error}</div>}
      </Card>
      {view === 'steps' && <div className="span-12 roadmap">
        {shown.map((s, i) => (
          <div key={s.id} id={'step-' + s.id} className={`road-step stars-${Math.max(1, Math.round(s.priority / 20))} ${i === 0 ? 'top' : ''} ${flash === s.id ? 'flash' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
            <div className="road-line"><div className="road-dot" style={{ '--p': s.priority }} /></div>
            <div className="road-card card">
              <div className="road-head">
                <div>
                  <div className="step-cat">{s.cat} <Badge>{s.effort}</Badge> <span className="prio" title="Приоритет">{'★'.repeat(Math.max(1, Math.round(s.priority / 20)))}</span></div>
                  <h4><Rich text={s.title} /></h4>
                </div>
                {mode !== 'none' && <button className="chip tiny" title={mode === 'local' ? 'Скрыть шаг (только в этом браузере)' : 'Скрыть шаг'} onClick={() => hide(s.id)}>скрыть</button>}
              </div>
              <p className="why"><Rich text={s.why} /></p>
              {s.calc && <div className="step-calc small" title="Расчёт по данным профиля: без зелий, баффов и сетовых бонусов"><Rich text={s.calc} /></div>}
              {(() => {
                // «→ итог» не повторяем, если он слово в слово совпадает с началом объяснения
                const payoff = s.payoff && !String(s.why || '').toLowerCase().startsWith(String(s.payoff).toLowerCase().replace(/\.$/, '')) ? s.payoff : null;
                return (s.cost > 0 || payoff) && <div className="cost-line">{s.cost > 0 && <Badge color={s.needsSaving ? '#f87171' : '#f5c542'}>~{coins(s.cost)}{s.needsSaving ? ' · нужно накопить' : ''}</Badge>}{payoff && <span className="muted small">→ <Rich text={payoff} /></span>}</div>;
              })()}
              {s.how?.length > 0 && <ul className="how">{s.how.map((h, j) => <li key={j}><Rich text={h} /></li>)}</ul>}
              {s.items?.length > 0 && (
                <div className="item-row">{s.items.map(id => <ItemIcon key={id} id={id} size={40} slot onClick={() => openItem(id)} title={s.itemNames?.[id] || id} />)}</div>
              )}
              {s.guide?.id && (
                <a className="link small step-guide" href={`#/guides/${s.guide.id}`} onClick={e => { e.preventDefault(); openNewsLink(`guides/${s.guide.id}`, s.guide.anchor); }}>
                  Гайд: {s.guide.title} →
                </a>
              )}
            </div>
          </div>
        ))}
        {!shown.length && <Empty>{hiddenSteps.length ? 'В этой категории остались только скрытые шаги.' : 'В этой категории нет шагов.'}</Empty>}
        {hiddenSteps.length > 0 && (
          <details className="hidden-steps card" data-news="hidden" open={showHidden} onToggle={e => setShowHidden(e.currentTarget.open)}>
            <summary>Скрытые шаги ({hiddenSteps.length}){mode === 'local' ? ' · только в этом браузере' : ''}</summary>
            <ul>{hiddenSteps.map(s => (
              <li key={s.id} id={'step-' + s.id} className={flash === s.id ? 'flash' : ''}>
                <span><span className="muted small">{s.cat} · </span>{s.title}</span>
                <button className="chip tiny" onClick={() => unhide(s.id)}>вернуть</button>
              </li>
            ))}</ul>
          </details>
        )}
      </div>}
    </div>
  );
}
