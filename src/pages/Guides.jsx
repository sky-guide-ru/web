// Страница «Гайды»: слева список гайдов по группам, справа выбранный гайд (#/guides/<id>).
import { useEffect, useRef } from 'react';
import { useApi } from '../api.js';
import { Card, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { GenericGuide, StatusBadge, GuideListCtx } from '../guides/parts.jsx';
import { CUSTOM } from '../guides/index.js';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import { GuideMayorLine } from '../components/Election.jsx';

export default function Guides({ state, sub }) {
  const upd = state?.updatedAt || 0;
  const { data: list, error } = useApi('/guides', [upd], { keep: true });
  const guides = list?.guides || [];
  const id = guides.some(g => g.id === sub) ? sub : guides[0]?.id;
  const { data: guide, error: gErr, errorText: gErrText } = useApi(id ? `/guides/${id}` : null, [upd], { keep: true });

  // Выбранный гайд виден в списке: на телефоне список — горизонтальная лента, на компьютере — колонка с прокруткой
  const listRef = useRef(null);
  useEffect(() => {
    const l = listRef.current, a = l?.querySelector('.guides-item.active');
    if (!l || !a) return;
    const lr = l.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (l.scrollWidth > l.clientWidth + 1) { if (ar.left < lr.left || ar.right > lr.right) l.scrollLeft += ar.left - lr.left - 8; }
    else if (l.scrollHeight > l.clientHeight + 1 && (ar.top < lr.top || ar.bottom > lr.bottom)) l.scrollTop += ar.top - lr.top - 40;
  }, [id, guides.length]);

  if (error && !list) return <Empty>Гайды не загрузились: {error}</Empty>;
  if (list && !guides.length) return <Empty>Гайдов пока нет: они появятся после загрузки профиля.</Empty>;

  const groups = [];
  for (const g of guides) {
    let grp = groups.find(x => x.key === g.group);
    if (!grp) groups.push(grp = { key: g.group, title: list.groups?.[g.group] || g.group, items: [] });
    grp.items.push(g);
  }
  // Пройденные — вниз своей группы, почти готовые — наверх: сразу видно, что осталось
  const rank = g => (g.status === 'done' ? 3 : g.status === 'locked' ? 2 : g.almost ? 0 : 1);
  for (const grp of groups) grp.items = grp.items.map((g, i) => [g, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
  const C = CUSTOM[id];
  const shown = guide?.id === id ? guide : null;

  return (
    <div className="guides">
      <div className="guides-side">
      {groups.length > 2 && (
        <nav className="guides-jump" aria-label="Разделы гайдов">
          {groups.map(grp => (
            <button key={grp.key} type="button" className={`guides-jump-btn ${grp.items.some(g => g.id === id) ? 'active' : ''}`}
              onClick={() => document.getElementById(`guides-group-${grp.key}`)?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' })}>
              {grp.title}
            </button>
          ))}
        </nav>
      )}
      <aside className="guides-list" ref={listRef}>
        {groups.map(grp => (
          <div key={grp.key} id={`guides-group-${grp.key}`} className="guides-group">
            <div className="guides-group-title">{grp.title}</div>
            {grp.items.map(g => (
              <a key={g.id} href={`#/guides/${g.id}`} className={`guides-item ${g.id === id ? 'active' : ''} ${g.status === 'done' ? 'is-done' : ''}`} title={g.summary || ''}>
                {g.icon && <ItemIcon id={g.icon} size={28} />}
                <span className="guides-item-text">
                  <b>{g.title}</b>
                  {g.status === 'done' ? <small className="muted">{g.summary}</small> : g.next?.[0] ? <small className="muted">{g.next[0].title}</small> : g.summary && <small className="muted">{g.summary}</small>}
                </span>
                <StatusBadge status={g.status} almost={g.almost} />
              </a>
            ))}
          </div>
        ))}
      </aside>
      </div>
      <div className="guides-body">
        {gErr && !shown ? <Card><Empty>Гайд не загрузился: <Rich text={gErrText || gErr} /></Empty></Card>
          : !shown ? <div className="muted small"><div className="spinner" />{gErrText ? <Rich text={gErrText} /> : 'Собираю гайд…'}</div>
          : <GuideListCtx.Provider value={guides}><RefsProvider refs={shown.refs}><GuideMayorLine id={shown.id} />{C ? <C guide={shown} state={state} /> : <GenericGuide guide={shown} />}</RefsProvider></GuideListCtx.Provider>}
      </div>
    </div>
  );
}
