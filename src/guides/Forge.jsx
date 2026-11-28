// Гайд «The Forge»: слоты (что куётся и когда готово), выгодные рецепты под ритм заходов, пошаговые цепочки деталей бура.
// Данные — extra.forge из core/src/guides/forge.js. У Ironman/Stranded/Bingo вместо выгодных рецептов — «Что ковать для себя».
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, saveLocal } from '../api.js';
import { LOCALE } from '../i18n.js';
import { useApp } from '../App.jsx';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { Rich } from './Rich.jsx';

const VISIT_LABEL = { 4: 'каждые 4 ч', 12: '2 раза в день', 24: 'раз в сутки' };
const hrs = h => `${(Math.round(h * 10) / 10).toLocaleString(LOCALE)} ч`;
const days = h => (h >= 36 ? `≈ ${(Math.round(h / 24 * 10) / 10).toLocaleString(LOCALE)} дн.` : `≈ ${hrs(h)}`);

function left(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
}
const clock = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

function useStoredNum(key, init) {
  const [v, setV] = useState(() => { try { const s = Number(localStorage.getItem(key)); return s || init; } catch { return init; } });
  return [v, x => { setV(x); saveLocal(key, String(x)); }];
}

// Время на клиенте идёт само: «осталось» пересчитывается раз в минуту без запроса к серверу
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}

function Item({ id, size = 28 }) {
  const { openItem } = useApp();
  return <ItemIcon id={id} size={size} onClick={() => openItem(id)} />;
}

function NowCard({ list }) {
  const now = useNow();
  const free = list.filter(s => s.empty).length;
  return (
    <Card title="Сейчас в Forge" news="forge-now" right={<span className="muted small">{free ? `свободно: ${free}` : 'все слоты заняты'}</span>} className="forge-now">
      <div className="forge-slots">
        {list.map(s => {
          if (s.empty) return (
            <div key={s.slot} className="forge-slot free">
              <div className="tiny muted">Слот {s.slot}</div>
              <div className="forge-slot-name muted">пусто</div>
              {s.suggest && <div className="tiny gold">положи <Rich text={s.suggestName} item={s.suggest} /></div>}
            </div>
          );
          const ms = s.end ? s.end - now : null;
          const ready = ms != null && ms <= 0;
          const p = s.end && s.start ? Math.min(1, Math.max(0, (now - s.start) / (s.end - s.start))) : null;
          return (
            <div key={s.slot} className={`forge-slot ${ready ? 'ready' : ''}`}>
              <div className="tiny muted">Слот {s.slot}</div>
              <div className="forge-slot-name"><Item id={s.id} size={22} /> <Rich text={s.name} item={s.id} /></div>
              {ready ? <div className="tiny green">✓ готово — забери</div>
                : ms != null ? <div className="tiny muted">ещё {left(ms)} · до {clock(s.end)}</div>
                  : <div className="tiny muted">куётся</div>}
              {!ready && p != null && <div className="forge-bar"><i style={{ width: `${p * 100}%` }} /></div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ProfitCard({ f }) {
  const [visit, setVisit] = useStoredNum('sb-forge-visit', 12);
  const plan = f.plans.find(p => p.visitH === visit) || f.plans[1] || f.plans[0];
  const row = id => f.rows?.[id];
  return (
    <Card title="Выгодно ковать" news="forge-profit" className="forge-profit"
      right={plan.perHour > 0 && <span className="gold forge-total">≈ {coins(plan.perHour)}/ч{f.guest ? '' : ` на ${f.slots} сл.`}</span>}>
      <div className="forge-visit">
        <span className="muted small">Захожу в Forge:</span>
        <div className="forge-seg" role="group" aria-label="Как часто заходишь в Forge">
          {f.visits.map(v => <button key={v} type="button" className={v === plan.visitH ? 'on' : ''} onClick={() => setVisit(v)}>{VISIT_LABEL[v]}</button>)}
        </div>
      </div>
      {!plan.top.length && <p className="muted small">Сейчас выгодных рецептов под твой HotM не нашлось.</p>}
      <div className="forge-rows">
        <div className="forge-row head"><span /><span>Рецепт</span><span className="num">HotM</span><span className="num">Время</span><span className="num">За ковку</span><span className="num">В час</span></div>
        {plan.top.map(t => {
          const r = row(t.id);
          if (!r) return null;
          return <ProfitRow key={t.id} r={r} perHour={t.perHour} slots={t.slots} slotH={t.slotH} />;
        })}
        {(f.goals || []).map(g => <ProfitRow key={g.id} r={g} perHour={g.perHour} locked />)}
      </div>
      <p className="tiny muted">
        Доход в час — на твой ритм: рецепт на 6 ч при заходе 2 раза в день держит слот 12 ч. Покупка материалов и продажа ордером на Bazaar,
        слотов на рецепт не больше, чем реально продать.
      </p>
      <a className="link-btn small" href="#/money/crafts" onClick={() => saveLocal('sb-money-crafts-kind', JSON.stringify('forge'))}>Все рецепты Forge в «Заработке» →</a>
    </Card>
  );
}

function ProfitRow({ r, perHour, slots, slotH, locked }) {
  const sl = slots > 0 ? (slots < 1 ? '<1 сл.' : `${Math.round(slots)} сл.`) : null;
  const parts = (r.parts || []).slice(0, 3).map(p => `${num(p.n)} ${p.name}`).join(', ');
  return (
    <div className={`forge-row ${locked ? 'locked' : ''}`}>
      <Item id={r.id} />
      <div className="forge-row-main">
        <div className="forge-row-name">
          <Rich text={r.name} item={r.id} />{r.count > 1 ? ` ×${r.count}` : ''}
          {sl && <span className="forge-pill" title="Сколько твоих слотов занять этим рецептом">{sl}</span>}
          {r.own && !locked && <span className="forge-pill own" title="Материалы на одну ковку уже есть у тебя">свои</span>}
          {locked && <span className="forge-pill lock">🔒 {(r.locked || []).join(', ') || `HotM ${r.hotm}`}</span>}
        </div>
        <div className="tiny muted forge-row-sub"><span className="forge-phone">{hrs(r.durationH)} · </span>{parts ? <Rich text={parts} /> : null}{slotH && slotH > r.durationH + 0.5 ? <span> · слот занят {hrs(slotH)}</span> : null}</div>
      </div>
      <span className="num forge-desk">{r.hotm || '—'}</span>
      <span className="num forge-desk">{hrs(r.durationH)}</span>
      <span className="num green">+{coins(r.profit)}</span>
      <span className="num gold">{coins(perHour)}</span>
    </div>
  );
}

function SelfCard({ list }) {
  return (
    <Card title="Что ковать для себя" news="forge-self" className="forge-profit forge-self">
      <p className="muted small">Рынка нет: куй то, что нужно для твоего бура. Материалы добываются или покупаются у NPC.</p>
      {!list?.length && <p className="muted small">Все детали бура уже собраны или ждут уровня HotM.</p>}
      <div className="forge-rows">
        {(list || []).map(s => (
          <div key={s.id} className="forge-row self">
            <Item id={s.id} />
            <div className="forge-row-main">
              <div className="forge-row-name"><Rich text={s.name} item={s.id} />{s.crafts > 1 ? ` ×${s.crafts}` : ''}</div>
              <div className="tiny muted">{hrs(s.durationH)} · для <Rich text={s.forName} item={s.forId} /></div>
            </div>
            <span className={`small forge-self-st ${s.enough ? 'green' : 'gold'}`}>
              {s.enough ? 'всё есть' : <>не хватает <Rich text={s.missing.map(x => `${num(x.n)} ${x.name}`).join(', ')} /></>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DrillCard({ f }) {
  const drills = f.drills || [];
  const [pick, setPick] = useState(() => { try { return localStorage.getItem('sb-forge-drill') || ''; } catch { return ''; } });
  const drill = drills.find(d => d.key === pick) || drills[0] || null;
  const parts = drill ? drill.upgrades : f.parts || [];
  const firstOf = list => (list.find(p => !p.locked && p.key !== 'drill') || list[0])?.key;
  const [sel, setSel] = useState(() => firstOf(parts));
  const [ticks, setTicks] = useState(() => { try { return JSON.parse(localStorage.getItem('sb-forge-ticks') || '{}'); } catch { return {}; } });
  const tick = k => { const next = { ...ticks, [k]: !ticks[k] }; setTicks(next); saveLocal('sb-forge-ticks', JSON.stringify(next)); };
  const choose = key => {
    setPick(key); saveLocal('sb-forge-drill', key);
    const d = drills.find(x => x.key === key);
    setSel(firstOf(d?.upgrades || []));
  };
  if (f.guest) return <Card title="Улучшить бур" news="forge-drill"><p className="muted small">Введи свой ник на «Обзоре» — здесь появятся твой бур, его детали и пошаговые цепочки рецептов.</p></Card>;
  const place = d => (d.where?.length ? d.where.join(', ') : '') + (d.count > 1 ? ` ×${d.count}` : '');
  return (
    <Card title="Улучшить бур" news="forge-drill" className="forge-drill">
      {drills.length > 1 ? (
        <label className="forge-pick small">
          <span className="muted">Какой бур улучшить</span>
          <select value={drill.key} onChange={e => choose(e.target.value)}>
            {drills.map(d => <option key={d.key} value={d.key}>{d.name}{place(d) ? ` — ${place(d)}` : ''}</option>)}
          </select>
        </label>
      ) : (
        <p className="muted small">{drill ? <>Твой бур: <Rich text={drill.name} item={drill.id} />{place(drill) ? ` · ${place(drill)}` : ''}</>
          : f.drill ? <>Твой бур: <Rich text={f.drill.name} item={f.drill.id} /></> : 'Бура пока нет: первый — Mithril Drill SX-R226.'}</p>
      )}
      {parts.map(p => (
        <div key={p.key}>
          <button type="button" className={`forge-part ${sel === p.key ? 'sel' : ''}`} onClick={() => setSel(sel === p.key ? null : p.key)} aria-expanded={sel === p.key}>
            <ItemIcon id={p.next} size={28} />
            <span className="forge-part-main">
              <span className="tiny muted">{p.label}</span>
              <span className="forge-part-name">{p.currentName || <span className="muted">нет</span>} <span className="muted">→</span> {p.nextName}</span>
            </span>
            <span className="tiny muted forge-part-side">{p.locked ? <span className="red">🔒 {p.locked}</span> : p.why || days(p.hours)} {sel === p.key ? '▴' : '▾'}</span>
          </button>
          {sel === p.key && <Chain p={p} f={f} ticks={ticks} tick={tick} />}
        </div>
      ))}
    </Card>
  );
}

function Chain({ p, f, ticks, tick }) {
  const leftH = p.hours;
  const buy = p.materials.filter(x => x.missing > 0 && x.id !== 'SKYBLOCK_COIN');
  const coinsNeed = p.materials.find(x => x.id === 'SKYBLOCK_COIN');
  const cheaper = p.cost != null && p.readyPrice ? (p.cost < p.readyPrice ? 'ковать выгоднее' : 'дешевле купить готовый') : null;
  return (
    <div className="forge-chain">
      <div className="small"><b>Пошагово: <Rich text={p.nextName} item={p.next} /></b></div>
      {p.steps.map(s => {
        const k = `${p.next}:${s.id}`;
        const done = s.done || ticks[k];
        return (
          <div key={s.id} className={`forge-step ${done ? 'done' : ''}`}>
            <button type="button" className={`forge-ck ${done ? 'ok' : ''}`} onClick={() => !s.done && tick(k)} disabled={s.done}
              aria-label={done ? 'Сделано' : 'Отметить сделанным'}>{done ? '✓' : ''}</button>
            <div>
              <div className="forge-row-name">{s.need > 1 ? `${num(s.need)}× ` : ''}<Rich text={s.name} item={s.id} /></div>
              <div className="tiny muted">{s.durationH > 0.05 ? `по ${hrs(s.durationH)}` : 'сразу'} · <Rich text={s.inputs.map(i => `${num(i.n)} ${i.name || nameOf(i.id, p)}`).join(', ')} /></div>
            </div>
            <span className={`tiny ${s.done ? 'green' : s.have ? 'gold' : 'muted'}`}>{s.id === p.next ? 'в конце' : s.done ? `есть ${num(s.have)}` : s.have ? `есть ${num(s.have)} из ${num(s.need)}` : 'нет'}</span>
          </div>
        );
      })}
      <div className="forge-sum">
        <div><span className="tiny muted">Осталось ковать</span><b>{days(leftH)}</b><span className="tiny muted">на {f.slots} сл.</span></div>
        <div><span className="tiny muted">Материалы</span>
          {f.noMarket ? <><b>{buy.length ? `${buy.length} вид.` : 'всё есть'}</b><span className="tiny muted">{buy.length ? 'добыть' : ''}</span></>
            : <><b className="gold">{p.cost == null ? '—' : coins(p.cost)}</b><span className="tiny muted">{p.cost == null ? 'нет цены' : 'докупить'}</span></>}
        </div>
        {!f.noMarket && <div><span className="tiny muted">Готовый</span><b>{p.readyPrice ? coins(p.readyPrice) : '—'}</b><span className={`tiny ${cheaper === 'ковать выгоднее' ? 'green' : 'muted'}`}>{cheaper || 'нет на рынке'}</span></div>}
      </div>
      {buy.length > 0 && <p className="tiny muted">{f.noMarket ? 'Добыть' : 'Докупить'}: <Rich text={buy.map(x => `${num(x.missing)} ${x.name}`).join(', ')} />{coinsNeed?.need ? ` и ${coins(coinsNeed.need)} монет` : ''}.</p>}
    </div>
  );
}

// Имя ингредиента шага: берём из материалов или шагов той же цепочки (сервер уже прислал имена)
function nameOf(id, p) {
  return p.materials.find(x => x.id === id)?.name || p.steps.find(x => x.id === id)?.name || id;
}

export default function Forge({ guide }) {
  const f = guide.extra?.forge || {};
  const sections = useMemo(() => (guide.sections || []), [guide.sections]);
  return (
    <>
      <GuideHero guide={guide} />
      <NextSteps guide={guide} />
      {f.now && <NowCard list={f.now} />}
      <div className="forge-wrap"><div className="forge-grid">
        {f.noMarket ? <SelfCard list={f.self} /> : f.plans ? <ProfitCard f={f} /> : <Card title="Выгодно ковать"><p className="muted small">Цены Bazaar ещё загружаются.</p></Card>}
        <DrillCard f={f} />
      </div></div>
      {sections.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
