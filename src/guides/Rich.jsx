// Текст гайда со ссылками: предметы, сеты, питомцы, NPC, мобы, места и механики подчёркнуты пунктиром.
// Наведение — короткая подсказка, клик по предмету — его карточка (как в вики), клик по остальному — закреплённая
// подсказка с объяснением, «как это делать» и связанными предметами. Словарь приходит с сервера: guide.refs (server/guides/refs.js).
// Плюс общий словарь всего сайта (globalRefs.js): любой игровой термин в <Rich text=…/> получает подсказку сам,
// даже если страница не прислала refs. Корневой <RefsProvider> стоит в App.jsx, так что Rich работает на любой странице.
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { RARITY_COLOR } from '../api.js';
import { useApp } from '../App.jsx';
import { ensureLexicon, globalData, splitGlobal, subscribe, getVersion } from './globalRefs.js';
import { WarpChip, WarpAlt, WarpTip, splitWarps } from './warps.jsx';

const KIND_RU = { mech: 'Механика', stat: 'Характеристика', place: 'Место', event: 'Событие', cur: 'Валюта', npc: 'NPC', mob: 'Существо', skill: 'Навык', item: 'Предмет',
  floor: 'Этаж данжа', rarity: 'Редкость', reforge: 'Reforge', gem: 'Гем' };
const useGlobalVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);
const RefsCtx = createContext(null);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, '[\'’]');

/** Оборачивает гайд: словарь ссылок + одна общая плавающая подсказка. */
export function RefsProvider({ refs, children }) {
  const { openItem } = useApp();
  const [tip, setTip] = useState(null); // { ref, x, y, pinned }
  const re = useMemo(() => {
    const ps = Object.keys(refs?.phrases || {}).sort((a, b) => b.length - a.length);
    if (!ps.length) return null;
    try { return new RegExp(`(?<![\\p{L}\\p{N}])(${ps.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu'); } catch { return null; }
  }, [refs]);
  const norm = useMemo(() => {
    const m = new Map();
    for (const [p, r] of Object.entries(refs?.phrases || {})) m.set(p.replace(/’/g, '\''), r);
    return m;
  }, [refs]);
  const lookup = useCallback(p => norm.get(p.replace(/’/g, '\'')), [norm]);
  const gv = useGlobalVersion();
  useEffect(() => {
    // словарь не нужен для первой отрисовки: грузим, когда браузер освободится
    const ric = window.requestIdleCallback || (f => setTimeout(f, 300));
    ric(() => ensureLexicon(), { timeout: 1500 });
  }, []);
  // Данные подсказок: сначала свои (refs страницы), потом общего словаря
  const own = refs?.data;
  const getData = useCallback(ref => (ref.startsWith('w:') ? { kind: 'warp', warp: ref.slice(2) } : own?.[ref] || globalData(ref)), [own, gv]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = useCallback((ref, e, pinned = false) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip(t => (t?.pinned && !pinned ? t : { ref, x: r.left, y: r.bottom, top: r.top, pinned }));
  }, []);
  const hide = useCallback(() => setTip(t => (t?.pinned ? t : null)), []);
  const close = useCallback(() => setTip(null), []);
  const activate = useCallback((ref, e) => {
    e.preventDefault(); e.stopPropagation();
    const d = getData(ref);
    if (d?.kind === 'item') { setTip(null); openItem(d.id); }
    else show(ref, e, true);
  }, [getData, openItem, show]);

  // Закреплённая подсказка закрывается по Esc, клику мимо и прокрутке
  useEffect(() => {
    if (!tip?.pinned) return;
    const key = e => { if (e.key === 'Escape') close(); };
    const down = e => { if (!e.target.closest?.('.gref-tip') && !e.target.closest?.('.gref')) close(); };
    addEventListener('keydown', key);
    addEventListener('pointerdown', down, true);
    return () => { removeEventListener('keydown', key); removeEventListener('pointerdown', down, true); };
  }, [tip?.pinned, close]);

  const value = useMemo(() => ({ re, lookup, getData, show, hide, activate }), [re, lookup, getData, show, hide, activate]);
  const tipData = tip ? getData(tip.ref) : null;
  return (
    <RefsCtx.Provider value={value}>
      {children}
      {/* В body: у карточек гайда есть transform-анимации, внутри них position: fixed считается от карточки */}
      {tip && tipData && createPortal(<RefTip d={tipData} tip={tip} onClose={close} openItem={id => { close(); openItem(id); }} />, document.body)}
    </RefsCtx.Provider>
  );
}

function RefTip({ d, tip, onClose, openItem }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: tip.x, top: tip.y + 6, vis: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(8, Math.min(tip.x, innerWidth - w - 8));
    const below = tip.y + 6 + h < innerHeight - 8;
    setPos({ left, top: below ? tip.y + 6 : Math.max(8, tip.top - h - 6), vis: true });
  }, [tip, d]);
  const isItem = d.kind === 'item';
  if (d.kind === 'warp') {
    return (
      <div ref={ref} className="gref-tip pinned" style={{ left: pos.left, top: pos.top, visibility: pos.vis ? 'visible' : 'hidden' }} role="dialog">
        <button className="x-btn sm gref-x" onClick={onClose} aria-label="Закрыть">×</button>
        <WarpTip warp={d.warp} />
      </div>
    );
  }
  return (
    <div ref={ref} className={`gref-tip ${tip.pinned ? 'pinned' : ''}`} style={{ left: pos.left, top: pos.top, visibility: pos.vis ? 'visible' : 'hidden' }} role="dialog">
      <div className="gref-tip-head">
        {isItem && <ItemIcon id={d.id} size={28} />}
        <div>
          <b style={isItem && d.rarity ? { color: RARITY_COLOR[d.rarity] } : undefined}>{isItem ? d.name : d.title}</b>
          <div className="gref-kind">{KIND_RU[d.kind] || ''}{d.where ? ` · ${d.where}` : ''}</div>
        </div>
        {tip.pinned && <button className="x-btn sm" onClick={onClose} aria-label="Закрыть">×</button>}
      </div>
      {isItem ? (
        <>
          {d.hint && <p className="gref-text"><span className="muted">Как получить: </span>{d.hint}</p>}
          <p className="gref-foot">Нажми — откроется карточка: пошаговое получение, цены, рецепт</p>
        </>
      ) : (
        <>
          {d.text && <p className="gref-text">{d.text}</p>}
          {d.how?.length > 0 && (
            <>
              <div className="gref-sub">Как это делать</div>
              <ol className="gref-how">{d.how.map((h, i) => <li key={i}>{h}</li>)}</ol>
            </>
          )}
          {(d.warp || d.coords) && (
            <p className="gref-text small">
              {d.warp && <>Телепорт: <WarpChip warp={d.warp} /></>}
              {d.coords && <>{d.warp ? ' · ' : ''}координаты {d.coords.join(' ')}</>}
            </p>
          )}
          {d.items?.length > 0 && (
            <>
              <div className="gref-sub">{d.kind === 'npc' ? 'Продаёт' : d.kind === 'mob' ? 'Дроп' : 'Связанные предметы'}</div>
              <div className="gref-items">{d.items.map(id => <ItemIcon key={id} id={id} size={30} onClick={() => openItem(id)} />)}</div>
            </>
          )}
          {!tip.pinned && <p className="gref-foot">Нажми, чтобы закрепить подсказку</p>}
        </>
      )}
    </div>
  );
}

/** Одна ссылка. refKey — 'i:ID' | 't:key' | 'n:ID' | 'm:ID' | 'c:Имя'. */
export function RefLink({ refKey, children }) {
  const ctx = useContext(RefsCtx);
  useGlobalVersion();
  const d = ctx?.getData(refKey);
  if (!d) return <>{children}</>;
  const kind = d.kind === 'item' ? 'item' : 'term';
  return (
    <span
      className={`gref gref-${kind}`} role="button" tabIndex={0}
      style={d.kind === 'item' && d.rarity ? { '--gref-c': RARITY_COLOR[d.rarity] } : undefined}
      onMouseEnter={e => ctx.show(refKey, e)} onMouseLeave={ctx.hide}
      onFocus={e => ctx.show(refKey, e)} onBlur={ctx.hide}
      onClick={e => ctx.activate(refKey, e)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') ctx.activate(refKey, e); }}
    >{children}</span>
  );
}

/** Разбивает строку на текст и ссылки. */
export function splitRefs(text, ctx) {
  const s = String(text ?? '');
  if (!ctx?.re || !s) return [s];
  const out = [];
  let last = 0;
  ctx.re.lastIndex = 0;
  for (const m of s.matchAll(ctx.re)) {
    const ref = ctx.lookup(m[0]);
    if (!ref) continue;
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ ref, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Текст со ссылками. item — ссылка по умолчанию: если в тексте нет других ссылок, весь текст ведёт на этот предмет.
 *  auto={false} — только refs страницы, без общего словаря. */
export function Rich({ text, item, auto = true }) {
  const ctx = useContext(RefsCtx);
  useGlobalVersion();
  if (text == null || text === '') return null;
  // /warp name — плашка, которая знает, сработает ли телепорт у игрока (warps.jsx); остальной текст — ссылки
  let parts = splitWarps(String(text)).flatMap(p => (typeof p === 'string' ? splitRefs(p, ctx) : [p]));
  if (auto) parts = parts.flatMap(p => (typeof p === 'string' ? splitGlobal(p) : [p]));
  const linked = parts.some(p => typeof p === 'object');
  if (item && !linked) return <RefLink refKey={`i:${item}`}>{String(text)}</RefLink>;
  const warps = [...new Set(parts.filter(p => p?.warp).map(p => p.warp))];
  return (
    <>
      {parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span>
        : p.warp ? <WarpChip key={i} warp={p.warp} onOpen={ctx?.activate} />
        : <RefLink key={i} refKey={p.ref}>{p.text}</RefLink>)}
      {warps.map(w => <WarpAlt key={`alt-${w}`} warp={w} />)}
    </>
  );
}

export const useRefs = () => useContext(RefsCtx);
