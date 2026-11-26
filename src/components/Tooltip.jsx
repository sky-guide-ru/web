import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

// Тёмные цвета Minecraft (§0 §1 §4 §8) чуть осветлены: на тёмном фоне сайта иначе почти не читаются
const COLORS = { 0: '#6b6b6b', 1: '#4f63ff', 2: '#00AA00', 3: '#00AAAA', 4: '#D83C3C', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#82828f', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };

// Отрисовка строки с цветовыми кодами Minecraft (§)
export function McText({ text, className = '' }) {
  const parts = [];
  let color = '#AAAAAA', bold = false, italic = false, buf = '';
  const push = () => { if (buf) parts.push({ t: buf, color, bold, italic }); buf = ''; };
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '§' && i + 1 < s.length) {
      push();
      const c = s[++i].toLowerCase();
      if (COLORS[c]) { color = COLORS[c]; bold = false; italic = false; }
      else if (c === 'l') bold = true;
      else if (c === 'o') italic = true;
      else if (c === 'r') { color = '#AAAAAA'; bold = false; italic = false; }
    } else buf += s[i];
  }
  push();
  return (
    <span className={className}>
      {parts.map((p, i) => <span key={i} style={{ color: p.color, fontWeight: p.bold ? 600 : 400, fontStyle: p.italic ? 'italic' : 'normal' }}>{p.t}</span>)}
    </span>
  );
}

export function McTooltipBox({ name, lore = [] }) {
  return (
    <div className="mc-tooltip">
      <div className="mc-name"><McText text={name?.startsWith('§') ? name : `§f${name || ''}`} /></div>
      {lore.map((l, i) => <div key={i} className="mc-line">{l ? <McText text={l} /> : ' '}</div>)}
    </div>
  );
}

const Ctx = createContext(null);
export function TooltipProvider({ children }) {
  const [tip, setTip] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const show = useCallback((data, e) => { setTip(data); setPos({ x: e.clientX, y: e.clientY }); }, []);
  const move = useCallback(e => setPos({ x: e.clientX, y: e.clientY }), []);
  const hide = useCallback(() => setTip(null), []);
  const value = useMemo(() => ({ show, move, hide }), [show, move, hide]);
  // На телефоне касание оставляет подсказку висеть: прячем её при прокрутке и следующем касании
  useEffect(() => {
    if (!tip) return;
    const off = e => { if (e.type !== 'pointerdown' || e.pointerType !== 'mouse') hide(); };
    addEventListener('scroll', off, true);
    addEventListener('pointerdown', off, true);
    return () => { removeEventListener('scroll', off, true); removeEventListener('pointerdown', off, true); };
  }, [tip, hide]);
  const narrow = window.innerWidth < 600;
  const flipX = pos.x > window.innerWidth - 380;
  // Нижняя половина экрана — подсказка открывается вверх, иначе длинный лор уходит за низ
  const vert = pos.y > window.innerHeight * .55 ? { bottom: window.innerHeight - pos.y + 12 } : { top: pos.y + 12 };
  // Узкий экран: подсказка во всю ширину с отступами, чтобы не уезжала за левый край
  const horiz = narrow ? { left: 8, right: 8 } : { left: flipX ? undefined : pos.x + 16, right: flipX ? window.innerWidth - pos.x + 16 : undefined };
  return (
    <Ctx.Provider value={value}>
      {children}
      {tip && (
        <div className="tooltip-layer" style={{ ...horiz, ...vert }}>
          <McTooltipBox {...tip} />
        </div>
      )}
    </Ctx.Provider>
  );
}
export const useTooltip = () => useContext(Ctx) || { show() {}, move() {}, hide() {} };
