import { LOCALE, DEC, EN } from '../i18n.js';
import { useEffect, useId, useRef, useState } from 'react';

export function Card({ title, icon, right, children, className = '', style, news }) {
  return (
    <section className={`card ${className}`} style={style} data-news={news}>
      {(title || right) && (
        <header className="card-head">
          <h3>{icon && <span className="card-icon">{icon}</span>}{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Progress({ value, color = 'var(--accent)', label, sub, max }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.max(0, Math.min(1, value || 0))), 50); return () => clearTimeout(t); }, [value]);
  return (
    <div className="progress-wrap">
      {(label || sub) && <div className="progress-labels"><span>{label}</span><span className="muted">{sub}</span></div>}
      <div className={`progress ${max ? 'maxed' : ''}`}>
        <div className="progress-fill" style={{ width: `${w * 100}%`, background: max ? 'linear-gradient(90deg,#f5c542,#ffdf7e,#f5c542)' : color }} />
      </div>
    </div>
  );
}

// Плавный «набег» числа: берёт число из начала строки («217,33 млн», «1 009») и докручивает до него
// В английской версии тысячи через запятую («1,009»), дробная часть через точку
const NUM_RE = EN ? /^([+\-−]?[\d,]*\d)(\.\d+)?(.*)$/s : /^([+\-−]?[\d\s\u00a0\u202f]*\d)([.,]\d+)?(.*)$/s;
const GROUP = EN ? /,/ : /[\s\u00a0\u202f]/;
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export function CountUp({ value, duration = 900 }) {
  const text = value == null ? '' : String(value);
  const m = NUM_RE.exec(text);
  const [shown, setShown] = useState(m && !reduceMotion ? null : text);
  const from = useRef(0);
  const prevRest = useRef(null);
  useEffect(() => {
    if (!m || reduceMotion) { setShown(text); return; }
    const intPart = m[1], frac = m[2] || '', rest = m[3];
    const sep = (intPart.match(GROUP) || [EN ? ',' : ' '])[0];
    const dec = frac ? frac[0] : '';
    const digits = frac.length ? frac.length - 1 : 0;
    const target = Number(intPart.replace(/[^\d]/g, '') + (frac ? '.' + frac.slice(1) : '')) * (/^[\-−]/.test(intPart) ? -1 : 1);
    const sign = /^\+/.test(intPart) ? '+' : '';
    const fmt = v => {
      const [i, f] = Math.abs(v).toFixed(digits).split('.');
      const grouped = intPart.length > 3 && GROUP.test(intPart) ? i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : i;
      return (v < 0 ? '−' : sign) + grouped + (f ? dec + f : '') + rest;
    };
    // Единицы поменялись («999 тыс.» → «1 млн») — не интерполируем между разными масштабами
    if (prevRest.current != null && prevRest.current !== rest) { prevRest.current = rest; from.current = target; setShown(text); return; }
    prevRest.current = rest;
    const start = from.current, t0 = performance.now();
    let raf;
    const step = t => {
      const k = Math.min(1, (t - t0) / duration), e = 1 - Math.pow(1 - k, 3);
      setShown(k < 1 ? fmt(start + (target - start) * e) : text);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <>{shown ?? text}</>;
}

export function Stat({ label, value, sub, icon, accent, href, title }) {
  // Подсветка, когда значение поменялось от живого обновления
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value && prev.current != null) { setFlash(true); const t = setTimeout(() => setFlash(false), 1600); prev.current = value; return () => clearTimeout(t); }
    prev.current = value;
  }, [value]);
  const Tag = href ? 'a' : 'div';
  return (
    // href — плитка ведёт на страницу с подробностями (Magical Power → аксессуары и т. п.)
    <Tag href={href} title={title} className={`stat ${href ? 'stat-link' : ''} ${flash ? 'flash' : ''}`} style={accent ? { '--stat-accent': accent } : undefined}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value"><CountUp value={value} /></div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </Tag>
  );
}

export function Sparkline({ points, width = 240, height = 56, color = 'var(--accent)', format }) {
  const gid = 'sg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!points || points.length < 2) return <div className="spark-empty muted small"><i />Мало данных для графика — история копится раз в час.</div>;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const flat = maxY === minY;
  const sx = x => ((x - minX) / (maxX - minX || 1)) * width;
  const sy = y => flat ? height / 2 : height - 6 - ((y - minY) / (maxY - minY)) * (height - 12);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  const first = ys[0], last = ys[ys.length - 1], diff = last - first;
  const pct = first ? (diff / Math.abs(first)) * 100 : null;
  const trend = flat || diff === 0 || (pct !== null && Math.abs(pct) < 0.05) ? 'flat' : diff > 0 ? 'up' : 'down';
  const fmt = v => format ? format(v) : Math.round(v).toLocaleString(LOCALE);
  const lx = sx(xs[xs.length - 1]), ly = sy(last);
  return (
    <div className={`spark-wrap ${trend}`}>
      <div className="spark-plot">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="spark">
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {!flat && <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />}
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeDasharray={flat ? '5 5' : undefined} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="spark-dot" style={{ left: `${(lx / width) * 100}%`, top: `${(ly / height) * 100}%`, '--c': color }} />
      </div>
      <div className="spark-meta small">
        <span className="muted">{trend === 'flat' ? 'Без изменений' : 'Изменение'}</span>
        {trend !== 'flat' && <b className="spark-delta">{diff > 0 ? '▲ +' : '▼ −'}{fmt(Math.abs(diff))}{pct !== null && Math.abs(pct) >= 0.1 ? ` (${Math.abs(pct).toFixed(1).replace('.', DEC)}%)` : ''}</b>}
        <span className="muted spark-range">{fmt(minY)}{flat ? '' : ` — ${fmt(maxY)}`}</span>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => <button key={t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

export function Badge({ children, color }) { return <span className="badge" style={color ? { '--badge': color } : undefined}>{children}</span>; }
