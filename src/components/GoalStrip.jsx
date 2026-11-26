// Тонкая полоса «ближайшие цели» под шапкой (текущий уровень → следующий, чтобы цель не путали с уровнем): SkyBlock-уровень, Catacombs и самый близкий к апу скилл.
// Есть на всех страницах, кроме главной (там то же самое в герое).
export default function GoalStrip({ member: m }) {
  if (!m) return null;
  const goals = [];
  const sb = m.sbLevel % 1;
  goals.push({ k: 'sb', label: `SkyBlock ${Math.floor(m.sbLevel)} → ${Math.floor(m.sbLevel) + 1}`, p: sb, text: `${Math.round(sb * 100)}/100`, color: 'var(--gold)' });
  const c = m.dungeons?.catacombs;
  if (c && c.level < c.maxLevel) goals.push({ k: 'cata', label: `Catacombs ${c.level} → ${c.level + 1}`, p: c.progress, text: `${Math.round(c.progress * 100)}%`, color: '#ff5e5e' });
  const skill = Object.entries(m.skills || {}).filter(([k]) => k !== 'social' && k !== 'runecrafting').map(([, s]) => s).filter(s => s.level < s.maxLevel && !s.apiMissing).sort((a, b) => b.progress - a.progress)[0];
  if (skill) goals.push({ k: 'skill', label: `${skill.name} ${skill.level} → ${skill.level + 1}`, p: skill.progress, text: `${Math.round(skill.progress * 100)}%`, color: 'var(--accent)' });
  return (
    <div className="goal-strip" aria-label="Ближайшие цели">
      {goals.map(g => (
        <div key={g.k} className="goal" style={{ '--g': g.color }}>
          <span className="goal-label">{g.label}</span>
          <span className="goal-bar"><i style={{ width: `${Math.max(2, g.p * 100)}%` }} /></span>
          <b>{g.text}</b>
        </div>
      ))}
    </div>
  );
}
