import { useEffect, useRef, useState } from 'react';
import { NewsBadge } from './NewsPopup.jsx';

// Нижняя панель на телефоне (как в приложениях): четыре главных раздела под большим пальцем и «Ещё».
// «Ещё» выдвигает снизу лист со всеми остальными разделами по группам, аккаунтом и настройками.
// На компьютере панели нет (CSS), там остаётся боковое меню.

// Главные кнопки панели — в этом порядке
export const MAIN = ['overview', 'roadmap', 'market', 'money'];

// Группы листа «Ещё». Разделы, которых нет в группах (на будущее), попадают в «Другое»
const GROUPS = [
  { title: 'Мой профиль', ids: ['skills', 'gear', 'accessories', 'pets', 'museum', 'stash', 'collections', 'minions'] },
  { title: 'Справочник', ids: ['news', 'wiki', 'guides', 'events'] },
  { title: 'Игроки', ids: ['compare', 'top'] },
  { title: 'Владельцу', ids: ['status', 'feedback'] },
];

export function groupPages(pages) {
  const by = new Map(pages.map(p => [p.id, p]));
  const used = new Set(MAIN);
  const out = GROUPS.map(g => ({ title: g.title, items: g.ids.filter(id => by.has(id)).map(id => (used.add(id), by.get(id))) }));
  const rest = pages.filter(p => !used.has(p.id));
  if (rest.length) out.push({ title: 'Другое', items: rest });
  return out.filter(g => g.items.length);
}

const Ico = ({ p }) => <span className="nav-ico" data-fb={p.fb}><img src={`/api/texture/${p.icon}`} alt="" /></span>;

// badges — число непрочитанного по разделам (сейчас только «Новости»): значок на плитке в листе, на кнопке и на «Ещё»
export default function BottomNav({ pages, current, prefetch, badges = {}, children }) {
  const [open, setOpen] = useState(false);
  const sheet = useRef(null);
  const main = MAIN.map(id => pages.find(p => p.id === id)).filter(Boolean);
  const groups = groupPages(pages);
  const inMore = !MAIN.includes(current);

  // Закрываем лист при переходе на другой раздел, по Esc и по «Назад» браузера
  useEffect(() => { setOpen(false); }, [current]);
  useEffect(() => {
    if (!open) return;
    const k = e => { if (e.key === 'Escape') setOpen(false); };
    const f = () => setOpen(false);
    addEventListener('keydown', k); addEventListener('popstate', f);
    // Фокус в лист: с клавиатуры и читалкой экрана сразу попадаешь к разделам
    sheet.current?.querySelector('a, button')?.focus({ preventScroll: true });
    return () => { removeEventListener('keydown', k); removeEventListener('popstate', f); };
  }, [open]);
  // Страница под листом не прокручивается
  useEffect(() => {
    document.documentElement.classList.toggle('more-open', open);
    return () => document.documentElement.classList.remove('more-open');
  }, [open]);

  const warm = id => () => prefetch?.(id);
  // Лист всегда в разметке и только прячется: окно «Сообщить об ошибке», открытое из листа,
  // живёт внутри своей кнопки и иначе закрылось бы вместе с листом
  const onSheetClick = e => { if (e.target.closest('a[href^="#/"], .fb-btn')) setOpen(false); };

  return (
    <>
      <div className={`more-back ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div ref={sheet} className={`more-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Все разделы" inert={!open} onClick={onSheetClick}>
        <div className="more-grip" aria-hidden="true" />
        {groups.map(g => (
          <section key={g.title} className="more-group">
            <h4>{g.title}</h4>
            <div className="more-grid">
              {g.items.map(p => (
                <a key={p.id} href={`#/${p.id}`} className={p.id === current ? 'active' : ''} aria-current={p.id === current ? 'page' : undefined} onTouchStart={warm(p.id)}>
                  <NewsBadge n={badges[p.id]} /><Ico p={p} /><span>{p.label}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <section className="more-group more-extra">{children}</section>
      </div>
      <nav className="bottom-nav" aria-label="Разделы">
        {main.map(p => (
          <a key={p.id} href={`#/${p.id}`} className={p.id === current && !open ? 'active' : ''} aria-current={p.id === current ? 'page' : undefined} onTouchStart={warm(p.id)}>
            <NewsBadge n={badges[p.id]} /><Ico p={p} /><span>{p.label}</span>
          </a>
        ))}
        <button type="button" className={`bn-more ${open || inMore ? 'active' : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}>
          {!open && <NewsBadge n={Object.entries(badges).reduce((s, [id, n]) => s + (MAIN.includes(id) ? 0 : n || 0), 0)} />}
          <span className="nav-ico bn-dots" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>{open ? 'Закрыть' : 'Ещё'}</span>
        </button>
      </nav>
    </>
  );
}
