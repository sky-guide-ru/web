// МАКЕТ «Что продать» (данные выдуманы, для показа)
import { useState } from 'react';
import { Card, Stat } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num } from '../api.js';
import './sell.css';

// how: bazaar | ah | npc; now — продать сразу, wait — ордер/лот; npc — торговцу (Ironman)
const ITEMS = [
  { id: 'ENCHANTED_MITHRIL', name: 'Enchanted Mithril', n: 3151, at: 'Мешки', how: 'bazaar', now: 7.56e6, wait: 8.21e6, npc: 5.04e6, demand: '≈ 41 тыс. шт. в день' },
  { id: 'LIVID_DAGGER', name: 'Livid Dagger', n: 1, at: 'Ender Chest, стр. 2', how: 'ah', now: 2.6e6, wait: 3.05e6, npc: 1e4, demand: '12 лотов, за сутки ушло 18', why: 'второй такой же — в инвентаре' },
  { id: 'ENCHANTED_PUFFERFISH', name: 'Enchanted Pufferfish', n: 1885, at: 'Мешки', how: 'bazaar', now: 3.58e6, wait: 3.9e6, npc: 2.26e6, demand: '≈ 9 тыс. шт. в день' },
  { id: 'JACOBS_TICKET', name: "Jacob's Ticket", n: 149, at: 'Backpack 5', how: 'bazaar', now: 2.6e6, wait: 2.84e6, npc: 0, demand: '≈ 2 тыс. шт. в день' },
  { id: 'ENCHANTED_HARD_STONE', name: 'Enchanted Hard Stone', n: 3005, at: 'Мешки', how: 'bazaar', now: 2.7e6, wait: 2.88e6, npc: 1.73e6, demand: '≈ 60 тыс. шт. в день' },
  { id: 'WISE_DRAGON_CHESTPLATE', name: 'Wise Dragon Chestplate', n: 1, at: 'Backpack 2', how: 'ah', now: 1.2e6, wait: 1.45e6, npc: 4e4, demand: '30 лотов, уходит за ~день', why: 'старый сет: носишь Storm' },
  { id: 'ENCHANTED_BONE', name: 'Enchanted Bone', n: 640, at: 'Ender Chest, стр. 1', how: 'bazaar', now: 1.1e6, wait: 1.18e6, npc: 1.02e5, demand: '≈ 25 тыс. шт. в день' },
  { id: 'REVENANT_FLESH', name: 'Revenant Flesh', n: 412, at: 'Инвентарь', how: 'bazaar', now: 9.5e5, wait: 1.02e6, npc: 2.06e4, demand: '≈ 70 тыс. шт. в день' },
  { id: 'HAMSTER_WHEEL', name: 'Hamster Wheel', n: 18, at: 'Backpack 4', how: 'npc', now: 3.6e5, wait: 3.6e5, npc: 3.6e5, demand: 'торговец берёт сколько угодно' },
];
const KEEP = [
  { id: 'RECOMBOBULATOR_3000', name: 'Recombobulator 3000', v: 6.9e6, why: 'нужен для Treasure Ring из плана покупок' },
  { id: 'DIVAN_FRAGMENT', name: 'Divan Fragment ×6', v: 4.1e6, why: "хватит на Divan's Drill из плана" },
  { id: 'SUMMONING_EYE', name: 'Summoning Eye ×3', v: 3.3e6, why: 'шаг плана: Superior Dragon Armor' },
  { id: 'ANCESTRAL_SPADE', name: 'Ancestral Spade', v: 4.6e6, why: 'пригодится, если мэром станет Diana' },
];
const LABEL = { bazaar: 'Bazaar', ah: 'AH', npc: 'NPC' };
const HOW = {
  bazaar: { now: 'Sell Instantly', wait: 'Sell Offer' },
  ah: { now: 'BIN чуть ниже всех', wait: 'BIN по средней цене' },
  npc: { now: 'торговцу', wait: 'торговцу' },
};
const PLACES = ['Все', 'Мешки', 'Инвентарь', 'Рюкзаки', 'Ender Chest'];
const placeOf = at => at.startsWith('Backpack') ? 'Рюкзаки' : at.startsWith('Ender') ? 'Ender Chest' : at;

export function useSellTile(iron) {
  const list = iron ? ITEMS.filter(x => x.npc) : ITEMS;
  const v = list.reduce((s, x) => s + (iron ? x.npc : x.wait), 0);
  return { id: 'sell', icon: 'GOLD_INGOT', title: 'Что продать', value: coins(v), sub: `${list.length} вещей · инвентарь, рюкзаки, Ender Chest, мешки` };
}

export default function SellMock({ iron: iron0 = false }) {
  const [iron, setIron] = useState(iron0);
  const [mode, setMode] = useState('wait');
  const [place, setPlace] = useState('Все');
  const [pick, setPick] = useState({ ENCHANTED_MITHRIL: 1, LIVID_DAGGER: 1, JACOBS_TICKET: 1 });
  const val = x => iron ? x.npc : x[mode];
  const all = (iron ? ITEMS.filter(x => x.npc) : ITEMS).map(x => iron ? { ...x, how: 'npc' } : x);
  const list = all.filter(x => place === 'Все' || placeOf(x.at) === place).sort((a, b) => val(b) - val(a));
  const noNpc = iron ? ITEMS.filter(x => !x.npc) : [];
  const sumNow = all.reduce((s, x) => s + (iron ? x.npc : x.now), 0);
  const sumWait = all.reduce((s, x) => s + (iron ? x.npc : x.wait), 0);
  const picked = list.filter(x => pick[x.id]);
  const cnt = p => p === 'Все' ? all.length : all.filter(x => placeOf(x.at) === p).length;
  return (
    <>
      <div className="span-12 stats-row">
        {iron
          ? <Stat label="Торговцам" value={coins(sumNow)} sub="Ironman: Bazaar и AH закрыты, считаем только NPC" accent="#4ade80" icon={<ItemIcon id="GOLD_INGOT" size={28} />} />
          : <>
            <Stat label="Продать сразу" value={coins(sumNow)} sub="Sell Instantly, BIN чуть ниже всех, торговцу" accent="#4ade80" icon={<ItemIcon id="GOLD_INGOT" size={28} />} />
            <Stat label="Если подождать" value={coins(sumWait)} sub="Sell Offer и лоты по средней цене, после налога" accent="#f5c542" icon={<ItemIcon id="ENCHANTED_GOLD" size={28} />} />
          </>}
        <Stat label="Лучше оставить" value={`${KEEP.length} вещи`} sub={`${coins(KEEP.reduce((s, x) => s + x.v, 0))} · нужны для плана`} accent="#60a5fa" icon={<ItemIcon id="CHEST" size={28} />} />
      </div>

      <Card className="span-12" title="Что продать" right={
        <label className="sl-iron small"><input type="checkbox" checked={iron} onChange={() => setIron(v => !v)} /> Ironman: только NPC</label>
      }>
        <div className="sl-bar">
          <div className="sl-chips">{PLACES.map(p => <button key={p} className={`chip ${place === p ? 'active' : ''}`} onClick={() => setPlace(p)}>{p} <span className="muted">{cnt(p)}</span></button>)}</div>
          {!iron && <div className="sl-chips">{[['now', 'Сразу'], ['wait', 'Подождать']].map(([k, l]) => <button key={k} className={`chip ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>}
        </div>
        <div className="sl-head tiny muted"><span /><span>Предмет</span><span>Где продать</span><span>Спрос</span><span className="r">Выручка</span></div>
        {list.map(x => (
          <label key={x.id} className="sl-row">
            <input type="checkbox" checked={!!pick[x.id]} onChange={() => setPick(p => ({ ...p, [x.id]: !p[x.id] }))} />
            <span className="sl-item"><ItemIcon id={x.id} size={32} /><span><b>{x.name}</b><span className="tiny muted">{num(x.n)} шт. · {x.at}{x.why ? ` · ${x.why}` : ''}</span></span></span>
            <span className="sl-where"><span className={`sl-src sl-${x.how}`}>{LABEL[x.how]}</span><span className="tiny muted">{HOW[x.how][mode]}</span></span>
            <span className="sl-dem tiny muted">{iron ? '' : x.demand}</span>
            <span className="sl-val"><b className="gold">{coins(val(x))}</b>{x.n > 1 && <span className="tiny muted">{coins(val(x) / x.n)} за шт.</span>}</span>
          </label>
        ))}
        {noNpc.length > 0 && <p className="tiny muted sl-note">Торговцы не берут: {noNpc.map(x => x.name).join(', ')}. Лучше оставить для крафта.</p>}
        <div className="sl-foot">
          <span className="small">Выбрано {picked.length}: <b className="gold">{coins(picked.reduce((s, x) => s + val(x), 0))}</b></span>
          <button className="btn ghost">Скопировать список</button>
        </div>
      </Card>

      <Card className="span-12" title="Лучше оставить">
        <div className="sl-keep">{KEEP.map(x => (
          <div key={x.id} className="sl-krow"><ItemIcon id={x.id} size={32} /><span><b>{x.name}</b><span className="tiny muted">{x.why}</span></span><span className="tiny muted r">{coins(x.v)}</span></div>
        ))}</div>
      </Card>
    </>
  );
}
