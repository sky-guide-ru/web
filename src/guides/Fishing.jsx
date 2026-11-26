// Гайд по рыбалке: общий вид + наглядная сетка Trophy Fish (18 видов × 4 тира).
import { Card } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { RARITY_COLOR } from '../api.js';
import { useApp } from '../App.jsx';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import TrophyTiers from '../components/TrophyTiers.jsx';

const TIERS = [['bronze', 'Бронза'], ['silver', 'Серебро'], ['gold', 'Золото'], ['diamond', 'Алмаз']];

export function TrophyGrid({ fish, ranks, counts, title = 'Trophy Fish по тирам' }) {
  const { openItem } = useApp();
  return (
    <Card title={title} className="fish-trophy">
      <TrophyTiers counts={counts} />
      <div className="fish-ranks">
        {ranks.map(r => (
          <span key={r.n} className={`fish-rank ${r.claimed || (r.claimed == null && r.ready) ? 'done' : r.ready ? 'ready' : ''}`} title={r.reward}>
            {r.name.replace(' Trophy Fisher', '')} <b>{Math.min(r.have, r.count)}/{r.count}</b>
          </span>
        ))}
      </div>
      <div className="fish-grid">
        {fish.map(f => {
          const best = [...TIERS].reverse().find(([t]) => f.tiers[t] > 0)?.[0] || 'bronze';
          const id = `${f.key.toUpperCase()}_${best.toUpperCase()}`;
          const none = !TIERS.some(([t]) => f.tiers[t] > 0);
          return (
            <button key={f.key} className={`fish-cell ${none ? 'none' : ''}`} onClick={() => openItem(id)} title={`${f.name}: ${f.how}`} style={{ '--r': RARITY_COLOR?.[f.rarity] || '#aaa' }}>
              <ItemIcon id={id} size={32} />
              <span className="fish-name">{f.name}</span>
              <span className="fish-tiers">
                {TIERS.map(([t, ru]) => <i key={t} className={`t-${t} ${f.tiers[t] ? 'on' : ''}`} title={`${ru}: ${f.tiers[t] || 0}`} />)}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default function Fishing({ guide }) {
  const ex = guide.extra || {};
  return (
    <>
      <GuideHero guide={guide} />
      <NextSteps guide={guide} />
      {ex.trophy && <TrophyGrid fish={ex.trophy} ranks={ex.ranks || []} counts={ex.tierCounts} />}
      {(guide.sections || []).map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
