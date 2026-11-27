// «Запасы» → «Что продать»: вещи из инвентаря, рюкзаков, Ender Chest и мешков, где их выгоднее продать и за сколько.
// Без рынка (Ironman, Stranded, Bingo) — только торговцы. «На что потратить»: что из плана скрафтить из своих запасов
// (с рынком — только то, что так выходит дешевле покупки).
// Данные — /api/sell (расчёт в core stash/sell.js и stash/craft.js).
import { useMemo, useState } from 'react';
import { Card, Stat, Empty, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, plural } from '../api.js';
import { useApp } from '../App.jsx';

const SRC = { bazaar: 'Bazaar', ah: 'AH', npc: 'NPC' };
const WAY = { instant: 'Sell Instantly', offer: 'Sell Offer', fast: 'BIN чуть ниже всех', avg: 'BIN по средней цене', npc: 'торговцу' };
const PLACES = [['all', 'Все'], ['sacks', 'Мешки'], ['inv', 'Инвентарь'], ['bp', 'Рюкзаки'], ['ender', 'Ender Chest']];
const placeName = w => (w.key === 'bp' ? `Backpack ${w.n}` : (PLACES.find(p => p[0] === w.key) || [])[1] || w.key);
const whereText = ws => (ws.length > 2 ? `${ws.slice(0, 2).map(placeName).join(', ')} +${ws.length - 2}` : ws.map(placeName).join(', '));
const demandText = d => (!d ? '' : d.perDay != null ? `≈ ${num(d.perDay)} шт. в день` : `${num(d.lots)} ${plural(d.lots, 'лот', 'лота', 'лотов')} · за сутки ушло ${num(d.sold24h)}`);

/** Плитка «Что продать» для переключателя «Запасов» */
export function sellTile(d) {
  return {
    id: 'sell', news: 'sell', icon: 'GOLD_INGOT', title: 'Что продать',
    value: d ? coins(d.market ? d.totals.wait : d.totals.now) : '…',
    sub: !d ? 'считаю…' : d.items.length ? `${d.items.length} ${plural(d.items.length, 'вещь', 'вещи', 'вещей')} · где выгоднее и за сколько` : 'продавать нечего',
  };
}

export default function StashSell({ res }) {
  const { openItem } = useApp();
  const { data: d, error } = res;
  const [mode, setMode] = useState('wait');
  const [place, setPlace] = useState('all');
  const [pick, setPick] = useState({});
  const [copied, setCopied] = useState(false);
  const iron = d && !d.market;
  const take = x => (iron ? x.now : x[mode]);
  const list = useMemo(() => (d?.items || []).filter(x => place === 'all' || x.where.some(w => w.key === place)).sort((a, b) => take(b).total - take(a).total), [d, place, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !d) return <Empty>Не загрузилось: {error}</Empty>;
  if (!d) return <div className="span-12 muted small"><div className="spinner" />Смотрю, что лежит без дела…</div>;
  if (d.status === 'error') return <Empty>Не загрузилось: {d.error}</Empty>;
  if (d.apiDisabled) return <Card className="span-12" title="Вещи не видны"><p>У игрока выключен <b>Inventory API</b>: SkyBlock Menu → Settings → API Settings → Inventory API.</p></Card>;

  const picked = list.filter(x => pick[x.id]);
  const copy = () => {
    const rows = (picked.length ? picked : list).map(x => `${x.name} ×${x.count} — ${SRC[take(x).how]}, ${WAY[take(x).way]}: ${coins(take(x).total)}`);
    navigator.clipboard?.writeText(rows.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  const keepSum = d.keep.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <div className="span-12 stats-row">
        {iron
          ? <Stat label="Торговцам" value={coins(d.totals.now)} sub="Bazaar и AH закрыты: только NPC" accent="#4ade80" icon={<ItemIcon id="GOLD_INGOT" size={28} />} />
          : <>
            <Stat label="Продать сразу" value={coins(d.totals.now)} sub="Sell Instantly, BIN чуть ниже всех, торговцу" accent="#4ade80" icon={<ItemIcon id="GOLD_INGOT" size={28} />} />
            <Stat label="Если подождать" value={coins(d.totals.wait)} sub="Sell Offer и лоты по средней цене, после налога" accent="#f5c542" icon={<ItemIcon id="ENCHANTED_GOLD" size={28} />} />
          </>}
        {d.keep.length > 0 && <Stat label="Лучше оставить" value={`${d.keep.length} ${plural(d.keep.length, 'вещь', 'вещи', 'вещей')}`} sub={`${coins(keepSum)} · нужны для плана`} accent="#60a5fa" icon={<ItemIcon id="CHEST" size={28} />} />}
      </div>

      {iron && <Craft items={d.craft || []} openItem={openItem} iron />}

      <Card className="span-12" title={iron ? 'Продать торговцам' : 'Что продать'} news="sell">
        {!d.items.length ? <Empty>Ничего ценного без дела не лежит.</Empty> : <>
          <div className="sl-bar">
            <div className="sl-chips">{PLACES.filter(([k]) => k === 'all' || d.places[k]).map(([k, l]) => (
              <button key={k} className={`chip ${place === k ? 'active' : ''}`} onClick={() => setPlace(k)}>{l} <span className="muted">{k === 'all' ? d.items.length : d.places[k]}</span></button>))}</div>
            {!iron && <div className="sl-chips">{[['now', 'Сразу'], ['wait', 'Подождать']].map(([k, l]) => <button key={k} className={`chip ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>}
          </div>
          <div className="sl-head tiny muted"><span /><span>Предмет</span><span>Где продать</span><span>{iron ? '' : 'Спрос'}</span><span className="r">Выручка</span></div>
          {list.map(x => {
            const p = take(x);
            return (
              <div key={x.id} className="sl-row">
                <input type="checkbox" aria-label="Выбрать" checked={!!pick[x.id]} onChange={() => setPick(s => ({ ...s, [x.id]: !s[x.id] }))} />
                <button className="sl-item" onClick={() => openItem(x.id)}><ItemIcon id={x.id} size={32} /><span><b>{x.name}</b><span className="tiny muted">{num(x.count)} шт. · {whereText(x.where)}{x.extra ? ` · ещё ${x.extra} ${plural(x.extra, 'остаётся', 'остаются', 'остаются')} у тебя` : ''}</span></span></button>
                <span className="sl-where"><span className={`sl-src sl-${p.how}`}>{SRC[p.how]}</span><span className="tiny muted">{WAY[p.way]}</span></span>
                <span className="sl-dem tiny muted">{iron ? '' : demandText(x.demand)}</span>
                <span className="sl-val"><b className="gold">{coins(p.total)}</b>{x.count > 1 && <span className="tiny muted">{coins(p.unit)} за шт.</span>}</span>
              </div>
            );
          })}
          {d.more > 0 && <p className="tiny muted sl-note">И ещё {d.more} {plural(d.more, 'позиция', 'позиции', 'позиций')} подешевле.</p>}
          {iron && d.noNpc.length > 0 && <p className="tiny muted sl-note">Торговцы не берут: {d.noNpc.map(x => x.name).join(', ')}. Это лучше пустить в крафт.</p>}
          <div className="sl-foot">
            <span className="small">{picked.length ? <>Выбрано {picked.length}: <b className="gold">{coins(picked.reduce((s, x) => s + take(x).total, 0))}</b></> : <span className="muted">Отметь, что продаёшь, — сумма будет здесь</span>}</span>
            <button className="btn ghost" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать список'}</button>
          </div>
        </>}
      </Card>

      {d.keep.length > 0 && (
        <Card className="span-12" title="Лучше оставить">
          <div className="sl-keep">{d.keep.map(x => (
            <button key={x.id} className="sl-krow" onClick={() => openItem(x.id)}><ItemIcon id={x.id} size={32} /><span><b>{x.name}{x.count > 1 ? ` ×${num(x.count)}` : ''}</b><span className="tiny muted">{x.why}</span></span><span className="tiny muted r">{coins(x.value)}</span></button>
          ))}</div>
        </Card>
      )}

      {!iron && d.craft?.length > 0 && <Craft items={d.craft} openItem={openItem} />}
    </>
  );
}

// Что из плана можно скрафтить из своих запасов и чего не хватает; с рынком — ещё сколько это экономит
function Craft({ items, openItem, iron }) {
  return (
    <Card className="span-12" title="На что потратить" news="craft">
      <p className="small muted">{iron
        ? 'Вещи из плана, на которые уже есть часть ресурсов. Цифры — сколько есть из нужного по рецепту.'
        : 'Вещи из плана, которые дешевле собрать из своих запасов, чем купить готовыми. Цифры — сколько есть из нужного по рецепту.'}</p>
      {!items.length ? <Empty>Для вещей из плана в запасах пока ничего нет.</Empty> : (
        <div className="sl-craft">{items.map(x => (
          <div key={x.id} className="sl-crow">
            <button className="sl-item" onClick={() => openItem(x.id)}><ItemIcon id={x.id} size={36} /><span><b>{x.name}</b>{x.step && <span className="tiny muted">{x.step}</span>}{x.saving > 0 && <span className="tiny"><span className="gold">выгода {coins(x.saving)}</span><span className="muted"> · {x.missCost ? `докупить на ${coins(x.missCost)} вместо ${coins(x.buyCost)}` : `всё есть, готовая стоит ${coins(x.buyCost)}`}</span></span>}</span></button>
            <div className="sl-cprog"><Progress value={x.ready} color={x.ready >= 1 ? 'var(--green)' : 'var(--accent)'} sub={x.ready >= 1 ? 'можно крафтить' : `${Math.round(x.ready * 100)}%`} /></div>
            <div className="sl-parts">{x.parts.map(p => {
              const ok = p.have >= p.need, can = !ok && p.have + p.fromStash >= p.need;
              return (
                <button key={p.id} className={`sl-part ${ok ? 'ok' : can ? 'can' : 'miss'}`} onClick={() => openItem(p.id)} title={p.name}>
                  <ItemIcon id={p.id} size={20} /><span>{p.name}</span><b>{num(p.have)}/{num(p.need)}</b>
                  {p.fromStash > 0 && <span className="tiny">+{num(p.fromStash)} скрафтить</span>}
                </button>
              );
            })}</div>
          </div>
        ))}</div>
      )}
    </Card>
  );
}
