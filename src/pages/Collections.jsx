import { DEC } from '../i18n.js';
// Страница «Коллекции»: тиры по разделам, что ближе всего к следующему тиру, какие тиры откроют рецепты миньонов
// (а это новые уникальные крафты и слоты), что ещё не начато, и все коллекции с наградами каждого тира.
// Данные — /api/collections (выбранный игрок; в коопе количество общее на всех участников).
import { useMemo, useState } from 'react';
import { Card, Stat, Empty, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApi, num, plural } from '../api.js';
import { useApp } from '../App.jsx';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const roman = n => ROMAN[n] || String(n);
// «1,2 млн», «45 тыс.»: как в остальном сайте, без английских B/M/k
const dec = v => v.toFixed(1).replace(/\.0$/, '').replace('.', DEC);
const short = n => (n >= 1e9 ? `${dec(n / 1e9)} млрд` : n >= 1e6 ? `${dec(n / 1e6)} млн` : n >= 1e4 ? `${Math.round(n / 1e3)} тыс.` : num(n));

export default function Collections({ state }) {
  const { openItem } = useApp();
  const upd = state?.updatedAt || 0;
  const { data: co, error } = useApi('/collections', [upd], { keep: true });
  const [catId, setCatId] = useState('all');
  const [filter, setFilter] = useState('todo');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);

  const byId = useMemo(() => new Map((co?.entries || []).map(e => [e.id, e])), [co]);
  const list = useMemo(() => {
    if (!co?.entries) return [];
    const qs = q.trim().toLowerCase();
    return co.entries.filter(e => (catId === 'all' || e.cat === catId)
      && (filter === 'all' || (filter === 'todo' ? !e.maxed : filter === 'maxed' ? e.maxed : !e.started))
      && (!qs || e.name.toLowerCase().includes(qs) || e.id.toLowerCase().includes(qs)));
  }, [co, catId, filter, q]);

  if (error && !co) return <Empty>Коллекции не загрузились: {error}</Empty>;
  if (!co) return <div className="muted small"><div className="spinner" />Считаю коллекции…</div>;
  if (co.status === 'error') return <Empty>Коллекции не загрузились: {co.error}</Empty>;
  const own = state?.view?.owner;

  if (co.status === 'off') {
    return (
      <Card className="span-12" title="Коллекции не видны">
        <p>Hypixel не отдаёт коллекции {own ? 'этого профиля' : co.player || 'игрока'}: в настройках выключен <b>Collections API</b>.</p>
        <ol className="museum-howto">
          <li>В игре: SkyBlock Menu → Settings → API Settings → Collections API → включить.</li>
          <li>Подождать пару минут и нажать «Обновить» на сайте.</li>
        </ol>
        {!own && <p className="muted small">Это настройка самого игрока: попроси его включить.</p>}
      </Card>
    );
  }

  const tile = id => {
    const e = byId.get(id);
    if (!e) return null;
    const unlock = e.next?.unlocks?.[0];
    return (
      <button key={id} className="museum-tile coll-tile" onClick={() => { setOpen(id); setCatId('all'); setFilter('all'); setQ(''); setAll(true); setTimeout(() => document.getElementById(`coll-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} title={`${e.name}: ${num(e.amount)} / ${num(e.next?.need)}`}>
        <ItemIcon id={e.icon} size={36} />
        <span className="museum-tile-text">
          <b>{e.name} {roman(e.next?.tier)}</b>
          <span className="museum-bar"><i style={{ width: `${(e.next?.progress || 0) * 100}%` }} /></span>
          <span className="tiny muted">ещё {short(e.next?.left || 0)}{unlock ? ` · ${unlock.ru}` : ''}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="grid museum coll">
      <div className="span-12 stats-row">
        <Stat label="Максимальных" value={`${co.maxed} / ${co.total}`} sub={`${Math.round(co.maxed / co.total * 100)}% коллекций`} accent="#f5c542" icon={<img src="/api/texture/nether_star" alt="" />} />
        <Stat label="Тиров открыто" value={`${co.tiers} / ${co.tiersMax}`} sub="каждый тир — новые рецепты" accent="#4ade80" icon={<img src="/api/texture/experience_bottle" alt="" />} />
        <Stat label="SkyBlock XP" value={`${num(co.sbXp)}`} sub={`из ${num(co.sbXpMax)} · по 4 за тир`} accent="#60a5fa" icon={<img src="/api/texture/emerald" alt="" />} />
        <Stat label="Не начато" value={co.notStarted.length} sub={co.notStarted.length ? 'хватит одной штуки для I тира' : 'начаты все'} accent="#f472b6" icon={<img src="/api/texture/painting" alt="" />} />
      </div>

      {co.coop && (
        <div className="span-12 small muted coll-note">
          Профиль в коопе ({co.coop.members} {plural(co.coop.members, 'участник', 'участника', 'участников')}): количество в коллекции общее, тиры открываются сразу у всех.
          {co.coop.hidden > 0 && ` У ${co.coop.hidden} ${plural(co.coop.hidden, 'участника', 'участников', 'участников')} выключен Collections API, его вклад не виден: реальные числа могут быть больше.`}
        </div>
      )}

      <Card className="span-12" title="Ближе всего к следующему тиру">
        {co.close.length ? <div className="museum-tiles">{co.close.map(tile)}</div> : <Empty>Все начатые коллекции максимальные.</Empty>}
      </Card>

      {co.minionUnlocks.length > 0 && (
        <Card className="span-12" title={`Откроют рецепты миньонов: ${co.minionUnlocks.length}`}>
          <p className="small muted">Новый миньон — это 11–12 новых уникальных крафтов, а они дают слоты миньонов. Смотри страницу <a className="link" href="#/minions">«Миньоны»</a>.</p>
          <div className="museum-tiles">{co.minionUnlocks.slice(0, 8).map(tile)}</div>
        </Card>
      )}

      <Card className="span-12" title="Разделы">
        <div className="museum-cats">
          {co.categories.map(c => (
            <button key={c.id} className={`museum-cat ${catId === c.id ? 'active' : ''}`} onClick={() => { setCatId(c.id); document.getElementById('coll-list')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <ItemIcon id={c.icon} size={36} />
              <span className="museum-cat-text">
                <b>{c.ru}</b>
                <span className="museum-bar"><i style={{ width: `${(c.tiers / Math.max(1, c.tiersMax)) * 100}%` }} /></span>
                <span className="tiny muted">макс. {c.maxed}/{c.total} · тиров {c.tiers}/{c.tiersMax}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="span-12" title="Все коллекции" right={<span className="tiny muted">{list.length} {plural(list.length, 'коллекция', 'коллекции', 'коллекций')}</span>}>
        <div id="coll-list" className="museum-filters">
          <div className="chips">
            <button className={`chip ${catId === 'all' ? 'active' : ''}`} onClick={() => setCatId('all')}>Все разделы</button>
            {co.categories.map(c => <button key={c.id} className={`chip ${catId === c.id ? 'active' : ''}`} onClick={() => setCatId(c.id)}>{c.ru}</button>)}
          </div>
          <div className="chips">
            {[['todo', 'Не максимальные'], ['new', 'Не начаты'], ['maxed', 'Максимальные'], ['all', 'Все']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <input className="search" placeholder="Найти: wheat, mithril, sand…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {list.length ? (
          <div className="coll-grid">
            {(all || q ? list : list.slice(0, 24)).map(e => <CollRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} openItem={openItem} coop={!!co.coop} />)}
          </div>
        ) : <Empty>Под фильтр ничего не подходит.</Empty>}
        {!all && !q && list.length > 24 && <button className="chip museum-more" onClick={() => setAll(true)}>Показать все {list.length}</button>}
      </Card>
      <div className="span-12 tiny muted">
        Тиры и награды — из данных Hypixel{co.source === 'snapshot' ? ` (сохранённая копия, версия ${co.version || '?'}: свежие придут после ответа Hypixel)` : ''}. Каждый тир даёт ещё +4 SkyBlock XP, в списках наград это не повторяется.
      </div>
    </div>
  );
}

function CollRow({ e, open, onToggle, openItem, coop }) {
  return (
    <div id={`coll-${e.id}`} className={`coll-row ${e.maxed ? 'maxed' : ''} ${!e.started ? 'new' : ''} ${open ? 'open' : ''}`}>
      <button className="coll-head" onClick={onToggle} aria-expanded={open}>
        <ItemIcon id={e.icon} size={34} />
        <span className="coll-main">
          <span className="coll-title"><b>{e.name}</b><span className={`coll-tier ${e.maxed ? 'gold' : ''}`}>{roman(e.tier)} / {roman(e.max)}</span></span>
          {e.maxed ? <span className="tiny gold">максимум · {short(e.amount)}</span> : (
            <>
              <Progress value={e.next.progress} color={e.started ? 'var(--accent)' : 'var(--muted)'} />
              <span className="tiny muted">{short(e.amount)} / {short(e.next.need)} · ещё {short(e.next.left)}{coop && e.coopShare != null && e.amount ? ` · твой вклад ${Math.round(e.coopShare * 100)}%` : ''}</span>
            </>
          )}
        </span>
      </button>
      {!e.maxed && e.next.unlocks.length > 0 && !open && (
        <div className="coll-next tiny">
          <span className="muted">{roman(e.next.tier)}:</span> {e.next.unlocks.slice(0, 3).map((u, i) => <Unlock key={i} u={u} openItem={openItem} />)}{e.next.unlocks.length > 3 && <span className="muted"> и ещё {e.next.unlocks.length - 3}</span>}
        </div>
      )}
      {open && (
        <ol className="coll-tiers">
          {e.tiers.map(t => (
            <li key={t.tier} className={t.done ? 'done' : t.tier === e.tier + 1 ? 'next' : ''}>
              <span className="coll-tnum">{roman(t.tier)}</span>
              <span className="coll-tneed tiny muted">{short(t.need)}</span>
              <span className="coll-tunlocks">{t.unlocks.length ? t.unlocks.map((u, i) => <Unlock key={i} u={u} openItem={openItem} />) : <span className="muted tiny">только SkyBlock XP</span>}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Unlock({ u, openItem }) {
  const cls = `coll-unlock k-${u.kind}`;
  if (u.item) return <button className={cls} onClick={() => openItem(u.item)} title={u.kind === 'recipe' ? `Рецепт: ${u.ru}` : u.ru}><ItemIcon id={u.item} size={18} />{u.kind === 'recipe' ? u.ru : u.ru}</button>;
  return <span className={cls}>{u.kind === 'recipe' ? `Рецепт: ${u.ru}` : u.ru}</span>;
}
