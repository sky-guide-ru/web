import { LOCALE, DEC } from '../i18n.js';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, Tabs, Empty, Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, useApi, api, useHashTab, saveLocal, friendlyError, useProfileStore, getView } from '../api.js';
import { useApp } from '../App.jsx';
import { BankTab, BitsTab } from './Wealth.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx'; // «подсказки по тексту», как в гайдах

// ---------- общие помощники вкладки ----------

/** Фильтр, который запоминается в браузере: не нужно выставлять заново при каждом заходе */
function useStored(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem('sb-money-' + key); return s == null ? init : JSON.parse(s); } catch { return init; }
  });
  const set = x => { setV(x); saveLocal('sb-money-' + key, JSON.stringify(x)); };
  return [v, set];
}

const PRICE_BANDS = [
  ['', 'Любая цена'], ['0-100000', 'до 100 тыс.'], ['0-1000000', 'до 1 млн'], ['0-10000000', 'до 10 млн'],
  ['0-100000000', 'до 100 млн'], ['1000000-100000000', '1–100 млн'], ['100000000-', 'от 100 млн'],
];
const inBand = (v, band) => {
  if (!band) return true;
  const [lo, hi] = band.split('-').map(x => (x === '' ? null : Number(x)));
  return (lo == null || v >= lo) && (hi == null || v <= hi);
};
const pct = (v, d = 1) => (v == null || isNaN(v) ? '—' : `${v.toFixed(d).replace('.', DEC)}%`);
const lc = s => String(s || '').toLowerCase();
const RISK_CLS = { низкий: 'low', средний: 'mid', высокий: 'high', low: 'low', mid: 'mid', high: 'high' };

/** Чипы категорий с количеством: «Все 40 · Farming 12 · Добыча 7…» */
function CatChips({ rows, value, onChange, field = 'category', allLabel = 'Все' }) {
  const counts = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) { const c = r[field] || 'Прочее'; m.set(c, (m.get(c) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, field]);
  if (counts.length < 2) return null;
  return (
    <div className="chips mt-chips" role="group" aria-label="Категория">
      <button className={`chip ${!value ? 'active' : ''}`} onClick={() => onChange('')}>{allLabel} <span className="mt-count">{rows.length}</span></button>
      {counts.map(([c, n]) => <button key={c} className={`chip ${value === c ? 'active' : ''}`} onClick={() => onChange(value === c ? '' : c)}>{c} <span className="mt-count">{n}</span></button>)}
    </div>
  );
}

function Pick({ label, value, onChange, options }) {
  return (
    <label className="mt-pick"><span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}

function Toggle({ checked, onChange, children }) {
  return <label className="mt-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{children}</label>;
}

/**
 * Таблица с сортировкой по любому столбцу и раскрывающимися строками.
 * cols: { key, label, sort?: row => число|строка (по умолчанию row[key]), render?: row => узел, cls?, title?, nosort? }
 * Клик по заголовку: по убыванию → по возрастанию → как было. На телефоне — выпадающий список сортировки.
 */
function SortTable({ cols, rows, rowKey, expand, storeKey, empty = 'Ничего не подходит под фильтры.' }) {
  const [sort, setSort] = useStored('sort-' + storeKey, null); // { key, dir }
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find(c => c.key === sort.key);
    if (!col) return rows;
    const get = col.sort || (r => r[col.key]);
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (typeof x === 'string' || typeof y === 'string') return String(x ?? '').localeCompare(String(y ?? ''), LOCALE) * sort.dir;
      return ((x ?? -Infinity) - (y ?? -Infinity)) * sort.dir || 0;
    });
  }, [rows, sort, cols]);
  const isText = key => { const c = cols.find(x => x.key === key); return c?.text; };
  const click = key => setSort(!sort || sort.key !== key ? { key, dir: isText(key) ? 1 : -1 } : sort.dir === (isText(key) ? 1 : -1) ? { key, dir: -sort.dir } : null);
  const sortable = cols.filter(c => !c.nosort && c.label);
  return (
    <>
      <label className="bz-sort-m muted small">Сортировка:{' '}
        <select value={sort ? `${sort.key}:${sort.dir}` : ''} onChange={e => { const [key, dir] = e.target.value.split(':'); setSort(key ? { key, dir: Number(dir) } : null); }}>
          <option value="">как советует сайт</option>
          {sortable.flatMap(c => c.text
            ? [<option key={c.key + '1'} value={`${c.key}:1`}>{c.label}: А→Я</option>]
            : [<option key={c.key + '-1'} value={`${c.key}:-1`}>{c.label}: больше</option>, <option key={c.key + '1'} value={`${c.key}:1`}>{c.label}: меньше</option>])}
        </select>
      </label>
      {!sorted.length ? <Empty>{empty}</Empty> : (
        <div className="table-wrap">
          <table className="table mt">
            <thead><tr>
              {expand && <th aria-label="Подробнее" />}
              {cols.map(c => c.nosort || !c.label
                ? <th key={c.key} className={c.cls} title={c.title}>{c.label}</th>
                : <th key={c.key} className={`sortable ${c.cls || ''}`} title={c.title || 'Сортировать'} onClick={() => click(c.key)} aria-sort={sort?.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                    {c.label}{sort?.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                  </th>)}
            </tr></thead>
            <tbody>{sorted.map(r => {
              const k = rowKey(r);
              const isOpen = open === k;
              return (
                <Fragment key={k}>
                  <tr className={`clickable-row ${isOpen ? 'mt-open' : ''}`} onClick={() => expand && setOpen(isOpen ? null : k)} aria-expanded={expand ? isOpen : undefined}>
                    {expand && <td className="mt-chev" aria-hidden="true">{isOpen ? '▾' : '▸'}</td>}
                    {cols.map(c => <td key={c.key} className={c.cls} data-label={c.label || undefined}>{c.render ? c.render(r) : r[c.key]}</td>)}
                  </tr>
                  {isOpen && <tr className="mt-detail"><td colSpan={cols.length + 1}>{expand(r)}</td></tr>}
                </Fragment>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Ячейка «иконка + название»: клик по ним открывает карточку предмета, а не раскрывает строку */
function ItemCell({ id, name, sub, openItem }) {
  return (
    <span className="mt-item">
      <button className="mt-item-btn" onClick={e => { e.stopPropagation(); openItem(id); }} title="Открыть карточку предмета"><ItemIcon id={id} size={30} /></button>
      <span className="mt-item-name"><button className="link-btn" onClick={e => { e.stopPropagation(); openItem(id); }}>{name}</button>{sub && <span className="muted tiny">{sub}</span>}</span>
    </span>
  );
}

function Count({ shown, total }) {
  return <div className="muted tiny mt-shown">Показано {shown} из {total}. Нажми на строку, чтобы раскрыть подробности; на название — чтобы открыть предмет.</div>;
}

// ---------- Культуры ----------

function Crops() {
  // Farming Fortune запоминается: не нужно двигать ползунок при каждом заходе
  // Свой Fortune у каждого профиля: ползунок соседа не меняет твой расчёт
  const [ffRaw, setFfStored] = useProfileStore('sb-farming-fortune', 1800);
  const ff = Number(ffRaw) || 1800;
  // Значение уходит и на сервер: по нему считаются «Методы» и советы о заработке (иначе там грубая оценка).
  // Только для своего профиля: на сервере это настройка владельца
  const setFf = v => {
    setFfStored(v);
    if (getView()) return;
    clearTimeout(setFf.t);
    setFf.t = setTimeout(() => api('/market/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmingFortune: v }) }).catch(() => {}), 600);
  };
  const { data } = useApi(`/market/crops?fortune=${ff}`, [], { keep: true });
  const max = data?.length ? Math.max(...data.map(c => c.perHour || 0)) || 1 : 1;
  return (
    <>
      <div className="budget">
        <span>Твоя Farming Fortune:</span>
        <input type="range" min="0" max="3000" step="25" value={ff} onChange={e => setFf(+e.target.value)} aria-label="Farming Fortune" />
        <b>{ff}</b>
        <span className="muted">(посмотри в игре в меню Stats; расчёт при ~19,5 блока/с и 90% времени в фарме)</span>
      </div>
      {data?.length ? (
        <div className="crop-bars">
          {data.map((c, i) => (
            <div key={c.id} className="crop-bar">
              <ItemIcon id={c.id} size={32} />
              <span className="crop-name">{c.name}
                <span className="muted tiny crop-sub">≈{num(c.items)} шт/ч · {c.unit ? `${c.unit.toLocaleString(LOCALE, { maximumFractionDigits: 2 })} за шт` : 'не продаётся'} · продавать: {c.sellAsName || c.name}</span>
                {c.volumeWarning && <span className="tiny crop-warn">⚠ {c.volumeWarning}</span>}
              </span>
              <div className="bar"><div style={{ width: `${(c.perHour / max) * 100}%`, animationDelay: `${i * 40}ms` }} /></div>
              <b>{coins(c.perHour)}/ч</b>
              <span className="muted tiny">{c.market}</span>
            </div>
          ))}
        </div>
      ) : <Empty>Цены Bazaar загружаются…</Empty>}
    </>
  );
}

// ---------- Флипы Bazaar ----------

function Flips({ openItem }) {
  const [risky, setRisky] = useStored('flips-risky', false);
  const [capital, setCapital] = useStored('flips-capital', 50);
  const [cat, setCat] = useStored('flips-cat', '');
  const [band, setBand] = useStored('flips-band', '');
  const [minWeek, setMinWeek] = useStored('flips-week', '');
  const [q, setQ] = useState('');
  const budget = Math.max(1, Number(capital) || 50) * 1e6;
  const { data } = useApi(`/market/flips/bazaar?limit=150&budget=${budget}${risky ? '&risky=1' : ''}`, [risky, budget], { keep: true });
  const rows = useMemo(() => (data || []).filter(f =>
    (!cat || f.category === cat) && inBand(f.buyAt, band) && (!minWeek || f.weeklyCoins >= Number(minWeek)) && (!q || lc(f.name).includes(lc(q)) || lc(f.id).includes(lc(q)))), [data, cat, band, minWeek, q]);
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  const cols = [
    { key: 'name', label: 'Товар', text: true, render: f => <ItemCell id={f.id} name={f.name} sub={f.category} openItem={openItem} /> },
    { key: 'buyAt', label: 'Ордер на покупку', cls: 'num', render: f => coins(f.buyAt) },
    { key: 'sellAt', label: 'Продавать по', cls: 'num', render: f => coins(f.sellAt) },
    { key: 'margin', label: 'Маржа', cls: 'num green', render: f => coins(f.margin) },
    { key: 'marginPct', label: 'Маржа %', cls: 'num', render: f => pct(f.marginPct) },
    { key: 'weeklyCoins', label: 'Оборот/нед.', cls: 'num', title: 'Сколько монет проходит через товар за неделю (по меньшей стороне)', render: f => coins(f.weeklyCoins) },
    { key: 'risk', label: 'Риск', sort: f => ({ низкий: 1, средний: 2, высокий: 3 }[f.risk] || 0), render: f => <span className={`mt-risk ${RISK_CLS[f.risk] || ''}`}>{f.risk}</span> },
    { key: 'perHour', label: '~Прибыль/ч', cls: 'num gold', render: f => coins(f.perHour) },
  ];
  const expand = f => (
    <div className="mt-more">
      <p>{f.howRu}</p>
      <div className="mt-facts">
        <span><b>{num(f.weekly)}</b> шт. в неделю продают и покупают</span>
        <span><b>{f.unitsPerHour >= 1 ? `~${num(f.unitsPerHour)}` : 'меньше 1'}</b> шт. в час реально успеть ({f.sharePct ?? 2}% часового оборота{f.capitalLimited ? ', упирается в капитал' : ', в пределах капитала'})</span>
        <span><b>{coins(f.invest)}</b> в ордерах за час</span>
        <span>Конкуренты: <b>{num(f.competition?.buyOrders)}</b> ордеров на покупку, <b>{num(f.competition?.sellOrders)}</b> на продажу</span>
      </div>
      {f.warning && <p className="red small">⚠ Похоже на накрутку: {f.warning}</p>}
      <div className="row-gap">
        <a className="chip" href={`#/market/${encodeURIComponent(f.id)}`}>📈 График на «Рынке» →</a>
        <button className="chip" onClick={() => openItem(f.id)}>Карточка предмета →</button>
      </div>
    </div>
  );
  return (
    <>
      <div className="mt-filters">
        <input className="search mt-search" placeholder="Поиск товара…" value={q} onChange={e => setQ(e.target.value)} />
        <label className="mt-pick"><span>Мой капитал, млн</span><input type="number" min="1" step="1" value={capital} onChange={e => setCapital(e.target.value)} /></label>
        <Pick label="Цена товара" value={band} onChange={setBand} options={PRICE_BANDS} />
        <Pick label="Оборот за неделю" value={minWeek} onChange={setMinWeek} options={[['', 'любой'], ['1000000000', 'от 1 млрд'], ['10000000000', 'от 10 млрд'], ['50000000000', 'от 50 млрд']]} />
        <Toggle checked={risky} onChange={setRisky}>Показать рискованные</Toggle>
      </div>
      <CatChips rows={data} value={cat} onChange={setCat} />
      <Count shown={rows.length} total={data.length} />
      <SortTable storeKey="flips" cols={cols} rows={rows} rowKey={f => f.id} expand={expand}
        empty={data.length ? 'Ничего не подходит под фильтры.' : 'Нет выгодных флипов прямо сейчас (или цены ещё грузятся).'} />
    </>
  );
}

// ---------- Крафт и Forge ----------

function Crafts({ openItem }) {
  const { data } = useApi('/market/flips/craft?forge=1&limit=150', []);
  const [kind, setKind] = useStored('crafts-kind', '');
  const [market, setMarket] = useStored('crafts-market', '');
  const [band, setBand] = useStored('crafts-band', '');
  const [hideLocked, setHideLocked] = useStored('crafts-locked', false);
  const [showOdd, setShowOdd] = useStored('crafts-odd', false);
  const [cat, setCat] = useStored('crafts-cat', '');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data || []).filter(c =>
    (!kind || c.kind === kind) && (!market || c.market === market) && inBand(c.cost, band) && (!hideLocked || !c.locked) && (!cat || c.category === cat)
    && (showOdd || !c.suspicious) && (!q || lc(c.name).includes(lc(q)) || lc(c.id).includes(lc(q)))), [data, kind, market, band, hideLocked, showOdd, cat, q]);
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  if (!data.length) return <Empty>Выгодных крафтов не найдено (или цены ещё грузятся).</Empty>;
  const cols = [
    { key: 'name', label: 'Предмет', text: true, render: c => <ItemCell id={c.id} openItem={openItem} name={<>{c.name}{c.count > 1 ? ` ×${c.count}` : ''}</>}
      sub={<>{c.kind === 'forge' ? '⚒ Forge' : 'Крафт'} · {c.category}{c.locked ? <span className="mt-lock"> · 🔒 нужно {c.locked.join(', ')}</span> : ''}</>} /> },
    { key: 'cost', label: 'Себестоимость', cls: 'num', render: c => coins(c.cost) },
    { key: 'sell', label: 'Продажа', cls: 'num', title: 'Сколько получишь после налога', render: c => coins(c.sell) },
    { key: 'profit', label: 'Прибыль', cls: 'num green', render: c => coins(c.profit) },
    { key: 'pct', label: 'Маржа %', cls: 'num', render: c => pct(c.pct, 0) },
    { key: 'volumeDay', label: 'Продаж/день', cls: 'num', render: c => num(c.volumeDay) },
    { key: 'perHour', label: '~В час', cls: 'num gold', title: 'Крафт: сколько успеешь продать за час. Forge: доход одного слота в час с учётом спроса', sort: c => c.perHour * (c.slotFill ?? 1), render: c => coins(c.perHour * (c.slotFill ?? 1)) },
    { key: 'durationH', label: 'Время', cls: 'num', sort: c => c.durationH ?? 0, render: c => (c.durationH ? `${c.durationH.toLocaleString(LOCALE)} ч` : 'сразу') },
    { key: 'market', label: 'Где продать', text: true },
  ];
  const expand = c => (
    <div className="mt-more">
      <div className="mt-parts">
        {(c.parts || []).map(p => (
          <button key={p.id} className="mt-part" onClick={() => openItem(p.id)} title="Открыть ингредиент">
            <ItemIcon id={p.id} size={26} /><span>{p.n}× {p.name}</span>
            <span className="muted tiny">{coins(p.unit)} за шт · {p.via === 'craft' ? 'дешевле скрафтить' : p.market || 'рынок'}</span>
          </button>
        ))}
      </div>
      <div className="mt-facts">
        <span>Себестоимость <b>{coins(c.cost)}</b> → продажа <b>{coins(c.sell)}</b> = <b className="green">+{coins(c.profit)}</b></span>
        {c.kind === 'forge' ? <span>Ковка <b>{c.durationH} ч</b> на слот, доход слота ≈ <b>{coins((c.perHourLow || 0) * (c.slotFill ?? 1))}–{coins(c.perHour * (c.slotFill ?? 1))}/ч</b>{c.slotFill < 1 ? ' (спроса хватает не на весь слот)' : ''}</span>
          : <span>Продать реально ≈ <b>{(c.craftsPerHour || 0).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}</b> шт. в час, доход ≈ <b>{coins(c.perHourLow)}–{coins(c.perHour)}/ч</b></span>}
        {c.demandDay != null && <span>Спрос: реально продать ≈ <b>{c.demandDay < 1 ? c.demandDay.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) : num(c.demandDay)}</b> шт. в день{c.kind === 'forge' && c.maxSlots != null ? `, слотов под него: ${c.maxSlots < 1 ? 'меньше одного' : Math.round(c.maxSlots)}` : ''}</span>}
        {c.req && <span>{c.req}</span>}
      </div>
      {c.subCrafts?.length > 0 && <p className="muted small">Часть ингредиентов выгоднее скрафтить самому: они отмечены «дешевле скрафтить».</p>}
      {c.warning && <p className="small gold">⚠ {c.warning}</p>}
      <button className="chip" onClick={() => openItem(c.id)}>Карточка предмета и рецепт →</button>
    </div>
  );
  return (
    <>
      <div className="mt-filters">
        <input className="search mt-search" placeholder="Поиск предмета…" value={q} onChange={e => setQ(e.target.value)} />
        <Pick label="Тип" value={kind} onChange={setKind} options={[['', 'Крафт и Forge'], ['craft', 'Только крафт'], ['forge', 'Только Forge']]} />
        <Pick label="Где продавать" value={market} onChange={setMarket} options={[['', 'Везде'], ['Bazaar', 'Bazaar'], ['Auction House', 'Auction House']]} />
        <Pick label="Себестоимость" value={band} onChange={setBand} options={PRICE_BANDS} />
        <Toggle checked={hideLocked} onChange={setHideLocked}>Только открытые рецепты</Toggle>
        <Toggle checked={showOdd} onChange={setShowOdd}>Показать подозрительные</Toggle>
      </div>
      <CatChips rows={data} value={cat} onChange={setCat} />
      <Count shown={rows.length} total={data.length} />
      <SortTable storeKey="crafts" cols={cols} rows={rows} rowKey={c => c.id + c.kind} expand={expand} />
    </>
  );
}

// ---------- Дешёвые лоты AH ----------

function Snipes({ openItem, pricesAt }) {
  const { data } = useApi('/market/flips/snipes?limit=150', []);
  const [cat, setCat] = useStored('snipes-cat', '');
  const [band, setBand] = useStored('snipes-band', '');
  const [minPct, setMinPct] = useStored('snipes-pct', '');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data || []).filter(f => (!cat || f.category === cat) && inBand(f.price, band) && (!minPct || f.pct >= Number(minPct))
    && (!q || lc(f.name).includes(lc(q)) || lc(f.id).includes(lc(q)))), [data, cat, band, minPct, q]);
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  // Аукцион не загрузился — это не «дешёвых лотов нет», а «не видно лотов вообще»
  if (!data.length && pricesAt?.auctionsError && !pricesAt?.auctions) return <Empty>Не удалось загрузить аукцион: {friendlyError(pricesAt.auctionsError)}. Сервер попробует снова через 3 минуты.</Empty>;
  if (!data.length) return <Empty>Сейчас нет лотов заметно дешевле рынка (скан раз в 3 минуты).</Empty>;
  const copy = (e, cmd) => { e.stopPropagation(); navigator.clipboard?.writeText(cmd); };
  const cols = [
    { key: 'name', label: 'Предмет', text: true, render: f => <ItemCell id={f.id} name={f.name} sub={f.category} openItem={openItem} /> },
    { key: 'price', label: 'Цена лота', cls: 'num', render: f => coins(f.price) },
    { key: 'second', label: 'Следующий лот', cls: 'num', render: f => coins(f.second) },
    { key: 'median', label: 'Медиана продаж', cls: 'num', render: f => coins(f.median) },
    { key: 'sold24h', label: 'Продаж/сутки', cls: 'num', render: f => num(f.sold24h) },
    { key: 'profit', label: 'Выгода', cls: 'num green', title: 'После комиссии аукциона', render: f => coins(f.profit) },
    { key: 'pct', label: 'Выгода %', cls: 'num', render: f => pct(f.pct, 0) },
    { key: 'command', label: 'Команда', nosort: true, render: f => f.command ? <code onClick={e => copy(e, f.command)} title="Нажми, чтобы скопировать">{f.command}</code> : '—' },
  ];
  const expand = f => (
    <div className="mt-more">
      <p>Лот стоит <b>{coins(f.price)}</b>, а следующий по цене — <b>{coins(f.second)}</b>; за сутки такие продавались <b>{num(f.sold24h)}</b> раз по медиане <b>{coins(f.median)}</b>. Если купить и перевыставить по меньшей из двух цен, после комиссии останется ≈<b className="green">{coins(f.profit)}</b>.</p>
      <p className="muted small">Лоты выкупают за секунды, а список обновляется раз в 3 минуты. Перед покупкой проверь звёзды, чары и перековку: цена рынка дана для обычного предмета.</p>
      <div className="chips">
        {f.command && <button className="chip" onClick={e => copy(e, f.command)}>Скопировать {f.command}</button>}
        <button className="chip" onClick={() => openItem(f.id)}>Карточка предмета →</button>
      </div>
    </div>
  );
  return (
    <>
      <div className="mt-filters">
        <input className="search mt-search" placeholder="Поиск предмета…" value={q} onChange={e => setQ(e.target.value)} />
        <Pick label="Цена лота" value={band} onChange={setBand} options={PRICE_BANDS} />
        <Pick label="Выгода" value={minPct} onChange={setMinPct} options={[['', 'любая'], ['10', 'от 10%'], ['25', 'от 25%'], ['50', 'от 50%']]} />
      </div>
      <CatChips rows={data} value={cat} onChange={setCat} />
      <Count shown={rows.length} total={data.length} />
      <SortTable storeKey="snipes" cols={cols} rows={rows} rowKey={f => f.id + f.auction} expand={expand} />
    </>
  );
}

// ---------- Движение цен ----------

function Movers({ openItem }) {
  const [period, setPeriod] = useState('d1');
  const [market, setMarket] = useStored('movers-market', '');
  const [cat, setCat] = useStored('movers-cat', '');
  const [q, setQ] = useState('');
  const { data } = useApi(`/market/movers?period=${period}`, [period]);
  const all = useMemo(() => [...(data?.up || []), ...(data?.down || [])], [data]);
  const keep = r => (!market || r.market === market) && (!cat || r.category === cat) && (!q || lc(r.name).includes(lc(q)) || lc(r.id).includes(lc(q)));
  const col = (title, rows, up) => (
    <div className="grow">
      <h4 className="sub-h">{title}</h4>
      {rows?.length ? rows.map(r => (
        <div key={r.id} className="item-line" onClick={() => openItem(r.id)}>
          <ItemIcon id={r.id} size={30} /><div className="grow">{r.name}<div className="muted tiny">{r.category ? `${r.category} · ` : ''}{r.market}{r.weekly ? ` · оборот ${coins(r.weekly)}/нед` : r.lots ? ` · лотов: ${r.lots}` : ''}</div></div>
          <div className="tiny muted">{coins(r.from)} → {coins(r.now)}</div><b className={up ? 'green' : 'red'}>{r.pct > 0 ? '+' : ''}{r.pct.toFixed(1).replace('.', DEC)}%</b>
          {(r.market === 'Bazaar' || r.market === 'Auction House') && <a className="mv-chart" href={`#/market/${r.market === 'Bazaar' ? '' : 'ah:'}${encodeURIComponent(r.id)}`} onClick={e => e.stopPropagation()} title="Открыть график на «Рынке»" aria-label="График на «Рынке»">📈</a>}
        </div>
      )) : <Empty>{data && all.length ? 'Ничего не подходит под фильтры.' : 'История цен ещё копится.'}</Empty>}
    </div>
  );
  return (
    <>
      <Tabs value={period} onChange={setPeriod} tabs={[{ id: 'd1', label: 'За сутки' }, { id: 'd7', label: 'За неделю' }]} />
      <div className="muted tiny" style={{ margin: '4px 0 8px' }}>Сравниваем с медианой цены вокруг начала периода. Скачки больше ±100% показываем только у товаров с оборотом от 1 млрд в неделю: на тонком рынке это обычно один ордер, а не движение цены.</div>
      {all.length > 0 && (
        <>
          <div className="mt-filters">
            <input className="search mt-search" placeholder="Поиск товара…" value={q} onChange={e => setQ(e.target.value)} />
            <Pick label="Рынок" value={market} onChange={setMarket} options={[['', 'Bazaar и аукцион'], ['Bazaar', 'Bazaar'], ['Auction House', 'Auction House']]} />
          </div>
          <CatChips rows={all} value={cat} onChange={setCat} />
        </>
      )}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>{col('Растут', data?.up?.filter(keep), true)}{col('Падают', data?.down?.filter(keep), false)}</div>
    </>
  );
}

// ---------- Методы ----------

// Требование метода: статус от сервера (ok/no/soft/unk) и то, что есть у игрока сейчас
function ReqLine({ r }) {
  return <span className={`req-line ${r.status}`}><i /><span><Rich text={r.text} />{r.have && <span className="req-have"> — {r.have}</span>}{r.soft && r.status !== 'ok' ? <span className="req-have"> (желательно)</span> : ''}</span></span>;
}

const income = mt => mt.coinsPerHourRange ? `${coins(mt.coinsPerHourRange[0])}–${coins(mt.coinsPerHourRange[1])}/ч` : mt.coinsPerHour ? `~${coins(mt.coinsPerHour)}/ч` : null;
const hours = h => (h < 1 ? 'меньше часа' : h < 48 ? `≈${Math.round(h)} ч` : `≈${Math.round(h / 24)} дн.`);
const methodState = mt => (mt.ready ? 'ready' : mt.available ? 'soft' : mt.missingHard === 1 ? 'near' : 'locked');
const STATE_TEXT = { ready: 'Можно начинать', soft: 'Можно, но с докупкой', near: 'Не хватает одного', locked: 'Пока закрыт' };
const RISK_ORDER = { low: 1, mid: 2, high: 3 };

const METHOD_SORTS = {
  '': ['как советует сайт', null],
  income: ['доход в час', (a, b) => (b.coinsPerHour || 0) - (a.coinsPerHour || 0)],
  start: ['меньше вложений', (a, b) => (a.startCost || 0) - (b.startCost || 0) || (b.coinsPerHour || 0) - (a.coinsPerHour || 0)],
  payback: ['быстрее окупается', (a, b) => (a.paybackHours ?? (a.buyCost ? Infinity : 0)) - (b.paybackHours ?? (b.buyCost ? Infinity : 0)) || (b.coinsPerHour || 0) - (a.coinsPerHour || 0)],
  reqs: ['ближе к открытию', (a, b) => (a.missingHard || 0) - (b.missingHard || 0) || (b.reqDone / (b.reqTotal || 1)) - (a.reqDone / (a.reqTotal || 1))],
  risk: ['меньше риска', (a, b) => (RISK_ORDER[a.risk] || 9) - (RISK_ORDER[b.risk] || 9) || (b.coinsPerHour || 0) - (a.coinsPerHour || 0)],
  name: ['по названию', (a, b) => a.title.localeCompare(b.title, LOCALE)],
};

const fmtChance = c => (c >= 1 ? '100%' : `${(c * 100).toLocaleString(LOCALE, { maximumFractionDigits: c < 0.00001 ? 5 : c < 0.0001 ? 4 : c < 0.001 ? 3 : 2 })}%`);
/** «раз в 3 ч», «раз в 420 ч (~18 дней игры по 24 ч)»: как часто в среднем выпадает дроп при расчётном темпе. */
const fmtEvery = h => {
  if (!(h > 0) || !isFinite(h)) return null;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} мин`;
  const r = h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
  return h >= 48 ? `${num(r)} ч (это ~${num(Math.round(h / 24))} сут. непрерывной игры)` : `${num(r)} ч`;
};

function MethodDetail({ mt, openItem }) {
  const buys = [...(mt.upgrade || []).filter(u => u.cheapest).map(u => ({ text: u.text, cheapest: u.cheapest, owned: false })),
    ...(mt.kit || []).filter(k => !k.capital)];
  return (
    <div className="method-detail">
      <section className="md-two">
        <h5>Что это</h5>
        <p className="small"><Rich text={mt.desc} /></p>
        {mt.detail && <p className="small detail"><Rich text={mt.detail} /></p>}
        {mt.xp && <p className="small"><span className="muted">Что прокачивается:</span> <Rich text={mt.xp} /></p>}
      </section>
      <section>
        <h5>Требования и твой профиль</h5>
        <div className="req">{mt.reqs.length ? mt.reqs.map((r, i) => <ReqLine key={i} r={r} />) : <span className="muted small">Особых требований нет.</span>}</div>
      </section>
      {mt.steps?.length > 0 && (
        <section className="md-wide">
          <h5>Как делать</h5>
          <ol className="md-steps">{mt.steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>
        </section>
      )}
      <section>
        <h5>Доход</h5>
        <div className="md-big gold">{income(mt) || 'зависит от дня'}</div>
        <p className="muted tiny">{mt.sourceText}{mt.coinsPerHourRange && mt.coinsPerHour ? `; ${mt.source === 'live' ? 'обычно' : 'середина'} ≈${coins(mt.coinsPerHour)}/ч` : ''}</p>
        {mt.top?.length > 0 && (
          <div className="md-top">{mt.top.map(t => (
            <button key={t.id} className="mt-part" onClick={() => openItem(t.id)}><ItemIcon id={t.id} size={24} /><span>{t.name}</span><span className="gold tiny">{coins(t.perHour)}/ч</span></button>
          ))}</div>
        )}
        {mt.marketNote && <p className="small gold">📈 {mt.marketNote}</p>}
        {mt.mayorNote && <p className="small mt-mayor">🏛️ <Rich text={mt.mayorNote} /> <a className="link-btn tiny" href="#/events">мэр и календарь →</a></p>}
      </section>
      <section>
        <h5>Что нужно для старта</h5>
        {buys.length || mt.capital ? (
          <ul className="md-kit">
            {buys.map((k, i) => (
              <li key={i} className={k.owned ? 'ok' : k.owned === false ? 'need' : ''}>
                <span>{k.owned ? '✓ ' : k.owned === false ? '+ ' : '• '}<Rich text={k.text} /></span>
                {k.owned ? <span className="muted tiny">уже есть</span>
                  : k.cheapest ? <button className="link-btn tiny" onClick={() => openItem(k.cheapest.id)}>{k.cheapest.name}: от {coins(k.cheapest.price)}{k.note ? ` (${k.note})` : ''}</button> : null}
              </li>
            ))}
            {(mt.kit || []).filter(k => k.capital).map((k, i) => <li key={'c' + i}><span>• <Rich text={k.text} /></span><span className="tiny">от {coins(k.capital)}</span></li>)}
          </ul>
        ) : <p className="small muted">Ничего докупать не нужно.</p>}
        <div className="md-sum">
          <span>Вложить: <b>{mt.startCost ? coins(mt.startCost) : '0'}</b>{mt.capital ? <span className="muted tiny"> (из них {coins(mt.capital)} — оборотные, вернутся)</span> : ''}</span>
          {mt.paybackHours != null && <span>Покупки окупятся: <b>{hours(mt.paybackHours)}</b> игры</span>}
        </div>
      </section>
      {mt.risks?.length > 0 && (
        <section>
          <h5>Риски <span className={`mt-risk ${RISK_CLS[mt.risk] || ''}`}>{mt.riskText}</span></h5>
          <ul className="md-risks">{mt.risks.map((r, i) => <li key={i}><Rich text={r} /></li>)}</ul>
        </section>
      )}
      {mt.breakdown?.length > 0 && (
        <section className="md-wide">
          <h5>Откуда доход: шансы с вики × цены сейчас</h5>
          <div className="md-break-wrap">
            <table className="md-break">
              <thead><tr><th>Предмет</th><th>Шанс</th><th>Кол-во</th><th>Цена</th>{mt.breakdown.some(b => b.cost) && <th>Открыть</th>}<th>В среднем за {mt.breakdownUnit || 'раз'}</th>{mt.breakdown.some(b => b.perHour != null) && <th>В час</th>}</tr></thead>
              <tbody>{mt.breakdown.map(b => (
                <tr key={b.id} className={b.rare ? 'rare' : ''}>
                  <td><button className="link-btn" onClick={() => openItem(b.id)}><ItemIcon id={b.id} size={20} /> {b.name}</button></td>
                  <td>{fmtChance(b.chance)}</td>
                  <td>{b.qty ? num(Math.round(b.qty * 10) / 10) : '1'}</td>
                  <td>{coins(b.unit)}</td>
                  {mt.breakdown.some(x => x.cost) && <td>{b.cost ? coins(b.cost) : '—'}</td>}
                  <td className="gold">{coins(b.perKill)}</td>
                  {mt.breakdown.some(x => x.perHour != null) && <td className="gold">{b.perHour != null ? coins(b.perHour) : '—'}</td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <RareDrops mt={mt} openItem={openItem} />
          {mt.meter && <NucleusMeter meter={mt.meter} openItem={openItem} />}
          <p className="muted tiny">«За раз» — за одного босса, моба или заход. Редкие дропы (шанс меньше 5%) выделены: это удача, в среднем за долгий срок. Для сундуков учтено, что платный сундук открывают, только если предмет дороже цены открытия.</p>
        </section>
      )}
      {mt.dropPrices?.length > 0 && (
        <section className="md-wide">
          <h5>Что падает и почём сейчас</h5>
          <div className="drops">
            {mt.dropPrices.map(d => (
              <div key={d.id} className="drop" onClick={() => openItem(d.id)} title={d.name}><ItemIcon id={d.id} size={30} /><span className="tiny drop-name">{d.name}</span><span className="tiny">{coins(d.price)}</span>{d.d7 != null && <span className={`tiny ${d.d7 >= 0 ? 'green' : 'red'}`} title="изменение за неделю">{d.d7 >= 0 ? '▲' : '▼'}{Math.abs(d.d7).toFixed(0)}%</span>}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MethodCard({ mt, onOpen }) {
  const st = methodState(mt);
  // Закрытый метод: сначала то, без чего не пустят; открытый с докупкой — чего желательно добавить
  const lacking = st === 'ready' ? [] : (mt.reqs || []).filter(r => r.status === (mt.available ? 'soft' : 'no')).map(r => r.text);
  return (
    // Вся карточка — кнопка: разбор метода открывается окном поверх страницы
    <div className={`method method-click ${mt.available ? 'ok' : 'locked'}`} id={`method-${mt.id}`} role="button" tabIndex={0}
      aria-haspopup="dialog" aria-label={`${mt.title}: открыть разбор`}
      onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
      <div className="method-head"><h4>{mt.title}</h4><Badge>{mt.tag}</Badge></div>
      <div className={`method-state ${st}`}>{STATE_TEXT[st]}{lacking.length ? `: ${lacking.slice(0, 2).join(', ')}${lacking.length > 2 ? '…' : ''}` : ''}</div>
      {income(mt) && <div className="income">{income(mt)}{mt.sourceText && <span className="income-src">{mt.sourceText}</span>}</div>}
      {mt.mayorNote && <div className={`mt-mayor-badge ${mt.mayorFactor && mt.mayorFactor < 1 ? 'down' : ''}`} title={mt.mayorNote}>🏛️ {mt.mayorFactor ? `мэр: доход ${mt.mayorFactor > 1 ? '+' : '−'}${Math.round(Math.abs(mt.mayorFactor - 1) * 100)}%` : 'мэр помогает этому методу'}</div>}
      <div className="method-facts">
        {mt.effortText && <span title="Сколько внимания нужно">{mt.effortText}</span>}
        {mt.riskText && <span className={`mt-risk ${RISK_CLS[mt.risk] || ''}`} title="Риск уйти в минус">риск {mt.riskText}</span>}
        <span title="Сколько вложить на старте (докупить и держать в обороте)">{mt.startCost ? `старт ${coins(mt.startCost)}` : 'без вложений'}</span>
        {mt.paybackHours != null && <span title="За сколько часов игры отобьются покупки">окупится {hours(mt.paybackHours)}</span>}
      </div>
      {mt.reqTotal > 0 && (
        <div className="method-reqbar" title={`Выполнено требований: ${mt.reqDone} из ${mt.reqTotal}`}>
          <div style={{ width: `${(mt.reqDone / mt.reqTotal) * 100}%` }} /><span className="tiny muted">требования {mt.reqDone}/{mt.reqTotal}</span>
        </div>
      )}
      <p className="muted small">{mt.desc}</p>
      <div className="req">{(mt.reqs || []).map((r, i) => <ReqLine key={i} r={r} />)}</div>
      <span className="method-more" aria-hidden="true">Как начать, сколько вложить и риски →</span>
    </div>
  );
}

/** Разбор метода в окне поверх страницы: Esc и клик мимо закрывают, Tab ходит внутри окна. */
/** Редкие дропы отдельно: шанс, цена, как часто в среднем выпадают и сколько дают в час в среднем за долгий срок. */
function RareDrops({ mt, openItem }) {
  const rare = (mt.breakdown || []).filter(b => b.rare && b.unit > 0).sort((a, b) => (b.unit || 0) - (a.unit || 0));
  if (!rare.length) return null;
  const meter = /^(slayer-|dungeon-)/.test(mt.id);
  return (
    <div className="md-rare">
      <h5>Редкие дропы: удача</h5>
      <ul>{rare.map(b => {
        const every = fmtEvery(b.everyHours);
        return (
          <li key={b.id}>
            <button className="link-btn" onClick={() => openItem(b.id)}><ItemIcon id={b.id} size={20} /> {b.name}</button>
            <span>шанс {fmtChance(b.chance)} за {mt.breakdownUnit || 'раз'}, цена {coins(b.unit)}{every ? `, в среднем раз в ${every}` : ''}{b.perHour != null ? `; в доход за час входит ${coins(b.perHour)}` : ''}</span>
          </li>
        );
      })}</ul>
      <p className="muted tiny"><Rich text={'Это среднее за долгий срок: пока предмет не выпал, ты его не получаешь, а когда выпадет — получаешь всю цену сразу. Дропы реже раза в сутки рынок всегда купит, поэтому лимит продаж их не режет.' + (mt.meter ? ' Шансы в таблице — без RNG-метра; с метром выбранная цель выпадает чаще, это посчитано ниже и уже входит в доход.' : '') + (meter ? ' RNG-метр (у слееров с T3, в данжах — за заходы) копится, пока предмет не выпал, и гарантирует его, когда заполнится: реальное ожидание выбранного предмета короче среднего здесь. Точные требования метра для каждого предмета вики сейчас не отдаёт, поэтому в доход он не добавлен.' : '')} /></p>
    </div>
  );
}

/** Как в игре: шанс выбранного предмета растёт в 1 + 2 × заполнение раз, на полной шкале — гарантия. Считает остаток цикла с текущего места. */
const runsWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'ран' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'рана' : 'ранов');
const dec = x => x.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
function meterLeft(pRoll, rolls, runs, done) {
  const n = Math.max(1, Math.round(runs));
  let alive = 1, cycle = 0;
  for (let k = Math.max(0, Math.floor(done)); k < n; k++) { cycle += alive; alive *= Math.pow(1 - Math.min(1, pRoll * (1 + 2 * k / n)), rolls); }
  return { cycle, before: 1 - alive };
}

/** RNG-метр Crystal Nucleus: выбор цели и сколько осталось до гарантированного дропа. Прогресс из профиля, если Hypixel его отдаёт, иначе вводит игрок. */
function NucleusMeter({ meter, openItem }) {
  const [saved, setSaved] = useStored('nucleus-meter', { target: null, xp: 0 });
  const fromApi = meter.progress && Number.isFinite(meter.progress.xp);
  const targetId = (fromApi && meter.progress.selected) || saved.target || meter.best;
  const t = meter.targets.find(x => x.id === targetId) || meter.targets[0];
  if (!t) return null;
  const bestT = meter.targets.find(x => x.id === meter.best);
  const xp = Math.min(t.xp, Math.max(0, Number(fromApi ? meter.progress.xp : saved.xp) || 0));
  const per = meter.xpPerRun, total = t.xp / per, done = Math.floor(xp / per), left = Math.max(0, Math.ceil((t.xp - xp) / per));
  const [lo, hi] = meter.runsPerHour;
  const now = t.pRoll * (1 + 2 * xp / t.xp);
  const rest = meterLeft(t.pRoll, meter.rolls, total, done);
  const text = `Шкала ${num(xp)} из ${num(t.xp)} очков (${Math.floor(xp / t.xp * 100)}%)${t.known ? '' : ', размер шкалы — оценка по редкости, сверь с игрой'}. `
    + `До гарантированного ${t.name} осталось ${num(left)} ${runsWord(left)} — это от ${hours(left / hi)} до ${hours(left / lo)} игры при ${dec(lo)}–${dec(hi)} рана в час. `
    + `Шанс за бросок сейчас ${fmtChance(now)} (без метра ${fmtChance(t.pRoll)}), за ран с ${meter.rolls} бросками ≈${fmtChance(1 - Math.pow(1 - now, meter.rolls))}. `
    + `С этого места предмет выпадет в среднем через ${num(Math.round(rest.cycle))} ${runsWord(Math.round(rest.cycle))}, с вероятностью ${Math.round(rest.before * 100)}% ещё до гарантии. `
    + `В среднем за долгий срок метр на эту цель добавляет ≈${coins(t.extraPerRun)} за ран (${coins(t.extraPerHour[0])}–${coins(t.extraPerHour[1])} в час).`
    + (bestT && bestT.id !== t.id ? ` Доход метода выше посчитан с самой выгодной целью — ${bestT.name}; с этой целью он меньше на ${coins(bestT.extraPerHour[0] - t.extraPerHour[0])}–${coins(bestT.extraPerHour[1] - t.extraPerHour[1])} в час.` : ' Эта прибавка уже входит в доход метода выше.');
  return (
    <div className="md-meter">
      <h5>RNG-метр Crystal Nucleus</h5>
      <div className="md-meter-row">
        <label>Цель{' '}
          <select value={t.id} disabled={!!(fromApi && meter.progress.selected)} onChange={e => setSaved({ ...saved, target: e.target.value })}>
            {meter.targets.map(x => <option key={x.id} value={x.id}>{x.name} — +{coins(x.extraPerRun)} за ран</option>)}
          </select>
        </label>
        <label>Очков на шкале{' '}
          <input type="number" min="0" step="1000" max={t.xp} value={xp} disabled={fromApi} onChange={e => setSaved({ ...saved, target: t.id, xp: Number(e.target.value) || 0 })} />
        </label>
        <button className="link-btn" onClick={() => openItem(t.id)}><ItemIcon id={t.id} size={20} /> {coins(t.unit)}</button>
      </div>
      <div className="md-meter-bar" title={`${Math.floor(xp / t.xp * 100)}%`}><div style={{ width: `${(xp / t.xp) * 100}%` }} /></div>
      <p className="small"><Rich text={text} /></p>
      <p className="muted tiny"><Rich text={fromApi ? 'Прогресс взят из профиля.' : 'Прогресс шкалы Hypixel в профиль не отдаёт: посмотри его в игре (Crystal Nucleus Guide → Crystal Nucleus RNG Meter) и впиши сюда, сайт запомнит. Каждый ран даёт 1000 очков.'} /></p>
    </div>
  );
}

function MethodModal({ mt, refs, onClose, openItem }) {
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    box.current?.focus();
    return () => prev?.focus?.();
  }, []);
  useEffect(() => {
    // поверх может открыться карточка предмета: Esc и Tab тогда относятся к ней, а не к разбору
    const onTop = () => [...document.querySelectorAll('.modal-bg')].every(el => el === box.current?.parentElement);
    const f = e => {
      if (!box.current || !onTop()) return;
      // закреплённая подсказка термина живёт в body: Esc сначала закрывает её (это делает Rich), Tab ходит и по ней
      const tip = document.querySelector('.gref-tip.pinned');
      if (e.key === 'Escape') { if (!tip) onClose(); return; }
      if (e.key !== 'Tab') return;
      const sel = 'button, a[href], input, select, textarea, [tabindex="0"]';
      const els = [...box.current.querySelectorAll(sel), ...(tip ? tip.querySelectorAll(sel) : [])].filter(el => !el.disabled && el.offsetParent !== null);
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0], last = els[els.length - 1];
      const inside = box.current.contains(document.activeElement) || !!tip?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [onClose]);
  const st = methodState(mt);
  // в body: у страницы бывают анимации с transform, и position: fixed внутри них уезжает
  return createPortal(
    <div className="modal-bg method-modal-bg" onClick={onClose}>
      <div className="modal card method-modal" role="dialog" aria-modal="true" aria-label={mt.title} tabIndex={-1} ref={box} onClick={e => e.stopPropagation()}>
        <header className="mm-head">
          <div className="mm-title">
            <div className="mm-name"><h3>{mt.title}</h3><Badge>{mt.tag}</Badge></div>
            <div className={`method-state ${st}`}>{STATE_TEXT[st]}</div>
          </div>
          <button className="x-btn mm-x" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        <RefsProvider refs={refs}><MethodDetail mt={mt} openItem={openItem} /></RefsProvider>
      </div>
    </div>,
    document.body,
  );
}

function MoneyMethods({ openItem }) {
  const { data, error, errorText } = useApi('/market/money', []);
  const [cat, setCat] = useStored('methods-cat', '');
  const [avail, setAvail] = useStored('methods-avail', '');
  const [effort, setEffort] = useStored('methods-effort', '');
  const [risk, setRisk] = useStored('methods-risk', '');
  const [sort, setSort] = useStored('methods-sort', '');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const methods = data?.methods || [];
  const rows = useMemo(() => {
    const list = methods.filter(mt => (!cat || mt.tag === cat)
      && (!avail || (avail === 'now' ? mt.available : avail === 'near' ? !mt.available && mt.missingHard <= 1 : !mt.available))
      && (!effort || mt.effort === effort) && (!risk || mt.risk === risk)
      && (!q || lc(mt.title + ' ' + mt.desc + ' ' + mt.tag).includes(lc(q))));
    const fn = METHOD_SORTS[sort]?.[1];
    return fn ? [...list].sort(fn) : list;
  }, [methods, cat, avail, effort, risk, sort, q]);
  // Раньше ошибка тут терялась и загрузка крутилась бесконечно (например, сразу после обновления сайта)
  if (!data && error) return <Empty>Способы заработка не загрузились: <Rich text={errorText || error} /></Empty>;
  if (!data) return <div className="loader"><div className="spinner" />{errorText && <p className="small muted">{errorText}</p>}</div>;
  const plan = data.plan || {};
  const openMt = methods.find(mt => mt.id === open);
  return (
    <>
      {plan.summary && <div className="plan-summary"><img src="/api/texture/gold_ingot" alt="" className="plan-ico" /><span>{plan.summary}</span></div>}
      <div className="mt-filters">
        <input className="search mt-search" placeholder="Поиск метода: слеер, данж, гемы…" value={q} onChange={e => setQ(e.target.value)} />
        <Pick label="Доступность" value={avail} onChange={setAvail} options={[['', 'Все'], ['now', 'Доступны сейчас'], ['near', 'Не хватает одного'], ['locked', 'Пока закрыты']]} />
        <Pick label="Формат" value={effort} onChange={setEffort} options={[['', 'Любой'], ['afk', 'Пассивно'], ['semi', 'Спокойная игра'], ['focus', 'Активная игра'], ['party', 'Нужна команда'], ['daily', 'Раз в день']]} />
        <Pick label="Риск" value={risk} onChange={setRisk} options={[['', 'Любой'], ['low', 'Низкий'], ['mid', 'Средний'], ['high', 'Высокий']]} />
        <Pick label="Сортировка" value={sort} onChange={setSort} options={Object.entries(METHOD_SORTS).map(([k, [l]]) => [k, l])} />
      </div>
      <CatChips rows={methods} value={cat} onChange={setCat} field="tag" allLabel="Все методы" />
      {!rows.length ? <Empty>Ни один метод не подходит под фильтры.</Empty> : (
        <div className="methods">
          {rows.map(mt => <MethodCard key={mt.id} mt={mt} onOpen={() => setOpen(mt.id)} />)}
        </div>
      )}
      {openMt && <MethodModal mt={openMt} refs={data.refs} onClose={() => setOpen(null)} openItem={openItem} />}
    </>
  );
}

export default function Money({ state: appState, sub }) {
  const { openItem } = useApp();
  // «Мои лоты» переехали на «Рынок» → Auction House: старый адрес (и ссылка из новости) ведёт туда
  useEffect(() => { if (sub === 'auctions') location.replace('#/market/mine'); }, [sub]);
  const [tab, setTab] = useHashTab('money', sub, ['methods', 'crops', 'flips', 'crafts', 'snipes', 'movers', 'bank', 'bits'], 'methods');
  const st = appState;
  return (
    <div className="grid">
      <Card className="span-12" title="Как заработать с твоим профилем" right={<Tabs value={tab} onChange={setTab} tabs={[{ id: 'methods', label: 'Методы' }, { id: 'crops', label: 'Культуры' }, { id: 'flips', label: 'Флипы Bazaar', market: true }, { id: 'crafts', label: 'Крафт и Forge' }, { id: 'snipes', label: 'Дешёвые лоты AH', market: true }, { id: 'movers', label: 'Движение цен' }, { id: 'bank', label: 'Bank' }, { id: 'bits', label: 'Bits' }].filter(t => !t.market || st?.member?.mode?.market !== false)} />}>
        {st?.member?.mode && !st.member.mode.market && <div className="mode-banner">⚠️ Профиль {st.member.mode.label}: {st.member.mode.note}. Флипы скрыты, а доход посчитан по ценам рынка, поэтому реальный ниже.</div>}
        {tab === 'methods' && <MoneyMethods openItem={openItem} />}
        {tab === 'crops' && <Crops />}
        {tab === 'flips' && <Flips openItem={openItem} />}
        {tab === 'crafts' && <Crafts openItem={openItem} />}
        {tab === 'snipes' && <Snipes openItem={openItem} pricesAt={st.pricesAt} />}
        {tab === 'movers' && <Movers openItem={openItem} />}
        {tab === 'bank' && <BankTab />}
        {tab === 'bits' && <BitsTab openItem={openItem} />}
      </Card>
    </div>
  );
}
