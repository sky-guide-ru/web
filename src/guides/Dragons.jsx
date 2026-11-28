// Гайд «Драконы и Zealots»: путь к дракону по шагам, карточки драконов, калькулятор вклада (Dragon Weight) и бои игрока.
// Данные — extra.dragons из core/src/guides/dragons.js (все расчёты там). Таблицы, которые показаны карточками, здесь не повторяются.
import { useMemo, useState } from 'react';
import { Card } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, saveLocal } from '../api.js';
import { LOCALE } from '../i18n.js';
import { useApp } from '../App.jsx';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { Rich } from './Rich.jsx';

const pct = x => `${(Math.round(x * 1000) / 10).toLocaleString(LOCALE)}%`;
const pctFine = x => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: x < 0.01 ? 2 : 1 })}%`;
const mln = hp => `${(hp / 1e6).toLocaleString(LOCALE)} млн`;

function Item({ id, size = 28 }) {
  const { openItem } = useApp();
  return <ItemIcon id={id} size={size} onClick={() => openItem(id)} />;
}

function useStored(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s == null ? init : Number(s); } catch { return init; } });
  return [v, x => { setV(x); saveLocal(key, String(x)); }];
}

// Путь: Zealot → Special Zealot → 8 Summoning Eye → дракон
function PathCard({ d }) {
  const steps = [
    { icon: 'ENDER_PEARL', title: 'Zealot', text: 'Эндермены в Dragon\'s Nest. Бей их пачками.' },
    { icon: 'END_PORTAL_FRAME', title: 'Special Zealot', text: 'Примерно 1 из 420 Zealot. С него всегда падает глаз.' },
    { icon: 'SUMMONING_EYE', title: '8 Summoning Eye', text: 'В рамки Ender Altar в центре гнезда. До призыва глаз можно забрать.' },
    { icon: 'DRAGON_EGG', title: 'Дракон', text: 'Один из 7 видов. Лут зависит от твоего вклада.' },
  ];
  return (
    <Card title="Как дойти до дракона" className="drg-path">
      <ol className="drg-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="drg-step-ico"><Item id={s.icon} size={30} /></span>
            <b><Rich text={s.title} /></b>
            <span className="tiny muted"><Rich text={s.text} /></span>
          </li>
        ))}
      </ol>
      {d.zealots?.kills > 0 && (
        <p className="small muted drg-path-me">
          <Rich text={`У тебя ${num(d.zealots.kills)} Zealot${d.zealots.specials ? ` и ${num(d.zealots.specials)} Special Zealot — в среднем 1 на ${num(Math.round(d.zealots.kills / Math.max(1, d.zealots.specials)))}` : ''}.`} />
        </p>
      )}
    </Card>
  );
}

function StatsRow({ s, eyes }) {
  const tiles = [
    ['Убито драконов', num(s?.total || 0)],
    ['Из них Superior', num(s?.superior || 0)],
    ['Лучший урон', s?.bestDmg ? num(s.bestDmg) : '—'],
    ['Глаз положено', num(s?.placed || 0)],
    ['Глаз сейчас', num(eyes || 0)],
  ];
  return <div className="drg-tiles">{tiles.map(([k, v]) => <div key={k}><span className="tiny muted">{k}</span><b>{v}</b></div>)}</div>;
}

function VariantsCard({ d }) {
  const [open, setOpen] = useState(null);
  return (
    <Card title="Семь драконов" className="drg-variants" right={<span className="tiny muted">шанс появления</span>}>
      {d.stats && <StatsRow s={d.stats} eyes={d.eyes} />}
      <div className="drg-cards">
        {d.variants.map(v => (
          <button type="button" key={v.key} className={`drg-card drg-${v.key} ${open === v.key ? 'open' : ''}`} onClick={() => setOpen(open === v.key ? null : v.key)}>
            <div className="drg-card-top">
              <ItemIcon id={v.icon} size={34} />
              <div className="drg-card-name"><b>{v.name}</b><span className="tiny muted">{mln(v.hp)} HP</span></div>
              <span className={`drg-chance ${v.key === 'superior' ? 'rare' : ''}`}>{pct(v.chance)}</span>
            </div>
            <div className="small drg-card-note"><Rich text={v.note} /></div>
            <div className="tiny drg-card-bonus"><span className="muted">Сет брони: </span><Rich text={v.bonus} /></div>
            {(open === v.key) && (
              <div className="drg-card-more tiny">
                <div><span className="muted">Фрагмент:</span> <Rich text={v.fragName} item={v.frag} />{!d.noMarket && v.fragPrice > 0 && <> · {coins(v.fragPrice)}</>}</div>
                {!d.noMarket && v.setPrice > 0 && <div><span className="muted">Сет на аукционе:</span> {coins(v.setPrice)}</div>}
                {v.only && <div><span className="muted">Только с него:</span> <Rich text={v.onlyName} item={v.only} /></div>}
                {v.fastest > 0 && <div><span className="muted">Быстрее всего:</span> {Math.round(v.fastest / 1000)} с</div>}
              </div>
            )}
            <div className="drg-card-foot tiny">
              {v.kills ? <span className="green">убито {num(v.kills)}</span> : <span className="muted">ещё не убит</span>}
              {v.bestDmg > 0 && <span className="muted">лучший урон {num(v.bestDmg)}</span>}
              {!open && (v.only || v.fragPrice > 0) && <span className="muted drg-more">подробнее ▾</span>}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function WeightCard({ d }) {
  const [eyes, setEyes] = useStored('sb-drg-eyes', 4);
  const [place, setPlace] = useStored('sb-drg-place', 8);
  const cell = d.grid?.[eyes]?.[place];
  const open = useMemo(() => new Set(cell?.open || []), [cell]);
  if (!cell) return null;
  const max = 1200;
  const marks = [...new Set(d.major.map(m => m.req))];
  return (
    <Card title="Калькулятор вклада" news="profit" className="drg-calc">
      <p className="small muted"><Rich text="Вклад (Dragon Weight) решает, что может выпасть. Его дают свои Summoning Eye и место по урону. Выбери свой расклад:" /></p>
      <div className="drg-calc-ctrl">
        <div>
          <span className="tiny muted">Своих глаз</span>
          <div className="drg-eyes">
            {Array.from({ length: 9 }, (_, i) => (
              <button type="button" key={i} className={i === eyes ? 'on' : ''} onClick={() => setEyes(i)} aria-pressed={i === eyes}>{i}</button>
            ))}
          </div>
        </div>
        <label>
          <span className="tiny muted">Место по урону</span>
          <select value={place} onChange={e => setPlace(Number(e.target.value))}>
            {d.places.map((p, i) => <option key={i} value={i}>{p.label} (+{p.w})</option>)}
          </select>
        </label>
      </div>
      {d.luck && (
        <p className="tiny muted drg-luck"><Rich text={`Твой шанс за дракона — с твоим Magic Find ${num(d.luck.mf)}${d.luck.bestiary?.mf ? ` (из них +${d.luck.bestiary.mf} за Bestiary)` : ''}${d.luck.pl ? ` и Pet Luck ${num(d.luck.pl)}` : ''}, порядком проверки дропа и шансами каждого дракона.`} /></p>
      )}
      <div className="drg-meter" aria-label={`Вклад ${cell.weight}`}>
        <i style={{ width: `${Math.min(100, cell.weight / max * 100)}%` }} />
        {marks.filter(r => r <= max).map(r => <s key={r} style={{ left: `${r / max * 100}%` }} className={cell.weight >= r ? 'ok' : ''} />)}
        <b>≈ {num(cell.weight)}</b>
      </div>
      <div className="drg-loot">
        {d.major.map((m, i) => (
          <div key={i} className={`drg-loot-row ${open.has(i) ? 'open' : 'closed'}`}>
            <ItemIcon id={m.id} size={24} />
            <span className="drg-loot-name"><Rich text={m.label} item={m.id} /></span>
            <span className="tiny muted drg-loot-p">{open.has(i)
              ? <>{cell.chance?.[i] > 0 && <b className="drg-p">{pctFine(cell.chance[i])}</b>} <span className="drg-p-base"><Rich text={m.text} /></span></>
              : cell.weight < m.req ? `нужно ${num(m.req)}` : 'нужны свои глаза'}</span>
          </div>
        ))}
      </div>
      {d.noMarket
        ? <p className="small muted"><Rich text="В этом режиме профиля рынка нет: глаза только из Special Zealot, броня и фрагменты — для себя." /></p>
        : (
          <div className="drg-sum">
            <div><span className="tiny muted">Средний дроп</span><b>{coins(cell.loot)}</b></div>
            <div><span className="tiny muted">Свои глаза</span><b>{cell.cost ? coins(cell.cost) : '0'}</b></div>
            <div className={cell.net >= 0 ? 'good' : 'bad'}><span className="tiny muted">Итог за дракона</span><b>{cell.net >= 0 ? '+' : '−'}{coins(Math.abs(cell.net))}</b></div>
          </div>
        )}
      {!d.noMarket && <p className="tiny muted"><Rich text={`Среднее за много боёв по нынешним ценам, с твоим Magic Find. Summoning Eye сейчас ${coins(d.eyePrice)}. Обычно в минус: плюс дают редкие Ender Dragon и Aspect of the Dragons.`} /></p>}
    </Card>
  );
}

export default function Dragons({ guide }) {
  const d = guide.extra?.dragons;
  const rest = useMemo(() => (guide.sections || []).filter(s => !(d && s.card)), [guide.sections, d]);
  return (
    <>
      <GuideHero guide={guide} />
      <NextSteps guide={guide} />
      {d && (
        <>
          <PathCard d={d} />
          <div className="drg-wrap"><div className="drg-grid">
            <VariantsCard d={d} />
            <WeightCard d={d} />
          </div></div>
        </>
      )}
      {rest.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
