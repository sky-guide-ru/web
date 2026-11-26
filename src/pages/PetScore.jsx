// Карточки «Pet Score» и «Кап Taming» над списком питомцев.
// Всё считает сервер (server/analysis/pet-score.js): счёт, порог Magic Find, самые дешёвые очки, кандидаты на сдачу.
import { Card, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { RARITY_COLOR, RARITY_RU, coins, plural } from '../api.js';
import { useApp } from '../App.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';

const KIND = { new: 'новый тип', rarity: 'выше редкость', maxed: 'макс. уровень' };

function PetRow({ o, onOpen, right }) {
  return (
    <button className="ps-row" onClick={() => onOpen(o.id)} title="Открыть карточку питомца" style={{ '--r': RARITY_COLOR[o.tier] }}>
      <ItemIcon id={o.id} size={30} />
      <span className="ps-row-name">
        <b style={{ color: RARITY_COLOR[o.tier] }}>{o.name}</b>
        <small>{o.sub || <>{RARITY_RU[o.tier]}{o.kind ? ` · ${KIND[o.kind]}${o.kind === 'rarity' && o.from ? ` (сейчас ${RARITY_RU[o.from]})` : ''}` : ''}</>}</small>
      </span>
      {right}
    </button>
  );
}

export function PetScoreCard({ ps }) {
  const { openItem } = useApp();
  if (!ps) return null;
  const prev = ps.thresholds.filter(t => t.need <= ps.score).pop();
  const from = prev ? prev.need : 0;
  const pct = ps.next ? (ps.score - from) / (ps.next.need - from) : 1;
  return (
    <Card className="span-6 ps-card" title="Pet Score" icon={<ItemIcon id="PET_ITEM_TIER_BOOST" size={22} />}
      right={<span className="muted small">+{ps.mf} ✯ Magic Find из {ps.maxMf}</span>}>
      <div className="ps-head">
        <div className="ps-score"><b>{ps.score}</b><small>очков</small></div>
        <div className="ps-bar">
          <div className="ps-bar-top">
            {ps.next
              ? <span>до <b>{ps.next.need}</b> (+{ps.next.mf} ✯ Magic Find): не хватает <b>{ps.next.left}</b></span>
              : <span className="gold">Все пороги Magic Find взяты</span>}
          </div>
          <Progress value={pct} max={!ps.next} />
          <div className="muted tiny">{ps.uniqueTypes} {plural(ps.uniqueTypes, 'тип', 'типа', 'типов')} питомцев: {ps.rarityPoints} за редкость + {ps.maxedPoints} за максимальный уровень{ps.apiScore && ps.apiScore !== ps.score ? ` · в игре записано ${ps.apiScore}` : ''}</div>
        </div>
      </div>
      <p className="muted small ps-rule">Каждый тип питомца считается один раз, по самой высокой редкости: обычный 1 … мифический 6. Ещё +1, если у типа есть питомец максимального уровня. Tier Boost поднимает редкость.</p>

      {ps.nearMax?.length > 0 && <>
        <div className="ex-sec"><span>Бесплатно: докачай до максимума</span></div>
        <div className="ps-list">
          {ps.nearMax.map(p => <PetRow key={p.id + p.level} o={p} onOpen={openItem} right={<span className="ps-cost">ур. {p.level}/{p.maxLevel}<small>+1 очко</small></span>} />)}
        </div>
      </>}

      {ps.next && ps.plan.picks.length > 0 && <>
        <div className="ex-sec"><span>Самый дешёвый путь до {ps.next.need}</span><span className="ex-note">≈ {coins(ps.plan.cost)}{ps.plan.enough ? '' : ' (на рынке не хватает вариантов)'}</span></div>
        <div className="ps-list">
          {ps.plan.picks.map(o => <PetRow key={o.type} o={o} onOpen={openItem} right={<span className="ps-cost">{coins(o.cost)}<small>+{o.points} {plural(o.points, 'очко', 'очка', 'очков')}</small></span>} />)}
        </div>
      </>}
      {!ps.plan.picks.length && ps.next && <p className="muted small">Цены аукциона ещё не загрузились: дешёвые варианты появятся через минуту.</p>}
    </Card>
  );
}

export function TamingCard({ t }) {
  const { openItem } = useApp();
  if (!t) return null;
  const full = t.left === 0;
  const tierLine = c => c.owned
    ? `${RARITY_RU[c.minTier]} или выше · есть у тебя (${RARITY_RU[c.owned.tier]}, ур. ${c.owned.level})`
    : `${RARITY_RU[c.minTier]} или выше`;
  return (
    <Card className="span-6 ps-card" title="Кап Taming" icon={<ItemIcon id="BONE" size={22} />}
      right={<span className={full ? 'gold small' : 'muted small'}>{t.cap}/{t.max}</span>}>
      <RefsProvider refs={t.refs}>
        <Progress value={(t.cap - 50) / (t.max - 50)} max={full} />
        <p className={full ? 'small' : 'muted small'}><Rich text={t.text?.intro || ''} /></p>
        {t.sacrificed.length > 0 && <details className="ex-eggs">
          <summary>Уже сдано: {t.sacrificed.length}</summary>
          <div className="ps-tags">{t.sacrificed.map(s => <span key={s} className="chip">{s.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</span>)}</div>
        </details>}
        {!full && t.candidates.length > 0 && <>
          <div className="ex-sec"><span>Осталось отдать George</span>{t.totalCost > 0 && <span className="ex-note">≈ {coins(t.totalCost)}</span>}</div>
          <div className="ps-list">
            {t.candidates.map(c => <PetRow key={c.type} o={{ ...c, sub: tierLine(c) }} onOpen={openItem}
              right={<span className="ps-cost">{c.owned ? 'есть' : c.cost ? coins(c.cost) : 'не продаётся'}</span>} />)}
          </div>
          <p className="muted tiny"><Rich text={t.text?.note || ''} /></p>
        </>}
      </RefsProvider>
    </Card>
  );
}
