import { LOCALE } from '../i18n.js';
// «История»: графики всех показателей профиля за сутки/неделю/месяц/год и «за это время ты получил».
// Данные — /api/history (снимок раз в час; после 30 дней по дню, после года по неделе — server/history.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui.jsx';
import { api, coins, num } from '../api.js';

const DAY = 86400_000;
const RANGES = [
  { id: '1d', label: 'Сутки', ms: DAY, word: 'за сутки' },
  { id: '7d', label: 'Неделя', ms: 7 * DAY, word: 'за неделю' },
  { id: '30d', label: 'Месяц', ms: 30 * DAY, word: 'за месяц' },
  { id: '365d', label: 'Год', ms: 365 * DAY, word: 'за год' },
  { id: 'all', label: 'Всё время', ms: 0, word: 'за всё время' },
];

const lvl = v => (v == null ? '—' : (Math.floor(v * 100) / 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 }));
const xp = v => `${coins(v)} опыта`;
const SKILL_COLOR = '#4ade80', SLAYER_COLOR = '#ff7a59', DUNGEON_COLOR = '#ff5e5e', MINING_COLOR = '#60a5fa', MAIN_COLOR = '#f5c542', OTHER_COLOR = '#c879ff';

/** Все показатели, у которых есть история. names — русские названия скиллов/слееров/классов из профиля. */
function buildMetrics(m) {
  const sk = m?.skills || {}, sl = m?.slayers || {}, cl = m?.dungeons?.classes || {};
  return [
    { group: 'main', key: 'nw', label: 'Состояние', fmt: coins, color: MAIN_COLOR, money: true },
    { group: 'main', key: 'items', label: 'Предметы', fmt: coins, color: MAIN_COLOR, money: true },
    { group: 'main', key: 'coins', label: 'Монеты (кошелёк + Bank)', fmt: coins, color: MAIN_COLOR, money: true },
    { group: 'main', key: 'sb', label: 'Уровень SkyBlock', fmt: lvl, color: OTHER_COLOR },
    { group: 'main', key: 'mp', label: 'Magical Power', fmt: num, color: OTHER_COLOR },
    { group: 'main', key: 'cata', label: 'Catacombs', fmt: lvl, color: DUNGEON_COLOR },
    ...Object.keys(sk).map(k => ({ group: 'skills', key: `skills.${k}`, label: sk[k].name || k, fmt: xp, color: SKILL_COLOR })),
    ...Object.keys(sl).map(k => ({ group: 'slayers', key: `slayers.${k}`, label: sl[k].name || k, fmt: xp, color: SLAYER_COLOR })),
    { group: 'dungeons', key: 'cata', label: 'Catacombs', fmt: lvl, color: DUNGEON_COLOR },
    ...Object.keys(cl).map(k => ({ group: 'dungeons', key: `classes.${k}`, label: cl[k].name || k, fmt: lvl, color: DUNGEON_COLOR })),
    { group: 'dungeons', key: 'secrets', label: 'Секреты', fmt: num, color: DUNGEON_COLOR },
    { group: 'dungeons', key: 'floors', label: 'Пройдено этажей', fmt: num, color: DUNGEON_COLOR },
    { group: 'gather', key: 'hotm', label: 'Heart of the Mountain', fmt: lvl, color: MINING_COLOR },
    { group: 'gather', key: 'powder.mithril', label: 'Mithril Powder (всего)', fmt: coins, color: MINING_COLOR },
    { group: 'gather', key: 'powder.gemstone', label: 'Gemstone Powder (всего)', fmt: coins, color: MINING_COLOR },
    { group: 'gather', key: 'powder.glacite', label: 'Glacite Powder (всего)', fmt: coins, color: MINING_COLOR },
    { group: 'gather', key: 'hotfXp', label: 'Heart of the Forest', fmt: xp, color: SKILL_COLOR },
    { group: 'gather', key: 'garden', label: 'Опыт Garden', fmt: xp, color: SKILL_COLOR },
    { group: 'gather', key: 'visitors', label: 'Garden Visitors', fmt: num, color: SKILL_COLOR },
    { group: 'gather', key: 'trophy', label: 'Trophy Fish', fmt: num, color: MINING_COLOR },
    { group: 'gather', key: 'kuudra', label: 'Забеги Kuudra', fmt: num, color: SLAYER_COLOR },
    { group: 'gather', key: 'rep', label: 'Репутация Crimson Isle', fmt: num, color: SLAYER_COLOR },
    { group: 'other', key: 'bank', label: 'Bank', fmt: coins, color: MAIN_COLOR, money: true },
    { group: 'other', key: 'purse', label: 'Purse', fmt: coins, color: MAIN_COLOR, money: true },
    { group: 'other', key: 'souls', label: 'Fairy Souls', fmt: num, color: OTHER_COLOR },
    { group: 'other', key: 'petScore', label: 'Pet Score', fmt: num, color: OTHER_COLOR },
    { group: 'other', key: 'pets', label: 'Питомцев', fmt: num, color: OTHER_COLOR },
    { group: 'other', key: 'museum', label: 'Предметов в музее', fmt: num, color: OTHER_COLOR },
    { group: 'other', key: 'bestiary', label: 'Вехи бестиария', fmt: num, color: OTHER_COLOR },
    { group: 'other', key: 'tasks', label: 'Задач SkyBlock', fmt: num, color: OTHER_COLOR },
  ];
}
const GROUPS = [['main', 'Главное'], ['skills', 'Skills'], ['slayers', 'Slayers'], ['dungeons', 'Dungeons'], ['gather', 'Mining'], ['other', 'Прочее']];

const short = mt => (mt.fmt === xp ? coins : mt.fmt);
const at = (p, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p);
/** Точки одного показателя: [t, v], без снимков, где поля ещё не было */
export function series(points, key) {
  const out = [];
  for (const p of points) { const v = at(p, key); if (typeof v === 'number' && Number.isFinite(v)) out.push([p.t, v]); }
  return out;
}

const dateFmt = (t, short) => new Date(t).toLocaleString(LOCALE, short ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
const fullDate = t => new Date(t).toLocaleString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const signed = (d, fmt) => `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`;

/** Большой график с подписями осей и подсказкой при наведении/касании */
function BigChart({ pts, fmt, axisFmt = fmt, color, short }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 600, H = 220, PAD = 10;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = xs[0], maxX = xs[xs.length - 1];
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const sx = x => ((x - minX) / (maxX - minX || 1)) * W;
  const sy = y => H - PAD - ((y - minY) / (maxY - minY)) * (H - PAD * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  const gid = `hc-${color.replace('#', '')}`;
  const move = e => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * (maxX - minX) + minX;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - x) < Math.abs(pts[best][0] - x)) best = i;
    setHover(best);
  };
  const h = hover != null ? pts[hover] : null;
  const ticks = [maxY, (maxY + minY) / 2, minY];
  return (
    <div className="hc-big">
      <div className="hc-yaxis tiny muted">{ticks.map((v, i) => <span key={i}>{axisFmt(v)}</span>)}</div>
      <div className="hc-plot" ref={ref} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label="График">
          <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[0.5].map(f => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="hc-grid" vectorEffect="non-scaling-stroke" />)}
          <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
          <path d={d} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {h && <line x1={sx(h[0])} x2={sx(h[0])} y1="0" y2={H} className="hc-cursor" vectorEffect="non-scaling-stroke" />}
        </svg>
        {h && (
          <>
            <span className="spark-dot" style={{ left: `${(sx(h[0]) / W) * 100}%`, top: `${(sy(h[1]) / H) * 100}%`, '--c': color }} />
            <div className={`hc-tip small ${sx(h[0]) > W * 0.6 ? 'left' : ''}`} style={{ left: `${(sx(h[0]) / W) * 100}%` }}>
              <b>{fmt(h[1])}</b>
              <span className="muted tiny">{fullDate(h[0])}</span>
            </div>
          </>
        )}
      </div>
      <div className="hc-xaxis tiny muted"><span>{dateFmt(minX, short)}</span><span>{dateFmt((minX + maxX) / 2, short)}</span><span>{dateFmt(maxX, short)}</span></div>
    </div>
  );
}

/** Мини-график для плитки (без подписей) */
function Mini({ pts, color }) {
  if (pts.length < 2) return <svg className="hc-mini" viewBox="0 0 100 28" />;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = xs[0], maxX = xs[xs.length - 1], minY = Math.min(...ys), maxY = Math.max(...ys);
  const flat = minY === maxY;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(((p[0] - minX) / (maxX - minX || 1)) * 100).toFixed(1)},${flat ? 14 : (26 - ((p[1] - minY) / (maxY - minY)) * 24).toFixed(1)}`).join(' ');
  return <svg className="hc-mini" viewBox="0 0 100 28" preserveAspectRatio="none"><path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeDasharray={flat ? '3 3' : undefined} vectorEffect="non-scaling-stroke" opacity={flat ? 0.5 : 1} /></svg>;
}

/** Изменения показателей за окно: [{ metric, pts, first, last, diff }] */
export function changes(points, metrics) {
  const seen = new Set();
  const out = [];
  for (const mt of metrics) {
    if (seen.has(mt.key)) continue;
    seen.add(mt.key);
    const pts = series(points, mt.key);
    if (!pts.length) continue;
    const first = pts[0][1], last = pts[pts.length - 1][1];
    out.push({ metric: mt, pts, first, last, diff: last - first });
  }
  return out;
}

export default function HistoryCharts({ state, className = 'span-12', id }) {
  const m = state.member;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [range, setRange] = useState(() => localStorage.getItem('sb-hist-range') || '7d');
  const [group, setGroup] = useState('main');
  const [pick, setPick] = useState('nw');
  // Новая часовая точка приходит в /api/state (облегчённая история) — тогда и перезапрашиваем полную
  const lastT = state.history?.[state.history.length - 1]?.t || 0;
  const viewKey = `${state.player?.uuid || ''}:${m?.profileId || ''}`;
  useEffect(() => {
    let off = false;
    api('/history').then(r => { if (!off) { setData(r); setErr(null); } }).catch(e => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [lastT, viewKey]);

  const metrics = useMemo(() => buildMetrics(m), [m]);
  const R = RANGES.find(r => r.id === range) || RANGES[1];
  const all = data?.points || [];
  const now = all.length ? all[all.length - 1].t : Date.now();
  const pts = useMemo(() => {
    if (!R.ms) return all;
    const from = now - R.ms;
    const i = all.findIndex(p => p.t >= from);
    return i < 0 ? all.slice(-1) : all.slice(Math.max(0, i - 1));
  }, [all, R.ms, now]);
  const ch = useMemo(() => changes(pts, metrics), [pts, metrics]);
  const byKey = Object.fromEntries(ch.map(c => [c.metric.key, c]));
  const setR = id2 => { setRange(id2); try { localStorage.setItem('sb-hist-range', id2); } catch { /* приватный режим */ } };

  // «За неделю ты получил»: самые заметные приросты (опыт скиллов/слееров, уровни, монеты)
  // Состояние — первым (может и упасть), дальше всё, что выросло: по относительному приросту
  const rel = c => Math.abs(c.diff) / (Math.abs(c.first) || 1);
  const gains = [
    ...ch.filter(c => c.metric.key === 'nw' && c.diff !== 0),
    ...ch.filter(c => !c.metric.money && c.diff > 0).sort((x, y) => rel(y) - rel(x)),
  ].slice(0, 8);

  const groupTiles = metrics.filter(mt => mt.group === group).map(mt => byKey[mt.key] ? { ...byKey[mt.key], metric: mt } : null)
    .filter(c => c && (c.last !== 0 || c.diff !== 0));
  const sel = byKey[pick] || groupTiles[0] || null;
  const span = all.length > 1 ? all[all.length - 1].t - all[0].t : 0;
  const days = Math.max(1, Math.round(span / DAY));

  return (
    <Card title="История" className={`history-card ${className}`} right={<span className="muted small">{data?.since ? `копится с ${new Date(data.since).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</span>}>
      <div id={id} className="hc-anchor" />
      <div className="hc-bar">
        <div className="chips" role="tablist" aria-label="Период">
          {RANGES.map(r => <button key={r.id} role="tab" aria-selected={range === r.id} className={`chip ${range === r.id ? 'active' : ''}`} onClick={() => setR(r.id)}>{r.label}</button>)}
        </div>
      </div>

      {err && <p className="neg small">Не удалось загрузить историю: {err}</p>}
      {!data && !err && <div className="spark-empty muted small"><i />Загружаю историю…</div>}
      {data && all.length < 2 && (
        <div className="spark-empty muted small"><i />История копится раз в час: первые графики появятся через пару часов.{data.tracked ? '' : ' У этого профиля история хранится, только пока его смотрят: постоянно она пишется для своего профиля и друзей с аккаунтом на сайте.'}</div>
      )}

      {data && all.length >= 2 && (
        <>
          {R.ms > span * 1.05 && span > 0 && <p className="muted tiny hc-note">Истории пока {days} {days % 10 === 1 && days % 100 !== 11 ? 'день' : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? 'дня' : 'дней'}: показываю всё, что есть.</p>}
          <div className="hc-gains">
            <div className="small"><b>{R.word[0].toUpperCase() + R.word.slice(1)} ты получил</b></div>
            {gains.length ? (
              <div className="hc-gain-list">
                {gains.map(c => (
                  <button key={c.metric.key} className={`hc-gain ${c.diff > 0 ? 'up' : 'down'}`} style={{ '--c': c.metric.color }} onClick={() => { setGroup(c.metric.group); setPick(c.metric.key); }}>
                    <b>{signed(c.diff, c.metric.fmt)}</b><span className="muted tiny">{c.metric.label}</span>
                  </button>
                ))}
              </div>
            ) : <div className="muted small">Пока без изменений: зайди в игру и покачайся — прирост появится здесь.</div>}
          </div>

          <div className="chips hc-groups" role="tablist" aria-label="Показатели">
            {GROUPS.map(([g, label]) => <button key={g} role="tab" aria-selected={group === g} className={`chip ${group === g ? 'active' : ''}`} onClick={() => { setGroup(g); setPick(null); }}>{label}</button>)}
          </div>

          {sel ? (
            <div className="hc-main">
              <div className="hc-head">
                <div><div className="muted small">{sel.metric.label}</div><div className="hc-value">{sel.metric.fmt(sel.last)}</div></div>
                <div className={`hc-delta ${sel.diff > 0 ? 'up' : sel.diff < 0 ? 'down' : 'flat'}`}>{sel.diff ? `${sel.diff > 0 ? '▲' : '▼'} ${signed(sel.diff, sel.metric.fmt)} ${R.word}` : `без изменений ${R.word}`}</div>
              </div>
              {sel.pts.length >= 2 ? <BigChart pts={sel.pts} fmt={sel.metric.fmt} axisFmt={short(sel.metric)} color={sel.metric.color} short={R.id === '1d'} />
                : <div className="spark-empty muted small"><i />Для этого показателя пока одна точка: он начал записываться недавно.</div>}
            </div>
          ) : <div className="muted small">В этой группе пока нечего показать.</div>}

          <div className="hc-tiles">
            {groupTiles.map(c => (
              <button key={c.metric.key} className={`hc-tile ${sel?.metric.key === c.metric.key ? 'on' : ''}`} style={{ '--c': c.metric.color }} onClick={() => setPick(c.metric.key)} aria-pressed={sel?.metric.key === c.metric.key}>
                <span className="hc-tile-label tiny muted">{c.metric.label}</span>
                <span className="hc-tile-value small" title={c.metric.fmt(c.last)}>{short(c.metric)(c.last)}</span>
                <Mini pts={c.pts} color={c.metric.color} />
                <span className={`tiny hc-tile-delta ${c.diff > 0 ? 'up' : c.diff < 0 ? 'down' : ''}`}>{c.diff ? signed(c.diff, short(c.metric)) : '—'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
