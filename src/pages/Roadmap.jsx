import { useState, useMemo, useEffect } from 'react';
import { Card, Empty, Badge, Tabs, Progress } from '../components/ui.jsx';
import { api, coins, num, plural, useHashTab, usePart, RARITY_COLOR, useProfileStore } from '../api.js';
import { usePurchaseCart } from '../purchaseCart.js';
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

// Поиск предмета, чтобы добавить свою вещь в план покупок
function CartAdd({ onAdd }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [qty, setQty] = useState(1);
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes([]); return; }
    let alive = true;
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(s)}`).then(r => alive && setRes(r.slice(0, 6))).catch(() => alive && setRes([])), 150);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  const pick = r => { onAdd(r.id, qty); setQ(''); setRes([]); setQty(1); };
  return (
    <div className="cart-add">
      <div className="gsearch">
        <input className="gsearch-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Добавить свою вещь: название предмета" aria-label="Добавить вещь в план покупок"
          onKeyDown={e => { if (e.key === 'Enter' && res[0]) pick(res[0]); if (e.key === 'Escape') setQ(''); }} />
        {res.length > 0 && (
          <div className="gsearch-pop" role="listbox">
            {res.map(r => (
              <div key={r.id} role="option" aria-selected="false" className="gsearch-item" onMouseDown={e => { e.preventDefault(); pick(r); }}>
                <ItemIcon id={r.id} size={28} />
                <div className="grow" style={{ color: RARITY_COLOR[r.rarity] }}>{r.name || r.id}</div>
                <span className="muted tiny">+ в план</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <label className="cart-qty small muted">шт. <input type="number" min={1} max={100000} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} /></label>
    </div>
  );
}

// «70m», «1.5b», «500k», «2 500 000» → монеты
export function parseCoins(s) {
  const m = /^\s*([\d\s.,]+)\s*([kкmмbб]|тыс|млн|млрд)?\.?\s*$/i.exec(String(s || ''));
  if (!m) return null;
  const u = (m[2] || '').toLowerCase();
  const raw = m[1].replace(/\s/g, '');
  // «2,500,000» и «1.000.000» без единиц — разделители тысяч, иначе запятая — десятичная («1,5m»)
  const n = Number(!u && /^\d{1,3}([.,]\d{3}){2,}$/.test(raw) ? raw.replace(/[.,]/g, '') : raw.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const k = /^(k|к|тыс)$/.test(u) ? 1e3 : /^(m|м|млн)$/.test(u) ? 1e6 : /^(b|б|млрд)$/.test(u) ? 1e9 : 1;
  return Math.round(n * k);
}

// Что купить на бюджет: по порядку плана; дорогое, что не влезает, пропускаем — дальше может влезть дешёвое
export function fitBudget(rows, budget) {
  const take = new Set();
  let left = budget;
  for (const r of rows) if (r.cost > 0 && r.cost <= left) { take.add(r.kind === 'item' ? 'i:' + r.id : r.stepId); left -= r.cost; }
  return { take, left, spent: budget - left };
}

function PurchasePlan({ state, onStep }) {
  const { data, mode, change, error, loading } = usePurchaseCart(state);
  const { openItem } = useApp();
  const [budgetText, setBudgetText] = useProfileStore('sb-cart-budget', '');
  const plan = state.analysis?.plan;
  const stepById = useMemo(() => new Map((state.analysis?.roadmap || []).map(s => [s.id, s])), [state.analysis?.roadmap]);
  if (!data && loading) return <div className="muted small"><div className="spinner" />Считаю план покупок…</div>;
  // Сервер не ответил — показываем план как есть, без правок
  const rows = data?.rows || (plan || []).map(p => ({ kind: 'step', ...p }));
  const budget = parseCoins(budgetText);
  const fit = budget ? fitBudget(rows, budget) : null;
  const rowKey = p => (p.kind === 'item' ? 'i:' + p.id : p.stepId);
  const inBudget = p => fit?.take.has(rowKey(p));
  // «Что даст»: итог шага плана (payoff), иначе первое предложение объяснения
  const gives = p => { const st = stepById.get(p.stepId); return st?.payoff || (st?.why ? String(st.why).split(/(?<=\.)\s/)[0] : ''); };
  const edit = mode !== 'none' && !!data;
  const when = p => (p.affordableNow ? <span className="green">хватает уже сейчас</span> : p.hoursOfFarming != null ? `~${Math.ceil(p.hoursOfFarming)} ч лучшего заработка` : 'нужно накопить');
  return (
    <div className="cart" data-news="cart">
      {rows.length > 0 && (
        <div className="cart-budget" data-news="budget">
          <label className="small">Бюджет: <input className="gsearch-input" value={budgetText} onChange={e => setBudgetText(e.target.value)} placeholder="например, 70m или 1.5b" aria-label="Бюджет в монетах" /></label>
          {data?.liquid > 0 && <button className="chip tiny" onClick={() => setBudgetText(String(Math.round(data.liquid)))}>сколько есть: {coins(data.liquid)}</button>}
          {budgetText && <button className="chip tiny" onClick={() => setBudgetText('')}>сбросить</button>}
          {fit && <span className="small">{fit.take.size ? <>На {coins(budget)}: <b>{fit.take.size}</b> {plural(fit.take.size, 'покупка', 'покупки', 'покупок')} на {coins(fit.spent)}, останется {coins(fit.left)}.</> : <span className="muted">На {coins(budget)} пока ничего не хватает.</span>}</span>}
          {budgetText && !budget && <span className="small muted">Не понял сумму: напиши число, можно с k, m или b.</span>}
        </div>
      )}
      {rows.length ? (
        <table className="table">
          <thead><tr><th>#</th><th>Что купить</th><th>Что даст</th><th>Цена</th><th>Нарастающим итогом</th><th>Когда</th>{edit && <th />}</tr></thead>
          <tbody>{rows.map((p, i) => p.kind === 'item' ? (
            <tr key={'i:' + p.id} className={`clickable-row ${inBudget(p) ? 'in-budget' : ''}`} onClick={() => openItem(p.id)} title="Открыть предмет: цена и где взять">
              <td>{inBudget(p) ? '✓' : i + 1}</td>
              <td><span className="cart-item"><ItemIcon id={p.id} size={24} />{p.name}{p.qty > 1 && ` ×${num(p.qty)}`}<span className="cart-own">своё</span>{p.have > 0 && <span className="muted small">есть {num(p.have)}</span>}</span></td>
              <td className="muted small">—</td>
              <td>{p.cost ? coins(p.cost) : <span className="muted">нет цены</span>}</td><td>{coins(p.cumulative)}</td><td>{when(p)}</td>
              {edit && <td><button className="x-btn sm danger" title="Убрать из плана" aria-label="Убрать из плана" onClick={e => { e.stopPropagation(); change({ remove: p.id }); }}>×</button></td>}
            </tr>
          ) : (
            <tr key={p.stepId} className={`clickable-row ${inBudget(p) ? 'in-budget' : ''}`} onClick={() => onStep(p.stepId)} title="Открыть шаг плана: что именно и где взять">
              <td>{inBudget(p) ? '✓' : i + 1}</td><td><Rich text={p.title} /></td><td className="muted small cart-gives"><Rich text={gives(p)} /></td><td>{coins(p.cost)}</td><td>{coins(p.cumulative)}</td><td>{when(p)}</td>
              {edit && <td><button className="x-btn sm danger" title="Не покупать: убрать из плана покупок" aria-label="Убрать из плана" onClick={e => { e.stopPropagation(); change({ skip: p.stepId, value: true }); }}>×</button></td>}
            </tr>
          ))}</tbody>
        </table>
      ) : <Empty>{plan?.length || data?.skipped?.length ? 'В плане покупок пусто.' : 'План покупок появится, когда загрузятся цены Bazaar и аукциона.'}</Empty>}
      {edit && <CartAdd onAdd={(id, qty) => change({ add: id, qty })} />}
      <p className="muted small plan-note">
        Список собирается сам из шагов плана с ценой.{' '}
        {edit ? <>Ненужное можно убрать, своё — добавить здесь или кнопкой «+ В план покупок» в карточке предмета. Что уже лежит у тебя, вычитается, а купленное уходит само.{mode === 'local' ? ' Правки видно только в этом браузере.' : ''}</> : mode === 'none' ? 'Это чужой план: править его может только сам игрок.' : ''}
      </p>
      {error && <div className="step-undo small warn" role="alert">{error}</div>}
      {data?.bought?.length > 0 && <div className="small green cart-bought">✔ Куплено: {data.bought.map(b => b.name).join(' · ')}</div>}
      {data?.skipped?.length > 0 && (
        <details className="hidden-steps">
          <summary className="small">Убрано из плана покупок ({data.skipped.length})</summary>
          <ul>{data.skipped.map(s => (
            <li key={s.stepId}><span>{s.title} <span className="muted small">· {coins(s.cost)}</span></span><button className="chip tiny" onClick={() => change({ skip: s.stepId, value: false })}>вернуть</button></li>
          ))}</ul>
        </details>
      )}
    </div>
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
        {view === 'plan' && <PurchasePlan state={state} onStep={goStep} />}
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
