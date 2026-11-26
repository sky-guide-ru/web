import { LOCALE } from '../i18n.js';
// Раздел «Новости»: что нового на сайте и что исправили, по дням (журнал изменений).
// Записи живут в server/news/entries.js и приходят с /api/news вместе со словарём подсказок по тексту.
import { useEffect, useMemo } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { useApi } from '../api.js';
import { RefsProvider } from '../guides/Rich.jsx';
import { markNewsSeen } from '../news.js';
import { NewsText } from '../newsLinks.jsx';

const dayRu = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

export default function News() {
  const { data, error } = useApi('/news');
  // Открыл раздел — точка на кнопке гаснет. Что было новым до этого захода, подсвечиваем в списке
  const before = useMemo(() => { try { return localStorage.getItem('sb-news-seen'); } catch { return null; } }, []);
  useEffect(() => { if (data?.latest) markNewsSeen(data.latest); }, [data?.latest]);

  const days = useMemo(() => {
    const out = [];
    for (const e of data?.entries || []) {
      if (out.at(-1)?.date !== e.date) out.push({ date: e.date, items: [] });
      out.at(-1).items.push(e);
    }
    return out;
  }, [data]);
  const fresh = useMemo(() => {
    const list = data?.entries || [];
    const i = before ? list.findIndex(e => e.id === before) : -1;
    return new Set(before && i >= 0 ? list.slice(0, i).map(e => e.id) : []);
  }, [data, before]);

  if (error) return <Card title="Новости"><Empty>Не удалось загрузить новости: {error}</Empty></Card>;
  if (!data) return <div className="skeleton-page" aria-label="Загружаю новости…"><div className="sk sk-hero" /></div>;

  return (
    <RefsProvider refs={data.refs}>
      <div className="news">
        <div className="news-head">
          <h2>Новости сайта</h2>
          <p className="muted">Что появилось нового и что исправили. Самое свежее — сверху.</p>
        </div>
        {days.length === 0 && <Card><Empty>Пока новостей нет.</Empty></Card>}
        {days.map(d => (
          <section key={d.date} className="news-day">
            <h3 className="news-date"><time dateTime={d.date}>{dayRu(d.date)}</time></h3>
            {d.items.map(e => (
              <article key={e.id} id={`news-${e.id}`} className={`card news-item news-${e.kind}`}>
                <header className="news-item-head">
                  <span className={`news-kind k-${e.kind}`}>{e.kindRu}</span>
                  <h4><NewsText text={e.title} /></h4>
                  {fresh.has(e.id) && <span className="news-fresh">новое</span>}
                </header>
                <ul>{e.items.map((t, i) => <li key={i}><NewsText text={t} /></li>)}</ul>
              </article>
            ))}
          </section>
        ))}
      </div>
    </RefsProvider>
  );
}
