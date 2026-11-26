import { DEC } from '../i18n.js';
import { Card, Progress, Stat, Badge } from '../components/ui.jsx';
import { num, plural, usePart } from '../api.js';
import { useHiddenSteps } from '../hiddenSteps.js';
import { SKILL_ICON } from './Overview.jsx';
import ProgressExtras from './ProgressExtras.jsx';
import TrophyTiers from '../components/TrophyTiers.jsx';
import HistoryCharts from '../components/HistoryCharts.jsx';
import { useEffect } from 'react';
import { Rich } from '../guides/Rich.jsx';

const fx2 = v => v.toFixed(2).replace('.', DEC);

const SLAYER_ICON = { zombie: 'rotten_flesh', spider: 'cobweb', wolf: 'mutton', enderman: 'ender_pearl', blaze: 'blaze_rod', vampire: 'redstone' };
const FLOOR_BOSS = ['Вход', 'Bonzo', 'Scarf', 'The Professor', 'Thorn', 'Livid', 'Sadan', 'Necron'];

// Ссылка «в плане: N →» на шаги нужной категории: увидел слабое место — сразу видно, что с ним делать
function PlanLink({ steps, cat, hidden }) {
  const n = steps.filter(s => s.cat === cat && !hidden[s.id]).length;
  if (!n) return null;
  return <a className="link small" href={`#/roadmap/cat:${encodeURIComponent(cat)}`}>шагов в плане: {n} →</a>;
}

export default function Skills({ state, sub }) {
  const steps = state.analysis?.roadmap || [];
  const { hidden } = useHiddenSteps(state); // скрытые шаги плана не считаем
  const m = state.member;
  // Нижние блоки (Chocolate Factory, атрибуты, гонки…) — отдельным куском, когда открыт «Прогресс»
  const ex = usePart(state, 'extras', m?.extras ? { extras: m.extras, chocolate: state.analysis?.chocolate } : null);
  // #/skills/history — ссылка «все графики» с «Обзора»: сразу к истории
  useEffect(() => {
    if (sub !== 'history') return;
    const t = setTimeout(() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [sub]);
  if (!m) return null;
  const d = m.dungeons;
  return (
    <div className="grid">
      <Card title="Skills" className="span-7" news="skills" right={<PlanLink steps={steps} hidden={hidden} cat="Skills" />}>
        <div className="skill-grid">
          {Object.entries(m.skills).map(([k, s]) => (
            <div key={k} className={`skill-card ${s.level >= s.maxLevel ? 'maxed' : ''}`}>
              <img src={`/api/texture/${SKILL_ICON[k]}`} alt="" />
              <div className="grow">
                <div className="skill-head"><b>{s.name}</b>{s.level >= s.maxLevel ? (s.capMax ? <span className="cap-badge" title={`Кап поднимается ${s.capHow}`}>КАП {s.level} → {s.capMax}</span> : <span className="max-badge">МАКС {s.level}</span>) : <span>{s.level}<span className="muted">/{s.maxLevel}{s.capMax ? ` (можно ${s.capMax})` : ''}</span></span>}</div>
                {s.capMax && <div className="tiny cap-how">Кап {s.maxLevel} → {s.capMax}: {s.capHow}</div>}
                <Progress value={s.progress} max={s.level >= s.maxLevel} />
                <div className="muted tiny">{s.level >= s.maxLevel ? `всего ${num(s.xp)} опыта` : `${num(s.xpCurrent)} / ${num(s.xpForNext)}`}</div>
                {s.overflow && <div className="tiny overflow-lvl" title={`До overflow ${Math.floor(s.overflow.level) + 1}: ${num(s.overflow.xpCurrent)} / ${num(s.overflow.xpForNext)}`}>Overflow {fx2(s.overflow.level)}</div>}
              </div>
            </div>
          ))}
        </div>
        {m.skillAverageOverflow != null && Object.values(m.skills).some(s => s.overflow) && (
          <div className="muted small overflow-note" style={{ marginTop: 10 }}>
            <b>Overflow Average {fx2(m.skillAverageOverflow)}</b> · <Rich text="Overflow — уровень по всему опыту, без игрового максимума. Бонусов сверх максимума он не даёт: это мера, сколько опыта набито сверху. Overflow Average — по 10 скиллам вместе с Hunting, без Social и Runecrafting, как у Discord-ботов (!osk)." />
          </div>
        )}
        <div className="muted small" style={{ marginTop: 10 }}>Кап Farming: {m.farmingCap}/60 (медали Jacob у Anita) · Кап Taming: {m.tamingCap}/60 (сдано типов питомцев: {m.tamingSacrificed})</div>
      </Card>

      <Card title="Slayers" className="span-5" right={<PlanLink steps={steps} hidden={hidden} cat="Slayers" />}>
        {Object.entries(m.slayers).map(([k, s]) => (
          <div key={k} className="slayer-row">
            <img src={`/api/texture/${SLAYER_ICON[k]}`} alt="" />
            <div className="grow">
              <div className="skill-head"><b>{s.name}</b><span>{s.ru} · ур. {s.level}<span className="muted">/{s.maxLevel}</span></span></div>
              <Progress value={s.progress} max={s.level >= s.maxLevel} color="linear-gradient(90deg,#ef4444,#f97316)" />
              <div className="muted tiny">{num(s.xp)} опыта{s.xpForNext ? ` · до след. ${num(s.xpForNext - s.xp)}` : ''} · {Object.entries(s.kills).filter(([, v]) => v).map(([t, v]) => `T${t}: ${v}`).join(' · ') || 'не начат'}</div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Dungeons — Catacombs" className="span-7" right={<PlanLink steps={steps} hidden={hidden} cat="Dungeons" />}>
        <div className="stats-row">
          <Stat label="Catacombs" value={d.catacombs.level} sub={`${Math.round(d.catacombs.progress * 100)}% до следующего`} accent="#ff5e5e" icon={<img src="/api/texture/bone" alt="" />} />
          <Stat label="Class Average" value={d.classAverage.toFixed(1).replace('.', DEC)} sub={`выбран: ${d.classes[d.selectedClass]?.name || '—'}`} accent="#f59e0b" icon={<img src="/api/texture/bow" alt="" />} />
          <Stat label="Secrets" value={num(d.secrets)} accent="#a78bfa" icon={<img src="/api/texture/map" alt="" />} />
        </div>
        <div className="classes">
          {Object.entries(d.classes).map(([k, c]) => (
            <div key={k} className={`class-pill ${k === d.selectedClass ? 'sel' : ''}`}>
              <b>{c.name}</b><span>{c.level}</span><Progress value={c.progress} />
            </div>
          ))}
        </div>
        <div className="floors">
          {FLOOR_BOSS.map((b, i) => (
            <div key={i} className="floor">
              <div className="floor-n">{i === 0 ? 'E' : `F${i}`}</div>
              <div className="tiny muted">{b}</div>
              <div><b>{d.floors[i] || 0}</b> <span className="tiny muted">{plural(d.floors[i] || 0, 'раз', 'раза', 'раз')}</span></div>
              {i > 0 && <div className={`floor-m ${d.masterFloors[i] ? 'on' : ''}`}>M{i}: {d.masterFloors[i] || 0}</div>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Mining и Crimson Isle" className="span-5" right={<PlanLink steps={steps} hidden={hidden} cat="Mining" />}>
        <div className="kv">
          <span>Heart of the Mountain</span><b>{m.mining.hotm.level}/10</b>
          <span>Mithril Powder</span><b>{num(m.mining.powder.mithril)}</b>
          <span>Gemstone Powder</span><b>{num(m.mining.powder.gemstone)}</b>
          <span>Glacite Powder</span><b>{num(m.mining.powder.glacite)}</b>
          <span>Crystal Nucleus</span><b>{num(m.mining.nucleusRuns)} {plural(m.mining.nucleusRuns || 0, 'раз', 'раза', 'раз')}</b>
          <span>Faction</span><b>{m.crimson.faction === 'barbarians' ? 'Barbarians' : m.crimson.faction === 'mages' ? 'Mages' : '—'} ({num(Math.max(m.crimson.barbarianRep, m.crimson.mageRep))} реп.)</b>
          <span>Kuudra</span><b className="kuudra-tiers">{['basic', 'hot', 'burning', 'fiery', 'infernal'].map(t => <span key={t} className={`kt kt-${t} ${m.crimson.kuudra[t] ? '' : 'zero'}`} title={`Kuudra ${t[0].toUpperCase() + t.slice(1)}: ${m.crimson.kuudra[t]} ${plural(m.crimson.kuudra[t] || 0, 'заход', 'захода', 'заходов')}`}>{t[0].toUpperCase() + t.slice(1)} <i>{m.crimson.kuudra[t]}</i></span>)}</b>
          <span>Dojo</span><b>{(() => { const pts = Object.entries(m.crimson.dojo || {}).filter(([k]) => k.startsWith('dojo_points_')).map(([, v]) => v || 0); return pts.length ? <>{num(pts.reduce((a, b) => a + b, 0))} очк. · S {pts.filter(v => v >= 1000).length}/7 <a href="#/guides/crimson" className="link small">гайд →</a></> : <a href="#/guides/crimson" className="link small">не пройдено · гайд →</a>; })()}</b>
          <span>Garden: Copper</span><b>{num(m.garden.copper)}</b>
          <span>Rift: Enigma Souls</span><b>{m.rift.enigmaSouls}/52</b>
          <span>Fairy Souls</span><b>{m.fairySouls.collected}{m.fairySouls.total ? ` / ${m.fairySouls.total}` : ''} {m.fairySouls.unspent ? <Badge color="#f59e0b">{m.fairySouls.unspent} не сдано</Badge> : null}</b>
        </div>
        {m.fishing?.trophyTiers && (
          <div className="trophy-wide">
            <div className="progress-labels"><span>Trophy Fish по тирам</span><a href="#/guides/trophy" className="link small">план до алмаза →</a></div>
            <TrophyTiers counts={m.fishing.trophyTiers} compact />
          </div>
        )}
      </Card>
      <HistoryCharts state={state} id="history" />
      {ex?.extras ? <ProgressExtras m={{ ...m, extras: ex.extras }} advice={ex.chocolate} /> : m.hasExtras ? <div className="span-12 muted small"><div className="spinner" />Загружаю остальной прогресс…</div> : null}
    </div>
  );
}
