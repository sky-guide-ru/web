// Гайд Bestiary: своя страница с карточками и полосками вместо таблиц (данные — extra.bestiary из core/src/guides/bestiary.js).
// Секции с bx: true — те же данные таблицами для общего рендера; здесь их не показываем.
import { Card } from '../components/ui.jsx';
import { num } from '../api.js';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { Rich } from './Rich.jsx';

const pl = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};
const kills = n => `${num(n)} ${pl(n, 'убийство', 'убийства', 'убийств')}`;

/** Полоска из делений: заполнено done из total (до 25 делений, иначе сплошная). */
function Segs({ done, total, tone = '' }) {
  if (total > 25) return <div className={`bx-bar ${tone}`}><i style={{ width: `${Math.min(100, (done / total) * 100)}%` }} /></div>;
  return (
    <div className={`bx-segs ${tone}`} role="img" aria-label={`${done} из ${total}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}
    </div>
  );
}

function Hero({ guide, b }) {
  return (
    <GuideHero guide={{ ...guide, level: null }}>
      <div className="bx-hero">
        <div className="bx-ms">
          <div className="bx-ms-num">{b.milestone}<span>/ {b.maxMilestone}</span></div>
          <div className="tiny muted">Bestiary Milestone</div>
        </div>
        <div className="bx-ms-next">
          <div className="small"><b>До вехи {b.nextMs}</b> <span className="muted">— ещё {b.toNext} {pl(b.toNext, 'уровень', 'уровня', 'уровней')}</span></div>
          <Segs done={b.inMs} total={b.perMs} tone="gold" />
          <div className="tiny muted">Уровень любого моба — одно деление{b.nextXp ? ` · веха ${b.nextXpAt} даст ${num(b.nextXp)} Combat XP` : ''}</div>
        </div>
      </div>
      <div className="bx-tiles">
        <div className="bx-tile"><b className="red">+{b.claimed}</b><span>Health от вех</span></div>
        {b.unclaimed > 0
          ? <div className="bx-tile warn"><b className="gold">{b.unclaimed}</b><span>{pl(b.unclaimed, 'награда ждёт', 'награды ждут', 'наград ждут')} в меню Milestones</span></div>
          : <div className="bx-tile"><b className="green">✓</b><span>все награды забраны</span></div>}
        <div className="bx-tile"><b>{b.found}<small>/{b.families}</small></b><span>мобов найдено</span></div>
        <div className="bx-tile"><b>{b.maxed}</b><span>на максимуме</span></div>
      </div>
    </GuideHero>
  );
}

function PlanCard({ b }) {
  if (!b.plan.length) return null;
  return (
    <Card title={`Быстрее всего до вехи ${b.nextMs}`} news="plan" className="bx-card">
      <div className="bx-plan">
        {b.plan.map((r, i) => (
          <div key={r.name + i} className="bx-plan-item">
            <div className="bx-step">{i + 1}</div>
            <div className="bx-plan-main">
              <div className="bx-name"><Rich text={r.name} /></div>
              <div className="tiny muted"><Rich text={r.where} /></div>
            </div>
            <div className="bx-plan-right">
              <span className="bx-pill">убить {num(r.need)}</span>
              <span className="tiny green">+{r.gain} {pl(r.gain, 'уровень', 'уровня', 'уровней')}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="tiny muted bx-foot">Порядок — по числу убийств, силе моба и дороге. Мобы событий — ниже.</p>
    </Card>
  );
}

function MobRow({ f, right }) {
  return (
    <div className="bx-mob">
      <div className="bx-mob-top">
        <span className="bx-name"><Rich text={f.name} /></span>
        <span className={`bx-lvl ${f.tier >= f.max ? 'green' : ''}`}>{f.tier}<small>/{f.max}</small></span>
      </div>
      <Segs done={f.tier} total={f.max} tone={f.tier >= f.max ? 'green' : ''} />
      <div className="tiny muted bx-mob-sub">{right}</div>
    </div>
  );
}

function MainCard({ b }) {
  if (!b.main.length) return null;
  return (
    <Card title="Твои мобы" news="main" className="bx-card" right={<span className="tiny muted">бонус — против этого моба</span>}>
      <div className="bx-mobs">
        {b.main.map(f => (
          <MobRow key={f.name} f={f} right={<>
            <Rich text={f.bonus} />{f.left > 0 && <> · ещё {kills(f.left)}</>}
          </>} />
        ))}
      </div>
    </Card>
  );
}

function Chips({ title, list, text, news, note }) {
  if (!list.length) return null;
  return (
    <Card title={title} news={news} className="bx-card">
      {note && <p className="tiny muted bx-note">{note}</p>}
      <div className="bx-chips">
        {list.slice(0, 6).map(f => (
          <div key={f.name} className="bx-chip">
            <span className="bx-name"><Rich text={f.name} /></span>
            <span className="tiny muted"><Rich text={f.where} /></span>
            <span className="bx-chip-n">{text(f)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Islands({ b }) {
  return (
    <Card title="По островам" news="islands" className="bx-card">
      <div className="bx-isles">
        {b.islands.map(r => (
          <div key={r.where} className={`bx-isle ${r.tiers === 0 ? 'none' : ''}`}>
            <div className="bx-isle-top"><span><Rich text={r.where} /></span><b>{Math.round((r.tiers / r.max) * 100)}%</b></div>
            <Segs done={r.tiers} total={r.max} tone={r.tiers >= r.max ? 'green' : ''} />
            <div className="tiny muted">{r.found} из {r.families} найдено{r.maxed ? ` · ${r.maxed} на максимуме` : ''}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Rewards({ b }) {
  return (
    <div className="bx-rewards">
      {b.rewards.map(r => (
        <div key={r.n} className={`bx-reward ${r.n === b.nextXpAt ? 'next' : ''}`}>
          <span className="tiny muted">Веха {r.n}</span>
          <b>{num(r.xp)}</b>
          <span className="tiny muted">Combat XP{r.sbxp ? ` · +${r.sbxp} SB XP` : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function Bestiary({ guide }) {
  const b = guide.extra?.bestiary;
  const all = guide.sections || [];
  if (!b) return <><GuideHero guide={guide} /><NextSteps guide={guide} />{all.map((s, i) => <Section key={i} s={s} />)}</>;
  const howto = all.find(s => s.kind === 'steps');
  const how = all.find(s => s.kind === 'text' && !s.bx);
  const tail = all.filter(s => !s.bx && s !== howto && s !== how && s.kind !== 'table');
  return (
    <>
      <Hero guide={guide} b={b} />
      <NextSteps guide={guide} next={(guide.next || []).filter(n => !n.bx)} />
      <div className="bx-grid">
        <PlanCard b={b} />
        <MainCard b={b} />
      </div>
      <div className="bx-grid">
        <Chips title="Почти максимум" list={b.almost} news="almost" text={f => kills(f.toMax)} note="Последние уровни — самый большой бонус против моба." />
        <Chips title="Только на событиях" list={b.events} news="events" text={f => kills(f.left)} note="Когда событие идёт, эти уровни самые дешёвые." />
      </div>
      <Islands b={b} />
      <Card title="Как работает Bestiary" className="bx-card">
        <ul className="bx-facts">
          <li><b>Уровень моба</b><span>+3 Magic Find и +3 Strength против него</span></li>
          <li><b>10 уровней</b><span>веха: +1 Health навсегда</span></li>
          <li><b>Каждая 5-я веха</b><span>Combat XP</span></li>
          <li><b>Начать</b><span><Rich text="поговорить с Bramass Beastslayer в Spider's Den" /></span></li>
        </ul>
        <Rewards b={b} />
        {(howto || how) && (
          <details className="bx-more">
            <summary>Подробнее и пошагово</summary>
            {how && <Section s={{ ...how, title: 'Правила' }} />}
            {howto && <Section s={howto} />}
          </details>
        )}
      </Card>
      {tail.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
