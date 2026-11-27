// «Опрос» — плавающая кнопка внизу слева (как кнопка советчика справа) и окно опроса поверх страницы.
// Раздела в меню нет, чтобы не перегружать его. Открыть из любого места: openSurvey().
// После 10 ответов кнопка становится маленькой (только значок): вернуться и поменять ответы можно всегда.
import { lazy, Suspense, useEffect, useState } from 'react';
import { chunk } from '../update.js';

const Survey = lazy(chunk(() => import('../pages/Survey.jsx')));
const DONE = 'sb-survey-done'; // ставит pages/Survey.jsx
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
export const openSurvey = () => dispatchEvent(new CustomEvent('sb-survey'));

export default function SurveyDock() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(() => !!read(DONE));
  // Кнопка висит поверх текста: при прокрутке вниз прячется, при прокрутке вверх и у верха страницы — снова видна
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = scrollY;
    const f = () => {
      const y = scrollY, d = y - last;
      if (Math.abs(d) < 12) return;
      setAway(d > 0 && y > 200);
      last = y;
    };
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);
  useEffect(() => {
    const f = () => setOpen(true);
    addEventListener('sb-survey', f);
    return () => removeEventListener('sb-survey', f);
  }, []);
  // Окошко «Что нового» стоит в том же углу: следим за ним и поднимаем кнопку над ним (стопкой, без наложения)
  useEffect(() => {
    const root = document.documentElement;
    let ro = null; let el = null; let h = '';
    const sync = () => {
      const pop = document.querySelector('.news-pop');
      if (pop !== el) {
        ro?.disconnect(); el = pop;
        if (pop && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(sync); ro.observe(pop); }
      }
      if (root.classList.contains('has-news-pop') !== !!pop) root.classList.toggle('has-news-pop', !!pop);
      const nh = pop ? `${Math.ceil(pop.getBoundingClientRect().height)}px` : '';
      if (pop && nh !== h) root.style.setProperty('--news-pop-h', nh);
      h = nh;
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); ro?.disconnect(); root.classList.remove('has-news-pop'); };
  }, []);
  useEffect(() => {
    if (!open) { setDone(!!read(DONE)); return undefined; }
    const k = e => { if (e.key === 'Escape' && !document.querySelector('.modal-bg')) setOpen(false); };
    addEventListener('keydown', k);
    document.documentElement.classList.add('survey-open');
    return () => { removeEventListener('keydown', k); document.documentElement.classList.remove('survey-open'); };
  }, [open]);
  if (!open) {
    return (
      <button type="button" className={`survey-fab${done ? ' mini' : ''}${away ? ' away' : ''}`} onClick={() => setOpen(true)} title={done ? 'Опрос: посмотреть или поменять ответы' : 'Каким быть советчику? Короткий опрос'} aria-label="Открыть опрос">
        <span aria-hidden="true">📝</span>{!done && <span className="survey-fab-text">Опрос</span>}
      </button>
    );
  }
  return (
    <section className="survey-dock" role="dialog" aria-label="Опрос">
      <button type="button" className="cd-icon survey-close" onClick={() => setOpen(false)} title="Свернуть (Esc). Ответы уже сохранены" aria-label="Закрыть опрос">✕</button>
      <div className="survey-dock-body">
        <Suspense fallback={<p className="muted">Загружаю опрос…</p>}><Survey /></Suspense>
      </div>
    </section>
  );
}
