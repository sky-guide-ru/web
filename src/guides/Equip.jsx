// Секция гайда «Equipment» (kind 'equip'): 4 слота рядом с бронёй — что надето, что улучшить, на что сменить,
// что собрать на следующую вещь и вся лестница слота. Данные считает core (guides/equipment.js).
import { Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins } from '../api.js';
import { Rich } from './Rich.jsx';

const TONE = { good: '#4ade80', warn: '#f5c542', bad: '#f87171', muted: '#8b90b0' };
const SLOT_ICON = { necklace: '◎', cloak: '⛉', belt: '▭', gloves: '✋' };

// «+25 Foraging Fortune, +2 Sweep; бонус…» → статы чипами, остальное текстом
function Stats({ text }) {
  const parts = String(text || '').split(/[,;]\s+/);
  const chips = [], rest = [];
  for (const p of parts) (/^[+−\-×]\s?\d/.test(p) && p.length <= 40 ? chips : rest).push(p);
  return (
    <>
      {chips.length > 0 && <div className="eq-stats">{chips.map((c, i) => <span key={i} className="eq-stat"><Rich text={c} /></span>)}</div>}
      {rest.length > 0 && <div className="eq-why muted small"><Rich text={rest.join(', ')} /></div>}
    </>
  );
}

function Item({ it, label, dim }) {
  return (
    <div className={`eq-item${dim ? ' dim' : ''}`}>
      <ItemIcon id={it.id} size={40} />
      <div className="eq-item-body">
        <div className="eq-item-label">{label}</div>
        <b className="eq-item-name"><Rich text={it.name} item={it.id} /></b>
        <Stats text={it.why} />
      </div>
    </div>
  );
}

function Slot({ s }) {
  const n = s.next;
  const have = s.recipe ? s.recipe.inputs.filter(x => x.id !== 'SKYBLOCK_COIN') : [];
  const done = have.filter(x => x.have >= x.need).length;
  return (
    <div className={`eq-slot eq-${s.state}`}>
      <div className="eq-slot-head">
        <span className="eq-slot-ico" aria-hidden="true">{SLOT_ICON[s.key]}</span>
        <span className="eq-slot-name">{s.name}</span>
        {s.tag && <Badge color={TONE[s.tag.tone]}>{s.tag.text}</Badge>}
        {n?.price ? <span className="eq-price">{coins(n.price)}</span> : n?.craftCost ? <span className="eq-price">~{coins(n.craftCost)}</span> : null}
      </div>

      {s.now
        ? <Item it={s.now} label={s.now.worn ? 'Надето' : `Есть${s.now.where ? ` · ${s.now.where}` : ''}`} />
        : <div className="eq-empty muted small">Слот пустой</div>}

      {s.upgrades?.length > 0 && (
        <div className="eq-ups">
          <div className="eq-sub">Улучшить</div>
          {s.upgrades.map((u, i) => (
            <div key={i} className="eq-up">
              {u.item ? <ItemIcon id={u.item} size={24} /> : <span className="eq-up-dot" aria-hidden="true">✦</span>}
              <div><b><Rich text={u.label} /></b>{u.price ? <span className="muted small"> · {coins(u.price)}</span> : null}<div className="muted small"><Rich text={u.text} /></div></div>
            </div>
          ))}
        </div>
      )}

      {n && (
        <div className="eq-next">
          <div className="eq-arrow" aria-hidden="true">↓</div>
          <Item it={n} label={s.now ? 'Сменить на' : 'Надеть'} dim={!n.reqOk} />
          <ul className="eq-facts">
            {n.req && <li className={n.reqOk ? 'ok' : 'no'}>{n.reqOk ? '✓' : '✕'} <Rich text={n.req} /></li>}
            {n.how && <li><Rich text={n.how} /></li>}
          </ul>
        </div>
      )}

      {s.recipe && (
        <details className="eq-recipe">
          <summary><Rich text={s.recipe.title} /> <span className="muted small">· {s.recipe.where} · {done}/{have.length}</span></summary>
          <ul>
            {s.recipe.inputs.map((x, i) => {
              const coin = x.id === 'SKYBLOCK_COIN';
              const pct = coin ? 1 : Math.min(1, x.have / x.need);
              return (
                <li key={i} className={pct >= 1 ? 'ok' : ''}>
                  {coin ? <span className="eq-coin" aria-hidden="true">¢</span> : <ItemIcon id={x.id} size={24} />}
                  <div className="eq-ing">
                    <div className="eq-ing-row"><Rich text={x.name} item={coin ? undefined : x.id} /><span className="eq-ing-n">{coin ? coins(x.need) : `${x.have.toLocaleString()}/${x.need.toLocaleString()}`}</span></div>
                    {!coin && <div className="eq-bar"><i style={{ width: `${pct * 100}%` }} /></div>}
                    {x.cost ? <div className="muted small">не хватает на ~{coins(x.cost)}</div> : x.how ? <div className="muted small"><Rich text={x.how} /></div> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {s.ladder?.length > 1 && (
        <div className="eq-ladder" aria-label="Порядок улучшений">
          {s.ladder.map((x, i) => (
            <span key={x.id} className="eq-step-wrap">
              {i > 0 && <span className="eq-chev" aria-hidden="true">›</span>}
              <span className={`eq-step ${x.state}`} title={x.name}><ItemIcon id={x.id} size={28} title={x.name} /></span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EquipSection({ s }) {
  return (
    <div className="eq">
      {(s.intro || s.mix) && (
        <div className="eq-intro">
          {s.intro && <p className="small"><Rich text={s.intro} /></p>}
          {s.mix && <p className="small eq-mix"><b>Можно ли смешивать.</b> <Rich text={s.mix} /></p>}
        </div>
      )}
      <div className="eq-slots" aria-label="4 слота Equipment">
        {(s.slots || []).map(x => (
          <span key={x.key} className={`eq-chip eq-${x.state}`}>
            <span className="eq-slot-ico" aria-hidden="true">{SLOT_ICON[x.key]}</span>
            <span><b>{x.name}</b><span className="muted small">{x.now ? <Rich text={x.now.name} /> : 'пусто'}</span></span>
          </span>
        ))}
      </div>
      <div className="eq-grid">{(s.slots || []).map(x => <Slot key={x.key} s={x} />)}</div>
    </div>
  );
}
