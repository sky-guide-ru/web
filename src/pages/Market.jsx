import { LOCALE } from '../i18n.js';
// Раздел «Рынок»: переключатель Bazaar / Auction House (аукцион — MarketAuction.jsx).
// Bazaar: товары слева (поиск по-русски, избранное, изменение за сутки), справа — биржевой график
// выбранного товара (components/chart/TradingChart.jsx) и сводка: цены покупки/продажи, спред, обороты, ордера.
// Адрес: #/market/<ID товара>. На телефоне — либо список, либо график с кнопкой «← Все товары».
import { useState, useEffect, useMemo, useRef, lazy, Suspense, Fragment } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, api, ago, saveLocal } from '../api.js';
import { useApp } from '../App.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import '../components/chart/chart.css';

import MarketFilters, { BZ_CATS } from '../components/MarketFilters.jsx';
import { chunk } from '../update.js';
const TradingChart = lazy(chunk(() => import('../components/chart/TradingChart.jsx')));
const loadAuction = () => import('./MarketAuction.jsx');
const MarketAuction = lazy(chunk(loadAuction));
const MODE = 'sb-market-mode';
const WATCH = 'sb-watchlist';
const LAST = 'sb-market-last';
const SORTS = [
  ['', 'по обороту'], ['d1:-1', 'рост за сутки'], ['d1:1', 'падение за сутки'], ['buy:-1', 'дороже'], ['buy:1', 'дешевле'],
  ['spreadPct:-1', 'больший спред'], ['buyWeek:-1', 'чаще покупают'], ['name:1', 'по названию'],
];
const pctTxt = p => (p == null ? '' : `${p > 0 ? '+' : ''}${p.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`);
const go = id => {
  location.hash = `#/market/${encodeURIComponent(id)}`;
  // на телефоне график стоит над списком — после выбора товара поднимаемся к нему
  if (matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => document.querySelector('.mk-pane.on .mk-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};
const PAGE = 200;
// Цена в строке списка: у товара может не быть ордеров с одной стороны (или вовсе) — тогда так и пишем
const priceTxt = r => (r.buy > 0 || r.sell > 0
  ? `покупка ${r.buy > 0 ? coins(r.buy) : '—'} · продажа ${r.sell > 0 ? coins(r.sell) : '—'}`
  : 'сейчас нет ордеров');

function useNarrow() {
  const q = '(max-width: 900px)';
  const [n, setN] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return n;
}

/**
 * Обёртка: какой рынок показать. Адрес #/market/ah:<ключ> — аукцион, #/market/<ID> — Bazaar, без ID — последний выбранный.
 * Обе вкладки, раз открытые, остаются на странице: при переключении не теряются выбранный предмет, поиск, фильтры,
 * прокрутка списка и график. Скрытая вкладка не опрашивает сервер (ей отдаётся замороженное состояние цен),
 * а при возврате один раз догружает свежее.
 */
export default function Market({ state, sub }) {
  const narrow = useNarrow();
  // #/market/mine — «Мои лоты» на вкладке Auction House
  const mineHash = sub === 'mine';
  const picked = sub && !mineHash ? decodeURIComponent(sub) : null;
  const [saved, setSaved] = useState(() => (mineHash ? 'ah' : localStorage.getItem(MODE) || 'bz'));
  const [mine, setMine] = useState(0);
  useEffect(() => { if (mineHash) { setSaved('ah'); saveLocal(MODE, 'ah'); setMine(n => n + 1); } }, [mineHash, sub]);
  const mode = picked ? (picked.startsWith('ah:') ? 'ah' : 'bz') : mineHash ? 'ah' : saved;
  useEffect(() => { if (picked) { setSaved(mode); saveLocal(MODE, mode); } }, [picked, mode]);
  const [seen, setSeen] = useState(() => ({ [mode]: true }));
  useEffect(() => { if (!seen[mode]) setSeen(s => ({ ...s, [mode]: true })); }, [mode, seen]);
  // Код Auction House подгружаем заранее, пока смотрят Bazaar: при переключении раздел не пропадает за спиннером
  useEffect(() => { const t = setTimeout(() => loadAuction().catch(() => {}), 1500); return () => clearTimeout(t); }, []);
  // Прокрутка страницы своя у каждой вкладки (на телефоне список и график — в общей прокрутке)
  const scrollY = useRef({});
  const pick = m => {
    if (m === mode) return;
    scrollY.current[mode] = window.scrollY;
    setSaved(m); saveLocal(MODE, m);
    if (picked) location.hash = '#/market';
    const y = scrollY.current[m];
    if (y != null) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
  };
  // Состояние для скрытой вкладки — последнее, что она видела активной: так её запросы не срабатывают на каждое обновление цен
  const frozen = useRef({});
  if (state) frozen.current[mode] = state;
  const stateFor = m => (m === mode ? state : frozen.current[m] || state);
  // И выбранный предмет скрытая вкладка держит свой (адрес теперь про соседнюю), чтобы ничего не перезапрашивать
  const lastPick = useRef({});
  if (picked) lastPick.current[mode] = mode === 'ah' ? picked.slice(3) : picked;
  const pickFor = m => lastPick.current[m] || null;
  const modeSwitch = (
    <span className="tc-seg mk-mode" role="tablist" aria-label="Рынок">
      <button type="button" role="tab" aria-selected={mode === 'bz'} className={mode === 'bz' ? 'on' : ''} onClick={() => pick('bz')}>Bazaar</button>
      <button type="button" role="tab" aria-selected={mode === 'ah'} className={mode === 'ah' ? 'on' : ''} onClick={() => pick('ah')}>Auction House</button>
    </span>
  );
  const noMarket = state?.member?.mode && !state.member.mode.market;
  const pane = (m, body) => (
    <div className={`mk-pane mk-pane-${m} ${mode === m ? 'on' : ''}`} aria-hidden={mode !== m} inert={mode !== m}>{body}</div>
  );
  return (
    <div className={`mk ${narrow ? 'narrow' : ''}`} data-news="market">
      {noMarket && <div className="mode-banner mk-banner">⚠️ Профиль {state.member.mode.label}: Bazaar и аукцион недоступны. Цены здесь — только для ориентира.</div>}
      <div className="mk-stack">
        {seen.bz && pane('bz', <MarketBazaar state={stateFor('bz')} picked={pickFor('bz')} narrow={narrow} modeSwitch={modeSwitch} active={mode === 'bz'} />)}
        {seen.ah && pane('ah', (
          <Suspense fallback={<div className="loader"><div className="spinner" /></div>}>
            <MarketAuction state={stateFor('ah')} picked={pickFor('ah')} narrow={narrow} modeSwitch={modeSwitch} active={mode === 'ah'} mine={mine} />
          </Suspense>
        ))}
      </div>
    </div>
  );
}

function MarketBazaar({ state, picked, narrow, modeSwitch, active = true }) {
  const { openItem } = useApp();
  const [q, setQ] = useState('');
  const [list, setList] = useState(null); // { total, items } — страница за страницей, по всем товарам Bazaar
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState(() => localStorage.getItem('sb-market-sort') || '');
  const [cat, setCat] = useState(() => localStorage.getItem('sb-market-cat') || '');
  const [watch, setWatch] = useState(() => { try { return JSON.parse(localStorage.getItem(WATCH) || '[]'); } catch { return []; } });
  const [watched, setWatched] = useState([]);
  // Избранное общее у Bazaar и аукциона: при возврате на вкладку берём то, что могли поменять на соседней
  useEffect(() => {
    if (!active) return;
    const v = localStorage.getItem(WATCH) || '[]';
    if (v !== JSON.stringify(watch)) { try { setWatch(JSON.parse(v)); } catch { /* испорченная запись — оставляем как есть */ } }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cur, setCur] = useState(null); // строка выбранного товара
  const [help, setHelp] = useState(null);
  const id = picked || localStorage.getItem(LAST) || list?.items?.[0]?.id || null;

  // Поиск и сортировка — на сервере по всем товарам (их больше 2000), сюда приходит страница.
  // Ответ на устаревший запрос (уже напечатали другое) не должен перетирать свежий.
  // При обновлении цен перезапрашиваем столько строк, сколько уже показано («Показать ещё» не сбрасывается).
  const shown = list?.items?.length || 0;
  const listUrl = (offset, limit) => `/bazaar?paged=1&q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}&cat=${encodeURIComponent(cat)}&offset=${offset}&limit=${limit}`;
  useEffect(() => {
    let alive = true, t;
    // Сервер не ответил (502 при перезапуске) — пробуем снова через 5 с, иначе список так и висел со спиннером
    const load = () => api(listUrl(0, PAGE)).then(r => alive && setList(r)).catch(() => { if (alive) t = setTimeout(load, 5000); });
    t = setTimeout(load, q ? 200 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q, sort, cat]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!list) return;
    let alive = true;
    api(listUrl(0, Math.max(PAGE, shown))).then(r => alive && setList(r)).catch(() => {});
    return () => { alive = false; };
  }, [state.pricesAt?.bazaar]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = () => {
    setMore(true);
    api(listUrl(shown, PAGE)).then(r => setList(l => ({ ...r, total: r.total, items: [...(l?.items || []), ...r.items.filter(x => !l?.items?.some(y => y.id === x.id))] })))
      .catch(() => {}).finally(() => setMore(false));
  };
  // Избранное грузится отдельно: видно всегда, даже если товар не попал в поиск или топ-300
  useEffect(() => {
    if (!watch.length) { setWatched([]); return; }
    let alive = true;
    api(`/bazaar?ids=${encodeURIComponent(watch.join(','))}`).then(r => alive && setWatched(r)).catch(() => {});
    return () => { alive = false; };
  }, [watch, state.pricesAt?.bazaar]);
  useEffect(() => {
    if (!id) { setCur(null); return; }
    if (picked) saveLocal(LAST, picked);
    let alive = true;
    api(`/bazaar?ids=${encodeURIComponent(id)}`).then(r => alive && setCur(r[0] || { id, name: id, missing: true })).catch(() => {});
    return () => { alive = false; };
  }, [id, picked, state.pricesAt?.bazaar]);
  useEffect(() => { api('/market/help').then(setHelp).catch(() => {}); }, []);

  const toggle = x => { const n = watch.includes(x) ? watch.filter(w => w !== x) : [...watch, x]; setWatch(n); saveLocal(WATCH, JSON.stringify(n)); };
  const pickSort = v => { setSort(v); saveLocal('sb-market-sort', v); };
  const pickCat = v => { setCat(v); saveLocal('sb-market-cat', v); };
  const rows = useMemo(() => {
    const base = tab === 'fav' ? watched : list?.items;
    if (!base) return null;
    const withPct = base.map(r => ({ ...r, spreadPct: r.buy > 0 ? (r.spread / r.buy) * 100 : 0, d1v: r.d1?.buy ?? null }));
    const filtered = tab === 'fav' && q ? withPct.filter(r => r.name.toLowerCase().includes(q.toLowerCase())) : withPct;
    if (!sort || tab !== 'fav') return filtered; // общий список уже отсортирован сервером
    const [k, d] = sort.split(':'); const dir = Number(d);
    const val = r => (k === 'd1' ? r.d1v : r[k]);
    return [...filtered].sort((a, b) => {
      if (k === 'name') return a.name.localeCompare(b.name, LOCALE) * dir;
      const va = val(a), vb = val(b);
      if (va == null) return 1; if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }, [list, watched, tab, sort, q]);

  // На телефоне сразу график (последний открытый товар или самый ходовой), список товаров — под ним
  const showList = true;
  const showMain = !!id;

  const side = (
    <Card className="mk-side" title={modeSwitch} right={<span className="muted tiny" title="Цены обновляются каждые 20 секунд">обновлено {ago(state.pricesAt?.bazaar)}</span>}>
      <input className="search" placeholder="Поиск: печенька, зачарованный алмаз, рекомб, wheat…" value={q} onChange={e => setQ(e.target.value)} aria-label="Поиск товара" />
      <div className="mk-tools">
        <div className="tc-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{q ? 'Найдено' : 'Все'}</button>
          <button type="button" role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>★ Избранное{watch.length ? ` ${watch.length}` : ''}</button>
        </div>
        <label className="mk-sort muted small"><span className="sr-only">Сортировка</span>
          <select value={sort} onChange={e => pickSort(e.target.value)} aria-label="Сортировка">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </div>
      {tab === 'all' && <MarketFilters order={BZ_CATS} counts={list?.facets?.cat} cat={cat} setCat={pickCat} />}
      {tab === 'all' && list && <div className="muted tiny mk-count" style={{ margin: "2px 0 6px" }}>{q ? `Найдено товаров: ${num(list.total)}` : `Всего товаров на Bazaar: ${num(list.total)}`}{list.total > rows?.length ? `, показано ${num(rows.length)}` : ''}</div>}
      {rows ? (rows.length ? (<>
        <ul className="mk-list" role="listbox" aria-label="Товары Bazaar">
          {rows.map((r, i) => {
            const d = r.d1v;
            return (<Fragment key={r.id}>
              {r.similar && !rows[i - 1]?.similar && <li className="mk-similar muted tiny" role="presentation">Похожие</li>}
              <li role="option" aria-selected={r.id === id} className={`mk-row ${r.id === id ? 'on' : ''}`} onClick={() => go(r.id)} onKeyDown={e => { if (e.key === 'Enter') go(r.id); }} tabIndex={0}>
                <button type="button" className={`star ${watch.includes(r.id) ? 'on' : ''}`} onClick={e => { e.stopPropagation(); toggle(r.id); }} title={watch.includes(r.id) ? 'Убрать из избранного' : 'В избранное'} aria-label="Избранное">★</button>
                <ItemIcon id={r.neuId || r.id} size={28} />
                <span className="mk-name"><span className="mk-title">{r.name}</span><span className="muted tiny">{priceTxt(r)}</span></span>
                <span className={`mk-chg ${d == null ? 'muted' : d >= 0 ? 'green' : 'red'}`} title="Изменение цены покупки за сутки">{d == null ? '—' : pctTxt(d)}</span>
              </li>
            </Fragment>);
          })}
        </ul>
        {tab === 'all' && list && list.total > rows.length && (
          <button type="button" className="btn ghost mk-more-btn" style={{ width: "100%", marginTop: 8, flex: "none" }} onClick={loadMore} disabled={more}>
            {more ? 'Загружаю…' : `Показать ещё ${num(Math.min(PAGE, list.total - rows.length))} из ${num(list.total - rows.length)}`}
          </button>
        )}
      </>) : <Empty>{tab === 'fav' ? 'В избранном пока пусто: нажми ★ у товара.' : 'Ничего не найдено.'}</Empty>) : <div className="loader"><div className="spinner" /></div>}
    </Card>
  );

  const spreadPct = cur?.buy > 0 ? (cur.spread / cur.buy) * 100 : null;
  const main = cur && (
    <div className="mk-main">
      {narrow && <button type="button" className="btn ghost mk-back" onClick={() => document.querySelector('.mk-pane.on .mk-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>↓ Выбрать другой товар</button>}
      <Card className="mk-head">
        <div className="mk-head-row">
          <button type="button" className="mk-head-icon" onClick={() => openItem(cur.neuId || cur.id)} title="Открыть карточку предмета"><ItemIcon id={cur.neuId || cur.id} size={48} /></button>
          <div className="mk-head-name">
            <h2><button type="button" className="link-btn" onClick={() => openItem(cur.neuId || cur.id)}>{cur.name}</button></h2>
            <div className="muted tiny">{cur.missing ? 'Товара сейчас нет на Bazaar' : 'Bazaar · цены каждые 20 секунд'}</div>
          </div>
          <button type="button" className={`star big ${watch.includes(cur.id) ? 'on' : ''}`} onClick={() => toggle(cur.id)} title={watch.includes(cur.id) ? 'Убрать из избранного' : 'В избранное'} aria-label="Избранное">★</button>
        </div>
        {!cur.missing && (
          <div className="mk-stats mk-key">
            <div><span>Купить сразу</span><b className="tc-buy">{coins(cur.buy)}</b>{cur.d1?.buy != null && <i className={cur.d1.buy >= 0 ? 'green' : 'red'}>{pctTxt(cur.d1.buy)} за сутки</i>}</div>
            <div><span>Продать сразу</span><b className="tc-sell">{coins(cur.sell)}</b>{cur.d1?.sell != null && <i className={cur.d1.sell >= 0 ? 'green' : 'red'}>{pctTxt(cur.d1.sell)} за сутки</i>}</div>
            <div><span>Спред</span><b className={cur.spread > 0 ? 'green' : ''}>{coins(cur.spread)}</b>{spreadPct != null && <i className="muted">{spreadPct.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}% от цены</i>}</div>
          </div>
        )}
      </Card>
      <Card className="mk-chart">
        <Suspense fallback={<div className="tc-over"><div className="spinner" /></div>}>
          <TradingChart key={cur.id} id={cur.id} name={cur.name} height={narrow ? 380 : 540} paused={!active} />
        </Suspense>
        <div className="muted tiny mk-credit">Графики: <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="link">TradingView Lightweight Charts™</a></div>
      </Card>
      {!cur.missing && (
        <Card title="Обороты и ордера" className="mk-more">
          <div className="mk-stats">
            <div><span>Куплено за неделю</span><b>{num(cur.buyWeek)}</b><i className="muted">{coins(cur.buyWeek * cur.buy)} монет</i></div>
            <div><span>Продано за неделю</span><b>{num(cur.sellWeek)}</b><i className="muted">{coins(cur.sellWeek * cur.sell)} монет</i></div>
            <div><span>Ордера на продажу</span><b>{num(cur.sellOrders)}</b><i className="muted">в них {num(cur.buyVol)} шт.</i></div>
            <div><span>Ордера на покупку</span><b>{num(cur.buyOrders)}</b><i className="muted">в них {num(cur.sellVol)} шт.</i></div>
          </div>
        </Card>
      )}
      {help?.texts && (
        <Card title="Как читать график" className="mk-help">
          <RefsProvider refs={help.refs}>
            <ul className="mk-help-list">{help.texts.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>
          </RefsProvider>
        </Card>
      )}
    </div>
  );

  return (
    <>
      {!narrow && showList && side}
      {showMain ? main || <div className="loader"><div className="spinner" /></div> : !narrow && <Empty>Выбери товар слева.</Empty>}
      {narrow && showList && side}
    </>
  );
}
