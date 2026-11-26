// Страница «Музей»: XP и вехи, разделы, что пожертвовать из своего, что дешевле докупить, неполные сеты,
// одолженные и особые предметы, весь каталог музея с фильтрами. Данные — /api/museum (выбранный игрок).
import { useMemo, useState } from 'react';
import { Card, Stat, Tabs, Empty, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApi, coins, num, useHashTab } from '../api.js';
import { useApp } from '../App.jsx';

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
const STATUS_RU = { donated: 'в музее', borrowed: 'одолжен', counted: 'засчитан высшим тиром', missing: 'нет' };

export default function Museum({ state, sub }) {
  const { openItem } = useApp();
  const upd = state?.updatedAt || 0;
  const { data: mu, error } = useApi('/museum', [upd, state?.pricesAt?.auctions], { keep: true });
  const [tab, setTab] = useHashTab('museum', sub, ['cheap', 'value', 'sets', 'borrowed', 'special'], 'cheap');
  const [catId, setCatId] = useState('all');
  const [filter, setFilter] = useState('missing');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);

  const info = mu?.entryInfo || {};
  const nm = id => mu?.names?.[id] || info[id]?.name || id;
  const ic = id => info[id]?.icon || id;

  const catalog = useMemo(() => {
    if (!mu?.entries) return [];
    const qs = q.trim().toLowerCase();
    return mu.entries.filter(e => (catId === 'all' || e.cat === catId)
      && (filter === 'all' || (filter === 'missing' ? e.status === 'missing' : filter === 'owned' ? e.status === 'missing' && e.owned : e.status !== 'missing'))
      && (!qs || (info[e.id]?.name || e.id).toLowerCase().includes(qs)));
  }, [mu, catId, filter, q]);

  if (error && !mu) return <Empty>Музей не загрузился: {error}</Empty>;
  if (!mu) return <div className="muted small"><div className="spinner" />Считаю музей…</div>;
  if (mu.status === 'error') return <Empty>Музей не загрузился: {mu.error}</Empty>;
  const who = state?.view?.owner ? 'у тебя' : `у ${mu.player || 'игрока'}`;

  if (mu.status !== 'ok') {
    return (
      <div className="grid">
        <Card className="span-12 museum-off" title="Музей не виден">
          {mu.status === 'off' ? (
            <>
              <p>Hypixel не отдаёт музей {state?.view?.owner ? 'этого профиля' : mu.player || 'игрока'}: в настройках выключен <b>Museum API</b> (или музей ещё ни разу не открывали).</p>
              <ol className="museum-howto">
                <li>В игре: SkyBlock Menu → Settings → API Settings → Museum API → включить.</li>
                <li>Подождать пару минут и нажать «Обновить» на сайте.</li>
              </ol>
              {!state?.view?.owner && <p className="muted small">Это настройка самого игрока: попроси его включить, если хочешь видеть музей.</p>}
            </>
          ) : <p>Hypixel пока не ответил по музею. Через пару минут нажми «Обновить». Пока можно посмотреть гайд: <a className="link" href="#/guides/museum">Музей — как устроен</a>.</p>}
        </Card>
        <CatalogInfo mu={mu} />
      </div>
    );
  }

  const ms = mu.milestone;
  const plan = mu.milestonePlan;
  return (
    <div className="grid museum">
      <div className="span-12 stats-row">
        <Stat label="XP музея" value={num(mu.xp)} sub={`из ${num(mu.xpMax)} · это SkyBlock XP`} accent="#f472b6" icon={<img src="/api/texture/gold_block" alt="" />} />
        <Stat label="Веха" value={`${ms.n} / ${ms.max}`} sub={ms.nextXp ? `до ${ms.next}-й: ${ms.toNext} XP` : 'все вехи пройдены'} accent="#f5c542" icon={<img src="/api/texture/nether_star" alt="" />} />
        <Stat label="Пожертвовано" value={`${mu.donated} / ${mu.total}`} sub={`${Math.round(mu.donated / mu.total * 100)}% · сдано напрямую ${mu.direct}`} accent="#4ade80" icon={<img src="/api/texture/item_frame" alt="" />} />
        <Stat label="Оценка музея" value={mu.value ? coins(mu.value) : '—'} sub={mu.appraisal ? 'оценён (Museum Appraisal)' : mu.value ? 'по данным Hypixel' : 'не оценён'} accent="#60a5fa" icon={<img src="/api/texture/emerald" alt="" />} />
      </div>

      <Card className="span-12" title={ms.nextXp ? `До вехи ${ms.next}` : 'Все вехи пройдены'}>
        <Progress value={ms.progress} label={`${num(mu.xp)} XP`} sub={ms.nextXp ? `из ${num(ms.nextXp)}` : ''} max={!ms.nextXp} color="#f472b6" />
        {ms.rewardsNext?.length > 0 && <div className="small muted">Награда вехи {ms.next}: {ms.rewardsNext.join(', ')}</div>}
        <MilestoneStrip list={mu.milestones} n={ms.n} />
        {plan && (plan.steps.length ? (
          <div className="museum-plan">
            <div className="small"><b>{plan.free ? 'Можно дойти бесплатно — тем, что уже есть:' : plan.reached ? `Дешевле всего добрать за ${coins(plan.coins)}:` : 'На рынке не хватает предметов до вехи, вот что есть:'}</b></div>
            <div className="museum-tiles">
              {plan.steps.map(s => <Tile key={s.id} id={ic(s.id)} name={nm(s.id)} sub={`+${s.gain} XP · ${s.free ? 'уже есть' : `~${coins(s.cost)}`}`} tone={s.free ? 'good' : ''} onClick={() => openItem(ic(s.id))} />)}
            </div>
          </div>
        ) : null)}
      </Card>

      <Card className="span-12" title="Разделы">
        <div className="museum-cats">
          {mu.categories.map(c => (
            <button key={c.id} className={`museum-cat ${catId === c.id ? 'active' : ''}`} onClick={() => { setCatId(c.id); document.getElementById('museum-catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <ItemIcon id={c.icon} size={36} />
              <span className="museum-cat-text">
                <b>{c.ru}</b>{c.name !== c.ru && <> <span className="muted tiny">{c.name}</span></>}
                <span className="museum-bar"><i style={{ width: `${(c.donated / c.total) * 100}%` }} /></span>
                <span className="tiny muted">{c.donated}/{c.total} · {c.xp}/{c.xpMax} XP</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="span-12" title={mu.canDonate.length ? `Можно пожертвовать прямо сейчас: ${mu.canDonate.length} (+${mu.canDonateXp} XP)` : 'Можно пожертвовать прямо сейчас'}>
        {mu.canDonate.length ? (
          <>
            <p className="small muted">Эти предметы {who} уже есть, но в музее их нет. Hub → Museum → клик по предмету в инвентаре → Confirm Donation. Пожертвованное можно забрать обратно, XP останется; продать его после этого уже нельзя (Co-op Soulbound).</p>
            <div className="museum-tiles">
              {mu.canDonate.map(x => <Tile key={x.id} id={ic(x.id)} name={nm(x.id)} sub={`+${x.gain} XP · ${x.where.join(', ')}`} tone="warn" title={x.value ? `Сейчас стоит ~${coins(x.value)}: после пожертвования не продать` : ''} onClick={() => openItem(ic(x.id))} />)}
            </div>
          </>
        ) : <Empty>Всё, что {who} лежит в инвентаре, хранилищах и гардеробе, уже в музее.</Empty>}
      </Card>

      <Card className="span-12" title="Что докупить" right={<Tabs tabs={[
        { id: 'cheap', label: 'Дешевле всего' }, { id: 'value', label: 'XP за монету' }, { id: 'sets', label: `Неполные сеты (${mu.partialSets.length})` },
        { id: 'borrowed', label: `Одолжено (${mu.borrowed.length})` }, { id: 'special', label: `Особые (${mu.special.count})` },
      ]} value={tab} onChange={setTab} />}>
        {tab === 'cheap' || tab === 'value' ? (
          (tab === 'cheap' ? mu.cheapest : mu.bestValue).length ? (
            <table className="table">
              <thead><tr><th></th><th>Предмет</th><th>Раздел</th><th>+XP</th><th>Цена</th><th>За 1 XP</th></tr></thead>
              <tbody>
                {(tab === 'cheap' ? mu.cheapest : mu.bestValue).map(x => (
                  <tr key={x.id} className="clickable-row" onClick={() => openItem(ic(x.id))}>
                    <td><ItemIcon id={ic(x.id)} size={30} /></td>
                    <td>{nm(x.id)}{x.set && <div className="tiny muted">сет: {x.set.length} {plural(x.set.length, 'часть', 'части', 'частей')}</div>}{x.gain > x.xp && <div className="tiny muted">засчитает и низшие тиры</div>}</td>
                    <td>{mu.categories.find(c => c.id === x.cat)?.ru}</td>
                    <td className="gold">+{x.gain}</td>
                    <td>{coins(x.cost)}</td>
                    <td>{coins(x.perXp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>{state.pricesAt?.auctions ? 'Всё, что продаётся на рынке, уже в музее.' : 'Цены аукциона ещё загружаются (полный скан 1–2 минуты).'}</Empty>
        ) : tab === 'sets' ? (
          mu.partialSets.length ? (
            <table className="table">
              <thead><tr><th></th><th>Сет</th><th>Есть</th><th>Не хватает</th><th>Докупить</th><th>+XP</th></tr></thead>
              <tbody>
                {mu.partialSets.map(s => (
                  <tr key={s.id}>
                    <td><ItemIcon id={ic(s.id)} size={30} onClick={() => openItem(ic(s.id))} /></td>
                    <td>{nm(s.id)}</td>
                    <td><div className="item-row">{s.have.map(p => <ItemIcon key={p} id={p} size={26} onClick={() => openItem(p)} title={nm(p)} />)}</div></td>
                    <td><div className="item-row">{s.missing.map(p => <ItemIcon key={p.id} id={p.id} size={26} onClick={() => openItem(p.id)} title={`${nm(p.id)}${p.price ? ` · ~${coins(p.price)}` : ' · нет на рынке'}`} />)}</div></td>
                    <td>{s.costLeft ? coins(s.costLeft) : <span className="muted">нет на рынке</span>}</td>
                    <td className="gold">+{s.gain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>Неполных сетов нет: либо сет есть целиком, либо его частей нет вовсе.</Empty>
        ) : tab === 'borrowed' ? (
          mu.borrowed.length ? (
            <>
              <p className="small muted">Эти предметы забраны из музея обратно. XP за них засчитан, вернуть в витрину можно в любой момент.</p>
              <div className="museum-tiles">{mu.borrowed.map(b => <Tile key={b.id} id={ic(b.id)} name={nm(b.id)} sub={`${b.xp} XP · засчитан`} tone="good" onClick={() => openItem(ic(b.id))} />)}</div>
            </>
          ) : <Empty>Ничего не одолжено: всё пожертвованное стоит в витринах.</Empty>
        ) : (
          <>
            <p className="small muted">Special Items не дают SkyBlock XP и не входят в проценты: их выставляют для коллекции и оценки музея.</p>
            {mu.special.items.length ? <div className="item-row wrap">{mu.special.items.map((id, i) => <ItemIcon key={id + i} id={id} size={34} slot onClick={() => openItem(id)} />)}</div> : <Empty>Особых предметов в музее пока нет.</Empty>}
            {mu.specialOwned.length > 0 && <>
              <h4 className="sub-h">Есть {who}, но ещё не выставлены</h4>
              <div className="museum-tiles">{mu.specialOwned.map(x => <Tile key={x.id} id={x.id} name={nm(x.id)} sub={x.where.join(', ')} onClick={() => openItem(x.id)} />)}</div>
            </>}
          </>
        )}
        {mu.unpriced > 0 && (tab === 'cheap' || tab === 'value') && <div className="tiny muted" style={{ marginTop: 8 }}>Ещё {mu.unpriced} {plural(mu.unpriced, 'недостающий предмет не продаётся', 'недостающих предмета не продаются', 'недостающих предметов не продаются')} на рынке (их добывают сами): они в каталоге ниже.</div>}
      </Card>

      <Card className="span-12" title="Каталог музея" right={<span className="tiny muted">{catalog.length} {plural(catalog.length, 'запись', 'записи', 'записей')}</span>}>
        <div id="museum-catalog" className="museum-filters">
          <div className="chips">
            <button className={`chip ${catId === 'all' ? 'active' : ''}`} onClick={() => setCatId('all')}>Все разделы</button>
            {mu.categories.map(c => <button key={c.id} className={`chip ${catId === c.id ? 'active' : ''}`} onClick={() => setCatId(c.id)}>{c.ru}</button>)}
          </div>
          <div className="chips">
            {[['missing', 'Нет в музее'], ['owned', 'Есть, но не сдано'], ['done', 'Засчитано'], ['all', 'Все']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <input className="search" placeholder="Найти в каталоге: hyperion, necron, rod…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {catalog.length ? (
          <div className="museum-grid">
            {(all ? catalog : catalog.slice(0, 150)).map(e => (
              <button key={e.id} className={`museum-cell st-${e.status}${e.owned && e.status === 'missing' ? ' owned' : ''}`} onClick={() => openItem(ic(e.id))}
                title={`${info[e.id]?.name || e.id} · ${e.xp} XP · ${e.status === 'counted' ? `засчитан через ${info[e.via]?.name || e.via}` : e.owned && e.status === 'missing' ? 'есть у игрока, можно пожертвовать' : STATUS_RU[e.status]}${e.cost ? ` · ~${coins(e.cost)}` : ''}`}>
                <ItemIcon id={ic(e.id)} size={36} />
                <span className="museum-cell-xp">{e.xp}</span>
              </button>
            ))}
          </div>
        ) : <Empty>Под фильтр ничего не подходит.</Empty>}
        {!all && catalog.length > 150 && <button className="chip museum-more" onClick={() => setAll(true)}>Показать все {catalog.length}</button>}
        <div className="museum-legend tiny muted">
          <span><i className="st-donated" /> в музее</span><span><i className="st-borrowed" /> одолжен</span><span><i className="st-counted" /> засчитан высшим тиром</span>
          <span><i className="st-missing owned" /> есть, можно сдать</span><span><i className="st-missing" /> нет</span><span>число — SkyBlock XP</span>
        </div>
      </Card>
      <div className="span-12 small muted">Подробно — в гайде <a className="link" href="#/guides/museum">«Музей»</a>: как жертвовать, забирать, вехи и награды.</div>
    </div>
  );
}

function Tile({ id, name, sub, tone = '', onClick, title }) {
  return (
    <button className={`museum-tile ${tone}`} onClick={onClick} title={title || name}>
      <ItemIcon id={id} size={36} />
      <span className="museum-tile-text"><b>{name}</b><span className="tiny muted">{sub}</span></span>
    </button>
  );
}

function MilestoneStrip({ list, n }) {
  if (!list?.length) return null;
  return (
    <div className="museum-ms" aria-label={`Вехи музея: ${n} из ${list.length}`}>
      {list.map(m => <span key={m.n} className={`museum-ms-cell ${m.done ? 'done' : m.n === n + 1 ? 'next' : ''}`} title={`Веха ${m.n}: ${m.xp} XP${m.rewards ? ` — ${m.rewards.join(', ')}` : ''}`}>{m.n % 5 === 0 ? m.n : ''}</span>)}
    </div>
  );
}

// Без данных игрока: хотя бы что такое музей и сколько в нём всего
function CatalogInfo({ mu }) {
  return (
    <Card className="span-12" title="Что есть в музее">
      <div className="museum-cats">
        {mu.categories.map(c => (
          <div key={c.id} className="museum-cat">
            <ItemIcon id={c.icon} size={36} />
            <span className="museum-cat-text"><b>{c.ru}</b>{c.name !== c.ru && <> <span className="muted tiny">{c.name}</span></>}<span className="tiny muted">{c.total} записей · {c.xpMax} XP</span></span>
          </div>
        ))}
      </div>
    </Card>
  );
}
