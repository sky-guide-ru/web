import { DEC } from '../i18n.js';
// Страница «Миньоны»: слоты (уникальные крафты кооператива + Community Shop), что дешевле всего скрафтить до
// следующего слота, все типы с тирами и замками (коллекция или слеер), примерная доходность, улучшения и топливо.
// Данные — /api/minions (выбранный игрок).
import { useMemo, useState } from 'react';
import { Card, Stat, Empty, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApi, coins, num, plural } from '../api.js';
import { useApp } from '../App.jsx';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = n => ROMAN[n] || String(n);
const secs = s => (s >= 60 ? `${Math.round(s / 6) / 10} мин` : `${String(s).replace('.', DEC)} с`);

export default function Minions({ state }) {
  const { openItem } = useApp();
  const upd = state?.updatedAt || 0;
  const { data: mi, error } = useApi('/minions', [upd, state?.pricesAt?.bazaar], { keep: true });
  const [filter, setFilter] = useState('todo');
  const [q, setQ] = useState('');

  const byType = useMemo(() => new Map((mi?.types || []).map(t => [t.type, t])), [mi]);
  const list = useMemo(() => {
    if (!mi?.types) return [];
    const qs = q.trim().toLowerCase();
    return mi.types.filter(t => (filter === 'all' || (filter === 'todo' ? (t.top < t.max || t.missing.length) && !t.locked : filter === 'new' ? !t.top : filter === 'locked' ? !!t.locked : t.top >= t.max))
      && (!qs || t.name.toLowerCase().includes(qs)));
  }, [mi, filter, q]);

  if (error && !mi) return <Empty>Миньоны не загрузились: {error}</Empty>;
  if (!mi) return <div className="muted small"><div className="spinner" />Считаю миньонов…</div>;
  if (mi.status === 'error') return <Empty>Миньоны не загрузились: {mi.error}</Empty>;
  const who = state?.view?.owner ? 'у тебя' : `у ${mi.player || 'игрока'}`;
  const nextSlot = mi.slots + 1; // в лестнице — слоты за крафты
  const nextTotal = mi.totalSlots + 1; // в заголовках — со слотами Community Shop, как в игре
  const prevNeed = [...mi.ladder].reverse().find(l => l.done)?.need || 0;

  return (
    <div className="grid museum minions">
      <div className="span-12 stats-row">
        <Stat label="Слотов миньонов" value={mi.totalSlots} sub={mi.community ? `${mi.slots} за крафты + ${mi.community} из Community Shop` : `за крафты · Community Shop: 0/${mi.communityMax}`} accent="#f5c542" icon={<img src="/api/texture/hopper" alt="" />} />
        <Stat label="Уникальных крафтов" value={`${mi.unique} / ${mi.totalPossible}`} sub={mi.coop ? `весь кооп · твоих ${mi.ownUnique}` : `${Math.round(mi.unique / Math.max(1, mi.totalPossible) * 100)}% всех тиров`} accent="#4ade80" icon={<img src="/api/texture/crafting_table" alt="" />} />
        <Stat label={mi.nextAt ? `До ${nextTotal}-го слота` : 'Слоты'} value={mi.nextAt ? `${mi.left} ${plural(mi.left, 'крафт', 'крафта', 'крафтов')}` : 'максимум'} sub={mi.nextAt ? (mi.toNextCost != null ? `дешевле всего ~${coins(mi.toNextCost)}` : 'цены ещё грузятся') : `все ${mi.maxSlots} слотов за крафты`} accent="#60a5fa" icon={<img src="/api/texture/gold_ingot" alt="" />} />
        <Stat label="Типов на максимуме" value={`${mi.maxed} / ${mi.types.length}`} sub={`не начато ${mi.notStarted.length}`} accent="#f472b6" icon={<img src="/api/texture/nether_star" alt="" />} />
      </div>

      {mi.status === 'empty' && <div className="span-12 small muted coll-note">Hypixel не прислал ни одного крафта миньона: либо их правда нет, либо профиль пустой. Цифры ниже — с нуля.</div>}

      <Card className="span-12" title={mi.nextAt ? `До ${nextTotal}-го слота: ${mi.left} ${plural(mi.left, 'новый крафт', 'новых крафта', 'новых крафтов')}` : 'Все слоты за крафты открыты'}>
        {mi.nextAt && <Progress value={(mi.unique - prevNeed) / Math.max(1, mi.nextAt - prevNeed)} label={`${mi.unique} уникальных`} sub={`следующий слот на ${mi.nextAt}`} color="#f5c542" />}
        <div className="minion-ladder" aria-label="Лестница слотов">
          {mi.ladder.map(l => <span key={l.slots} className={`museum-ms-cell ${l.done ? 'done' : l.slots === nextSlot ? 'next' : ''}`} title={`${l.slots} слотов за крафты — ${l.need} уникальных`}>{l.slots}</span>)}
        </div>
        {mi.toNext.length > 0 && (
          <>
            <div className="small" style={{ marginTop: 'var(--sp-2)' }}><b>Дешевле всего добрать{mi.toNextCost != null ? ` за ~${coins(mi.toNextCost)}` : ''}:</b> <span className="muted">материалы по Bazaar, без миньона прошлого тира (он уже есть). Скрафченного миньона можно сразу разобрать или продать — крафт засчитан навсегда.</span></div>
            <div className="museum-tiles">
              {mi.toNext.map(c => (
                <button key={c.type + c.tier} className={`museum-tile ${c.isNew ? 'warn' : ''}`} onClick={() => openItem(`${c.type}_GENERATOR_${c.tier}`)} title={c.parts.map(p => `${p.n}× ${p.name}`).join(', ')}>
                  <ItemIcon id={`${c.type}_GENERATOR_${c.tier}`} size={36} />
                  <span className="museum-tile-text"><b>{c.name} {roman(c.tier)}</b><span className="tiny muted">~{coins(c.cost)}{c.isNew ? ' · новый тип' : c.gap ? ' · пропущенный тир' : ''}</span></span>
                </button>
              ))}
            </div>
          </>
        )}
        {mi.coop && <div className="tiny muted" style={{ marginTop: 6 }}>Профиль в коопе: уникальные крафты всех участников складываются, слоты общие.</div>}
      </Card>

      <Card className="span-12" title="Что приносит больше монет">
        {mi.profit.length ? (
          <>
            <p className="small muted">Примерный доход одного миньона за сутки, если продавать дроп на Bazaar сразу (Sell Instantly). Без топлива и улучшений: с Plasma Bucket и Flycatcher будет примерно в 1,5–1,7 раза больше. Тир — самый высокий {who}, у не скрафченных — I.</p>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th></th><th>Миньон</th><th className="minion-opt">Тир</th><th className="minion-opt">Действие</th><th>Дроп за сбор</th><th>В сутки</th></tr></thead>
                <tbody>
                  {mi.profit.slice(0, 15).map(type => { const t = byType.get(type); return (
                    <tr key={type} className="clickable-row" onClick={() => openItem(t.icon)}>
                      <td><ItemIcon id={t.icon} size={30} /></td>
                      <td>{t.name}<div className="tiny muted minion-opt-sm">{t.top ? roman(t.top) : 'нет'}{t.speed ? ` · ${secs(t.speed)}` : ''}</div>{t.locked && <div className="tiny warn">рецепт закрыт</div>}</td>
                      <td className="minion-opt">{t.top ? roman(t.top) : <span className="muted">нет</span>}</td>
                      <td className="minion-opt">{t.speed ? secs(t.speed) : '—'}</td>
                      <td className="small">{t.drops.map(d => `${String(d.n).replace('.', DEC)}× ${d.name}`).join(', ')}</td>
                      <td className="gold">~{coins(t.perDay)}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
            <div className="tiny muted">Дроп за сбор — средний по вики, сбор идёт каждое второе действие. Миньоны с редким дропом (Inferno, Vampire, рыбалка, деревья) сюда не входят.</div>
          </>
        ) : <Empty>{state?.pricesAt?.bazaar ? 'Нет цен на дроп миньонов.' : 'Цены Bazaar ещё загружаются.'}</Empty>}
      </Card>

      <Card className="span-12" title="Все миньоны" right={<span className="tiny muted">{list.length} {plural(list.length, 'тип', 'типа', 'типов')}</span>}>
        <div className="museum-filters">
          <div className="chips">
            {[['todo', 'Можно качать'], ['new', `Не начаты (${mi.notStarted.length})`], ['locked', `Закрыты (${mi.locked.length})`], ['maxed', 'На максимуме'], ['all', 'Все']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <input className="search" placeholder="Найти: snow, clay, slime…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {list.length ? (
          <div className="minion-grid">
            {list.map(t => <MinionCard key={t.type} t={t} openItem={openItem} />)}
          </div>
        ) : <Empty>Под фильтр ничего не подходит.</Empty>}
        <div className="museum-legend tiny muted">
          <span><i className="st-donated" /> скрафчен</span><span><i className="st-missing owned" /> пропущен: даст уникальный крафт</span><span><i className="st-missing" /> ещё нет</span>
        </div>
      </Card>

      <Card className="span-12" title="Улучшения и топливо">
        <p className="small muted">Hypixel не показывает, что стоит в миньонах на острове: «есть» значит, что предмет лежит в инвентаре или хранилищах.</p>
        <h4 className="sub-h">Улучшения (2 слота в каждом миньоне)</h4>
        <div className="museum-tiles">{mi.upgrades.map(u => <Extra key={u.id} u={u} openItem={openItem} />)}</div>
        <h4 className="sub-h">Топливо</h4>
        <div className="museum-tiles">{mi.fuels.map(u => <Extra key={u.id} u={u} openItem={openItem} />)}</div>
      </Card>
      <div className="span-12 small muted">Как работают слоты, хранилища и что ставить в миньонов — в гайде <a className="link" href="#/guides/minions">«Миньоны»</a>. Какие коллекции откроют новых миньонов — на странице <a className="link" href="#/collections">«Коллекции»</a>.</div>
    </div>
  );
}

function MinionCard({ t, openItem }) {
  const set = new Set(t.tiers);
  const gaps = new Set(t.missing);
  return (
    <div className={`minion-card ${t.locked ? 'locked' : ''} ${t.top >= t.max && !t.missing.length ? 'maxed' : ''}`}>
      <button className="minion-head" onClick={() => openItem(t.icon)} title="Открыть карточку миньона">
        <ItemIcon id={t.icon} size={34} />
        <span className="minion-name"><b>{t.name}</b><span className="tiny muted">{t.top ? `${roman(t.top)} / ${roman(t.max)}` : 'не скрафчен'}{t.speed ? ` · ${secs(t.speed)}` : ''}</span></span>
      </button>
      <div className="minion-dots" aria-label={`Тиры: ${t.tiers.map(roman).join(', ') || 'нет'}`}>
        {Array.from({ length: t.max }, (_, i) => i + 1).map(n => <span key={n} className={set.has(n) ? 'on' : gaps.has(n) ? 'gap' : ''} title={`${roman(n)}: ${set.has(n) ? 'скрафчен' : gaps.has(n) ? 'пропущен — скрафти ради уникального крафта' : 'ещё нет'}`} />)}
      </div>
      <div className="tiny minion-next">
        {t.locked ? <span className="warn">🔒 {t.locked.kind === 'collection' ? `нужна коллекция ${t.locked.text}${t.locked.need ? ` (${num(t.locked.have)} / ${num(t.locked.need)})` : ''}` : t.locked.kind === 'slayer' && t.locked.tier ? `нужен ${t.locked.text} (сейчас ${t.locked.have})` : t.locked.text}</span>
          : t.next ? (t.next.noRecipe ? <span className="muted">{roman(t.next.tier)}: рецепта на верстаке нет</span> : <span>{roman(t.next.tier)}: {t.next.cost != null ? <b className="gold">~{coins(t.next.cost)}</b> : <span className="muted" title="Часть материалов сейчас нельзя купить на рынке">часть не продаётся</span>} <span className="muted">· {t.next.parts.map(p => `${p.n}× ${p.name}`).join(', ')}</span></span>)
          : <span className="gold">максимум</span>}
      </div>
    </div>
  );
}

function Extra({ u, openItem }) {
  return (
    <button className={`museum-tile ${u.owned ? 'good' : ''}`} onClick={() => openItem(u.id)} title={u.why}>
      <ItemIcon id={u.id} size={36} />
      <span className="museum-tile-text"><b>{u.name}</b><span className="tiny muted">{u.why}{u.owned ? ' · есть' : u.price ? ` · ~${coins(u.price)}` : ''}</span></span>
    </button>
  );
}
