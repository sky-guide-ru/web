// Оповещение о новостях сайта: значок с числом на кнопке меню и окошко «Что нового» при заходе.
// Окошко всплывает один раз на каждую новую запись: «Читать» ведёт в «Новости», крестик просто прячет.
import { useEffect, useState } from 'react';
import { RefsProvider } from '../guides/Rich.jsx';
import { NewsText } from '../newsLinks.jsx';
import { useNewsPopup, dismissNewsPopup, markNewsSeen } from '../news.js';
import { updateInfo, onUpdate, updateNow, dismissUpdate, wasJustUpdated, STALE_MS } from '../update.js';

/** Красный кружок с числом непрочитанного (9+ если больше). */
export function NewsBadge({ n }) {
  if (!n) return null;
  return <span className="nav-badge" title={`Новых записей: ${n}`} aria-label={`новых: ${n}`}>{n > 9 ? '9+' : n}</span>;
}

export default function NewsPopup() {
  const pop = useNewsPopup();
  const [shown, setShown] = useState(false);
  // Не сразу: сначала пусть откроется страница, потом мягко выезжает окошко
  useEffect(() => { if (!pop) { setShown(false); return; } const t = setTimeout(() => setShown(true), wasJustUpdated() ? 800 : 2500); return () => clearTimeout(t); }, [pop?.top.id]);
  if (!pop || !shown) return null;
  const { top, refs } = pop;
  const read = () => { markNewsSeen(top.id); location.hash = '#/news'; };
  return (
    <RefsProvider refs={refs}>
      <aside className={`news-pop news-${top.kind}`} role="status" aria-label="Что нового на сайте">
        <button type="button" className="x-btn news-pop-x" onClick={dismissNewsPopup} aria-label="Закрыть" title="Закрыть">×</button>
        <div className="news-pop-head"><span className="news-pop-bell" aria-hidden="true">🔔</span>Что нового на сайте</div>
        <div className="news-pop-title"><span className={`news-kind k-${top.kind}`}>{top.kindRu}</span><b><NewsText text={top.title} onGo={() => markNewsSeen(top.id)} /></b></div>
        <p className="news-pop-text"><NewsText text={top.items[0]} onGo={() => markNewsSeen(top.id)} /></p>
        <div className="news-pop-btns">
          <button type="button" className="btn small" onClick={read}>Читать</button>
          <button type="button" className="btn ghost small" onClick={dismissNewsPopup}>Позже</button>
        </div>
      </aside>
    </RefsProvider>
  );
}

/** Плашка «Сайт обновился»: новая версия ждёт перехода в другой раздел, а человек давно читает одну страницу.
 *  Стоит в том же углу, что и окошко новостей, и не мешает ему: пока окошко открыто, плашка ждёт. */
export function UpdateBar() {
  const pop = useNewsPopup();
  const [, tick] = useState(0);
  useEffect(() => onUpdate(() => tick(x => x + 1)), []);
  const { pending, since, dismissed } = updateInfo();
  const wait = pending && !dismissed ? since + STALE_MS - Date.now() : null;
  useEffect(() => {
    if (wait == null || wait <= 0) return;
    const t = setTimeout(() => tick(x => x + 1), wait + 50);
    return () => clearTimeout(t);
  }, [wait == null, pending]);
  if (pop || wait == null || wait > 0) return null;
  return (
    <aside className="news-pop update-pop" role="status" aria-label="Сайт обновился">
      <button type="button" className="x-btn news-pop-x" onClick={dismissUpdate} aria-label="Закрыть" title="Закрыть">×</button>
      <div className="news-pop-title"><span className="news-pop-bell" aria-hidden="true">✨</span><b>Сайт обновился</b></div>
      <p className="news-pop-text">Новая версия откроется при переходе в другой раздел — или сейчас, место на странице сохранится.</p>
      <div className="news-pop-btns">
        <button type="button" className="btn small" onClick={updateNow}>Обновить</button>
        <button type="button" className="btn ghost small" onClick={dismissUpdate}>Позже</button>
      </div>
    </aside>
  );
}
