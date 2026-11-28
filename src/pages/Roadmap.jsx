import { useState, useMemo, useEffect } from 'react';
import { Card, Empty, Badge, Tabs, Progress } from '../components/ui.jsx';
import { api, coins, num, plural, useHashTab, usePart, RARITY_COLOR, useProfileStore } from '../api.js';
import { usePurchaseCart } from '../purchaseCart.js';
import { useHiddenSteps } from '../hiddenSteps.js';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApp } from '../App.jsx';
import { Rich } from '../guides/Rich.jsx';
import { openNewsLink } from '../newsLinks.jsx';
import { useInterests, applyInterests, catKey } from '../interests.js';

const STATUS = { done: 'пройдено', current: 'сейчас', available: 'доступно', locked: 'закрыто' };

// «Нравится / Не хочу»: нажатие по категории переключает её: обычная → нравится → не хочу → обычная
const NEXT = { undefined: 'like', like: 'no', no: undefined };
function Interests({ cats, interests, set, clear }) {
  const like = cats.filter(([k]) => interests[k] === 'like'), no = cats.filter(([k]) => interests[k] === 'no');
  // Открыт ли блок — решает только игрок: выбор категорий его не сворачивает
  const [open, setOpen] = useState(like.length + no.length > 0);
  return (
    <details className="interests small" data-news="interests" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="interests-btn">
        <span className="interests-ic" aria-hidden="true"><span className="h">♥</span><span className="x">✕</span></span>
        Нравится / Не хочу
        {like.length > 0 && <span className="interests-cnt like" title="Нравится">♥ {like.length}</span>}
        {no.length > 0 && <span className="interests-cnt no" title="Не хочу">✕ {no.length}</span>}
        <span className="interests-chev" aria-hidden="true">▼</span>
      </summary>
      <div className="muted"><Rich text="Нажми категорию: ♥ поднимает её шаги выше, ✕ убирает их из плана, третье нажатие возвращает как было. Ironman и Bingo план учитывает сам." /></div>
      <div className="chips">
        {cats.map(([k, label]) => <button key={k} className={`chip tiny interest ${interests[k] || ''}`} onClick={() => set(k, NEXT[interests[k]])}>{interests[k] === 'like' ? '♥ ' : interests[k] === 'no' ? '✕ ' : ''}{label}</button>)}
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
        <input className="gsearch-input" value={q} onChange={e => setQ(e.target.value)} placeholder="+ Своя вещь" aria-label="Добавить вещь в план покупок"
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
      <input className="cart-qty" type="number" min={1} max={100000} value={qty} title="Сколько штук" aria-label="Сколько штук" onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} />
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

// Иконка шага плана покупок: последняя вещь шага — обычно то, к чему идёт улучшение («A → B» — это B)
// Нет вещей у шага — значок его категории (ключ категории не переводится)
const CAT_ICON = {
  'Аксессуары и Magical Power': 'HEGEMONY_ARTIFACT', 'Питомцы': 'GOLDEN_DRAGON;4', 'Снаряжение': 'ASPECT_OF_THE_DRAGON',
  'Mining': 'DIAMOND_PICKAXE', 'Fishing': 'FISHING_ROD', 'Garden': 'WHEAT', 'Slayers': 'REAPER_SWORD', 'Dungeons': 'HYPERION',
  'Crimson Isle и Kuudra': 'BURNING_CRIMSON_CHESTPLATE', 'Миньоны': 'COBBLESTONE', 'Деньги': 'GOLD_INGOT',
};
const stepIcon = st => (st?.items?.length ? st.items[st.items.length - 1]
  : /^museum/.test(st?.id || '') ? 'MUSEUM_PORTAL' : CAT_ICON[st && catKey(st)] || null);

// «План добычи»: вариант «Плана покупок» для Ironman, Stranded и Bingo (сервер отдаёт farm: true).
// Вместо цены — где взять: купить у NPC (остров, координаты, монеты), скрафтить (сколько материалов уже есть) или выбить.
const FARM_KIND = { npc: ['farm-npc', 'купить у NPC'], craft: ['farm-craft', 'скрафтить'], forge: ['farm-craft', 'Forge'], drop: ['farm-drop', 'выбить'], shop: ['farm-npc', 'обменять у NPC'], other: ['farm-other', 'добыть'] };
const FARM_FILTER = [['all', 'Всё'], ['npc', 'У NPC'], ['craft', 'Крафт'], ['drop', 'Выбить']];
const farmGroup = k => (k === 'shop' ? 'npc' : k === 'forge' ? 'craft' : k);
export const farmSkipKey = id => `f:${String(id).replace(/;/g, '.')}`;

function FarmPlan({ state, data, mode, change, error, onStep, label }) {
  const { openItem } = useApp();
  const [f, setF] = useState('all');
  const rows = data.rows || [];
  const list = rows.filter(r => f === 'all' || farmGroup(r.source?.kind) === f);
  const doneN = data.done?.length || 0;
  const edit = mode !== 'none';
  return (
    <div className="cart farm" data-news="farm">
      <div className="cart-top">
        <div className="cart-budget">
          <div className="cart-budget-row">
            <span className="small">Собрано <b>{doneN}</b> из {data.total || 0}{data.lack ? ` · для крафта не хватает материалов: ${data.lack}` : ''}{data.ready ? ` · можно скрафтить сейчас: ${data.ready}` : ''}</span>
            <span className="chips cart-budget-sum">{FARM_FILTER.map(([k, l]) => <button key={k} className={f === k ? 'chip active' : 'chip'} onClick={() => setF(k)}>{l}</button>)}</span>
          </div>
          <div className="cart-bar"><div className="cart-bar-fill" style={{ width: `${data.total ? Math.min(100, doneN / data.total * 100) : 0}%` }} /></div>
          <div className="cart-bar-legend tiny muted"><span>{label}: Bazaar и аукциона нет</span><span>монеты нужны только у NPC: {coins(data.coins || 0)}</span></div>
        </div>
        {edit && <CartAdd onAdd={(id, qty) => change({ add: id, qty })} />}
      </div>
      {list.length ? (
        <ol className="cart-list">{list.map((p, i) => {
          const src = p.source || {};
          const [cls, kindRu] = FARM_KIND[src.kind] || FARM_KIND.other;
          const ready = src.parts?.length && src.parts.every(x => x.have >= x.need);
          const lack = (src.parts || []).filter(x => x.have < x.need).length;
          return (
            <li key={p.kind + p.id} className="cart-row" onClick={() => openItem(p.id)} title="Открыть предмет: где взять пошагово">
              <span className="cart-n">{i + 1}</span>
              <span className="cart-ico"><ItemIcon id={p.id} size={32} /></span>
              <span className="cart-main">
                <span className="cart-title">{p.name}{p.qty > 1 && ` ×${num(p.qty)}`}{p.kind === 'item' && <span className="cart-own">своё</span>}{p.payoff && <span className="muted small"> · <Rich text={p.payoff} /></span>}</span>
                <span className="farm-how small muted"><span className={`farm-tag ${cls}`}>{kindRu}</span>{src.where && <span><Rich text={src.where} /></span>}{src.coords && <span className="farm-xyz">x, y, z: {src.coords}</span>}</span>
                {src.parts?.length > 0 && <span className="farm-parts small">{src.parts.map(x => <span key={x.id} className={x.have >= x.need ? 'green' : 'farm-lack'}>{x.name}: <b>{num(x.have)}</b> / {num(x.need)}</span>)}</span>}
                {p.stepId && <button className="farm-step tiny muted" onClick={e => { e.stopPropagation(); onStep(p.stepId); }}>шаг плана: <Rich text={p.stepTitle} /></button>}
              </span>
              <span className="cart-price">
                <b className={ready ? 'green' : ''}>{src.kind === 'npc' ? coins(src.coins) : ready ? 'всё есть' : lack ? `не хватает ${lack}` : p.have ? `${num(p.have)} / ${num(p.qty)}` : '—'}</b>
                <span className="small muted">{src.kind === 'npc' ? 'монет' : ready ? 'скрафти' : lack ? plural(lack, 'материала', 'материалов', 'материалов') : ''}</span>
              </span>
              {edit ? <button className="x-btn sm danger cart-x" title="Убрать из плана добычи" aria-label="Убрать из плана"
                onClick={e => { e.stopPropagation(); change(p.kind === 'item' ? { remove: p.id } : { skip: farmSkipKey(p.id), value: true }); }}>×</button> : <span />}
            </li>
          );
        })}</ol>
      ) : <Empty>{rows.length ? 'В этом фильтре пусто.' : 'Добывать по плану пока нечего.'}</Empty>}
      {error && <div className="step-undo small warn" role="alert">{error}</div>}
      {doneN > 0 && <div className="small green cart-bought">✔ Собрано: {data.done.map(b => b.name).join(' · ')}</div>}
      {data.skipped?.length > 0 && (
        <details className="hidden-steps">
          <summary className="small">Убрано из плана добычи ({data.skipped.length})</summary>
          <ul>{data.skipped.map(s => (
            <li key={s.id}><span>{s.name}</span><button className="chip tiny" onClick={() => change({ skip: farmSkipKey(s.id), value: false })}>вернуть</button></li>
          ))}</ul>
        </details>
      )}
      <p className="muted small plan-note">Список собирается из вещей в шагах плана, собранное уходит само.{edit ? <> Своё можно добавить и из карточки предмета.{mode === 'local' ? ' Правки видно только в этом браузере.' : ''}</> : ' Это чужой план: править его может только сам игрок.'}</p>
    </div>
  );
}

function PurchasePlan({ state, onStep }) {
  const { data, mode, change, error, loading } = usePurchaseCart(state);
  const { openItem } = useApp();
  const [budgetText, setBudgetText] = useProfileStore('sb-cart-budget', '');
  if (data?.farm) return <FarmPlan state={state} data={data} mode={mode} change={change} error={error} onStep={onStep} label={state.member?.mode?.label || 'Ironman'} />;
  const plan = state.analysis?.plan;
  const stepById = useMemo(() => new Map((state.analysis?.roadmap || []).map(s => [s.id, s])), [state.analysis?.roadmap]);
  if (!data && loading) return <div className="muted small"><div className="spinner" />Считаю план покупок…</div>;
  // Сервер не ответил — показываем план как есть, без правок
  const rows = data?.rows || (plan || []).map(p => ({ kind: 'step', ...p }));
  const liquid = data?.liquid > 0 ? Math.round(data.liquid) : 0;
  // Пустое поле — считаем от монет, что есть сейчас (кошелёк + банк)
  const typed = parseCoins(budgetText);
  const budget = typed || (budgetText ? null : liquid || null);
  const fit = budget ? fitBudget(rows, budget) : null;
  const total = rows.reduce((s, r) => s + (r.cost || 0), 0);
  const rowKey = p => (p.kind === 'item' ? 'i:' + p.id : p.stepId);
  const inBudget = p => fit?.take.has(rowKey(p));
  // «Что даст»: итог шага плана (payoff), иначе первое предложение объяснения
  const gives = p => { const st = stepById.get(p.stepId); return st?.payoff || (st?.why ? String(st.why).split(/(?<=\.)\s/)[0] : ''); };
  const edit = mode !== 'none' && !!data;
  const when = p => (inBudget(p) ? <span className="green">хватает</span>
    : !p.cost ? null
    : p.hoursOfFarming != null ? <span title="Столько часов лучшего заработка, чтобы накопить до этой строки">~{num(Math.ceil(p.hoursOfFarming))} ч</span>
    : <span>накопить</span>);
  const n = fit?.take.size || 0;
  return (
    <div className="cart" data-news="cart">
      {rows.length > 0 && (
        <div className="cart-top">
          <div className="cart-budget" data-news="budget">
            <div className="cart-budget-row">
              <label className="cart-budget-in">
                <span className="muted small">Бюджет</span>
                <input className="gsearch-input" value={budgetText} onChange={e => setBudgetText(e.target.value)} placeholder={liquid ? coins(liquid) : 'например, 70m'} aria-label="Бюджет в монетах" inputMode="decimal" />
              </label>
              {budgetText && <button className="chip tiny" onClick={() => setBudgetText('')}>{liquid ? 'сколько есть' : 'сбросить'}</button>}
              <span className="small cart-budget-sum">
                {budgetText && !typed ? <span className="muted">Не понял сумму: число, можно с k, m или b.</span>
                  : fit ? (n ? <>Хватает на <b>{n}</b> из {rows.length} · останется {coins(fit.left)}</> : <span className="muted">Пока ничего не хватает</span>)
                  : null}
              </span>
            </div>
            <div className="cart-bar" title={fit ? `${coins(fit.spent)} из ${coins(total)}` : ''}>
              <div className="cart-bar-fill" style={{ width: `${fit && total ? Math.max(fit.spent ? 1.5 : 0, Math.min(100, fit.spent / total * 100)) : 0}%` }} />
            </div>
            <div className="cart-bar-legend tiny muted"><span>{!budgetText && liquid ? 'монеты, что есть сейчас' : ''}</span><span>всё вместе: {coins(total)}</span></div>
          </div>
          {edit && <CartAdd onAdd={(id, qty) => change({ add: id, qty })} />}
        </div>
      )}
      {rows.length ? (
        <ol className="cart-list">{rows.map((p, i) => {
          const item = p.kind === 'item';
          const st = item ? null : stepById.get(p.stepId);
          const icon = item ? p.id : stepIcon(st);
          const g = item ? '' : gives(p);
          return (
            <li key={rowKey(p)} className={`cart-row ${inBudget(p) ? 'in-budget' : ''}`} onClick={() => (item ? openItem(p.id) : onStep(p.stepId))}
              title={item ? 'Открыть предмет: цена и где взять' : 'Открыть шаг плана: что именно и где взять'}>
              <span className="cart-n">{inBudget(p) ? '✓' : i + 1}</span>
              <span className="cart-ico">{icon ? <ItemIcon id={icon} size={32} /> : null}</span>
              <span className="cart-main">
                <span className="cart-title">{item ? <>{p.name}{p.qty > 1 && ` ×${num(p.qty)}`} <span className="cart-own">своё</span>{p.have > 0 && <span className="muted small"> · есть {num(p.have)}</span>}</> : <Rich text={p.title} />}</span>
                {g && <span className="cart-gives muted small"><Rich text={g} /></span>}
              </span>
              <span className="cart-price" title={p.cumulative ? `Нарастающим итогом: ${coins(p.cumulative)}` : ''}>
                <b>{p.cost ? coins(p.cost) : <span className="muted">нет цены</span>}</b>
                <span className="small muted">{when(p)}</span>
              </span>
              {edit ? <button className="x-btn sm danger cart-x" title={item ? 'Убрать из плана' : 'Не покупать: убрать из плана покупок'} aria-label="Убрать из плана"
                onClick={e => { e.stopPropagation(); change(item ? { remove: p.id } : { skip: p.stepId, value: true }); }}>×</button> : <span />}
            </li>
          );
        })}</ol>
      ) : <Empty>{plan?.length || data?.skipped?.length ? 'В плане покупок пусто.' : 'План покупок появится, когда загрузятся цены Bazaar и аукциона.'}</Empty>}
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
      <p className="muted small plan-note">
        Список собирается из шагов плана с ценой, купленное уходит само.{' '}
        {edit ? <>Своё можно добавить и из карточки предмета.{mode === 'local' ? ' Правки видно только в этом браузере.' : ''}</> : mode === 'none' ? 'Это чужой план: править его может только сам игрок.' : ''}
      </p>
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
  const allCats = useMemo(() => [...new Map(allSteps.map(s => [catKey(s), s.cat])).entries()], [allSteps]);
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
      <Card className="span-12" title="Персональный план прогрессии" right={<Tabs value={view} onChange={setView} tabs={[{ id: 'steps', label: 'Шаги' }, { id: 'map', label: 'Карта прогрессии' }, { id: 'plan', label: state.member?.mode?.market === false ? 'План добычи' : 'План покупок' }]} />}>
        {a?.summary?.headline && <div className="plan-summary"><span aria-hidden="true">🎯</span><span><Rich text={a.summary.headline} />{a.summary.quickWins ? ` · быстрых побед: ${a.summary.quickWins}` : ''}</span></div>}
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
