import { LOCALE } from '../i18n.js';
// Карточка профиля для Discord/ВК/Telegram: картинка 1200×630 рисуется прямо в браузере (canvas),
// её можно скопировать в буфер, скачать PNG или (на телефоне) сразу отправить через «Поделиться».
// Окно выводится в document.body (портал): внутри страницы его «держали» бы предки с анимацией transform,
// и position: fixed считался бы от них, а не от экрана — окно уезжало вниз страницы.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { shareTiles, autoPick, MAX_TILES } from './shareTiles.js';

const W = 1200, H = 630;
const FONT = '"Rubik Variable", "Inter Variable", system-ui, sans-serif';
const THEME_KEY = 'sb-share-theme';
const TILES_KEY = 'sb-share-tiles';

/** Оформления картинки: фон (3 точки градиента), два пятна света и основной цвет */
export const THEMES = {
  violet: { label: 'Фиолетовая', bg: ['#1b1440', '#121a33', '#0b2a2e'], glow: ['rgba(124,92,255,.38)', 'rgba(45,212,191,.22)'], accent: '#7c5cff', accent2: '#2dd4bf' },
  ember: { label: 'Закат', bg: ['#2b1220', '#1d1430', '#2a1a0c'], glow: ['rgba(255,94,94,.32)', 'rgba(245,197,66,.24)'], accent: '#ff7a45', accent2: '#f5c542' },
  emerald: { label: 'Изумруд', bg: ['#0a2622', '#0e1e2c', '#0f1533'], glow: ['rgba(45,212,191,.32)', 'rgba(96,165,250,.24)'], accent: '#2dd4bf', accent2: '#60a5fa' },
};

function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function fontsReady() {
  try {
    await Promise.all(['700 64px', '600 20px', '500 28px'].map(f => document.fonts?.load(`${f} "Rubik Variable"`)));
    await document.fonts?.ready;
  } catch { /* без шрифта нарисуется системным */ }
}

/** Нарисовать карточку. Возвращает Promise, когда аватар, значки и шрифты готовы */
export async function drawShareCard(canvas, { name, member: m, tiles, theme = 'violet' }, alive = () => true) {
  const T = THEMES[theme] || THEMES.violet;
  const [head, ...ico] = await Promise.all([loadImg(`/api/head/${m.uuid}?size=128`), ...tiles.map(t => loadImg(`/api/texture/${t.icon}`)), fontsReady()]);
  if (!alive()) return; // пока грузились картинки, игрок уже выбрал другие плитки
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(0.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Мягкие пятна света, как на сайте
  for (const [x, y, r, c] of [[160, 90, 400, T.glow[0]], [1080, 560, 440, T.glow[1]]]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  // Еле заметная пиксельная сетка — отсылка к Minecraft
  ctx.fillStyle = 'rgba(255,255,255,.025)';
  for (let x = 0; x < W; x += 30) for (let y = 0; y < H; y += 30) if ((x + y) % 60 === 0) ctx.fillRect(x, y, 2, 2);
  // Полоса цвета оформления сверху
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, T.accent); band.addColorStop(1, T.accent2);
  ctx.fillStyle = band; ctx.fillRect(0, 0, W, 6);

  // Голова игрока в рамке цвета оформления
  ctx.save(); roundRect(ctx, 52, 48, 158, 158, 26); ctx.fillStyle = band; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, 56, 52, 150, 150, 22); ctx.fillStyle = '#151528'; ctx.fill(); ctx.clip();
  if (head) { ctx.imageSmoothingEnabled = false; ctx.drawImage(head, 56, 52, 150, 150); }
  else { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 80px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText((name || '?')[0].toUpperCase(), 131, 157); ctx.textAlign = 'left'; }
  ctx.restore();

  ctx.fillStyle = '#fff'; ctx.font = `700 64px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(name, 238, 116, 700);
  ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = `500 28px ${FONT}`;
  const sub = `профиль ${m.profileName}`;
  ctx.fillText(sub, 240, 162);
  // Режим профиля (Ironman, Stranded…) — плашкой рядом
  if (m.mode?.label && m.gameMode !== 'normal') {
    const x = 240 + ctx.measureText(sub).width + 16;
    ctx.font = `600 20px ${FONT}`;
    const w = ctx.measureText(m.mode.label).width + 28;
    roundRect(ctx, x, 136, w, 34, 17); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(m.mode.label, x + 14, 160);
  }

  // Уровень SkyBlock — кольцо справа
  const lvl = Math.floor(m.sbLevel || 0), frac = (m.sbLevel || 0) % 1;
  const cx = 1060, cy = 124, R = 72;
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ring.addColorStop(0, T.accent); ring.addColorStop(1, T.accent2);
  ctx.strokeStyle = ring; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, frac)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 52px ${FONT}`; ctx.fillText(String(lvl), cx, cy + 18);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `500 18px ${FONT}`; ctx.fillText('уровень SkyBlock', cx, cy + R + 34);
  ctx.textAlign = 'left';

  // Плитки: до 9 штук рядами по 3 (ряды делятся поровну, неполный ряд растягивается на всю ширину)
  const n = tiles.length;
  const rows = n <= 3 ? 1 : n <= 6 ? 2 : 3;
  const per = Array.from({ length: rows }, (_, r) => Math.floor(n / rows) + (r < n % rows ? 1 : 0));
  const x0 = 56, y0 = 252, areaW = W - 112, areaH = 556 - y0, gx = 22, gy = rows === 3 ? 14 : 20;
  const th = Math.min(150, (areaH - gy * (rows - 1)) / rows), compact = th < 120;
  let i = 0;
  per.forEach((cols, r) => {
    const tw = (areaW - gx * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++, i++) {
      const t = tiles[i], x = x0 + c * (tw + gx), y = y0 + r * (th + gy);
      const tg = ctx.createLinearGradient(x, y, x + tw, y + th);
      tg.addColorStop(0, 'rgba(255,255,255,.075)'); tg.addColorStop(1, 'rgba(255,255,255,.03)');
      roundRect(ctx, x, y, tw, th, compact ? 14 : 18); ctx.fillStyle = tg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = t.color; roundRect(ctx, x, y + th * 0.16, 5, th * 0.68, 3); ctx.fill();
      // Значок предмета справа сверху (если сервер его отдал)
      const is = compact ? 32 : 40;
      if (ico[i]) {
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(ico[i], x + tw - is - 20, y + (compact ? 14 : 18), is, is); ctx.restore();
      } else {
        ctx.fillStyle = t.color; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x + tw - 20 - is / 2, y + 18 + is / 2, 13, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      const value = String(t.value).replace(/ /g, '\u00a0');
      const big = compact ? (value.length > 12 ? 26 : 32) : (value.length > 12 ? 34 : 42);
      ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = `600 ${compact ? 16 : 19}px ${FONT}`;
      ctx.fillText(t.label.toUpperCase(), x + 24, y + (compact ? 30 : 40), tw - is - 56);
      ctx.fillStyle = '#fff'; ctx.font = `700 ${big}px ${FONT}`; ctx.fillText(value, x + 24, y + (compact ? 64 : 90), tw - 44);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `500 ${compact ? 14 : 17}px ${FONT}`;
      ctx.fillText(String(t.sub || '').replace(/ /g, '\u00a0'), x + 24, y + (compact ? 85 : 120), tw - 44);
    }
  });

  // Подпись: адрес сайта слева, дата справа
  const fy = H - 26;
  ctx.fillStyle = band; roundRect(ctx, 56, fy - 17, 20, 20, 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 20px ${FONT}`;
  const host = location.host || 'Hypixel SkyBlock';
  ctx.fillText(host, 86, fy);
  const hw = ctx.measureText(host).width;
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `500 18px ${FONT}`;
  ctx.fillText(`· личный трекер прогрессии`, 86 + hw + 10, fy);
  ctx.textAlign = 'right'; ctx.fillText(`Hypixel SkyBlock · ${new Date().toLocaleDateString(LOCALE)}`, W - 56, fy); ctx.textAlign = 'left';
}

const canCopy = () => typeof window !== 'undefined' && !!(window.ClipboardItem && navigator.clipboard?.write);
const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'card.png', { type: 'image/png' })] }); } catch { return false; }
};

export default function ShareCard({ name, member, analysis, onClose }) {
  const ref = useRef(null);
  const box = useRef(null);
  const [msg, setMsg] = useState(null); // { text, ok }
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true); // картинка перерисовывается: пока не готова, не отдаём старую
  const [theme, setTheme] = useState(() => { try { const t = localStorage.getItem(THEME_KEY); return THEMES[t] ? t : 'violet'; } catch { return 'violet'; } });
  const [share] = useState(canShareFiles);
  const [copyOk] = useState(canCopy);
  // Плитки: «авто» — самые сильные стороны игрока, или свой список (до 9), он запоминается
  const pool = useMemo(() => shareTiles(member, analysis), [member, analysis]);
  const [custom, setCustom] = useState(() => { try { const v = JSON.parse(localStorage.getItem(TILES_KEY)); return Array.isArray(v) ? v : null; } catch { return null; } });
  const auto = useMemo(() => autoPick(pool), [pool]);
  const byId = useMemo(() => Object.fromEntries(pool.map(t => [t.id, t])), [pool]);
  const picked = (custom || auto).filter(id => byId[id]).slice(0, MAX_TILES);
  const tiles = picked.map(id => byId[id]);
  const saveCustom = v => { setCustom(v); try { v ? localStorage.setItem(TILES_KEY, JSON.stringify(v)) : localStorage.removeItem(TILES_KEY); } catch { /* */ } };
  const toggle = id => {
    if (picked.includes(id)) { if (picked.length > 1) saveCustom(picked.filter(x => x !== id)); }
    else if (picked.length < MAX_TILES) saveCustom([...picked, id]);
    else setMsg({ text: `На карточке помещается не больше ${MAX_TILES} плиток`, ok: false });
  };
  const key = `${picked.join(',')}|${theme}`;

  useEffect(() => {
    let live = true;
    setBusy(true);
    drawShareCard(ref.current, { name, member, tiles, theme }, () => live).then(() => { if (live) { setReady(true); setBusy(false); } });
    return () => { live = false; };
  }, [name, member, key]);

  // Пока окно открыто: страница под ним не прокручивается, фокус внутри окна, Esc закрывает, а после закрытия
  // фокус возвращается на кнопку, которая окно открыла
  useEffect(() => {
    const html = document.documentElement, prev = html.style.overflow, back = document.activeElement;
    html.style.overflow = 'hidden';
    box.current?.focus();
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', key, true);
    return () => { removeEventListener('keydown', key, true); html.style.overflow = prev; back?.focus?.(); };
  }, [onClose]);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4500); return () => clearTimeout(t); }, [msg]);

  const pickTheme = t => { setTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* */ } };
  const file = `${name}-${member.profileName}.png`;
  const blob = () => new Promise(res => ref.current.toBlob(res, 'image/png'));
  const download = async () => {
    const url = URL.createObjectURL(await blob());
    const l = document.createElement('a'); l.href = url; l.download = file; l.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg({ text: 'Картинка сохранена', ok: true });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]);
      setMsg({ text: matchMedia('(pointer: coarse)').matches ? 'Скопировано: вставь картинку в Discord' : 'Скопировано: вставь в Discord через Ctrl+V', ok: true });
    } catch { setMsg({ text: 'Браузер не дал скопировать картинку — нажми «Скачать PNG»', ok: false }); }
  };
  const send = async () => {
    try { await navigator.share({ files: [new File([await blob()], file, { type: 'image/png' })], title: name }); }
    catch (e) { if (e?.name !== 'AbortError') setMsg({ text: 'Не получилось открыть «Поделиться» — скачай PNG', ok: false }); }
  };

  return createPortal(
    <div className="modal-bg share-bg" onClick={onClose}>
      <div ref={box} tabIndex={-1} className="modal card share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={e => e.stopPropagation()}>
        <button className="x-btn modal-x" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="share-head">
          <h3 id="share-title">Карточка профиля</h3>
          <div className="muted small">Картинка с главными цифрами профиля — для Discord, ВК или Telegram</div>
        </div>
        <div className={`share-preview${ready ? ' ready' : ''}`}>
          <canvas ref={ref} className="share-canvas" width={W} height={H} aria-label={`Карточка профиля ${name}`} role="img" />
        </div>
        <div className="share-pick">
          <div className="share-pick-head">
            <span className="share-pick-title">Что показать на карточке</span>
            <span className="muted small">{custom ? `выбрано ${picked.length} из ${MAX_TILES}` : 'сейчас: самые сильные стороны'}</span>
            <button type="button" className={`share-auto${custom ? '' : ' on'}`} aria-pressed={!custom} onClick={() => saveCustom(null)}>Авто</button>
          </div>
          <div className="share-chips">
            {pool.map(t => {
              const n = picked.indexOf(t.id) + 1;
              return (
                <button key={t.id} type="button" className={`share-chip${n ? ' on' : ''}`} aria-pressed={!!n} onClick={() => toggle(t.id)} style={{ '--c': t.color }}>
                  {n ? <span className="share-chip-n">{n}</span> : <span className="share-chip-dot" aria-hidden="true" />}
                  <span className="share-chip-label">{t.label}</span>
                  <span className="share-chip-val">{t.value}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="share-bar">
          <div className="share-themes" role="group" aria-label="Оформление">
            {Object.entries(THEMES).map(([id, t]) => (
              <button key={id} type="button" className={`share-theme${theme === id ? ' on' : ''}`} aria-pressed={theme === id} title={t.label}
                onClick={() => pickTheme(id)} style={{ '--a': t.accent, '--b': t.accent2, '--bg': t.bg[0] }}>
                <span className="share-swatch" aria-hidden="true" />
                <span className="share-theme-name">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="share-actions">
            {share && <button className="btn" onClick={send} disabled={busy}>Поделиться</button>}
            {copyOk && <button className={share ? 'btn ghost' : 'btn'} onClick={copy} disabled={busy}>Копировать картинку</button>}
            <button className={share || copyOk ? 'btn ghost' : 'btn'} onClick={download} disabled={busy}>Скачать PNG</button>
          </div>
        </div>
        <div className={`share-msg${msg ? ' show' : ''}${msg && !msg.ok ? ' bad' : ''}`} role="status" aria-live="polite">{msg?.text || ''}</div>
      </div>
    </div>,
    document.body,
  );
}
