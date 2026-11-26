import { useEffect, useState, memo } from 'react';
import { useTooltip } from './Tooltip.jsx';
import { RARITY_COLOR } from '../api.js';

// Версия картинок иконок: браузер хранит их сутки и дольше. Меняется, когда сервер начинает рисовать иконки иначе
// (24.11.2026: 3D-модели паков спереди, а не развёрткой; головы из скина вместо Стива) — тогда старые картинки не держатся
const REV = 'r=2';

// Пакетная загрузка метаданных иконок
const metaCache = new Map();
const renderStatus = new Map(); // id -> true/false (есть ли готовый рендер)
const waiters = new Map();
let queue = new Set();
let timer = null;
function flush() {
  const ids = [...queue];
  queue = new Set();
  timer = null;
  fetch('/api/icons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
    .then(r => r.json())
    .then(map => {
      for (const id of ids) {
        const m = map[id] || { kind: 'item', name: 'barrier' };
        metaCache.set(id, m);
        (waiters.get(id) || []).forEach(fn => fn(m));
        waiters.delete(id);
      }
    }).catch(() => {});
}
function getMeta(id, cb) {
  if (metaCache.has(id)) return cb(metaCache.get(id));
  if (!waiters.has(id)) waiters.set(id, []);
  waiters.get(id).push(cb);
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 30);
}

// hash -> true (скин загрузился) или время неудачи: неудачу пробуем снова через минуту
const skinStatus = new Map();
const SKIN_RETRY_MS = 60_000;
const skinKnown = hash => { const v = skinStatus.get(hash); if (v === true) return true; if (v && Date.now() - v < SKIN_RETRY_MS) return false; return null; };
function Head({ hash, size }) {
  const s = size * 0.62;
  const url = `/api/skin/${hash}`;
  const [ok, setOk] = useState(() => skinKnown(hash));
  useEffect(() => {
    const known = skinKnown(hash);
    if (known !== null) { setOk(known); return; }
    setOk(null);
    let live = true;
    const img = new Image();
    img.onload = () => { skinStatus.set(hash, true); live && setOk(true); };
    img.onerror = () => { skinStatus.set(hash, Date.now()); live && setOk(false); };
    img.src = url;
    return () => { live = false; };
  }, [hash]);
  if (ok === false) return <div className="flat-icon icon-missing" style={{ width: size * 0.8, height: size * 0.8, fontSize: size * 0.4 }} aria-hidden="true">?</div>;
  const face = (x, y, transform, scale = 1) => ({
    width: s, height: s,
    backgroundImage: `url(${url})`,
    backgroundSize: `${8 * s}px ${8 * s}px`,
    backgroundPosition: `${-x * s / 8}px ${-y * s / 8}px`,
    transform: `${transform} translateZ(${(s / 2) * scale}px)`,
  });
  return (
    <div className="head3d" style={{ width: size, height: size }}>
      <div className="head3d-cube" style={{ width: s, height: s }}>
        <div className="face" style={face(8, 8, '')} />
        <div className="face shade-r" style={face(16, 8, 'rotateY(90deg)')} />
        <div className="face shade-t" style={face(8, 0, 'rotateX(90deg)')} />
        <div className="face hat" style={face(40, 8, '', 1.13)} />
        <div className="face hat shade-r" style={face(48, 8, 'rotateY(90deg)', 1.13)} />
        <div className="face hat shade-t" style={face(40, 0, 'rotateX(90deg)', 1.13)} />
      </div>
    </div>
  );
}

function Flat({ name, size, color, glint }) {
  const url = `/api/texture/${name}?${REV}`;
  const [broken, setBroken] = useState(0); // 0 — своя текстура, 1 — barrier, 2 — ничего не загрузилось
  const src = broken ? '/api/texture/barrier' : url;
  if (broken > 1) return <div className="flat-icon icon-missing" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">?</div>;
  return (
    <div className="flat-icon" style={{ width: size, height: size }}>
      <img src={src} width={size} height={size} alt="" onError={() => setBroken(b => b + 1)} draggable={false} />
      {color != null && (
        <div className="tint" style={{ background: `#${Number(color).toString(16).padStart(6, '0')}`, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />
      )}
      {glint && <div className="glint" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />}
    </div>
  );
}

// item: { id, name, rawName, lore, rarity, skin, color, glint, count }
function ItemIconInner({ id, item, size = 40, onClick, slot = false, title }) {
  const realId = id || item?.id;
  const [meta, setMeta] = useState(() => metaCache.get(realId) || null);
  const tip = useTooltip();
  useEffect(() => { if (realId) getMeta(realId, setMeta); }, [realId]);
  const hash = item?.skin || (meta?.kind === 'head' ? meta.hash : null);
  const glint = item?.glint ?? meta?.glint;
  const color = item?.color ?? meta?.color;
  const [renderOk, setRenderOk] = useState(() => (realId && renderStatus.get(realId)) ?? null);
  // Кастомные головы (питомцы со скинами и т.п.) рисуем из скина предмета, остальное — готовым рендером
  const useRender = realId && renderOk !== false && !(item?.skin && meta?.kind === 'head' && meta.hash !== item.skin);
  const content = !realId && !item ? null
    : useRender ? (
      <div className="flat-icon render" style={{ width: size * 0.86, height: size * 0.86 }}>
        <img src={`/api/img/${encodeURIComponent(realId)}?${REV}`} alt="" draggable={false} width={size * 0.86} height={size * 0.86}
          onLoad={e => { renderStatus.set(realId, true); if (e.currentTarget.naturalWidth <= 64) e.currentTarget.classList.add('pixel'); }} onError={() => { renderStatus.set(realId, false); setRenderOk(false); }} />
        {glint && <div className="glint" style={{ WebkitMaskImage: `url(/api/img/${encodeURIComponent(realId)}?${REV})`, maskImage: `url(/api/img/${encodeURIComponent(realId)}?${REV})` }} />}
      </div>
    )
    : hash ? <Head hash={hash} size={size} />
    : meta ? <Flat name={meta.name} size={size * 0.8} color={color} glint={glint} />
    : <div style={{ width: size * 0.8, height: size * 0.8 }} className="icon-loading" />;
  // Плитка в цвете редкости, как на SkyCrypt
  const rar = slot && item?.rarity ? RARITY_COLOR[item.rarity] : null;
  const tipData = item?.lore?.length ? { name: item.rawName || item.name, lore: item.lore } : title ? { name: title } : null;
  return (
    <div
      className={`item-icon ${slot ? 'slot' : ''} ${rar ? 'rar' : ''} ${onClick ? 'clickable' : ''}`}
      style={rar ? { width: size, height: size, '--r': rar } : { width: size, height: size }}
      onClick={onClick}
      onMouseEnter={e => tipData && tip.show(tipData, e)}
      onMouseMove={e => tipData && tip.move(e)}
      onMouseLeave={() => tip.hide()}
    >
      {content}
      {item?.count > 1 && <span className="count">{item.count}</span>}
    </div>
  );
}
// Состояние профиля приходит заново раз в минуту (цены, профиль) — все предметы становятся новыми объектами,
// хотя внутри то же самое. Сравниваем по содержимому, чтобы сотни иконок в хранилищах не перерисовывались зря.
// Обработчик клика каждый раз новый, но везде открывает этот же предмет — сравниваем только его наличие.
const sameLore = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i]));
const sameItem = (a, b) => a === b || (!!a && !!b && a.id === b.id && a.name === b.name && a.rawName === b.rawName && a.rarity === b.rarity
  && a.skin === b.skin && a.color === b.color && a.glint === b.glint && a.count === b.count && sameLore(a.lore, b.lore));
const sameProps = (p, n) => p.id === n.id && p.size === n.size && p.slot === n.slot && p.title === n.title && !p.onClick === !n.onClick && sameItem(p.item, n.item);
export const ItemIcon = memo(ItemIconInner, sameProps);
