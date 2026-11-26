// «Рынок» → Auction House: предметы аукциона слева (поиск по-русски и по-английски, избранное, изменение за сутки),
// справа — lowest BIN, вторая цена, настоящие продажи, варианты (звёзды, Recomb, редкость питомца) и график.
// Адрес: #/market/ah:<ключ>, например #/market/ah:TITANIUM_TALISMAN или #/market/ah:HYPERION@5r.
// Данные: GET /api/market/ah (список), /api/market/ah?ids=…&vars=1 (карточка), /api/market/candles/<ключ>?m=ah (график).
import { useState, useEffect, useMemo, lazy, Suspense, Fragment } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, api, ago, saveLocal } from '../api.js';
import { useApp } from '../App.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import '../components/chart/chart.css';

import MarketFilters, { AH_CATS } from '../components/MarketFilters.jsx';
import { chunk } from '../update.js';
const TradingChart = lazy(chunk(() => import('../components/chart/TradingChart.jsx')));
const WATCH = 'sb-watchlist-ah';
export const AH_LAST = 'sb-market-last-ah';
const SORTS = [
  ['', 'по обороту'], ['d1:-1', 'рост за сутки'], ['d1:1', 'падение за сутки'], ['buy:-1', 'дороже'], ['buy:1', 'дешевле'],
  ['sold:-1', 'чаще продают'], ['count:-1', 'больше лотов'], ['name:1', 'по названию'],
];
const PAGE = 200;
const pctTxt = p => (p == null ? '' : `${p > 0 ? '+' : ''}${p.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`);
export const ahHash = key => `#/market/ah:${encodeURIComponent(key)}`;
const go = key => {
  location.hash = ahHash(key);
  if (matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => document.querySelector('.mk-pane.on .mk-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};
// Ключ варианта «HYPERION@5r» → предмет «HYPERION» (для иконки и карточки предмета)
const baseOf = key => String(key).split('@')[0];
const rowTxt = r => {
  const parts = [];
  if (r.price > 0) parts.push(`BIN ${coins(r.price)}`); else if (r.median > 0) parts.push(`продавали за ${coins(r.median)}`); else parts.push('сейчас нет лотов');
  if (r.count) parts.push(`лотов ${num(r.count)}`);
  if (r.sold24) parts.push(`продаж за сутки ${num(r.sold24)}`);
  return parts.join(' · ');
};
const sortRows = (list, sort) => {
  if (!sort) return list;
  const [k, d] = sort.split(':'); const dir = Number(d);
  const val = r => (k === 'buy' ? r.price || r.median || null : k === 'sold' ? r.sold24 : r[k]);
  return [...list].sort((a, b) => {
    if (k === 'name') return a.name.localeCompare(b.name, 'ru') * dir;
    const va = val(a), vb = val(b);
    if (va == null) return 1; if (vb == null) return -1;
    return (va - vb) * dir;
  });
};

/**
 * @param {{ state: any, picked: string|null, narrow: boolean, modeSwitch: any, active?: boolean }} props  active — вкладка на экране (скрытая не опрашивает график)
 */
export default function MarketAuction({ state, picked, narrow, modeSwitch, active = true }) {
  const { openItem } = useApp();
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState(() => localStorage.getItem('sb-market-ah-sort') || '');
  const [cat, setCat] = useState(() => localStorage.getItem('sb-market-ah-cat') || '');
  const [rarity, setRarity] = useState(() => localStorage.getItem('sb-market-ah-rarity') || '');
  const [watch, setWatch] = useState(() => { try { return JSON.parse(localStorage.getItem(WATCH) || '[]'); } catch { return []; } });
  const [watched, setWatched] = useState([]);
  // Избранное общее у Bazaar и аукциона: при возврате на вкладку берём то, что могли поменять на соседней
  useEffect(() => {
    if (!active) return;
    const v = localStorage.getItem(WATCH) || '[]';
    if (v !== JSON.stringify(watch)) { try { setWatch(JSON.parse(v)); } catch { /* испорченная запись — оставляем как есть */ } }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cur, setCur] = useState(null);
  const [help, setHelp] = useState(null);
  const [copied, setCopied] = useState(false);
  const id = picked || localStorage.getItem(AH_LAST) || list?.items?.[0]?.id || null;
  const at = state.pricesAt?.auctions;

  const shown = list?.items?.length || 0;
  const listUrl = (offset, limit) => `/market/ah?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}&cat=${encodeURIComponent(cat)}&rarity=${encodeURIComponent(rarity)}&offset=${offset}&limit=${limit}`;
  useEffect(() => {
    let alive = true, t;
    // Сервер не ответил (502 при перезапуске) — пробуем снова через 5 с, иначе список так и висел со спиннером
    const load = () => api(listUrl(0, PAGE)).then(r => alive && setList(r)).catch(() => { if (alive) t = setTimeout(load, 5000); });
    t = setTimeout(load, q ? 200 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q, sort, cat, rarity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!list) return;
    let alive = true;
    api(listUrl(0, Math.max(PAGE, shown))).then(r => alive && setList(r)).catch(() => {});
    return () => { alive = false; };
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = () => {
    setMore(true);
    api(listUrl(shown, PAGE)).then(r => setList(l => ({ ...r, total: r.total, items: [...(l?.items || []), ...r.items.filter(x => !l?.items?.some(y => y.id === x.id))] })))
      .catch(() => {}).finally(() => setMore(false));
  };
  useEffect(() => {
    if (!watch.length) { setWatched([]); return; }
    let alive = true;
    api(`/market/ah?ids=${encodeURIComponent(watch.join(','))}`).then(r => alive && setWatched(r)).catch(() => {});
    return () => { alive = false; };
  }, [watch, at]);
  useEffect(() => {
    if (!id) { setCur(null); return; }
    if (picked) saveLocal(AH_LAST, picked);
    let alive = true;
    api(`/market/ah?ids=${encodeURIComponent(id)}&vars=1`).then(r => alive && setCur(r[0] || { id, name: id, missing: true })).catch(() => {});
    return () => { alive = false; };
  }, [id, picked, at]);
  useEffect(() => { api('/market/ah-help').then(setHelp).catch(() => {}); }, []);

  const toggle = x => { const n = watch.includes(x) ? watch.filter(w => w !== x) : [...watch, x]; setWatch(n); saveLocal(WATCH, JSON.stringify(n)); };
  const pickSort = v => { setSort(v); saveLocal('sb-market-ah-sort', v); };
  const pickCat = v => { setCat(v); saveLocal('sb-market-ah-cat', v); };
  const pickRarity = v => { setRarity(v); saveLocal('sb-market-ah-rarity', v); };
  const rows = useMemo(() => {
    if (tab !== 'fav') return list?.items || null;
    const f = q ? watched.filter(r => r.name.toLowerCase().includes(q.toLowerCase())) : watched;
    return sortRows(f, sort);
  }, [list, watched, tab, sort, q]);

  const copyLot = () => {
    if (!cur?.auction) return;
    navigator.clipboard?.writeText(`/viewauction ${cur.auction}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const side = (
    <Card className="mk-side" title={modeSwitch} right={<span className="muted tiny" title="Сайт просматривает весь аукцион раз в 3 минуты">обновлено {ago(at)}</span>}>
      <input className="search" placeholder="Поиск: титановый талисман, hyperion, дракон…" value={q} onChange={e => setQ(e.target.value)} aria-label="Поиск предмета на аукционе" />
      <div className="mk-tools">
        <div className="tc-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{q ? 'Найдено' : 'Все'}</button>
          <button type="button" role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>★ Избранное{watch.length ? ` ${watch.length}` : ''}</button>
        </div>
        <label className="mk-sort muted small"><span className="sr-only">Сортировка</span>
          <select value={sort} onChange={e => pickSort(e.target.value)} aria-label="Сортировка">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </div>
      {tab === 'all' && <MarketFilters order={AH_CATS} counts={list?.facets?.cat} cat={cat} setCat={pickCat} rarities={list?.facets?.rarity || {}} rarity={rarity} setRarity={pickRarity} />}
      {tab === 'all' && list && <div className="muted tiny mk-count" style={{ margin: '2px 0 6px' }}>{q ? `Найдено предметов: ${num(list.total)}` : `Всего предметов на аукционе: ${num(list.total)}`}{list.total > rows?.length ? `, показано ${num(rows.length)}` : ''}</div>}
      {rows ? (rows.length ? (<>
        <ul className="mk-list" role="listbox" aria-label="Предметы аукциона">
          {rows.map((r, i) => (<Fragment key={r.id}>
            {r.similar && !rows[i - 1]?.similar && <li className="mk-similar muted tiny" role="presentation">Похожие</li>}
            <li role="option" aria-selected={r.id === id} className={`mk-row ${r.id === id ? 'on' : ''}`} onClick={() => go(r.id)} onKeyDown={e => { if (e.key === 'Enter') go(r.id); }} tabIndex={0}>
              <button type="button" className={`star ${watch.includes(r.id) ? 'on' : ''}`} onClick={e => { e.stopPropagation(); toggle(r.id); }} title={watch.includes(r.id) ? 'Убрать из избранного' : 'В избранное'} aria-label="Избранное">★</button>
              <ItemIcon id={baseOf(r.id)} size={28} />
              <span className="mk-name"><span className="mk-title">{r.name}</span><span className="muted tiny">{rowTxt(r)}</span></span>
              <span className={`mk-chg ${r.d1 == null ? 'muted' : r.d1 >= 0 ? 'green' : 'red'}`} title="Изменение lowest BIN за сутки">{r.d1 == null ? '—' : pctTxt(r.d1)}</span>
            </li>
          </Fragment>))}
        </ul>
        {tab === 'all' && list && list.total > rows.length && (
          <button type="button" className="btn ghost mk-more-btn" style={{ width: '100%', marginTop: 8, flex: 'none' }} onClick={loadMore} disabled={more}>
            {more ? 'Загружаю…' : `Показать ещё ${num(Math.min(PAGE, list.total - rows.length))} из ${num(list.total - rows.length)}`}
          </button>
        )}
      </>) : <Empty>{tab === 'fav' ? 'В избранном пока пусто: нажми ★ у предмета.' : 'Ничего не найдено.'}</Empty>) : <div className="loader"><div className="spinner" /></div>}
    </Card>
  );

  const gap = cur?.price > 0 && cur?.second > 0 ? (cur.second / cur.price - 1) * 100 : null;
  const vars = cur?.variants || [];
  const main = cur && (
    <div className="mk-main">
      {narrow && <button type="button" className="btn ghost mk-back" onClick={() => document.querySelector('.mk-pane.on .mk-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>↓ Выбрать другой предмет</button>}
      <Card className="mk-head" news="ah">
        <div className="mk-head-row">
          <button type="button" className="mk-head-icon" onClick={() => openItem(baseOf(cur.id))} title="Открыть карточку предмета"><ItemIcon id={baseOf(cur.id)} size={48} /></button>
          <div className="mk-head-name">
            <h2><button type="button" className="link-btn" onClick={() => openItem(baseOf(cur.id))}>{cur.name}</button></h2>
            <div className="muted tiny">{cur.missing ? 'Предмета сейчас нет на аукционе' : 'Auction House · весь аукцион раз в 3 минуты'}</div>
          </div>
          <button type="button" className={`star big ${watch.includes(cur.id) ? 'on' : ''}`} onClick={() => toggle(cur.id)} title={watch.includes(cur.id) ? 'Убрать из избранного' : 'В избранное'} aria-label="Избранное">★</button>
        </div>
        {vars.length > 0 && (
          <div className="mk-vars tc-seg" role="group" aria-label="Вариант предмета">
            {vars.map(v => (
              <button key={v.id} type="button" className={v.id === cur.id ? 'on' : ''} aria-pressed={v.id === cur.id} onClick={() => go(v.id)}
                title={v.price > 0 ? `Lowest BIN ${coins(v.price)}, лотов ${num(v.count)}` : 'Сейчас нет лотов'}>{v.label}</button>
            ))}
          </div>
        )}
        {!cur.missing && (
          <div className="mk-stats mk-key">
            <div><span>Lowest BIN</span><b className="tc-buy">{cur.price > 0 ? coins(cur.price) : 'нет лотов'}</b>{cur.d1 != null && <i className={cur.d1 >= 0 ? 'green' : 'red'}>{pctTxt(cur.d1)} за сутки</i>}</div>
            <div><span>Продают за</span><b className="tc-sell">{cur.median > 0 ? coins(cur.median) : '—'}</b><i className="muted">{cur.median > 0 ? 'медиана продаж за 3 дня' : 'продаж пока не было'}</i></div>
            <div><span>Вторая цена</span><b>{cur.second > 0 ? coins(cur.second) : '—'}</b>{gap != null && <i className="muted">на {gap.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% дороже</i>}</div>
          </div>
        )}
      </Card>
      <Card className="mk-chart">
        <Suspense fallback={<div className="tc-over"><div className="spinner" /></div>}>
          <TradingChart key={cur.id} id={cur.id} name={cur.name} market="ah" height={narrow ? 380 : 540} paused={!active} />
        </Suspense>
        <div className="muted tiny mk-credit">Графики: <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="link">TradingView Lightweight Charts™</a></div>
      </Card>
      {!cur.missing && (
        <Card title="Лоты и продажи" className="mk-more">
          <div className="mk-stats">
            <div><span>Лотов BIN сейчас</span><b>{num(cur.count)}</b></div>
            <div><span>Продано за сутки</span><b>{num(cur.sold24)}</b>{cur.sold24 > 0 && cur.median > 0 && <i className="muted">≈ {coins(cur.sold24 * cur.median)} монет</i>}</div>
            <div><span>Продано за неделю</span><b>{num(cur.sold7)}</b></div>
            <div><span>Последняя продажа</span><b>{cur.last > 0 ? coins(cur.last) : '—'}</b>{cur.lastAt > 0 && <i className="muted">{ago(cur.lastAt)}</i>}</div>
            {cur.max > 0 && <div><span>Питомец 100 уровня</span><b>{coins(cur.max)}</b><i className="muted">lowest BIN</i></div>}
          </div>
          {cur.auction && (
            <button type="button" className="btn ghost small" style={{ marginTop: 10 }} onClick={copyLot} title="Скопировать команду: вставь её в чат игры, чтобы открыть лот">
              {copied ? 'Скопировано' : 'Скопировать /viewauction самого дешёвого лота'}
            </button>
          )}
        </Card>
      )}
      {help?.texts && (
        <Card title="Как читать цены аукциона" className="mk-help">
          <RefsProvider refs={help.refs}>
            <ul className="mk-help-list">{help.texts.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>
          </RefsProvider>
        </Card>
      )}
    </div>
  );

  return (
    <>
      {!narrow && side}
      {id ? main || <div className="loader"><div className="spinner" /></div> : !narrow && <Empty>Выбери предмет слева.</Empty>}
      {narrow && side}
    </>
  );
}
