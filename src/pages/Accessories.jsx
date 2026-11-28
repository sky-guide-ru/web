import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, Stat, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, RARITY_COLOR, RARITY_RU, friendlyError, usePart } from '../api.js';
import { useApp } from '../App.jsx';
import { Rich } from '../guides/Rich.jsx';

// «Аксессуары»: один блок — план «что сделать дальше» и список всех аксессуаров с общими фильтрами.
// Шаги плана, место в линейке, «что даёт» и «как получить» считает сервер (server/parse/acc-meta.js).
const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY SPECIAL'];
const STAT_L = { str: 'Strength', cd: 'Crit Damage', cc: 'Crit Chance', int: 'Intelligence', hp: 'Health', def: 'Defense', speed: 'Speed', atk: 'Attack Speed', mf: 'Magic Find', fish: 'Fishing', farm: 'Farming', mining: 'Mining', util: 'Особое' };
const HOW_L = { ah: 'Аукцион', bazaar: 'Bazaar', craft: 'Крафт', drop: 'Выбить', npc: 'NPC', da: 'Dark Auction' };
const KIND = { buy: ['Купить', '#22d3ee'], tier: ['Tier', '#f5c542'], recomb: ['Recomb', '#a78bfa'], enrich: ['Enrichment', '#4ade80'] };
const OWN = { all: 'Все', yes: 'Мои', no: 'Нет' };
const GAP = {
  tier: ['Не макс. tier', a => a.own && a.active && !!a.next],
  recomb: ['Без рекомба', a => a.own && a.canRecomb],
  enrich: ['Без enrichment', a => a.own && a.active && a.canEnrich && !a.enrichment],
  off: ['Не считается', a => a.own && !a.active],
};
const GROUPS = {
  none: ['Без групп', () => ''],
  rar: ['Редкость', a => RARITY_RU[a.rarity] || a.rarity],
  how: ['Как получить', a => HOW_L[a.how] || '—'],
  stat: ['Что даёт', a => STAT_L[a.stat] || '—'],
  own: ['Есть / нет', a => (a.own ? 'Есть в сумке' : 'Ещё нет')],
};

// Цена шага: ползунок логарифмический 10 тыс…10 млрд, правый край — без верхней границы; в поле — любая сумма
const P2V = p => (p <= 0 ? 0 : p >= 100 ? Infinity : (v => { const e = 10 ** Math.floor(Math.log10(v)); return Math.round(v / e * 2) / 2 * e; })(10 ** (4 + 6 * p / 100)));
const V2P = v => (!v ? 0 : v === Infinity ? 100 : Math.max(1, Math.min(99, Math.round((Math.log10(v) - 4) * 100 / 6))));
// «5m», «300к», «1,5 млрд», «2000000» → монеты; число без единиц меньше 1000 — миллионы
function parseCoins(s) {
  s = String(s || '').toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  // «2,500,000» и «1.000.000» — разделители тысяч, иначе запятая — десятичная («1,5 млрд»)
  s = /^\d{1,3}([.,]\d{3}){2,}$/.test(s) ? s.replace(/[.,]/g, '') : s.replace(',', '.');
  const m = s.match(/^([\d.]+)(млрд|b|bn|kkk|млн|m|kk|м|тыс|k|к|т)?$/);
  if (!m || Number.isNaN(+m[1])) return NaN;
  const n = +m[1], u = m[2] || '';
  if (/^(млрд|b|bn|kkk)$/.test(u)) return n * 1e9;
  if (/^(млн|m|kk|м)$/.test(u)) return n * 1e6;
  if (/^(тыс|k|к|т)$/.test(u)) return n * 1e3;
  return n >= 1000 ? n : n * 1e6;
}
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('acc:' + k)); localStorage.setItem('acc:' + k, JSON.stringify(v)); } catch { return null; } return null; };
const perMp = s => (s.gain > 0 && s.cost ? s.cost / s.gain : Infinity);
const Bdg = ({ k, label }) => <span className="badge" style={{ '--badge': KIND[k][1] }}>{label || KIND[k][0]}</span>;
// Длинная цепочка ступеней (Campfire и т. п.) сжимается: 3 последние цветные, одна серая, «+N» и «21/30».
// Полная цепочка — во всплывашке по наведению или нажатию, по 10 точек в ряд.
const DOTS_FULL = 5;
const Dots = ({ t, count = true }) => {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  // Подсказка привязана к экрану: при прокрутке прячем, чтобы не висела над чужой строкой
  useEffect(() => {
    if (!pos) return undefined;
    const hide = () => setPos(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [pos]);
  if (!t) return null;
  const [done, all] = t, left = Math.max(all - done, 0);
  const full = <>{'●'.repeat(done)}<i>{'●'.repeat(left)}</i></>;
  if (all <= DOTS_FULL) return <span className="dots" title={`tier ${done} из ${all}`}>{full}</span>;
  const more = Math.max(left - 1, 0);
  // Подсказка — поверх всего (портал в body): над точками, а если сверху нет места — под ними.
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.top > 96;
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124), y: up ? r.top - 8 : r.bottom + 8, up });
  };
  return (
    <span ref={ref} className="dots dots-s" tabIndex={0} aria-label={`tier ${done} из ${all}`}
      onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}
      onClick={e => { e.stopPropagation(); pos ? setPos(null) : show(); }}>
      {'●'.repeat(Math.min(done, 3))}{left > 0 && <i>●</i>}{more > 0 && <em>+{more}</em>}{count && <b>{done}/{all}</b>}
      {pos && createPortal(
        <span className={`dots dots-pop${pos.up ? '' : ' down'}`} role="tooltip" style={{ left: pos.x, top: pos.y }}><small>tier {done} из {all}</small>
          <span className="dots-grid">{Array.from({ length: all }, (_, k) => k < done ? <span key={k}>●</span> : <i key={k}>●</i>)}</span></span>,
        document.body)}
    </span>);
};

function MoneyField({ label, value, onChange, placeholder }) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const shown = focus ? text : (value && value !== Infinity ? coins(value) : '');
  const v = parseCoins(text);
  return (
    <label>{label}<input inputMode="decimal" placeholder={placeholder} value={shown} className={focus && Number.isNaN(v) ? 'bad' : ''}
      onFocus={() => { setFocus(true); setText(value && value !== Infinity ? coins(value).replace(/ /g, ' ') : ''); }}
      onBlur={() => setFocus(false)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      onChange={e => { setText(e.target.value); const n = parseCoins(e.target.value); if (!Number.isNaN(n)) onChange(n); }} /></label>
  );
}

export default function Accessories({ state, sub }) {
  const { openItem } = useApp();
  const acc = usePart(state, 'acc', state.analysis?.acc); // полный список — отдельным куском при открытии раздела
  const m = state.member;
  const [pane, setPaneRaw] = useState(() => (sub === 'norecomb' ? 'list' : LS('pane') || 'plan'));
  const setPane = p => { setPaneRaw(p); LS('pane', p); };
  const [F, setF] = useState(() => ({ own: sub === 'norecomb' ? 'yes' : 'all', gap: sub === 'norecomb' ? ['recomb'] : [], rar: [], stat: [], how: [], pmin: 0, pmax: Infinity, q: '' }));
  // Без своего бюджета — все монеты игрока (кошелёк и оба Bank), как в плане; 150 млн, только если монет не видно
  const [budget, setBudgetRaw] = useState(() => {
    const saved = LS('budget');
    if (saved != null && saved !== 150e6) return saved; // ровно 150 млн раньше сохранялись сами — это не выбор игрока
    return ((m?.purse || 0) + (m?.bank || 0) + (m?.personalBank || 0)) || 150e6;
  });
  const [view, setViewRaw] = useState(() => LS('view') || 'table');
  const [grp, setGrpRaw] = useState(() => LS('grp') || 'none');
  const [sort, setSort] = useState({ k: 'next', asc: true });
  const [sheet, setSheet] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [allIn, setAllIn] = useState(false);
  const [grpOpen, setGrpOpen] = useState(false);
  // На телефоне фильтры — нижняя шторка: выносим её в body, иначе fixed считается от карточки
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(max-width: 900px)'), on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => { if (sub === 'norecomb') { setF(f => ({ ...f, own: 'yes', gap: ['recomb'] })); setPaneRaw('list'); } }, [sub]);
  // Сохраняем только бюджет, заданный руками: иначе монеты одного игрока становились бюджетом для всех профилей
  const setBudget = v => { setBudgetRaw(v); LS('budget', v === Infinity ? null : v); };

  // Все аксессуары: свои + недостающие (одна строка на семейство — с наибольшим +MP)
  const rows = useMemo(() => {
    if (!acc) return [];
    const stepBy = new Map();
    for (const s of acc.steps || []) if (!stepBy.has(s.id) && (s.gain > 0 || s.kind === 'enrich')) stepBy.set(s.id, s);
    const own = (acc.list || []).map(a => ({ ...a, own: true, step: stepBy.get(a.id) || null }));
    const best = new Map();
    for (const r of acc.missing || []) {
      if (r.upgradeFrom) continue; // апгрейд своего — это «Не макс. tier» у своего аксессуара
      const key = r.fk || r.id;
      const cur = best.get(key);
      if (!cur || r.gain > cur.gain || (r.gain === cur.gain && (r.price || Infinity) < (cur.price || Infinity))) best.set(key, r);
    }
    const miss = [...best.values()].map(r => ({ ...r, own: false, active: false, mp: 0, step: { kind: 'buy', cost: r.price || null, gain: r.gain } }));
    return [...own, ...miss];
  }, [acc]);
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);

  const priceOn = F.pmin > 0 || F.pmax < Infinity;
  const q = F.q.trim().toLowerCase();
  const pass = (a, skip) => (!q || a.name.toLowerCase().includes(q))
    && (skip === 'own' || F.own === 'all' || (F.own === 'yes') === a.own)
    && (skip === 'gap' || F.gap.every(k => GAP[k][1](a)))
    && (skip === 'rar' || !F.rar.length || F.rar.includes(a.rarity))
    && (skip === 'stat' || !F.stat.length || F.stat.includes(a.stat))
    && (skip === 'how' || !F.how.length || F.how.includes(a.how))
    && (skip === 'price' || !priceOn || (a.step?.cost > 0 && a.step.cost >= F.pmin && a.step.cost <= F.pmax));
  const count = (skip, test) => rows.reduce((n, a) => n + (pass(a, skip) && test(a) ? 1 : 0), 0);
  const toggle = (k, v) => setF(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));
  const reset = () => setF({ own: 'all', gap: [], rar: [], stat: [], how: [], pmin: 0, pmax: Infinity, q: '' });

  // Фильтр не двигает страницу: пока блок прокручен вверх, он не становится ниже, чем был
  const lay = useRef(null);
  const lastH = useRef(0);
  const [toList, setToList] = useState(false);
  useLayoutEffect(() => {
    const L = lay.current; if (!L) return;
    if (L.getBoundingClientRect().top < 0 && lastH.current) L.style.minHeight = Math.max(lastH.current, parseFloat(L.style.minHeight) || 0) + 'px';
    lastH.current = L.offsetHeight;
  });
  useEffect(() => {
    const on = () => {
      const L = lay.current; if (!L) return;
      if (L.style.minHeight && L.getBoundingClientRect().top >= 0) { L.style.minHeight = ''; lastH.current = L.offsetHeight; }
      const last = L.querySelector('.acc-end')?.getBoundingClientRect();
      setToList(!!(L.style.minHeight && last && last.bottom < innerHeight * 0.4));
    };
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  if (!acc) return <div className="muted small"><div className="spinner" />Загружаю аксессуары…</div>;
  if (acc.hidden) {
    return (
      <Card className="span-12" title="Аксессуары не видны">
        <p><Rich text="У игрока выключен Inventory API, поэтому содержимое Accessory Bag неизвестно и план покупок не строится. Включить: SkyBlock Menu → Settings → API Settings → Inventory API, затем подождать пару минут." /></p>
        {m.magicalPower > 0 && <p className="muted small"><Rich text={`Наибольший Magical Power за всё время — ${num(m.magicalPower)}, сейчас он может быть меньше.`} /></p>}
      </Card>);
  }
  const noPrices = !(acc.steps || []).some(s => s.cost > 0);

  // ---- план: шаги под те же фильтры, что и список; «Что не доделано» выбирает виды шагов ----
  const kinds = F.gap.length ? F.gap : null;
  const planSteps = (acc.steps || []).filter(s => {
    if (!s.cost || s.cost < F.pmin || s.cost > F.pmax) return false;
    const a = byId.get(s.id) || { name: s.name, rarity: s.rarity, how: s.how, stat: s.stat, own: false, active: false };
    if (!pass(a, 'price')) return false;
    return kinds ? kinds.includes(s.kind) : s.kind !== 'enrich';
  });
  let spent = 0, gain = 0, tun = 0;
  const inB = [], outB = [];
  for (const s of planSteps) { if (spent + s.cost <= budget) { spent += s.cost; gain += s.gain; tun += s.tuning || 0; inB.push({ s, spent }); } else outB.push(s); }
  const recs = inB.filter(r => r.s.kind === 'recomb');
  const mp = m.magicalPower || acc.calculatedMp || 0;

  const howText = s => (s.kind === 'buy' ? (HOW_L[byId.get(s.id)?.how || s.how] || '') : s.kind === 'tier' ? `из ${s.from}` : s.kind === 'recomb' ? `Recombobulator 3000 · ${RARITY_RU[s.rarity]} → ${RARITY_RU[s.to]}` : 'Accessory Enrichment');
  const PlanRow = ({ s, fits, total }) => (
    <div className={`pl-row ${fits ? 'in' : 'out'}`} onClick={() => openItem(s.target || s.id)} role="button" tabIndex={0}>
      <ItemIcon id={s.target || s.id} size={28} />
      <div className="pl-what"><Bdg k={s.kind} /> <span className="pl-n" style={{ color: RARITY_COLOR[s.rarity] }}>{s.name}</span>
        <div className="muted tiny">{howText(s)}{s.req && <> · <span className="red">крафт после: {s.req}</span></>}</div></div>
      <div className="pl-g">{s.gain ? <b className="gold">+{s.gain} MP</b> : <b className="green">+1 Tuning</b>}<div className="muted tiny">{s.gain ? `${coins(s.cost / s.gain)} за 1 MP` : 'очко Stats Tuning'}</div></div>
      <div className="pl-c"><b>{coins(s.cost)}</b>{fits && total != null && <div className="muted tiny">итого {coins(total)}</div>}</div>
    </div>
  );
  const planList = [];
  let recDone = false;
  for (const r of inB) {
    if (r.s.kind === 'recomb' && recs.length > 1) {
      if (recDone) continue;
      recDone = true;
      const sg = recs.reduce((x, q2) => x + q2.s.gain, 0), sc = recs.reduce((x, q2) => x + q2.s.cost, 0);
      planList.push(
        <div key="recgrp" className="pl-row in pl-grp" onClick={() => setRecOpen(o => !o)} role="button" tabIndex={0} aria-expanded={recOpen}>
          <ItemIcon id="RECOMBOBULATOR_3000" size={28} />
          <div className="pl-what"><Bdg k="recomb" /> <span className="pl-n">Recombobulator 3000 ×{recs.length}</span>
            <div className="muted tiny">{recOpen ? 'свернуть ▴' : recs.slice(0, 3).map(q2 => q2.s.name).join(', ') + (recs.length > 3 ? ` и ещё ${recs.length - 3} ▾` : ' ▾')}</div></div>
          <div className="pl-g"><b className="gold">+{sg} MP</b><div className="muted tiny">{coins(sc / sg)} за 1 MP</div></div>
          <div className="pl-c"><b>{coins(sc)}</b><div className="muted tiny">{coins(recs[0].s.cost)} за штуку</div></div>
        </div>);
      if (recOpen) planList.push(<div key="recsub" className="pl-sub">{recs.map(q2 => <PlanRow key={'r' + q2.s.id} s={q2.s} fits />)}</div>);
      continue;
    }
    planList.push(<PlanRow key={r.s.kind + r.s.id} s={r.s} fits total={r.spent} />);
  }

  // ---- список ----
  const nextOf = a => a.step;
  const COLS = [
    { id: 'tier', l: 'Tier', cls: 'c-tier', sort: a => (a.tier ? a.tier[0] - a.tier[1] : 0), cell: a => <Dots t={a.tier} /> },
    { id: 're', l: 'Улучшения', cls: 'c-re', cell: a => {
      if (!a.own || !a.active) return null;
      const R = a.recomb ? 'y' : a.canRecomb ? 'n' : null, E = !a.canEnrich ? null : a.enrichment ? 'y' : 'n';
      return <span className="re">{R && <span className={R}>{R === 'y' ? '✓' : '✗'} Recomb</span>}{E && <span className={E}>{E === 'y' ? '✓' : '✗'} Enrich</span>}</span>;
    } },
    { id: 'how', l: 'Как получить', cls: 'c-src', sort: a => HOW_L[a.how] || '', cell: a => <span className="badge">{HOW_L[a.how] || '—'}</span> },
    { id: 'mp', l: 'MP', cls: 'c-mp gold keep', sort: a => -(a.mp || 0), cell: a => a.mp || '—' },
    { id: 'next', l: 'Дальше', cls: 'c-next keep', sort: a => (a.step ? perMp(a.step) : Infinity), cell: a => {
      const s = nextOf(a);
      if (!a.own) return <>{s.cost ? coins(s.cost) : <span className="muted">цены нет</span>} <span className="gold">+{s.gain}</span></>;
      if (!a.active) return <span className="muted">{a.sellable === false ? 'не считается, продать нельзя' : 'не считается, можно продать'}</span>;
      if (!s) return <span className="green">✓ готово</span>;
      return <><Bdg k={s.kind} /> {s.kind === 'tier' ? `→ ${s.name} ` : ''}{s.cost ? coins(s.cost) : ''} {s.gain ? <span className="gold">+{s.gain}</span> : <span className="green">+1 Tuning</span>}</>;
    } },
  ];
  const list = rows.filter(a => pass(a));
  const sk = sort.k === 'name' ? (a => a.name) : COLS.find(c => c.id === sort.k)?.sort || (() => 0);
  list.sort((x, y) => { const a = sk(x), b = sk(y); const r = typeof a === 'string' ? a.localeCompare(b) : a - b; return sort.asc ? r : -r; });
  const gk = GROUPS[grp]?.[1] || GROUPS.none[1];
  if (grp !== 'none') list.sort((x, y) => gk(x).localeCompare(gk(y)));
  const th = (id, l, cls = '') => <th key={id} className={`sortable ${cls} ${sort.k === id ? 'on' + (sort.asc ? '' : ' asc') : ''}`} onClick={() => setSort(s => ({ k: id, asc: s.k === id ? !s.asc : true }))}>{l}</th>;
  const tableRows = [], cards = [];
  let last = null;
  for (const a of list) {
    const g = gk(a);
    if (grp !== 'none' && g !== last) { tableRows.push(<tr key={'g' + g} className="grp"><td colSpan={COLS.length + 2}>{g}</td></tr>); cards.push(<h5 key={'g' + g}>{g}</h5>); last = g; }
    tableRows.push(
      <tr key={a.id} className={`clickable-row ${a.own ? '' : 'miss'}`} onClick={() => openItem(a.id)}>
        <td className="c-ico keep"><ItemIcon id={a.id} size={28} /></td>
        <td className="nm keep" style={{ color: RARITY_COLOR[a.rarity] }}>{a.name}{a.req && !a.own && <div className="acc-req">крафт после: {a.req}</div>}</td>
        {COLS.map(c => <td key={c.id} className={c.cls}>{c.cell(a)}</td>)}
      </tr>);
    const s = a.step;
    cards.push(
      <div key={a.id} className={`acc-card ${a.own ? '' : 'miss'}`} onClick={() => openItem(a.id)} role="button" tabIndex={0}>
        <div className="acc-ch"><ItemIcon id={a.id} size={36} /><div className="acc-cn"><div className="acc-name" style={{ color: RARITY_COLOR[a.rarity] }}>{a.name}</div>
          <div className="acc-meta">{RARITY_RU[a.rarity]} · {HOW_L[a.how] || '—'} · {STAT_L[a.stat] || '—'}</div></div>
          <div className={`acc-cmp ${a.own && a.active ? '' : 'muted'}`}>{a.own && a.active ? a.mp : '—'}<small>MP</small></div></div>
        <div className="acc-cs">
          {a.tier && <span className="acc-pill"><Dots t={a.tier} count={false} /> tier {a.tier[0]}/{a.tier[1]}</span>}
          {a.own && a.active && (a.recomb ? <span className="acc-pill y">✓ Recomb</span> : a.canRecomb ? <span className="acc-pill n">✗ Recomb</span> : null)}
          {a.own && a.active && a.canEnrich && (a.enrichment ? <span className="acc-pill y">✓ Enrich</span> : <span className="acc-pill n">✗ Enrich</span>)}
          {!a.own && <span className="acc-pill">нет в сумке</span>}
          {a.own && !a.active && <span className="acc-pill">не считается</span>}
        </div>
        {a.req && !a.own && <div className="acc-req">Крафт после: {a.req}</div>}
        <div className="acc-cf">{s ? <><Bdg k={s.kind} label={s.kind === 'buy' ? 'Добавить' : null} /><span className="acc-ft">{s.kind === 'tier' ? s.name : s.kind === 'buy' ? HOW_L[a.how] : s.kind === 'recomb' ? 'Recombobulator' : ''}</span>
          <span className="acc-fp">{s.cost ? coins(s.cost) : ''}</span>{s.gain ? <span className="gold">+{s.gain} MP</span> : <span className="green">+1 Tuning</span>}</>
          : a.own && a.active ? <span className="green">✓ Всё сделано</span> : <span className="muted">{a.sellable === false ? 'продать нельзя' : 'можно продать'}</span>}</div>
      </div>);
  }

  const nFilters = (F.own !== 'all') + F.gap.length + F.rar.length + F.stat.length + F.how.length + (priceOn ? 1 : 0);
  const priceLabel = F.pmin > 0 && F.pmax < Infinity ? `${coins(F.pmin)} – ${coins(F.pmax)}` : F.pmin > 0 ? `от ${coins(F.pmin)}` : `до ${coins(F.pmax)}`;
  const active = [];
  if (F.own !== 'all') active.push(['own', '', OWN[F.own]]);
  for (const k of F.gap) active.push(['gap', k, GAP[k][0]]);
  for (const k of F.rar) active.push(['rar', k, RARITY_RU[k]]);
  for (const k of F.stat) active.push(['stat', k, STAT_L[k]]);
  for (const k of F.how) active.push(['how', k, HOW_L[k]]);
  if (priceOn) active.push(['price', '', priceLabel]);
  const unset = (f, v) => setF(x => (f === 'own' ? { ...x, own: 'all' } : f === 'price' ? { ...x, pmin: 0, pmax: Infinity } : { ...x, [f]: x[f].filter(y => y !== v) }));
  const quick = (gap) => { setF({ own: 'yes', gap: [gap], rar: [], stat: [], how: [], pmin: 0, pmax: Infinity, q: '' }); setPane('list'); lay.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const checks = (key, labels, testOf) => Object.entries(labels).map(([k, l]) => {
    const n = count(key, testOf(k));
    return <label key={k} className={n || F[key].includes(k) ? '' : 'off'}><input type="checkbox" checked={F[key].includes(k)} onChange={() => toggle(key, k)} />{l}<span className="n">{n}</span></label>;
  });
  const statsPresent = Object.fromEntries(Object.entries(STAT_L).filter(([k]) => rows.some(a => a.stat === k)));
  const howPresent = Object.fromEntries(Object.entries(HOW_L).filter(([k]) => rows.some(a => a.how === k)));
  const bp = V2P(budget);
  const side = (
          <aside className={`acc-side ${sheet ? 'open' : ''}`}>
              <div className="acc-sheet-head"><b>Фильтры</b><button className="acc-x" onClick={() => setSheet(false)} aria-label="Закрыть">×</button></div>
              <input className="search" placeholder="Название…" value={F.q} onChange={e => setF(f => ({ ...f, q: e.target.value }))} />
              <div className="acc-g"><div className="acc-gt">Показать</div><div className="acc-seg">
                {Object.entries(OWN).map(([k, l]) => <button key={k} className={F.own === k ? 'active' : ''} onClick={() => setF(f => ({ ...f, own: k }))}>{l} {count('own', a => k === 'all' || (k === 'yes') === a.own)}</button>)}
              </div></div>
              <div className="acc-g"><div className="acc-gt">Что не доделано</div><div className="acc-list">{checks('gap', Object.fromEntries(Object.entries(GAP).map(([k, v]) => [k, v[0]])), k => GAP[k][1])}</div></div>
              <div className="acc-g"><div className="acc-gt">Редкость</div><div className="acc-rar">
                {RARITIES.map(r => { const n = count('rar', a => a.rarity === r); return <button key={r} className={`${F.rar.includes(r) ? 'active' : ''}${n ? '' : ' off'}`} style={{ '--c': RARITY_COLOR[r] }} onClick={() => toggle('rar', r)}>{RARITY_RU[r]} <small>{n}</small></button>; })}
              </div></div>
              <div className="acc-g"><div className="acc-gt">Что даёт</div><div className="acc-list">{checks('stat', statsPresent, k => a => a.stat === k)}</div></div>
              <div className="acc-g"><div className="acc-gt">Как получить</div><div className="acc-list">{checks('how', howPresent, k => a => a.how === k)}</div></div>
              <div className="acc-g"><div className="acc-gt">Цена шага</div>
                <div className="acc-pr">
                  <div className="acc-prin">
                    <MoneyField label="от" placeholder="0" value={F.pmin} onChange={v => setF(f => ({ ...f, pmin: v || 0 }))} />
                    <MoneyField label="до" placeholder="без лимита" value={F.pmax} onChange={v => setF(f => ({ ...f, pmax: v == null ? Infinity : v }))} />
                  </div>
                  <div className="acc-range"><div className="acc-track"><i style={{ left: V2P(F.pmin) + '%', right: (100 - V2P(F.pmax)) + '%' }} /></div>
                    <input type="range" min="0" max="100" value={V2P(F.pmin)} aria-label="Цена от" onChange={e => setF(f => ({ ...f, pmin: P2V(Math.min(+e.target.value, V2P(f.pmax) - 1)) }))} />
                    <input type="range" min="0" max="100" value={V2P(F.pmax)} aria-label="Цена до" onChange={e => setF(f => ({ ...f, pmax: P2V(Math.max(+e.target.value, V2P(f.pmin) + 1)) }))} />
                  </div>
                  <div className="acc-prlim"><span>0</span><span>без лимита</span></div>
                </div></div>
              <button className="btn ghost small" onClick={reset}>Сбросить фильтры</button>
              <button className="btn acc-apply" onClick={() => { setSheet(false); lay.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>Показать {pane === 'plan' ? planSteps.length : list.length}</button>
            </aside>
  );

  return (
    <div className="grid">
      <div className="span-12 stats-row">
        <Stat label="Magical Power" value={num(mp)} sub="по данным игры" accent="#c879ff" icon={<img src="/api/texture/ender_eye" alt="" />} />
        <Stat label="В сумке" value={acc.count} sub={`${rows.filter(a => !a.own).length} ещё нет`} accent="#60a5fa" icon={<img src="/api/texture/leather" alt="" />} />
        <Stat label="Без рекомба" href="#/accessories/norecomb" title="Показать аксессуары без Recombobulator" value={acc.notRecombCount} sub={acc.recombPrice ? `рекомб ~${coins(acc.recombPrice)}` : ''} accent="#a78bfa" icon={<img src="/api/texture/nether_star" alt="" />} />
        <a className="stat stat-link" style={{ '--stat-accent': '#f5c542' }} href="#/accessories" onClick={e => { e.preventDefault(); quick('tier'); }}>
          <div><div className="stat-label">Не макс. tier</div><div className="stat-value">{rows.filter(GAP.tier[1]).length}</div><div className="stat-sub">есть старшая версия</div></div></a>
      </div>

      <section className="card span-12" data-news="acc-planner">
        <header className="card-head">
          <div className="tabs acc-tabs">
            <button className={pane === 'plan' ? 'active' : ''} onClick={() => setPane('plan')}>Что сделать дальше</button>
            <button className={pane === 'list' ? 'active' : ''} onClick={() => setPane('list')}>Все аксессуары <small>{list.length}</small></button>
          </div>
          <span className="muted small">{list.length} из {rows.length}</span>
        </header>
        <div className="acc-lay" ref={lay}>
          {narrow ? createPortal(<>{side}{sheet && <div className="acc-back" onClick={() => setSheet(false)} />}</>, document.body) : side}
          <div className="acc-main">
            <div className="acc-mbar">
              <button className="btn ghost small acc-open" onClick={() => setSheet(true)}>{nFilters ? `Фильтры · ${nFilters}` : 'Фильтры'}</button>
              <div className="acc-active">{active.map(([f, k, l]) => <button key={f + k} onClick={() => unset(f, k)}>{l} ×</button>)}{active.length > 0 && <button className="clr" onClick={reset}>Сбросить</button>}</div>
            </div>
            {pane === 'plan' ? (
              <div>
                <div className="pl-top">
                  <div className="pl-box"><div className="acc-gt">Бюджет</div>
                    <div className="acc-pr"><div className="acc-prin one"><MoneyField label="до" placeholder="без лимита" value={budget} onChange={v => setBudget(v == null ? Infinity : v)} /></div>
                      <div className="acc-range"><div className="acc-track"><i style={{ left: 0, right: (100 - bp) + '%' }} /></div>
                        <input type="range" min="0" max="100" value={bp} aria-label="Бюджет" onChange={e => setBudget(P2V(+e.target.value))} /></div>
                      <div className="acc-prlim"><span>0</span><span>без лимита</span></div></div></div>
                  <div className="pl-res">{inB.length ? <>
                    <div><span className="muted small">Magical Power</span><b>{num(mp)} → <span className="gold">{num(mp + gain)}</span></b></div>
                    <div><span className="muted small">Потратить</span><b>{coins(spent)}</b></div>
                    <div><span className="muted small">Шагов</span><b>{inB.length}{tun ? <small className="green"> · +{tun} Tuning</small> : null}</b></div>
                  </> : <span className="muted small">{noPrices ? '' : 'На эту сумму ничего не купить.'}</span>}</div>
                </div>
                <div className="muted tiny pl-hint"><Rich text="Порядок — по цене за 1 MP. Фильтры сужают план: например, «Без рекомба» оставит только Recombobulator, «Без enrichment» — только Accessory Enrichment." /></div>
                {noPrices ? <Empty>{state.pricesAt?.auctionsError && !state.pricesAt?.auctions
                  ? `Не удалось загрузить аукцион: ${friendlyError(state.pricesAt.auctionsError)}. Сервер попробует снова через 3 минуты.`
                  : 'Цены аукциона ещё загружаются (полный скан занимает 1–2 минуты).'} Список аксессуаров без цен — на вкладке «Все аксессуары».</Empty>
                  : <div className="pl-list">
                    {allIn ? planList : planList.slice(0, 15)}
                    {planList.length > 15 && <button className="btn ghost small pl-more" onClick={() => setAllIn(v => !v)}>{allIn ? 'Свернуть' : `Все шаги в бюджете: ${inB.length}`}</button>}
                    {outB.length > 0 && <>
                      <div className="pl-sep">Дальше не хватает бюджета: нужно ещё {coins(spent + outB[0].cost - budget)}</div>
                      {outB.slice(0, more ? 999 : 3).map(s => <PlanRow key={'o' + s.kind + s.id} s={s} fits={false} />)}
                      {outB.length > 3 && <button className="btn ghost small pl-more" onClick={() => setMore(v => !v)}>{more ? 'Свернуть' : `Показать ещё ${outB.length - 3}`}</button>}
                    </>}
                    {!planSteps.length && <div className="muted small" style={{ padding: 12 }}>Под эти фильтры шагов нет.</div>}
                  </div>}
                <div className="acc-end" />
              </div>
            ) : (
              <div>
                <div className="acc-tools">
                  <div className="acc-dd">
                    <button className="chip" onClick={() => setGrpOpen(o => !o)} aria-expanded={grpOpen}>Группы: <b>{GROUPS[grp][0]}</b> ▾</button>
                    {grpOpen && <div className="acc-pop" onMouseLeave={() => setGrpOpen(false)}>
                      {Object.entries(GROUPS).map(([k, v]) => <button key={k} className={grp === k ? 'active' : ''} onClick={() => { setGrpRaw(k); LS('grp', k); setGrpOpen(false); }}>{grp === k ? '✓ ' : ''}{v[0]}</button>)}
                    </div>}
                  </div>
                  <div className="acc-seg acc-view">
                    {[['table', 'Таблица'], ['cards', 'Карточки']].map(([k, l]) => <button key={k} className={view === k ? 'active' : ''} onClick={() => { setViewRaw(k); LS('view', k); }}>{l}</button>)}
                  </div>
                </div>
                {!list.length ? <Empty>Ничего не подошло.</Empty> : view === 'table' ? (
                  <div className="table-scroll"><table className="table acc-t">
                    <thead><tr><th />{th('name', 'Аксессуар')}{COLS.map(c => (c.sort ? th(c.id, c.l, c.cls.includes('c-src') ? 'acc-srch' : '') : <th key={c.id}>{c.l}</th>))}</tr></thead>
                    <tbody>{tableRows}</tbody>
                  </table></div>
                ) : <div className="acc-cards">{cards}</div>}
                <div className="acc-end" />
              </div>
            )}
            {toList && <button className="acc-tolist" onClick={() => lay.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>↑ Найдено {pane === 'plan' ? planSteps.length : list.length} — к началу</button>}
          </div>
        </div>
      </section>

      <Card className="span-12" title="Maxwell" news="maxwell">
        <div className="muted small"><Rich text="Раздел про силы Maxwell и Stats Tuning появится позже." /></div>
      </Card>
    </div>
  );
}
