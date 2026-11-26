import { useMemo, useState } from 'react';
import { Card, Progress, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { RARITY_COLOR, RARITY_RU, saveLocal, usePart } from '../api.js';
import { useApp } from '../App.jsx';
import { PetScoreCard, TamingCard } from './PetScore.jsx';

const pretty = t => t.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const TIER = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6 };
const SORTS = {
  level: { label: 'по уровню', fn: (a, b) => b.level - a.level || (TIER[b.tier] || 0) - (TIER[a.tier] || 0) },
  rarity: { label: 'по редкости', fn: (a, b) => (TIER[b.tier] || 0) - (TIER[a.tier] || 0) || b.level - a.level },
  name: { label: 'по имени', fn: (a, b) => pretty(a.type).localeCompare(pretty(b.type)) },
};
const SORT_KEY = 'sb-pets-sort';

export default function Pets({ state }) {
  const { openItem } = useApp();
  const pets = state.member?.pets || [];
  const ps = usePart(state, 'petScore', state.analysis?.petScore); // Pet Score и Taming — отдельным куском
  const [q, setQ] = useState('');
  const [sort, setSortRaw] = useState(() => localStorage.getItem(SORT_KEY) || 'level');
  const [onlyGrow, setOnlyGrow] = useState(false);
  const setSort = v => { setSortRaw(v); saveLocal(SORT_KEY, v); };
  const maxed = pets.filter(p => p.level >= p.maxLevel).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pets
      .filter(p => !s || pretty(p.type).toLowerCase().includes(s) || (RARITY_RU[p.tier] || '').toLowerCase().includes(s))
      .filter(p => !onlyGrow || p.level < p.maxLevel)
      // активный питомец всегда первым
      .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (SORTS[sort] || SORTS.level).fn(a, b));
  }, [pets, q, sort, onlyGrow]);

  if (!pets.length) return <Empty>Питомцев не видно. Проверь, что в настройках API игры открыт доступ к инвентарю.</Empty>;

  return (
    <div className="grid">
      <PetScoreCard ps={ps} />
      <TamingCard t={ps?.taming} />
      <Card className="span-12" title={`Питомцы: ${pets.length}`} right={<span className="muted small">максимального уровня: {maxed} из {pets.length}</span>}>
        <div className="pets-tools">
          <input className="search" placeholder="Найти питомца: dragon, golem, легендарный…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="chips">
            {Object.entries(SORTS).map(([k, v]) => <button key={k} className={sort === k ? 'chip active' : 'chip'} onClick={() => setSort(k)}>{v.label}</button>)}
          </div>
          <label className="check small"><input type="checkbox" checked={onlyGrow} onChange={e => setOnlyGrow(e.target.checked)} /> только не прокачанные</label>
        </div>
        {shown.length ? (
          <div className="pet-grid">
            {shown.map((p, i) => (
              <div key={p.uuid || `${p.type}-${p.tier}-${i}`} className={`pet ${p.active ? 'active' : ''}`} onClick={() => openItem(p.id)} style={{ '--r': RARITY_COLOR[p.tier] }} title="Открыть карточку питомца">
                <ItemIcon id={p.id} size={56} />
                <div className="pet-name" style={{ color: RARITY_COLOR[p.tier] }}>{pretty(p.type)}</div>
                <div className="muted tiny pet-sub"><span>{RARITY_RU[p.tier]}</span><span><span className={p.level >= p.maxLevel ? 'gold' : ''}>ур. {p.level}</span>{p.level < p.maxLevel ? <span className="muted">/{p.maxLevel}</span> : ''}</span></div>
                <Progress value={p.level >= p.maxLevel ? 1 : p.progress} max={p.level >= p.maxLevel} />
                {p.heldItem && <div className="held"><ItemIcon id={p.heldItem} size={22} title={p.heldItem} /></div>}
                {p.active && <div className="active-tag">активен</div>}
              </div>
            ))}
          </div>
        ) : <Empty>Под фильтр ничего не подошло.</Empty>}
      </Card>
    </div>
  );
}
