// Фильтры «Рынка», как в меню игры: категории плитками с иконкой предмета (Farming, Mining… у Bazaar; Оружие, Броня… у аукциона)
// и редкость у аукциона цветными кнопками. Число на плитке — сколько найдено в категории по текущему поиску
// (facets из /api/bazaar и /api/market/ah). Ключи категорий — латиница с сервера (server/market/categories.js CATEGORY_KEYS).
import { ItemIcon } from './ItemIcon.jsx';
import { num, RARITY_COLOR } from '../api.js';

// ключ → [подпись, иконка (ID предмета, как значок вкладки в игре)]. Тёмные предметы (Wither Essence, Anvil) на тёмной плитке не видны — берём светлые
const CAT = {
  farming: ['Farming', 'WHEAT'], mining: ['Mining', 'DIAMOND_PICKAXE'], combat: ['Combat', 'IRON_SWORD'], foraging: ['Foraging', 'IRON_AXE'],
  fishing: ['Fishing', 'FISHING_ROD'], books: ['Книги', 'ENCHANTED_BOOK'], shards: ['Осколки', 'PRISMARINE_SHARD'], essence: ['Essence', 'ESSENCE_GOLD'],
  upgrades: ['Улучшения', 'RECOMBOBULATOR_3000'], weapon: ['Оружие', 'DIAMOND_SWORD'], armor: ['Броня', 'DIAMOND_CHESTPLATE'],
  accessory: ['Аксессуары', 'SPEED_TALISMAN'], pet: ['Питомцы', 'BONE'], tool: ['Инструменты', 'DIAMOND_PICKAXE'], equipment: ['Экипировка', 'MOLTEN_NECKLACE'],
  reforge: ['Reforge', 'EMERALD'], cosmetic: ['Косметика', 'NAME_TAG'], minion: ['Миньоны', 'HOPPER'], consumable: ['Расходники', 'POTION'], misc: ['Прочее', 'CHEST'],
};
export const BZ_CATS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'books', 'shards', 'essence', 'upgrades', 'misc'];
export const AH_CATS = ['weapon', 'armor', 'accessory', 'pet', 'equipment', 'tool', 'consumable', 'reforge', 'cosmetic', 'minion', 'books', 'combat', 'mining', 'misc'];
// Редкости по порядку: подпись на кнопке короткая, полная — в подсказке
const RARITIES = [['COMMON', 'C', 'Common'], ['UNCOMMON', 'U', 'Uncommon'], ['RARE', 'R', 'Rare'], ['EPIC', 'E', 'Epic'], ['LEGENDARY', 'L', 'Legendary'],
  ['MYTHIC', 'M', 'Mythic'], ['DIVINE', 'D', 'Divine'], ['SPECIAL', 'S', 'Special'], ['VERY_SPECIAL', 'VS', 'Very Special'], ['ULTIMATE', 'UL', 'Ultimate']];
// Кнопки — только у редкостей, которые есть среди найденного (у Admin-предметов лотов не бывает, их нет вовсе)

/**
 * @param {{ order: string[], counts?: Record<string, number>, cat: string, setCat: (c: string) => void,
 *   rarities?: Record<string, number> | null, rarity?: string, setRarity?: (r: string) => void }} props
 */
export default function MarketFilters({ order, counts = {}, cat, setCat, rarities = null, rarity = '', setRarity }) {
  // Плитки — категории, где что-то есть (и выбранная, даже если в ней пусто), в порядке как в игре
  const keys = [...order.filter(k => counts[k] || k === cat), ...Object.keys(counts).filter(k => !order.includes(k) && CAT[k])];
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const rars = rarities ? RARITIES.filter(([k]) => rarities[k] || k === rarity) : [];
  return (
    <div className="mk-filters">
      <div className="mk-cats" role="group" aria-label="Категория">
        <button type="button" className={`mk-cat ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => setCat('')} title="Все категории">
          <span className="mk-cat-all" aria-hidden>✦</span><span className="mk-cat-l">Все</span>{total > 0 && <span className="mk-cat-n">{num(total)}</span>}
        </button>
        {keys.map(k => (
          <button key={k} type="button" className={`mk-cat ${cat === k ? 'on' : ''}`} aria-pressed={cat === k} onClick={() => setCat(cat === k ? '' : k)} title={CAT[k]?.[0] || k}>
            <ItemIcon id={CAT[k]?.[1] || 'CHEST'} size={22} />
            <span className="mk-cat-l">{CAT[k]?.[0] || k}</span>
            <span className="mk-cat-n">{counts[k] ? num(counts[k]) : '0'}</span>
          </button>
        ))}
      </div>
      {setRarity && rars.length > 1 && (
        <div className="mk-rars" role="group" aria-label="Редкость">
          <span className="muted tiny">Редкость</span>
          <button type="button" className={`mk-rar ${!rarity ? 'on' : ''}`} aria-pressed={!rarity} onClick={() => setRarity('')}>любая</button>
          {rars.map(([k, short, full]) => (
            <button key={k} type="button" className={`mk-rar ${rarity === k ? 'on' : ''}`} aria-pressed={rarity === k} onClick={() => setRarity(rarity === k ? '' : k)}
              style={{ '--rc': RARITY_COLOR[k] || RARITY_COLOR[k.replace('_', ' ')] }} title={`${full}: ${num(rarities[k] || 0)}`}>{short}</button>
          ))}
        </div>
      )}
    </div>
  );
}
