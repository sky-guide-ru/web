import { LOCALE, EN } from '../i18n.js';
// Страница «Запасы»: мешки (Sacks) с ценами и эссенции с перками Essence Shop.
// Данные — /api/sacks и /api/essence (выбранный игрок). Гайд по эссенциям — #/guides/essence.
import { useMemo, useState } from 'react';
import { Card, Stat, Empty, Progress } from '../components/ui.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApi, coins, num, plural, useHashTab } from '../api.js';
import { useApp } from '../App.jsx';

const HOW_RU = { bazaar: 'на базаре', npc: 'торговцу', none: '—' };

// Виды мешков — как в игре («Enchanted Mining», «Lava Fishing»): игроки просили не переводить игровые названия
const sackRu = n => n;

// Колонки таблицы мешков: ключ → значение для сортировки; text — по алфавиту (сначала А→Я)
const COLS = [
  { key: 'name', label: 'Предмет', text: true, get: x => x.name },
  { key: 'count', label: 'Кол-во', get: x => x.count },
  { key: 'sell', label: 'Продать сразу', get: x => x.sell || 0 },
  { key: 'offer', label: 'Ордер на продажу', get: x => x.offer || 0, title: 'Sell Offer: выставить на базаре и подождать покупателя' },
  { key: 'npc', label: 'Торговцу', get: x => x.npc || 0, title: 'Цена продажи торговцу (NPC)' },
  { key: 'value', label: 'Итого', get: x => x.value || 0 },
];
const GROUP_SORTS = [['value', 'по стоимости'], ['name', 'по названию'], ['kinds', 'по числу видов'], ['count', 'по количеству']];

export default function Stash({ state, sub }) {
  const [tab, setTab] = useHashTab('stash', sub, ['sacks', 'essence'], 'sacks');
  // Обе части грузим сразу: крупные плитки сверху показывают итог каждой, и эссенции видно, даже пока открыты мешки
  // (раньше была мелкая вкладка, и игроки её не замечали)
  // Ждём свежий профиль (не тот, что сохранён в браузере), иначе мешки качались дважды подряд.
  // Цены Bazaar обновляются каждую минуту, но пересчёт мешков ради них — не чаще раза в 5 минут
  const upd = state?.updatedAt || 0, live = !!state && !state.fromCache;
  const priceTick = Math.floor((state?.pricesAt?.bazaar || 0) / 300_000);
  const sacks = useApi(live ? '/sacks' : null, [upd, priceTick], { keep: true });
  const ess = useApi(live ? '/essence' : null, [upd, priceTick], { keep: true });
  const sd = sacks.data?.status === 'ok' ? sacks.data : null, ed = ess.data?.status === 'ok' ? ess.data : null;
  const buyable = ed ? ed.types.reduce((s, t) => s + t.buyable, 0) : 0;
  const essCount = ed ? ed.types.filter(t => t.amount > 0).length : 0;
  const tiles = [
    { id: 'sacks', news: 'sacks', icon: 'LARGE_ENCHANTED_MINING_SACK', title: 'Мешки', value: sd ? coins(sd.total) : '…',
      sub: sd ? (sd.kinds ? `${num(sd.kinds)} ${plural(sd.kinds, 'позиция', 'позиции', 'позиций')} · что продать, каких мешков нет` : 'мешки пусты') : 'считаю…' },
    { id: 'essence', news: 'essence', icon: 'ESSENCE_WITHER', title: 'Essence и перки', value: ed ? coins(ed.total) : '…',
      sub: ed ? `${essCount} ${plural(essCount, 'вид', 'вида', 'видов')} · ${buyable ? `можно купить ${num(buyable)} ${plural(buyable, 'уровень', 'уровня', 'уровней')} перков` : 'перки, звёзды, продажа'}` : 'считаю…' },
  ];
  return (
    <div className="grid stash">
      <div className="span-12 stash-switch" role="tablist">
        {tiles.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`stash-switch-btn ${tab === t.id ? 'active' : ''}`} data-news={t.news} onClick={() => setTab(t.id)}>
            <ItemIcon id={t.icon} size={36} />
            <span><b>{t.title}</b><span className="stash-switch-val">{t.value}</span><span className="tiny muted">{t.sub}</span></span>
          </button>
        ))}
      </div>
      {tab === 'sacks' ? <Sacks res={sacks} /> : <Essence res={ess} />}
    </div>
  );
}

function Sacks({ res }) {
  const { openItem } = useApp();
  const { data: d, error } = res;
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState({ key: 'value', dir: -1 });
  const [gsort, setGsort] = useState('value');
  const list = useMemo(() => {
    if (!d?.items) return [];
    const qs = q.trim().toLowerCase();
    const col = COLS.find(c => c.key === sort.key) || COLS[5];
    return d.items
      .filter(x => (group === 'all' || (x.sack || 'Другое') === group) && (!qs || x.name.toLowerCase().includes(qs) || x.id.toLowerCase().includes(qs) || sackRu(x.sack || '').toLowerCase().includes(qs)))
      .sort((a, b) => (col.text ? String(col.get(a)).localeCompare(String(col.get(b)), LOCALE) : col.get(a) - col.get(b)) * sort.dir || b.value - a.value);
  }, [d, group, q, sort]);
  const groups = useMemo(() => {
    const g = [...(d?.groups || [])];
    return gsort === 'name' ? g.sort((a, b) => sackRu(a.name).localeCompare(sackRu(b.name), LOCALE)) : g.sort((a, b) => b[gsort] - a[gsort] || b.value - a.value);
  }, [d, gsort]);
  // Клик по заголовку: числа — сначала больше, текст — А→Я; повторный клик разворачивает
  const clickSort = key => {
    const c = COLS.find(x => x.key === key);
    setSort(sort.key === key ? { key, dir: -sort.dir } : { key, dir: c.text ? 1 : -1 });
  };

  if (error && !d) return <Empty>Мешки не загрузились: {error}</Empty>;
  if (!d) return <div className="span-12 muted small"><div className="spinner" />Считаю мешки…</div>;
  if (d.status === 'error') return <Empty>Мешки не загрузились: {d.error}</Empty>;
  if (d.apiDisabled) return <Card className="span-12" title="Мешки не видны"><p>У игрока выключен <b>Inventory API</b>: SkyBlock Menu → Settings → API Settings → Inventory API.</p></Card>;
  if (!d.kinds) return <Card className="span-12" title="Мешки пусты"><Empty>В мешках ничего нет (или Hypixel их ещё не отдал). Мешки покупаются у торговцев и открываются в рецептах коллекций, первый — Small Agronomy Sack.</Empty></Card>;
  const shown = all ? list : list.slice(0, 60);
  return (
    <>
      <div className="span-12 stats-row">
        <Stat label="Мешки стоят" value={coins(d.total)} sub="мгновенная продажа (или торговцу, если он платит больше)" accent="#4ade80" icon={<ItemIcon id="LARGE_ENCHANTED_MINING_SACK" size={28} />} />
        <Stat label="Через ордер на продажу" value={coins(d.offerTotal)} sub="если выставить на базаре и подождать" accent="#f5c542" icon={<ItemIcon id="ENCHANTED_GOLD" size={28} />} />
        <Stat label="Позиций" value={num(d.kinds)} sub={`${num(d.count)} шт. в ${d.groups.length} ${plural(d.groups.length, 'мешке', 'мешках', 'мешках')}`} accent="#60a5fa" icon={<ItemIcon id="LARGE_AGRONOMY_SACK" size={28} />} />
      </div>

      {d.sell.length > 0 && (
        <Card className="span-12" title="Лежит без дела — можно продать">
          <p className="small muted">Позиции дороже 1 млн. Если не копишь их на крафт или улучшение — продай: на базаре прямо из мешка (кнопка Sell Sacks Now) или ордером на продажу (Sell Offer), чтобы получить больше.</p>
          <div className="stash-tiles">
            {d.sell.map(x => (
              <button key={x.id} className="stash-tile" onClick={() => openItem(x.id)} title={x.name}>
                <ItemIcon id={x.id} size={36} />
                <span><b>{x.name}</b><span className="tiny muted">{num(x.count)} шт. · {HOW_RU[x.how]}</span><span className="gold">{coins(x.value)}</span></span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="span-12" title="Мешки по видам" right={
        <div className="stash-gsort">{GROUP_SORTS.map(([k, l]) => <button key={k} className={`chip ${gsort === k ? 'active' : ''}`} onClick={() => setGsort(k)}>{l}</button>)}</div>
      }>
        <div className="stash-groups">
          <button className={`stash-group ${group === 'all' ? 'active' : ''}`} onClick={() => setGroup('all')}>
            <ItemIcon id="LARGE_ENCHANTED_MINING_SACK" size={30} /><span><b>Все</b><span className="tiny muted">{coins(d.total)}</span></span>
          </button>
          {groups.map(g => (
            <button key={g.name} className={`stash-group ${group === g.name ? 'active' : ''}`} onClick={() => setGroup(g.name)} title={g.name === 'Другое' ? '' : `${g.name} Sack`}>
              <ItemIcon id={g.icon} size={30} />
              <span><b>{sackRu(g.name)}</b><span className="tiny muted">{g.kinds}{g.slots ? `/${g.slots}` : ''} · {coins(g.value)}</span></span>
            </button>
          ))}
        </div>
      </Card>

      {d.ladder && <SackLadder ladder={d.ladder} />}

      <Card className="span-12" title={group === 'all' ? 'Всё содержимое' : `Мешок: ${sackRu(group)}`}>
        <input className="search" placeholder="Найти в мешках: mithril, cocoa, gemstone…" value={q} onChange={e => setQ(e.target.value)} />
        <label className="stash-sort-m muted small">Сортировка:{' '}
          <select value={`${sort.key}:${sort.dir}`} onChange={e => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir: Number(dir) }); }}>
            {COLS.flatMap(c => c.text
              ? [<option key={c.key + '1'} value={`${c.key}:1`}>{c.label}: А→Я</option>, <option key={c.key + '-1'} value={`${c.key}:-1`}>{c.label}: Я→А</option>]
              : [<option key={c.key + '-1'} value={`${c.key}:-1`}>{c.label}: больше</option>, <option key={c.key + '1'} value={`${c.key}:1`}>{c.label}: меньше</option>])}
          </select>
        </label>
        {list.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th aria-label="Иконка" />{COLS.map(c => (
                <th key={c.key} className="sortable" title={c.title || 'Сортировать'} onClick={() => clickSort(c.key)} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                  {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                </th>))}</tr></thead>
              <tbody>
                {shown.map(x => (
                  <tr key={x.id} className="clickable-row" onClick={() => openItem(x.id)}>
                    <td><ItemIcon id={x.id} size={28} /></td>
                    <td>{x.name}{group === 'all' && x.sack && <div className="tiny muted">{sackRu(x.sack)}</div>}</td>
                    <td>{num(x.count)}</td>
                    <td>{x.sell ? coins(x.sell) : <span className="muted">—</span>}</td>
                    <td>{x.offer ? coins(x.offer) : <span className="muted">—</span>}</td>
                    <td className={x.how === 'npc' ? 'gold' : ''}>{x.npc ? coins(x.npc) : <span className="muted">—</span>}</td>
                    <td><b>{x.value ? coins(x.value) : <span className="muted" title="Нельзя продать на Bazaar, аукционе и NPC">не продаётся</span>}</b>{x.value > 0 && <div className="tiny muted">выгоднее: {HOW_RU[x.how]}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > shown.length && <button className="btn ghost museum-more" onClick={() => setAll(true)}>Показать ещё {list.length - shown.length}</button>}
          </div>
        ) : <Empty>Ничего не нашлось.</Empty>}
      </Card>
    </>
  );
}

function Essence({ res }) {
  const { openItem } = useApp();
  const { data: d, error } = res;
  const [open, setOpen] = useState(null);
  if (error && !d) return <Empty>Essence не загрузилась: {error}</Empty>;
  if (!d) return <div className="span-12 muted small"><div className="spinner" />Считаю эссенции…</div>;
  if (d.status === 'error') return <Empty>Essence не загрузилась: {d.error}</Empty>;
  const perksDone = d.types.reduce((s, t) => s + t.perkDone, 0), perksAll = d.types.reduce((s, t) => s + t.perks.length, 0);
  const buyable = d.types.reduce((s, t) => s + t.buyable, 0);
  return (
    <RefsProvider refs={d.refs}>
      <div className="span-12 stats-row">
        <Stat label="Essence стоит" value={coins(d.total)} sub="по мгновенной продаже на базаре" accent="#22d3ee" icon={<ItemIcon id="ESSENCE_WITHER" size={28} />} />
        <Stat label="Перки прокачаны" value={`${perksDone} / ${perksAll}`} sub="до максимального уровня" accent="#c084fc" icon={<ItemIcon id="ESSENCE_UNDEAD" size={28} />} />
        <Stat label="Можно купить сейчас" value={num(buyable)} sub={`${plural(buyable, 'уровень', 'уровня', 'уровней')} перков на то, что есть`} accent="#4ade80" icon={<ItemIcon id="ESSENCE_CRIMSON" size={28} />} />
      </div>
      <Card className="span-12" title="Что это и зачем">
        <p className="small">Essence — валюта для улучшений: <b>звёзды</b> на предметах (✪, +2% к статам за звезду, данжевым в Catacombs +10%) и <b>перки</b>. Перк — постоянный бонус: покупаешь уровень за эссенцию у NPC её магазина, и он действует навсегда (уровни берутся по порядку). У каждой эссенции свой магазин — где он, написано на карточке. Подробный разбор каждой эссенции — в гайде <a className="link" href="#/guides/essence">Essence и перки</a>.</p>
      </Card>
      {d.types.map(t => {
        const isOpen = open === t.type;
        return (
          <Card key={t.type} className="span-6 essence-card" style={t.color ? { '--ess': t.color } : undefined}
            title={<span className="essence-title"><ItemIcon id={t.id} size={28} onClick={() => openItem(t.id)} />{t.ru} Essence{t.area && <span className="tiny muted"> · {t.area}</span>}</span>}
            right={<span className="essence-amount"><b>{num(t.amount)}</b>{t.value > 0 && <span className="tiny muted">{coins(t.value)}</span>}</span>}>
            <div className="essence-info small">
              <p><Rich text={t.info.what} /></p>
              <b>Где добыть</b><ul>{t.info.get.map(x => <li key={x}><Rich text={x} /></li>)}</ul>
            </div>
            <div className={`essence-sell small ${t.price > 0 ? '' : 'no'}`}>
              <b>Продать:</b>{' '}
              {t.price > 0
                ? <>можно, на базаре ~{coins(t.price)} за штуку{t.amount > 0 && <> — весь запас <span className="gold">{coins(t.value)}</span></>}.</>
                : <>на базаре сейчас нет цены — эту эссенцию только тратят.</>}
              {t.sellNote && <div className="tiny muted"><Rich text={t.sellNote} /></div>}
            </div>
            {t.perks.length > 0 ? (
              <>
                <ShopBox t={t} />
                <Progress value={t.perks.length ? t.perkDone / t.perks.length : 0} label={`Перки: ${t.perkDone} из ${t.perks.length}`} sub={t.perkLeft ? `осталось ${num(t.perkLeft)}` : 'все куплены'} max={!t.perkLeft} color={t.color || undefined} />
                <ul className="essence-perks">
                  {t.perks.map(p => (
                    <li key={p.key} className={p.level >= p.max ? 'done' : p.affordable ? 'can' : ''} title={p.ru || ''}>
                      <span className="essence-perk-name"><span>{(!EN && p.ruName) || p.name}{!EN && p.ruName && <span className="tiny muted"> ({p.name})</span>}</span>{p.ru && <span className="tiny muted">{p.ru}</span>}</span>
                      <span className="essence-pips">{Array.from({ length: p.max }, (_, i) => <i key={i} className={i < p.level ? 'on' : ''} />)}</span>
                      <span className="tiny">{p.next == null ? '✔' : <>{num(p.next)}{p.affordable && <span className="green"> · хватает</span>}</>}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="small muted">У этой эссенции нет магазина перков: она идёт только на звёзды.</p>}
            {t.stars.length > 0 && (
              <div className="essence-stars">
                <div className="small"><b>Звёзды на твоих предметах</b></div>
                {t.stars.slice(0, 5).map(s => (
                  <button key={s.id + s.stars} className="essence-star" onClick={() => openItem(s.id)}>
                    <ItemIcon id={s.id} size={24} /><span>{s.name} <span className="gold">{'✪'.repeat(s.stars)}</span><span className="muted">{'✪'.repeat(Math.max(0, s.max - s.stars))}</span></span>
                    <span className={`tiny ${s.affordable ? 'green' : 'muted'}`}>след.: {num(s.next)}</span>
                  </button>
                ))}
                {t.starsCount > 5 && <div className="tiny muted">и ещё {t.starsCount - 5}</div>}
              </div>
            )}
            <button className="btn ghost small" onClick={() => setOpen(isOpen ? null : t.type)}>{isOpen ? 'Скрыть' : 'На что тратить'}</button>
            {isOpen && (
              <div className="essence-info small">
                <ul>{t.info.use.map(x => <li key={x}><Rich text={x} /></li>)}</ul>
                {t.itemsUsing > 0 && <p className="muted">Звёзды за эту эссенцию есть у {t.itemsUsing} {plural(t.itemsUsing, 'предмета', 'предметов', 'предметов')}.</p>}
              </div>
            )}
          </Card>
        );
      })}
      {!d.perksKnown && <p className="span-12 tiny muted">Hypixel не прислал купленные перки этого профиля: уровни показаны нулевыми.</p>}
    </RefsProvider>
  );
}

const STATE_RU = { upgrade: 'можно увеличить', missing: 'нет', unknown: 'есть, размер не виден', max: 'максимальный', merged: 'объединён' };

// Каких мешков не хватает и какие можно увеличить: следующий размер, требование коллекции, рецепт и цена
function SackLadder({ ladder }) {
  const { openItem } = useApp();
  const [f, setF] = useState(ladder.upgradable ? 'upgrade' : 'missing');
  const list = ladder.families.filter(x => (f === 'all' ? true : f === 'missing' ? x.state === 'missing' || x.state === 'unknown' : f === 'max' ? x.state === 'max' || x.state === 'merged' : x.state === f));
  const tabs = [['upgrade', `Увеличить (${ladder.upgradable})`], ['missing', `Нет (${ladder.missing})`], ['max', `Максимальные (${ladder.maxed})`], ['all', 'Все']];
  return (
    <Card className="span-12" title="Каких мешков не хватает и что увеличить" right={
      <div className="stash-gsort">{tabs.map(([k, l]) => <button key={k} className={`chip ${f === k ? 'active' : ''}`} onClick={() => setF(k)}>{l}</button>)}</div>
    }>
      <p className="small muted">Мешок забирает предметы своего вида прямо при подборе. Вместимость разных мешков одного вида складывается, а больший размер крафтится из меньшего. Рецепт открывается коллекцией.{!ladder.bagSeen && ' Сумка мешков (Sack of Sacks) в API не видна, поэтому мешки ищутся в инвентаре и хранилищах.'}</p>
      {list.length ? (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th aria-label="Иконка" /><th>Мешок</th><th>Сейчас</th><th>Следующий</th><th>Как получить</th><th>Цена</th></tr></thead>
            <tbody>
              {list.map(x => {
                const cur = x.ownedTier >= 0 ? x.steps[x.ownedTier] : null;
                const n = x.next;
                return (
                  <tr key={x.name}>
                    <td><ItemIcon id={n?.id || x.icon} size={30} onClick={() => openItem(n?.id || x.icon)} /></td>
                    <td><b>{sackRu(x.name)}</b>{x.kinds > 0 && <div className="tiny muted">{x.kinds} {plural(x.kinds, 'вид предметов', 'вида предметов', 'видов предметов')}</div>}</td>
                    <td className={x.state === 'max' || x.state === 'merged' ? 'green' : x.state === 'missing' ? 'muted' : ''}>
                      {cur ? <>{cur.size || 'есть'}{cur.capacity && <div className="tiny muted">по {num(cur.capacity)} шт.</div>}</> : STATE_RU[x.state]}
                    </td>
                    <td>{n ? <>{n.name}{n.capacity && <div className="tiny muted">по {num(n.capacity)} каждого</div>}{x.merges?.length > 0 && <div className="tiny muted">объединяет: {x.merges.map(sackRu).join(', ')}</div>}</>
                      : x.state === 'merged' ? <span className="green">✔ вошёл в мешок «{sackRu(x.mergedInto.name)}»</span> : <span className="green">✔ всё есть</span>}</td>
                    <td className="small">{n ? (
                      <>
                        {n.collection && <div>Рецепт открывает {n.collection.milestone ? '' : 'коллекция '}{n.collection.name} {n.collection.roman}</div>}
                        {n.where.map(w => <div key={w.text}>{w.text}</div>)}
                        {n.mats.length > 0 && <div className="item-row wrap stash-mats">
                          {n.needsPrev && <span className="tiny muted">предыдущий мешок +</span>}
                          {n.mats.map(m => <span key={m.id} className="stash-mat" title={m.name} onClick={() => openItem(m.id)}><ItemIcon id={m.id} size={20} />{num(m.count)}</span>)}
                        </div>}
                        {!n.mats.length && !n.collection && !n.where.length && <span className="muted">способа нет в базе — открой карточку мешка</span>}
                      </>
                    ) : '—'}</td>
                    <td>{n ? (
                      <>
                        {n.craftCost ? <div>крафт ~{coins(n.craftCost)}</div> : n.mats.length ? <div className="muted tiny">материалов нет на рынке</div> : null}
                        {n.buy ? <div className="tiny muted">готовый ~{coins(n.buy)}</div> : null}
                        {n.where.filter(w => w.coins).map(w => <div key={w.text} className="tiny">у торговца ~{coins(w.coins)}</div>)}
                      </>
                    ) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty>{f === 'upgrade' ? 'Увеличивать нечего: каждый мешок либо максимальный, либо его ещё нет.' : f === 'missing' ? 'Все мешки есть.' : 'Пусто.'}</Empty>}
    </Card>
  );
}

// Где стоит NPC магазина перков и как до него добраться
function ShopBox({ t }) {
  const sp = t.info.shopPlace;
  return (
    <div className="essence-shop small">
      <b>Где покупать перки:</b> {t.info.shop ? <Rich text={t.info.shop} /> : 'место магазина сайт пока не сверил — посмотри в игре.'}
      {sp && (
        <div className="tiny essence-route">
          NPC <b>{sp.npc}</b> · {sp.island}{sp.coords && <> · координаты {sp.coords.join(' ')}</>}
          {sp.warp && <> · дорога: <code>/warp {sp.warp}</code>{sp.dist > 15 ? `, дальше ~${sp.dist} блоков пешком` : ', NPC рядом'}</>}
          {sp.note && <div className="muted">{sp.note}</div>}
        </div>
      )}
    </div>
  );
}
