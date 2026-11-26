import { useEffect, useMemo, useState } from 'react';
import { Card, Stat, Tabs, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, RARITY_COLOR, RARITY_RU, friendlyError, useHashTab, usePart } from '../api.js';
import { useApp } from '../App.jsx';
import { MaxwellCard } from './Wealth.jsx';
import { Rich } from '../guides/Rich.jsx';

export default function Accessories({ state, sub }) {
  const { openItem } = useApp();
  const acc = usePart(state, 'acc', state.analysis?.acc); // полный список — отдельным куском при открытии раздела
  const m = state.member;
  // #/accessories/norecomb — плитка «Без рекомба» открывает «Мои аксессуары» с этим фильтром
  const [tab, setTab] = useHashTab('accessories', sub === 'norecomb' ? 'owned' : sub, ['buy', 'missing', 'owned'], 'buy');
  const [budget, setBudget] = useState(50);
  const [mq, setMq] = useState('');
  const [gap, setGap] = useState(sub === 'norecomb' ? 'recomb' : 'all');
  useEffect(() => { if (sub === 'norecomb') setGap('recomb'); }, [sub]);
  // Одна строка на семейство (8 расцветок Abicase засчитываются как один аксессуар) — берём самый выгодный по MP
  const missing = useMemo(() => {
    const best = new Map();
    for (const r of acc?.missing || []) {
      const key = r.fk || (r.family?.length ? [...r.family].sort()[0] : r.id); // fk — ключ семейства с сервера (старый кэш — family)
      const cur = best.get(key);
      if (!cur || r.gain > cur.gain || (r.gain === cur.gain && (r.price || Infinity) < (cur.price || Infinity))) best.set(key, r);
    }
    return [...best.values()].sort((a, b) => b.gain - a.gain || (a.price || Infinity) - (b.price || Infinity));
  }, [acc]);
  if (!acc) return <div className="muted small"><div className="spinner" />Загружаю аксессуары…</div>;
  const mqs = mq.trim().toLowerCase();
  const missingShown = mqs ? missing.filter(r => r.name.toLowerCase().includes(mqs) || (RARITY_RU[r.rarity] || '').toLowerCase().includes(mqs)) : missing;
  // Фильтры «Мои аксессуары»: что ещё не доделано на своих аксессуарах
  const list = acc.list || [];
  const GAPS = [
    { id: 'all', label: 'Все', test: () => true },
    { id: 'tier', label: 'Не макс. tier', test: a => a.next },
    { id: 'recomb', label: 'Без Recombobulator', test: a => a.canRecomb },
    { id: 'enrich', label: 'Без enrichment', test: a => a.canEnrich && !a.enrichment },
    { id: 'off', label: 'Не считаются', test: a => !a.active },
  ].map(g => ({ ...g, n: list.filter(g.test).length }));
  const gapCur = GAPS.find(g => g.id === gap) || GAPS[0];
  const ownedShown = list.filter(gapCur.test);
  const GAP_HINT = {
    tier: 'Есть старшая версия: апгрейд даёт больше MP.',
    recomb: acc.recombPrice > 0
      ? `Recombobulator 3000 поднимает редкость на одну ступень и даёт больше MP (~${coins(acc.recombPrice)} за штуку).`
      : 'Recombobulator 3000 поднимает редкость на одну ступень и даёт больше MP.',
    enrich: 'Enrichment ставится на Legendary и выше: +1 очко Stats Tuning у Maxwell.',
    off: 'Эти аксессуары перекрыты старшей версией в сумке и MP не дают: их можно продать.',
  };
  // Жадный план покупок под бюджет (млн)
  let left = budget * 1e6, gain = 0;
  const plan = [];
  for (const r of acc.cheapestNext) { if (r.price <= left) { plan.push(r); left -= r.price; gain += r.gain; } }
  return (
    <div className="grid">
      <div className="span-12 stats-row">
        <Stat label="Magical Power" value={num(m.magicalPower)} sub="по данным игры" accent="#c879ff" icon={<img src="/api/texture/ender_eye" alt="" />} />
        <Stat label="Аксессуаров в сумке" value={acc.count} accent="#60a5fa" icon={<img src="/api/texture/leather" alt="" />} />
        <Stat label="Без рекомба" href="#/accessories/norecomb" title="Показать аксессуары без Recombobulator" value={acc.notRecombCount} sub={`рекомб ~${coins(acc.recombPrice)}`} accent="#f59e0b" icon={<img src="/api/texture/nether_star" alt="" />} />
        <Stat label="Недостающих" value={missing.length} sub="без повторов семейств" accent="#4ade80" icon={<img src="/api/texture/emerald" alt="" />} />
      </div>
      <Card className="span-12" news="acc-planner" title="Планировщик Magical Power" right={<Tabs tabs={[{ id: 'buy', label: 'Что купить' }, { id: 'missing', label: `Чего нет (${missing.length})` }, { id: 'owned', label: 'Мои аксессуары' }]} value={tab} onChange={setTab} />}>
        {tab === 'buy' ? (
          <>
            <div className="budget">
              <span>Бюджет:</span>
              <input type="range" min="1" max="2000" step="1" value={budget} onChange={e => setBudget(+e.target.value)} />
              <b>{coins(budget * 1e6)}</b>
              {/* Без цен аукциона «+0 MP за 0» только путает: сумму показываем, когда есть что купить */}
              {acc.cheapestNext.length > 0 && <span className="muted">→ +{gain} MP за {coins(budget * 1e6 - left)} ({plan.length} шт.)</span>}
            </div>
            {acc.cheapestNext.length ? (
              <table className="table">
                <thead><tr><th></th><th>Аксессуар</th><th>Редкость</th><th>+MP</th><th>Цена</th><th>За 1 MP</th></tr></thead>
                <tbody>
                  {acc.cheapestNext.map(r => (
                    <tr key={r.id} className={`clickable-row ${plan.includes(r) ? 'in-plan' : ''}`} onClick={() => openItem(r.id)}>
                      <td><ItemIcon id={r.id} size={34} /></td>
                      <td><span style={{ color: RARITY_COLOR[r.rarity] }}>{r.name}</span>{r.upgradeFrom && <div className="muted tiny">апгрейд из {r.upgradeFrom}</div>}</td>
                      <td>{RARITY_RU[r.rarity]}</td>
                      <td className="gold">+{r.gain}</td>
                      <td>{coins(r.price)}</td>
                      <td>{coins(r.perMp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>{state.pricesAt?.auctionsError && !state.pricesAt?.auctions
              ? `Не удалось загрузить аукцион: ${friendlyError(state.pricesAt.auctionsError)}. Сервер попробует снова через 3 минуты.`
              : 'Цены аукциона ещё загружаются (полный скан занимает 1–2 минуты).'} Список недостающих без цен — на вкладке «Чего нет».</Empty>}
          </>
        ) : tab === 'missing' ? (
          <>
            <input className="search" placeholder="Найти среди недостающих: ring, artifact, легендарный…" value={mq} onChange={e => setMq(e.target.value)} />
            {missingShown.length ? (
              <table className="table">
                <thead><tr><th></th><th>Аксессуар</th><th>Редкость</th><th>+MP</th><th>Цена</th></tr></thead>
                <tbody>
                  {missingShown.map(r => (
                    <tr key={r.id} className="clickable-row" onClick={() => openItem(r.id)}>
                      <td><ItemIcon id={r.id} size={30} /></td>
                      <td><span style={{ color: RARITY_COLOR[r.rarity] }}>{r.name}</span>{r.upgradeFrom && <div className="muted tiny">апгрейд из {r.upgradeFrom}</div>}</td>
                      <td>{RARITY_RU[r.rarity]}</td>
                      <td className="gold">+{r.gain}</td>
                      <td title={r.price > 0 ? '' : 'Цена неизвестна: нет на аукционе или скан ещё не готов'}>{r.price > 0 ? coins(r.price) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>{mqs ? 'Под поиск ничего не подошло.' : 'Все аксессуары собраны!'}</Empty>}
          </>
        ) : (
          <>
            <div className="acc-gaps" data-news="acc-gaps">
              {GAPS.map(g => (
                <button key={g.id} className={`chip ${gap === g.id ? 'active' : ''}`} onClick={() => setGap(g.id)} disabled={!g.n && g.id !== 'all'}>
                  {g.label} <span className="muted">{g.n}</span>
                </button>
              ))}
            </div>
            {GAP_HINT[gap] && <div className="muted small acc-gap-hint"><Rich text={GAP_HINT[gap]} /></div>}
            {ownedShown.length ? (
              <div className="acc-grid">
                {ownedShown.map(a => (
                  <div key={a.id} className={`acc ${a.active ? '' : 'inactive'}`} onClick={() => openItem(a.id)}>
                    <ItemIcon id={a.id} size={40} />
                    <div className="grow">
                      <div style={{ color: RARITY_COLOR[a.rarity] }}>{a.name}</div>
                      <div className="muted tiny">
                        {a.active ? `${a.mp} MP` : 'не считается (есть старшая версия)'}
                        {a.recomb ? ' · рекомб' : a.canRecomb ? ' · без рекомба' : ''}
                        {a.enrichment ? ` · enrichment: ${a.enrichment}` : a.canEnrich ? ' · без enrichment' : ''}
                      </div>
                      {a.next && <div className="tiny">→ <span style={{ color: RARITY_COLOR[a.next.rarity] }}>{a.next.name}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty>{gap === 'all' ? 'В сумке нет аксессуаров.' : 'Здесь всё сделано.'}</Empty>}
          </>
        )}
      </Card>
      <Card className="span-12" title="Maxwell: сила и Stats Tuning">
        <MaxwellCard />
      </Card>
    </div>
  );
}
