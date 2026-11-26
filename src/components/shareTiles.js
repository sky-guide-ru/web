// Плитки для карточки профиля: всё, чем игрок может похвастаться.
// У каждой плитки есть «сила» (score, 0…1): насколько игрок близок к максимуму.
// Автоподбор берёт самые сильные плитки, а игрок может выбрать свои.
import { LOCALE } from '../i18n.js';
import { coins, num, prettyId } from '../api.js';

const fx = v => (Number(v) || 0).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
const logScore = (v, lo, hi) => (v > 0 ? clamp((Math.log10(v) - lo) / (hi - lo)) : 0);

export const MAX_TILES = 9;
export const AUTO_TILES = 6;
// В автоподборе не больше двух отдельных скиллов, чтобы карточка не превратилась в список скиллов
const MAX_AUTO_SKILLS = 2;

// Уровень Garden по опыту (как на сервере, server/parse/extras-view.js)
const GARDEN_EXP = [0, 70, 70, 140, 240, 600, 1500, 2000, 2500, 3000, 10000, 10000, 10000, 10000, 10000];
function gardenLevel(exp) {
  let lvl = 0, acc = 0;
  for (const need of GARDEN_EXP) { if (exp >= acc + need) { acc += need; lvl++; } else break; }
  return lvl;
}

const SKILLS = [
  ['farming', 'Farming', 'golden_hoe', '#facc15'],
  ['mining', 'Mining', 'diamond_pickaxe', '#38bdf8'],
  ['combat', 'Combat', 'stone_sword', '#f87171'],
  ['foraging', 'Foraging', 'jungle_sapling', '#4ade80'],
  ['fishing', 'Fishing', 'fishing_rod', '#60a5fa'],
  ['enchanting', 'Enchanting', 'enchanting_table', '#c084fc'],
  ['alchemy', 'Alchemy', 'brewing_stand', '#f472b6'],
  ['taming', 'Taming', 'bone', '#fb923c'],
  ['hunting', 'Hunting', 'lead', '#a3e635'],
  ['carpentry', 'Carpentry', 'crafting_table', '#d6a26b'],
  ['runecrafting', 'Runecrafting', 'magma_cream', '#e879f9'],
];
// Скиллы, которые легко докачать до конца: в автоподбор не идут, но выбрать их можно
const MINOR_SKILLS = new Set(['carpentry', 'runecrafting', 'taming']);
const KUUDRA = [['basic', 'Basic'], ['hot', 'Hot'], ['burning', 'Burning'], ['fiery', 'Fiery'], ['infernal', 'Infernal']];

/** Все плитки, для которых в профиле есть данные: [{ id, label, value, sub, color, icon, score, skill? }] */
export function shareTiles(m, a) {
  const out = [];
  const add = t => { if (t.value != null && t.value !== '' && t.value !== '—') out.push(t); };

  const nw = a?.gear?.networth?.total;
  if (nw > 0) add({ id: 'networth', label: 'Состояние', value: coins(nw), sub: 'оценка по рынку', color: '#f5c542', icon: 'gold_ingot', score: logScore(nw, 6, 10.5) });
  if (m.magicalPower > 0) add({ id: 'mp', label: 'Magical Power', value: num(m.magicalPower), sub: m.selectedPower ? `сила ${prettyId(m.selectedPower)}` : 'сила не выбрана', color: '#c879ff', icon: 'ender_eye', score: clamp(m.magicalPower / 1600) });

  const cata = m.dungeons?.catacombs;
  if (cata?.level > 0) add({ id: 'catacombs', label: 'Catacombs', value: String(cata.level), sub: `классы ~${fx(m.dungeons?.classAverage)}`, color: '#ff5e5e', icon: 'wither_skeleton_skull', score: clamp(cata.level / 50) });
  const best = Object.values(m.dungeons?.classes || {}).sort((x, y) => (y.level || 0) - (x.level || 0))[0];
  if (best?.level > 0) add({ id: 'class', label: 'Лучший класс', value: `${best.name} ${best.level}`, sub: `средний ~${fx(m.dungeons?.classAverage)}`, color: '#f97316', icon: 'bow', score: clamp(best.level / 50) * 0.95 });
  if (m.dungeons?.secrets > 0) add({ id: 'secrets', label: 'Secrets', value: num(m.dungeons.secrets), sub: 'найдено в Dungeons', color: '#94a3b8', icon: 'chest', score: clamp(m.dungeons.secrets / 30000) });

  if (m.skillAverage > 0) add({ id: 'skillavg', label: 'Skill Average', value: fx(m.skillAverage), sub: m.skillAverageOverflow ? `с overflow ${fx(m.skillAverageOverflow)}` : '9 основных скиллов', color: '#4ade80', icon: 'experience_bottle', score: clamp(m.skillAverage / 55) });
  for (const [k, label, icon, color] of SKILLS) {
    const s = m.skills?.[k];
    if (!s || s.apiMissing || !(s.level > 0)) continue;
    const maxed = s.level >= s.maxLevel;
    const of = s.overflow?.level > s.level ? `overflow ${fx(s.overflow.level)}` : maxed ? 'максимальный уровень' : `из ${s.maxLevel}`;
    // У максимального скилла сила 1, а overflow-опыт чуть поднимает её, чтобы различать «просто 60» и «далеко за 60»
    const extra = maxed && s.overflow?.level > s.level ? Math.min(0.08, (s.overflow.level - s.level) / 300) : 0;
    add({ id: `skill-${k}`, label, value: String(s.level), sub: of, color, icon, skill: true, minor: MINOR_SKILLS.has(k), score: clamp(s.level / (s.maxLevel || 60)) * 0.97 + extra });
  }

  const sl = Object.values(m.slayers || {});
  const slSum = sl.reduce((t, s) => t + (s.level || 0), 0), slMax = sl.reduce((t, s) => t + (s.maxLevel || 9), 0);
  if (slSum > 0) add({ id: 'slayers', label: 'Slayers', value: sl.map(s => s.level ?? 0).join(' / '), sub: 'зомби · паук · волк · эндер · блейз · вамп', color: '#fb923c', icon: 'rotten_flesh', score: slMax ? slSum / slMax : 0 });

  const hotm = m.mining?.hotm;
  if (hotm?.level > 0) {
    const gem = m.mining?.powder?.gemstone;
    add({ id: 'hotm', label: 'HOTM', value: String(hotm.level), sub: gem ? `Gemstone Powder ${coins(gem)}` : `из ${hotm.maxLevel || 10}`, color: '#22d3ee', icon: 'prismarine_shard', score: clamp(hotm.level / (hotm.maxLevel || 10)) * 0.95 });
  }

  if (m.garden?.experience > 0) {
    const gl = gardenLevel(m.garden.experience);
    add({ id: 'garden', label: 'Garden', value: String(gl), sub: m.garden.visitorsServed ? `visitors ${num(m.garden.visitorsServed)}` : `из ${GARDEN_EXP.length}`, color: '#84cc16', icon: 'sunflower', score: clamp(gl / GARDEN_EXP.length) * 0.9 });
  }

  const pets = (m.pets || []).filter(p => p.level > 0);
  if (pets.length) {
    const maxed = pets.filter(p => p.level >= (p.maxLevel || 100));
    const top = [...pets].sort((x, y) => (y.level || 0) - (x.level || 0) || (y.exp || 0) - (x.exp || 0))[0];
    add({ id: 'pets', label: 'Pets', value: maxed.length ? `${maxed.length} × max` : `${top.level} ур.`, sub: `лучший: ${prettyId(top.type)} ${top.level}`, color: '#fbbf24', icon: 'ender_pearl', score: clamp(maxed.length / 15) * 0.9 });
  }

  const mu = a?.museum;
  if (mu && mu.status !== 'none' && mu.donated > 0) add({ id: 'museum', label: 'Museum', value: `${num(mu.donated)}`, sub: `предметов из ${num(mu.total)}`, color: '#eab308', icon: 'item_frame', score: mu.total ? clamp(mu.donated / mu.total) : 0 });

  const k = m.crimson?.kuudra || {};
  const kTop = [...KUUDRA].reverse().find(([id]) => k[id] > 0);
  if (kTop) {
    const runs = KUUDRA.reduce((t, [id]) => t + (k[id] || 0), 0);
    add({ id: 'kuudra', label: 'Kuudra', value: kTop[1], sub: `${num(runs)} заходов`, color: '#ef4444', icon: 'lava_bucket', score: ((KUUDRA.findIndex(([id]) => id === kTop[0]) + 1) / KUUDRA.length) * 0.9 });
  }
  const rep = Math.max(m.crimson?.barbarianRep || 0, m.crimson?.mageRep || 0);
  if (rep > 0) add({ id: 'crimson', label: 'Crimson Isle', value: num(rep), sub: m.crimson?.faction === 'mages' ? 'репутация Mages' : 'репутация Barbarians', color: '#dc2626', icon: 'blaze_powder', score: clamp(rep / 12000) * 0.85 });

  const fs = m.fairySouls?.collected;
  if (fs > 0) add({ id: 'fairy', label: 'Fairy Souls', value: num(fs), sub: `обменов ${num(m.fairySouls.exchanges || 0)}`, color: '#f0abfc', icon: 'nether_star', score: clamp(fs / 266) * 0.55 });

  const medals = m.jacob?.medals;
  if (medals?.gold > 0) add({ id: 'jacob', label: 'Jacob’s Contest', value: `${num(medals.gold)} gold`, sub: `silver ${num(medals.silver || 0)} · bronze ${num(medals.bronze || 0)}`, color: '#fde047', icon: 'wheat', score: clamp(medals.gold / 150) * 0.8 });

  if (m.bank > 0) add({ id: 'bank', label: 'Bank', value: coins(m.bank), sub: `кошелёк ${coins(m.purse)}`, color: '#60a5fa', icon: 'gold_block', score: logScore(m.bank, 5, 9.3) * 0.85 });
  return out;
}

/** Автоподбор: самые сильные стороны игрока, не больше двух отдельных скиллов */
export function autoPick(tiles, n = AUTO_TILES) {
  const res = [];
  let skills = 0;
  for (const t of [...tiles].sort((x, y) => y.score - x.score)) {
    if (res.length >= n) break;
    if (t.skill && (t.minor || skills >= MAX_AUTO_SKILLS)) continue;
    if (t.skill) skills++;
    res.push(t.id);
  }
  return res;
}
