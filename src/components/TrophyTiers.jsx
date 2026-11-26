// Счётчик Trophy Fish по тирам: сколько видов из 18 поймано в бронзе, серебре, золоте и алмазе.
// counts = member.fishing.trophyTiers: { total: 18, species, tiers: { bronze: { exact, atLeast }, … } }
import { Progress } from './ui.jsx';

const TIERS = [
  ['bronze', 'Бронза', 'linear-gradient(90deg,#8a5a2b,#cd7f32)'],
  ['silver', 'Серебро', 'linear-gradient(90deg,#8e9aa3,#e2e8f0)'],
  ['gold', 'Золото', 'linear-gradient(90deg,#c9971c,#f5c542)'],
  ['diamond', 'Алмаз', 'linear-gradient(90deg,#22d3ee,#a5f3fc)'],
];

export default function TrophyTiers({ counts, compact = false }) {
  if (!counts?.tiers) return null;
  const total = counts.total || 18;
  return (
    <div className={`trophy-tiers ${compact ? 'compact' : ''}`}>
      {TIERS.map(([t, ru, color]) => {
        const c = counts.tiers[t] || { exact: 0, atLeast: 0 };
        const full = c.exact >= total;
        return (
          <div key={t} className={`trophy-tier t-${t}`} title={`${ru}: поймано у ${c.exact} из ${total} видов. С учётом старших тиров (так считает Odger): ${c.atLeast}/${total}.`}>
            <Progress value={c.exact / total} color={color} max={full} label={<><i className={`tt-dot t-${t}`} />{ru}</>} sub={<b>{c.exact}/{total}</b>} />
            {!compact && c.atLeast > c.exact && <span className="muted small">с учётом старших: {c.atLeast}/{total}</span>}
          </div>
        );
      })}
    </div>
  );
}
