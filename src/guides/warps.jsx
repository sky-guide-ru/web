// Телепорты /warp в тексте сайта: плашка, которая знает, сработает ли команда у этого игрока.
// - ✓ работает: место открыто всем или игрок отметил свиток;
// - 🔒 нужен Travel Scroll: под текстом — где взять свиток и как дойти без него;
// - ⛔ нужен MVP+: EPIC-свитки работают только с MVP+ и выше, под текстом — дорога пешком.
// Таблица варпов приходит с общим словарём (GET /api/refs/lexicon → warps, core/src/guides/warps.js).
// Hypixel не сообщает, какие свитки открыты: отметки ставит игрок, они хранятся в этом браузере отдельно для каждого профиля.
import { useSyncExternalStore } from 'react';
import { useApp } from '../App.jsx';
import { profileKey, onViewChange } from '../api.js';
import { Rich } from './Rich.jsx';
import { getWarp, warpList, subscribe as subLex, getVersion as lexVersion } from './globalRefs.js';

const KEY = 'sb-warp-scrolls';
const MVP_PLUS = new Set(['MVP_PLUS', 'MVP_PLUS_PLUS', 'ADMIN', 'GAME_MASTER', 'YOUTUBER', 'MODERATOR', 'HELPER', 'STAFF', 'OWNER']);

// --- отметки свитков: общий стор, чтобы плашки и список «Мои телепорты» менялись вместе ---
let marks = null, marksKey = null, ver = 0;
const subs = new Set();
const emit = () => { ver++; subs.forEach(f => f()); };
function load() {
  const k = profileKey(KEY);
  if (k === marksKey && marks) return marks;
  marksKey = k;
  try { marks = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch { marks = {}; }
  return marks;
}
onViewChange(() => { marks = null; emit(); });
const subMarks = f => { subs.add(f); const off = subLex(f); return () => { subs.delete(f); off(); }; };
const snap = () => `${ver}:${lexVersion()}`;

export function setScroll(warp, on) {
  const m = { ...load() };
  if (on) m[warp] = true; else delete m[warp];
  marks = m;
  try { localStorage.setItem(marksKey, JSON.stringify(m)); } catch { /* браузер не даёт сохранить */ }
  emit();
}

/** Ранг и отметки текущего профиля. rank: null — профиль не открыт, про MVP+ не судим. */
export function useWarpAccess() {
  useSyncExternalStore(subMarks, snap, snap);
  const m = useApp()?.state?.member;
  const rankId = m?.rank?.id || null;
  return { rankId, mvp: rankId ? MVP_PLUS.has(rankId) : null, bingo: m?.gameMode === 'bingo', marks: load() };
}

/** 'ok' | 'scroll' | 'rank' | 'plain' (варпа нет в таблице) */
export function warpStatus(e, a) {
  if (!e) return 'plain';
  if (e.rarity === 'free' || a.bingo) return 'ok';
  if (e.rarity === 'EPIC' && a.mvp === false) return 'rank';
  return a.marks[e.warp] ? 'ok' : 'scroll';
}

const ICON = { ok: '✓', scroll: '🔒', rank: '⛔' };
const TITLE = { ok: 'Телепорт работает', scroll: 'Нужен Travel Scroll', rank: 'Только с MVP+' };

/** Плашка /warp X. onOpen — открыть подробную подсказку (RefsProvider). */
export function WarpChip({ warp, onOpen }) {
  const a = useWarpAccess();
  const e = getWarp(warp);
  const st = warpStatus(e, a);
  const cls = `warp-chip warp-${st}`;
  const body = <>{ICON[st] && <span aria-hidden="true">{ICON[st]} </span>}{st === 'rank' ? <s>/warp {warp}</s> : `/warp ${warp}`}</>;
  if (!e || !onOpen) return <code className={cls} title={TITLE[st]}>{body}</code>;
  return (
    <code className={cls} title={TITLE[st]} role="button" tabIndex={0}
      onClick={ev => onOpen(`w:${warp}`, ev)}
      onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') onOpen(`w:${warp}`, ev); }}>{body}</code>
  );
}

const RARITY_CLS = { RARE: 'warp-rare', EPIC: 'warp-epic' };
function ScrollLine({ e }) {
  return (
    <span className="warp-scroll">
      Свиток <span className={RARITY_CLS[e.rarity]}>{e.rarity}</span> <Rich text={e.place} />{e.how && <> — <Rich text={e.how} /></>}.
    </span>
  );
}

function Way({ e, a, onOpen }) {
  if (e.via) {
    const far = e.via.dist > 0 ? `, дальше ~${e.via.dist} блоков пешком` : ', дальше пешком';
    return <><WarpChip warp={e.via.warp} onOpen={onOpen} />{far}.</>;
  }
  return e.route ? <Rich text={e.route} /> : null;
}

/** Строка под текстом: как быть, если телепорт не сработает. null — всё в порядке. */
export function WarpAlt({ warp, onOpen }) {
  const a = useWarpAccess();
  const e = getWarp(warp);
  const st = warpStatus(e, a);
  if (st !== 'scroll' && st !== 'rank') return null;
  const way = (e.via || e.route) ? <Way e={e} a={a} onOpen={onOpen} /> : null;
  return (
    <span className={`warp-alt warp-alt-${st}`}>
      {st === 'rank'
        ? <><b>/warp {warp} — только с MVP+.</b>{way && <> Дорога: {way}</>}</>
        : <><b>Пока нет свитка:</b> {way || 'дорога пешком.'}<br /><ScrollLine e={e} /></>}
    </span>
  );
}

/** Тело закреплённой подсказки для плашки (RefTip). */
export function WarpTip({ warp, onOpen }) {
  const a = useWarpAccess();
  const e = getWarp(warp);
  if (!e) return null;
  const st = warpStatus(e, a);
  const marked = !!a.marks[e.warp];
  return (
    <>
      <div className="gref-tip-head"><div><b>/warp {warp}</b><div className="gref-kind">{e.place}</div></div></div>
      {e.rarity === 'free' && <p className="gref-text">Открыт всем игрокам, свиток не нужен.</p>}
      {e.rarity !== 'free' && (
        <>
          <p className="gref-text">
            {st === 'rank' ? 'Свиток EPIC: телепорт работает только с рангом MVP+ и выше.'
              : st === 'ok' ? (a.bingo ? 'В Bingo все свитки открыты.' : 'Свиток отмечен как открытый.')
              : 'Варп открывается свитком. Свиток вечный: один раз ПКМ — и варп открыт навсегда.'}
          </p>
          <p className="gref-text small"><ScrollLine e={e} /></p>
          {st !== 'ok' && (e.via || e.route) && <p className="gref-text small"><span className="muted">Без телепорта: </span><Way e={e} a={a} onOpen={onOpen} /></p>}
          {st !== 'rank' && !a.bingo && (
            <button className="btn sm" onClick={() => setScroll(e.warp, !marked)}>{marked ? 'Свиток ещё не открыт' : 'У меня свиток уже открыт'}</button>
          )}
          <p className="gref-foot">Hypixel не сообщает сайту, какие свитки открыты: отметка хранится в этом браузере.</p>
        </>
      )}
    </>
  );
}

// /warp name в тексте; имя — латиница, цифры и _
const WARP_RE = /\/warp ([a-z_]+)/g;

/** Разбивает строку на текст и { warp }. */
export function splitWarps(s) {
  if (!s || !s.includes('/warp ')) return [s];
  const out = [];
  let last = 0;
  for (const m of s.matchAll(WARP_RE)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ warp: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** «Мои телепорты»: все свитки с отметками (секция гайда «Души и коллекции»). */
export function WarpScrolls() {
  const a = useWarpAccess();
  const list = warpList().filter(e => e.rarity !== 'free');
  if (!list.length) return <p className="muted small">Список свитков загружается…</p>;
  const rank = a.rankId ? (a.mvp ? 'есть MVP+: доступны и EPIC-свитки' : 'нет MVP+: EPIC-свитки не работают') : null;
  return (
    <>
      {rank && <p className="muted small">Ранг из профиля Hypixel: {rank}.</p>}
      <div className="table-scroll">
        <table className="table guide-table warp-table">
          <thead><tr><th>Свиток</th><th>Варп</th><th>Где взять</th></tr></thead>
          <tbody>
            {list.map(e => {
              const st = warpStatus(e, a);
              return (
                <tr key={e.warp} className={st === 'rank' ? 'muted' : ''}>
                  <td>
                    <label className="warp-check">
                      <input type="checkbox" checked={st === 'ok'} disabled={st === 'rank' || a.bingo} onChange={ev => setScroll(e.warp, ev.target.checked)} />
                      {' '}<Rich text={e.place} /> <span className={RARITY_CLS[e.rarity]}>{e.rarity}</span>
                    </label>
                  </td>
                  <td><code>/warp {e.warp}</code></td>
                  <td>{e.how ? <Rich text={e.how} /> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
