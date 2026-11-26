import { useState, useEffect } from 'react';
import { Card, Tabs, Empty, CountUp } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, itemValue, useApi, api, usePart, RARITY_COLOR } from '../api.js';
import { useApp } from '../App.jsx';
import PlayerModel from '../components/PlayerModel.jsx';

// Шлем → нагрудник → поножи → ботинки, как в игре
const PIECE_ORDER = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const pieceOrder = p => { const i = PIECE_ORDER.findIndex(k => (p.id || '').endsWith(k)); return i < 0 ? 9 : i; };

function ItemList({ items, openItem }) {
  if (!items?.length) return <Empty>Ничего не найдено (возможно, в настройках API выключен доступ к инвентарю).</Empty>;
  return (
    <div className="item-list">
      {items.map((it, i) => (
        <div key={i} className="item-line" onClick={() => openItem(it.id, it.uuid)}>
          <ItemIcon item={it} size={40} slot />
          <div className="grow">
            <div style={{ color: RARITY_COLOR[it.rarity] || '#fff', fontWeight: 600 }}>{it.name}</div>
            <div className="muted tiny">{[it.where, it.reforge && `перековка: ${reforgeName(it.reforge)}`, it.stars ? (it.stars > 5 ? `5★+${it.stars - 5}` : `${it.stars}★`) : null, it.recomb && 'рекомб', it.hpb ? `книги: ${it.hpb}` : null].filter(Boolean).join(' · ')}</div>
          </div>
          {it.value !== undefined && <div className="price" title={it.value > 0 ? '' : 'Цена неизвестна: нет на Bazaar/AH или аукцион ещё сканируется'}>{itemValue(it.value)}</div>}
        </div>
      ))}
    </div>
  );
}

function Grid({ items, cols = 9, openItem }) {
  return (
    <div className="mc-grid" style={{ gridTemplateColumns: `repeat(${cols}, 46px)` }}>
      {items.map((it, i) => <ItemIcon key={i} item={it?.id ? it : null} size={46} slot onClick={it?.id ? () => openItem(it.id, it.uuid) : undefined} />)}
    </div>
  );
}

// Wardrobe и наборы снаряжения: как в игре, столбик из 4 частей на каждый слот, подпись — названия наборов.
// Номера слотов как в игре; надетый слот показан с надетой бронёй (в самом наборе он пустой)
function SetsView({ sets, openItem }) {
  return (
    <div className="mc-grid" style={{ gridTemplateColumns: `repeat(auto-fill, 52px)`, gap: 10 }}>
      {sets.map(s => (
        <div key={s.slot} className={`set-col ${s.equipped ? 'on' : ''}`} title={`${s.names.join(', ') || `Слот ${s.slot}`}${s.equipped ? ' (надет)' : ''}`}>
          {/* название набора целиком в две строки: на телефоне нет наведения, обрезанное «Dungeo…» было не прочитать */}
          <div className="set-name tiny" aria-label={s.equipped ? `${s.names[0] || `Слот ${s.slot}`}, надет` : undefined}>{s.names[0] || `Слот ${s.slot}`}</div>
          {s.items.map((it, i) => <ItemIcon key={i} item={it?.id ? it : null} size={46} slot onClick={it?.id ? () => openItem(it.id, it.uuid) : undefined} />)}
          {/* номер слота и «надет» под бронёй: в подписи на 52px они вытесняли название набора */}
          {s.names[0] && <div className="set-no tiny">Слот {s.slot}</div>}
          {s.equipped && <div className="set-no on tiny" aria-hidden="true">надет</div>}
        </div>
      ))}
    </div>
  );
}

const PLACE_RU = { inventory: 'Инвентарь', enderChest: 'Ender Chest', wardrobe: 'Wardrobe', wardrobeEquipment: 'Wardrobe (Equipment)', vault: 'Personal Vault', talismans: 'Accessory Bag', armor: 'Надето', equipment: 'Экипировка', quiver: 'Quiver', fishingBag: 'Fishing Bag', potions: 'Potion Bag' };

// Все предметы из всех хранилищ с подписью, где лежат
function allStored(data) {
  const out = [];
  for (const [k, label] of Object.entries(PLACE_RU)) for (const it of data[k] || []) if (it?.id) out.push({ ...it, where: label });
  for (const [k, list] of Object.entries(data.backpacks || {})) for (const it of list || []) if (it?.id) out.push({ ...it, where: `Backpack ${Number(k) + 1}` });
  return out;
}

// «Где мой Hyperion?» — поиск сразу по инвентарю, эндер-сундуку, рюкзакам и гардеробу (по-русски тоже)
function StorageSearch({ data, q, openItem }) {
  const [ruIds, setRuIds] = useState(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRuIds(null); return; }
    let alive = true;
    setRuIds(null);
    // limit=500: среди сотен совпадений в каталоге нужно не потерять то, что лежит у игрока
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q.trim())}&limit=500`).then(r => alive && setRuIds(new Set(r.map(x => x.id)))).catch(() => {}), 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  const s = q.trim().toLowerCase();
  const found = allStored(data).filter(it => (it.name || '').toLowerCase().includes(s) || it.id.toLowerCase().includes(s.replace(/ /g, '_')) || ruIds?.has(it.id));
  return found.length ? <ItemList items={found} openItem={openItem} /> : <Empty>{ruIds ? 'Такого предмета в хранилищах нет.' : 'Ищу…'}</Empty>;
}

function Storage({ openItem }) {
  const { data } = useApi('/inventory');
  const [tab, setTab] = useState('inventory');
  const [q, setQ] = useState('');
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  const tabs = [
    { id: 'inventory', label: 'Инвентарь' }, { id: 'enderChest', label: 'Ender Chest' }, { id: 'wardrobe', label: 'Wardrobe' }, { id: 'equipmentSets', label: 'Наборы снаряжения' },
    { id: 'vault', label: 'Personal Vault' }, { id: 'talismans', label: 'Accessory Bag' }, { id: 'quiver', label: 'Quiver' },
    { id: 'sacksBag', label: 'Сумка мешков' }, { id: 'potions', label: 'Potion Bag' },
    ...(data.rift ? [{ id: 'riftInventory', label: 'Rift: инвентарь' }, { id: 'riftEnder', label: 'Rift: эндер-сундук' }] : []),
    ...Object.keys(data.backpacks || {}).sort((a, b) => a - b).map(k => ({ id: `bp${k}`, label: `Backpack ${Number(k) + 1}` })),
  ];
  const rift = { riftInventory: data.rift?.inventory, riftEnder: data.rift?.enderChest };
  let items = (tab.startsWith('bp') ? data.backpacks[tab.slice(2)] : tab in rift ? rift[tab] : data[tab]) || [];
  if (tab === 'inventory') items = [...items.slice(9), ...items.slice(0, 9)]; // хотбар вниз, как в игре
  return (
    <>
      <input className="search" placeholder="Где лежит? Найти во всех хранилищах: hyperion, гиперион, рекомб…" value={q} onChange={e => setQ(e.target.value)} />
      {q.trim().length >= 2 ? <StorageSearch data={data} q={q} openItem={openItem} /> : <>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'wardrobe' && data.wardrobeSets?.length ? <SetsView sets={data.wardrobeSets} openItem={openItem} />
          : tab === 'equipmentSets' ? (data.equipmentSets?.length ? <SetsView sets={data.equipmentSets} openItem={openItem} /> : <Empty>Наборов снаряжения нет.</Empty>)
          : items.length ? <Grid items={items} openItem={openItem} /> : <Empty>{tab === 'wardrobe' && data.wardrobeMissing ? 'Wardrobe пуст.' : 'Пусто или доступ к инвентарю в API выключен.'}</Empty>}
      </>}
    </>
  );
}

const EQUIP_SLOTS = ['Ожерелье', 'Плащ', 'Пояс', 'Перчатки'];
const ARMOR_SLOTS = ['Шлем', 'Нагрудник', 'Поножи', 'Ботинки'];

// Как на SkyCrypt: фигура игрока, броня, экипировка и активный питомец рядом
function Worn({ g, member, openItem }) {
  const pet = member?.pets?.find(p => p.active);
  const slot = (it, label, i) => (
    <div key={i} className={`worn-slot ${it ? '' : 'vacant'}`} title={it ? undefined : `${label}: пусто. Нажми, чтобы посмотреть, что сюда надеть`}>
      {/* пустой слот ведёт в вики к предметам этого типа: сразу видно, чем его занять */}
      {it ? <ItemIcon item={it} size={52} slot onClick={() => openItem(it.id, it.uuid)} /> : <a className="slot-ghost" href={`#/wiki/${encodeURIComponent(label.toLowerCase())}`} style={{ width: 52, height: 52 }}>{label}</a>}
    </div>
  );
  const armorVal = g.worn.armor.reduce((s, i) => s + (i?.value || 0), 0);
  const equipVal = g.worn.equipment.reduce((s, i) => s + (i?.value || 0), 0);
  return (
    <>
      <div className="worn">
        {member?.uuid && <PlayerModel uuid={member.uuid} className="worn-body" width={120} height={230} />}
        <div className="worn-col">{ARMOR_SLOTS.map((l, i) => slot(g.worn.armor[i], l, i))}</div>
        <div className="worn-col">{EQUIP_SLOTS.map((l, i) => slot(g.worn.equipment[i], l, i))}</div>
      </div>
      {pet && (
        <div className="worn-pet" onClick={() => openItem(pet.id)} style={{ '--r': RARITY_COLOR[pet.tier] || '#fff' }}>
          <ItemIcon id={pet.id} size={36} />
          <div className="grow">
            <div style={{ color: RARITY_COLOR[pet.tier], fontWeight: 700 }}>[{pet.level}] {pet.type.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}</div>
            <div className="muted tiny">Активный питомец{pet.heldItem ? ' · с предметом' : ''}</div>
          </div>
          {pet.heldItem && <ItemIcon id={pet.heldItem} size={28} />}
        </div>
      )}
      <div className="worn-sum"><span>Броня <b className="gold">{coins(armorVal)}</b></span><span>Экипировка <b className="gold">{coins(equipVal)}</b></span></div>
    </>
  );
}

// Итог крупно + полоса долей, как на SkyCrypt
const NW_PARTS = [['items', 'Предметы', '#f5c542'], ['pets', 'Питомцы', '#c879ff'], ['sacks', 'Мешки', '#4ade80'], ['essence', 'Essence', '#22d3ee'], ['coins', 'Монеты', '#60a5fa'], ['museum', 'Музей', '#f472b6']];
function Networth({ nw, pricing }) {
  const total = nw.total || 0;
  const parts = NW_PARTS.map(([k, label, color]) => ({ k, label, color, v: nw[k] || 0 }));
  return (
    <div className="nw">
      <div className="nw-total"><span className="muted small">Итого</span><b className="gold"><CountUp value={coins(total)} /></b></div>
      {pricing && <div className="muted small nw-wait"><div className="spinner" /> Цены ещё загружаются (сайт только что обновился), предметы пока не посчитаны. Через минуту оценка уточнится сама.</div>}
      <div className="nw-bar">{parts.filter(p => p.v > 0).map(p => <i key={p.k} style={{ width: `${(p.v / (total || 1)) * 100}%`, background: p.color }} title={`${p.label}: ${coins(p.v)}`} />)}</div>
      <div className="nw-parts">{parts.map(p => (
        <div key={p.k} className="nw-part"><span className="nw-dot" style={{ background: p.color }} /><span className="muted">{p.label}</span><b>{coins(p.v)}</b><span className="muted tiny">{total ? Math.round((p.v / total) * 100) : 0}%</span></div>
      ))}</div>
      <div className="muted tiny">Рыночная оценка по самым дешёвым лотам аукциона и Bazaar: база предмета плюс зачарования, гемы, звёзды, свитки, рекомб и книги. SkyCrypt считает иначе (вложенные улучшения и привязанные предметы по цене крафта), поэтому у него цифра выше.</div>
    </div>
  );
}

// Цены Bazaar и аукциона пришли — без них оценка предметов после перезапуска сервера «0»
export const pricesLoaded = state => !!state?.pricesAt?.bazaar && !!(state.pricesAt.auctions || state.pricesAt.auctionsError);

// Reforge в API строчными (heroic, pitchin) — в игре она пишется с заглавной: Heroic, Pitchin'
const reforgeName = r => String(r).split('_').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

// Название сета: «Necron Helmet» → «Necron». Если у части необычное имя («Wyld Helmet on a Helmet»,
// «Wyld Chain Top»), берём название из id сета: WYLD → Wyld
function setLabel(s) {
  const n = [...s.pieces].sort((a, b) => pieceOrder(a) - pieceOrder(b))[0].name.replace(/\s*[✪➊-➎].*$/, '').trim();
  if (/ (Helmet|Chestplate|Leggings|Boots)$/.test(n) && !/ (Helmet|Chestplate|Leggings|Boots) /.test(n)) return n.replace(/ (Helmet|Chestplate|Leggings|Boots)$/, '');
  return String(s.id).toLowerCase().split('_').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export default function Gear({ state }) {
  const { openItem } = useApp();
  // Полное снаряжение — отдельным куском при открытии раздела (в общем профиле только сводка для «Обзора»)
  const g = usePart(state, 'gear', state.analysis?.gear);
  if (!g) return <div className="muted small"><div className="spinner" />Загружаю снаряжение…</div>;
  return (
    <div className="grid">
      <Card title="Надето сейчас" className="span-4">
        <Worn g={g} member={state.member} openItem={openItem} />
      </Card>
      <div className="span-8 gear-stack">
      <Card title="Оружие"><ItemList items={g.weapons.slice(0, 8)} openItem={openItem} /></Card>
      <div className="gear-stack-row">
      <Card title="Сеты брони">
        <div className="item-list">
          {g.armorSets.map(s => (
            <div key={s.id} className="item-line">
              <div className="set-icons">{[...s.pieces].sort((a, b) => pieceOrder(a) - pieceOrder(b)).slice(0, 4).map((p, i) => <ItemIcon key={i} item={p} size={34} />)}</div>
              <div className="grow"><b>{setLabel(s)}</b><div className="muted tiny">{s.pieces.length}/4 частей{s.copies > s.pieces.length ? ` · дубликатов: ${s.copies - s.pieces.length}` : ''}</div></div>
              <div className="price">{itemValue(s.value)}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Инструменты"><ItemList items={g.tools.slice(0, 8)} openItem={openItem} /></Card>
      </div>
      </div>
      <Card title="Хранилища" className="span-12"><Storage openItem={openItem} /></Card>
      <Card title="Оценка состояния" className="span-12"><Networth nw={g.networth} pricing={!pricesLoaded(state)} /></Card>
    </div>
  );
}
