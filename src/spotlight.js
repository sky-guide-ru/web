// Свет за курсором: передаём координаты мыши в CSS-переменные ближайшей карточки.
// Не чаще раза за кадр: getBoundingClientRect на каждое движение мыши заставлял браузер пересчитывать раскладку
let last = null, ev = null, queued = false;
function apply() {
  queued = false;
  const e = ev;
  const card = e.target.closest?.('.card');
  if (last && last !== card) last.style.removeProperty('--my');
  last = card;
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
}
addEventListener('pointermove', e => {
  if (e.pointerType && e.pointerType !== 'mouse') return; // на телефоне подсветки за пальцем не видно — не тратим кадры
  ev = e;
  if (!queued) { queued = true; requestAnimationFrame(apply); }
}, { passive: true });
