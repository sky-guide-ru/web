import { useEffect, useRef, useState } from 'react';
import { useLite } from '../lite.js';

// Плоская фигурка игрока спереди из того же скина (облегчённый режим): без WebGL и без загрузки skinview3d (~130 КБ).
// Развёртка скина 64×64: голова, тело, руки, ноги + второй слой (шапка, куртка, рукава, штанины).
// Старые скины 64×32 без левых руки и ноги — отражаем правые, как делает сама игра.
export function drawFlatSkin(canvas, img, slim, scale) {
  const ctx = canvas.getContext('2d');
  const k = scale, arm = slim ? 3 : 4, old = img.height < 64;
  canvas.width = 16 * k; canvas.height = 32 * k;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const part = (sx, sy, w, h, dx, dy, mirror = false) => {
    if (!mirror) return ctx.drawImage(img, sx, sy, w, h, dx * k, dy * k, w * k, h * k);
    ctx.save(); ctx.translate((dx + w) * k, dy * k); ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w * k, h * k); ctx.restore();
  };
  const ax = 4 - arm; // тонкие руки прижаты к телу
  // Слой 1
  part(8, 8, 8, 8, 4, 0); // голова
  part(20, 20, 8, 12, 4, 8); // тело
  part(44, 20, arm, 12, ax, 8); // правая рука (слева на картинке)
  if (old) part(44, 20, arm, 12, 12, 8, true); else part(36, 52, arm, 12, 12, 8); // левая рука
  part(4, 20, 4, 12, 4, 20); // правая нога
  if (old) part(4, 20, 4, 12, 8, 20, true); else part(20, 52, 4, 12, 8, 20); // левая нога
  // Слой 2
  part(40, 8, 8, 8, 4, 0); // шапка
  if (!old) {
    part(20, 36, 8, 12, 4, 8); // куртка
    part(44, 36, arm, 12, ax, 8);
    part(52, 52, arm, 12, 12, 8);
    part(4, 36, 4, 12, 4, 20);
    part(4, 52, 4, 12, 8, 20);
  }
}

// Живая 3D-модель игрока (skinview3d грузится отдельным куском только там, где модель есть).
// В облегчённом режиме — плоская фигурка и кнопка «Покрутить в 3D».
// Если скин недоступен — голова игрока с нашего сервера (/api/head), если и её нет — ничего.
export default function PlayerModel({ uuid, width = 200, height = 300, className = '' }) {
  const lite = useLite();
  const [want3d, setWant3d] = useState(false);
  if (lite && !want3d) return <FlatModel uuid={uuid} height={height} className={className} on3d={() => setWant3d(true)} />;
  return <Model3d uuid={uuid} width={width} height={height} className={className} />;
}

function FlatModel({ uuid, height, className, on3d }) {
  const canvas = useRef(null);
  const [mode, setMode] = useState('flat'); // 'flat' | 'img' | 'none'
  const [ready, setReady] = useState(false);
  const h = Math.round(height * 0.82); // фигурка без поворота камеры выше 3D-модели — чуть уменьшаем, чтобы раскладка не менялась
  useEffect(() => {
    if (!uuid) return;
    let alive = true;
    (async () => {
      try {
        const info = await fetch(`/api/player-skin/${uuid}`).then(r => (r.ok ? r.json() : Promise.reject()));
        const img = new Image();
        img.src = info.skin;
        await img.decode();
        if (!alive || !canvas.current) return;
        drawFlatSkin(canvas.current, img, info.slim, 8);
        setReady(true);
      } catch { if (alive) setMode('img'); }
    })();
    return () => { alive = false; };
  }, [uuid]);
  if (mode === 'none') return null;
  if (mode === 'img') return <img className={`player-img ${className}`} src={`/api/head/${encodeURIComponent(uuid)}?size=128`} alt="" onError={() => setMode('none')} />;
  return (
    <div className="player-flat-wrap">
      <canvas ref={canvas} className={`player-flat ${className} ${ready ? 'ready' : 'loading'}`} style={{ height: h }} aria-hidden="true" />
      {ready && <button type="button" className="btn ghost" onClick={on3d} title="Загрузить объёмную модель (тяжелее для телефона)">Покрутить в 3D</button>}
    </div>
  );
}

function Model3d({ uuid, width, height, className }) {
  const canvas = useRef(null);
  const [mode, setMode] = useState('3d'); // '3d' | 'img' | 'none'
  const [ready, setReady] = useState(false); // пока скин грузится, холст не занимает место
  useEffect(() => {
    if (!uuid) return;
    let viewer, alive = true;
    (async () => {
      try {
        const info = await fetch(`/api/player-skin/${uuid}`).then(r => (r.ok ? r.json() : Promise.reject()));
        const sv = await import('skinview3d');
        if (!alive || !canvas.current) return;
        viewer = new sv.SkinViewer({ canvas: canvas.current, width, height, pixelRatio: Math.min(2, devicePixelRatio || 1) });
        await viewer.loadSkin(info.skin, { model: info.slim ? 'slim' : 'default' });
        if (info.cape) viewer.loadCape(info.cape).catch(() => {});
        viewer.fov = 40; viewer.controls.enableZoom = false;
        viewer.camera.position.set(-26, 12, 50); viewer.controls.update();
        viewer.autoRotate = false;
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce) { viewer.animation = new sv.IdleAnimation(); viewer.animation.speed = 0.8; }
        viewer.globalLight.intensity = 2.4; viewer.cameraLight.intensity = 0.8;
        if (alive) setReady(true);
      } catch { viewer?.dispose(); viewer = null; if (alive) setMode('img'); }
    })();
    return () => { alive = false; viewer?.dispose(); };
  }, [uuid, width, height]);

  if (mode === 'none') return null;
  if (mode === 'img') return <img className={`player-img ${className}`} src={`/api/head/${encodeURIComponent(uuid)}?size=128`} alt="" onError={() => setMode('none')} />;
  return <canvas ref={canvas} className={`player-3d ${className} ${ready ? 'ready' : 'loading'}`} title="Покрути мышкой" style={{ width, height }} />;
}
