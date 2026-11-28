import { Fragment, useState } from 'react';
import { coins, RARITY_COLOR } from '../api.js';
import { Rich } from '../guides/Rich.jsx';

// Блок «Гемы в снаряжении»: какие слоты есть у вещей, что в них стоит, что вставить выгоднее всего под деньги игрока.
// Расчёт — core/src/calc/gems.js (gear.gems из куска «Снаряжение»).

const COLOR = { RUBY: '#f87171', AMETHYST: '#c084fc', JADE: '#4ade80', SAPPHIRE: '#60a5fa', AMBER: '#f59e0b', TOPAZ: '#fde047', JASPER: '#f472b6', OPAL: '#f1f5f9', ONYX: '#9ca3af', AQUAMARINE: '#22d3ee', CITRINE: '#fb923c', PERIDOT: '#84cc16' };
const QS = { ROUGH: 'Rough', FLAWED: 'Flawed', FINE: 'Fine', FLAWLESS: 'Flawless', PERFECT: 'Perfect' };
const GROUPS = [['armor', 'Броня'], ['equipment', 'Экипировка'], ['weapon', 'Оружие'], ['tool', 'Инструменты']];
const cap = s => (s ? s[0] + s.slice(1).toLowerCase() : '');
const gemName = id => String(id).replace(/_GEM$/, '').split('_').map(cap).join(' ');
const PIECE = / (Helmet|Chestplate|Leggings|Boots)$/;

function Chip({ s }) {
  if (s.locked) return <span className="gchip lock" title="Слот закрыт">🔒 {s.typeRu}</span>;
  if (!s.current) return <span className="gchip empty" style={{ '--g': COLOR[s.gem] }}>пусто · {s.typeRu}</span>;
  return <span className={`gchip${s.done ? ' done' : ''}`} style={{ '--g': COLOR[s.current.gem] }}><i />{QS[s.current.quality]} {cap(s.current.gem)}</span>;
}

const toPerfect = it => it.slots.reduce((a, s) => a + (s.options.find(x => x.quality === 'PERFECT')?.cost || 0), 0);

// Части одного сета с одинаковыми слотами — одной строкой («Helianthus · 4 части»)
function merge(items) {
  const out = [];
  for (const it of items) {
    const key = it.slots.map(s => `${s.slot}:${s.locked ? 'L' : s.current ? s.current.gem + s.current.quality : '-'}`).join('|');
    const set = it.id.replace(/_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/, '');
    const prev = set !== it.id && out.find(o => o.set === set && o.key === key);
    if (prev) { prev.n++; prev.toP += toPerfect(it); continue; }
    out.push({ ...it, set, key, n: 1, toP: toPerfect(it) });
  }
  return out;
}

function unlockText(u) {
  if (!u) return '';
  const parts = [u.coins ? coins(u.coins) : null, ...u.items.map(x => `${x.count} ${gemName(x.id)}`)].filter(Boolean);
  return parts.join(' + ');
}

function MoveLine({ m, market }) {
  const how = m.locked ? `открыть слот (${unlockText(m.unlock)}) и вставить ${m.name}` : m.current ? `${m.current} → ${m.name}` : `вставить ${m.name}`;
  return (
    <li>
      <span className="gdot" style={{ '--g': COLOR[m.gem] }} />
      <div className="grow">
        <b>{m.item}</b> <span className="muted">· {m.typeRu} слот</span>
        <div className="small"><Rich text={`${how}: ${m.text}${m.wrongType ? ' (сейчас стат не под роль вещи)' : ''}`} /></div>
      </div>
      {market && <div className="price">{m.have ? 'уже есть' : m.cost != null ? `~${coins(m.cost)}` : '—'}</div>}
    </li>
  );
}

function Detail({ it, market }) {
  return (
    <div className="gdetail-body">
      {it.slots.map(s => (
        <div key={s.slot} className="gopt">
          <b>{s.typeRu} слот</b>{' '}
          <span className="muted small">
            {s.current ? <Rich text={`сейчас ${s.current.name}: ${s.current.text}`} /> : s.locked ? <Rich text={`закрыт: открыть за ${unlockText(s.unlock)}${market && s.unlock?.cost ? ` (~${coins(s.unlock.cost)})` : ''}`} /> : 'пусто'}
          </span>
          {s.done ? <div className="small green">✓ максимум</div> : (
            <div className="gopts">
              {s.options.map(x => (
                <span key={x.quality} className={`gq${x.quality === s.best ? ' pick' : ''}`}>
                  {QS[x.quality]} {cap(s.gem)} <span className="green">{x.text}</span>{market && x.price ? ` · ~${coins(x.price)}` : ''}
                  {x.quality === s.best && <span className="badge">{s.bestFits ? 'под твой бюджет' : 'дешевле всего'}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GemsCard({ gems, openItem }) {
  const [open, setOpen] = useState(null);
  if (!gems?.items?.length) return <div className="muted small">У твоих вещей нет слотов для гемов.</div>;
  const s = gems.summary;
  const market = gems.market !== false;
  return (
    <div className="gems">
      <div className="gsum">
        <span><b className="green">{s.perfect}</b>с Perfect</span>
        <span><b>{s.empty}</b>пустых</span>
        <span><b>{s.locked}</b>закрытых</span>
        {market && s.budget?.steps > 0 && <span><b className="gold">{s.budget.steps}</b>выгодных шагов на ~{coins(s.budget.cost)}</span>}
      </div>
      <p className="small muted gnote">
        <Rich text={market
          ? 'Камень под роль вещи: Jasper на оружие и броню для боя (Onyx — если Strength больше Crit Damage на треть; маг — Sapphire, танк — Amethyst), Jade, Amber и Topaz на Mining, Peridot на Farming, Aquamarine на Fishing, Citrine на Foraging. Качество — под бюджет: за слот не дороже 1% твоих денег. Fine даёт около половины статов Perfect за малую долю цены.'
          : 'Камень под роль вещи: Jasper на оружие и броню для боя, Jade, Amber и Topaz на Mining, Peridot на Farming, Aquamarine на Fishing, Citrine на Foraging. Камни добываются в Crystal Hollows, 80 штук крафтятся в камень следующего качества.'} />
      </p>
      {gems.moves?.length > 0 && <>
        <h4 className="gh">Выгоднее всего сейчас</h4>
        <ol className="gmoves">{gems.moves.slice(0, 6).map((m, i) => <MoveLine key={i} m={m} market={market} />)}</ol>
      </>}
      <h4 className="gh">По вещам</h4>
      <div className="table-scroll">
        <table className="gt">
          <thead><tr><th>Вещь</th><th>Слоты</th>{market && <th className="num">До Perfect</th>}</tr></thead>
          <tbody>
            {GROUPS.map(([g, t]) => {
              const rows = merge(gems.items.filter(it => it.group === g));
              if (!rows.length) return null;
              return (
                <Fragment key={g}>
                  <tr className="gt-group"><th colSpan={3}>{t}</th></tr>
                  {rows.map(it => {
                    const k = it.uuid || it.id + it.where;
                    const done = it.slots.every(x => x.done);
                    return (
                      <Fragment key={k}>
                        <tr className={`gt-row${open === k ? ' open' : ''}`} onClick={() => setOpen(open === k ? null : k)}>
                          <td>
                            <b style={{ color: RARITY_COLOR[it.rarity] || undefined }} onClick={e => { e.stopPropagation(); openItem?.(it.id, it.uuid); }} className="link-like">
                              {it.n > 1 ? `${it.name.replace(PIECE, '')} · ${it.n} ${it.n < 5 ? 'части' : 'частей'}` : it.name}
                            </b>
                            <div className="muted tiny">{[cap(it.rarity), it.roleRu].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td><div className="gchips">{it.slots.map(x => <Chip key={x.slot} s={x} />)}</div></td>
                          {market && <td className="num">{done ? <span className="green">✓ максимум</span> : it.toP ? `~${coins(it.toP)}` : '—'}</td>}
                        </tr>
                        {open === k && <tr className="gdetail"><td colSpan={3}><Detail it={it} market={market} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted tiny gnote"><Rich text="Камни вставляет и снимает Gemstone Grinder у Geo в Dwarven Mines (Dwarven Village). Снять камень платно (Fine 10k, Flawless 100k, Perfect 500k), сам камень возвращается. Нажми на вещь — варианты Fine, Flawless и Perfect." /></p>
    </div>
  );
}
