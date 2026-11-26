import { DEC, EN } from '../i18n.js';
// Нижние блоки «Прогресса»: шоколадная фабрика, эксперименты, аукцион, Hunting, Garden, Galatea, кооператив и рекорды.
// Данные готовит сервер (server/parse/extras-view.js): названия вместо сырых ID, ID для иконок, максимумы.
import { useState, Fragment } from 'react';
import { Card, Progress } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { useApp } from '../App.jsx';
import { Rich } from '../guides/Rich.jsx';
import { num, coins, plural, RARITY_COLOR } from '../api.js';

const SLAYER_RU = { zombie: 'Revenant Horror', spider: 'Tarantula Broodfather', wolf: 'Sven Packmaster', enderman: 'Voidgloom Seraph', blaze: 'Inferno Demonlord', vampire: 'Riftstalker Bloodfiend' };
const SLAYER_ICON = { zombie: 'REVENANT_FLESH', spider: 'TARANTULA_WEB', wolf: 'WOLF_TOOTH', enderman: 'NULL_SPHERE', blaze: 'DERELICT_ASHE', vampire: 'COVEN_SEAL' };
const fmtTime = ms => (ms ? `${(ms / 1000).toFixed(1).replace('.', DEC)} с` : '—');
const title = s => String(s || '').toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const MAXED = 'linear-gradient(90deg,#f5c542,#ffdf7e,#f5c542)';

// Маленькая плитка «иконка + подпись + значение»
function Tile({ icon, label, value, sub, tone, title: tip }) {
  const { openItem } = useApp();
  return (
    <div className={`ex-tile ${tone ? `tone-${tone}` : ''}`} title={tip}>
      {icon && <ItemIcon id={icon} size={34} onClick={() => openItem(icon)} />}
      <div className="ex-tile-body">
        <div className="ex-tile-label">{label}</div>
        <div className="ex-tile-value">{value}</div>
        {sub && <div className="ex-tile-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Section({ children, right }) {
  return <div className="ex-sec"><span>{children}</span>{right}</div>;
}

function Chocolate({ ch, view, advice }) {
  const tt = view?.max?.timeTower || 15;
  // Советы считают сотрудников по тем же данным, что и плитки; без советов — вид с сервера
  const emps = advice?.employees?.filter(e => e.hired).map(e => ({ id: e.key, name: e.name, level: e.level })) || view?.employees || [];
  return (
    <Card title="Chocolate Factory" icon={<ItemIcon id="PRESTIGE_CHOCOLATE_REALM" size={22} />} className="span-6 ex-card ex-choco">
      <div className="ex-tiles">
        <Tile icon="PRESTIGE_CHOCOLATE_REALM" label="Престиж" value={advice ? <>{ch.prestige}<span className="muted small">/{advice.maxPrestige} · {String(advice.mult).replace('.', DEC)}×</span></> : ch.prestige} sub={advice ? `кроликов найдено: ${num(ch.rabbits)} из ${num(advice.rabbits.total)}` : `кроликов найдено: ${num(ch.rabbits)}`} tone="gold" />
        <Tile icon="SUPREME_CHOCOLATE_BAR" label="Chocolate сейчас" value={coins(ch.chocolate)} sub={`за всё время ${coins(ch.total)}`} />
      </div>
      <div className="ex-bar-row">
        <span>Time Tower</span>
        <Progress value={ch.timeTower / tt} max={ch.timeTower >= tt} />
        <b>{ch.timeTower}<span className="muted">/{tt}</span></b>
      </div>
      <div className="ex-kv">
        {ch.sincePrestige > 0 && <><span>Chocolate с последнего престижа</span><b>{coins(ch.sincePrestige)}</b></>}
        {ch.barn > 0 && <><span>Rabbit Barn (вместимость)</span><b>ур. {ch.barn}</b></>}
        {ch.clickUpgrades > 0 && <><span>Hand-Baked Chocolate (клик)</span><b>ур. {ch.clickUpgrades}</b></>}
      </div>
      {emps.length > 0 && <>
        <Section right={advice?.maxedEmployees ? <span className="ex-note gold">все на капе {advice.cap}</span> : emps.every(e => e.level === emps[0].level) && <span className="ex-note">все на {emps[0].level} ур.{advice ? ` из ${advice.cap}` : ''}</span>}>Сотрудники-кролики</Section>
        <div className="ex-emps">
          {emps.map(e => (
            <div key={e.id} className={`ex-emp ${advice && e.level >= advice.cap ? 'full' : ''}`} title={advice ? `${e.name}: ${e.level} из ${advice.cap}` : e.name}>
              <small>{e.name.replace(/^Rabbit /, '')}</small>
              <b>{e.level}</b>
            </div>
          ))}
        </div>
      </>}
      {advice?.tips?.length > 0 && <ChocoTips advice={advice} />}
    </Card>
  );
}

// Что делать дальше на фабрике: сервер (analysis/chocolate.js) уже отсортировал по важности
function ChocoTips({ advice }) {
  const [all, setAll] = useState(false);
  const tips = all ? advice.tips : advice.tips.slice(0, 4);
  return <>
    <Section right={advice.tips.length > 4 && <button className="ex-more" onClick={() => setAll(!all)}>{all ? 'свернуть' : `ещё ${advice.tips.length - 4}`}</button>}>Что делать дальше</Section>
    <ol className="ex-tips">
      {tips.map(t => (
        <li key={t.id} className={t.prio >= 85 ? 'hot' : ''}>
          <b><Rich text={t.title} /></b>
          <span><Rich text={t.text} /></span>
        </li>
      ))}
    </ol>
    {advice.residents?.byIsland?.length > 0 && <details className="ex-eggs ex-res">
      <summary>Rabbits-резиденты: найдено {advice.residents.found} из {advice.residents.total}</summary>
      <div className="ex-res-list">
        {advice.residents.byIsland.map(r => (
          <div key={r.island} className={`ex-res-row ${r.missing.length ? '' : 'full'}`}>
            <span className="ex-res-isl">{r.islandRu}</span>
            <b className="ex-res-n">{r.found.length}<span className="muted">/{r.found.length + r.missing.length}</span></b>
            <span className="ex-res-names">
              {r.missing.map(n => <span key={n} className="ex-res-chip">{n}</span>)}
              {r.found.map(n => <span key={n} className="ex-res-chip got" title="уже найден">✓ {n}</span>)}
            </span>
          </div>
        ))}
      </div>
    </details>}
    {advice.eggs && <details className="ex-eggs">
      <summary>Места яиц Hoppity: не собрано на {advice.eggs.length} {plural(advice.eggs.length, 'острове', 'островах', 'островах')}</summary>
      <div className="ex-kv">{advice.eggs.map(e => <Fragment key={e.island}><span>{e.islandRu}</span><b>{e.missing} из {e.total}</b></Fragment>)}</div>
    </details>}
    <a className="link small ex-guide-link" href="#/guides/chocolate">Гайд по фабрике: престиж, Time Tower, вехи, яйца Hoppity →</a>
  </>;
}

function ExperimentsAuction({ x }) {
  const a = x.auctions;
  const net = a ? a.earned - a.spent : 0;
  return (
    <Card title="Эксперименты и аукцион" icon={<ItemIcon id="EXPERIMENTATION_TABLE" size={22} />} className="span-6 ex-card">
      <Section>Лучшие результаты в Experimentation Table</Section>
      <div className="ex-exp">
        {[['Superpairs', x.experiments.superpairs], ['Chronomatron', x.experiments.chronomatron], ['Ultrasequencer', x.experiments.ultrasequencer]].map(([n, v]) => (
          <div key={n} className={`ex-exp-cell ${v ? '' : 'zero'}`}><small>{n}</small><b>{v || '—'}</b></div>
        ))}
      </div>
      {a && <>
        <Section>Auction House за всё время</Section>
        <div className="ex-tiles">
          <Tile icon="GOLD_INGOT" label="Продано лотов" value={num(a.sold)} sub={`заработано ${coins(a.earned)}`} tone="green" />
          <Tile icon="ENCHANTED_GOLD_BLOCK" label="Выиграно лотов" value={num(a.won)} sub={`потрачено ${coins(a.spent)}`} tone="red" />
        </div>
        <div className="ex-kv">
          <span>Итог торговли</span><b className={net >= 0 ? 'pos' : 'neg'}>{net >= 0 ? '+' : '−'}{coins(Math.abs(net))}</b>
          <span>Самая большая ставка</span><b>{coins(a.highestBid)}</b>
          {a.fees > 0 && <><span>Комиссии</span><b>{coins(a.fees)}</b></>}
        </div>
      </>}
    </Card>
  );
}

function Hunting({ x, view }) {
  const { openItem } = useApp();
  const [all, setAll] = useState(false);
  const attrs = view?.attributes || [];
  const shown = all ? attrs : attrs.slice(0, 12);
  const maxed = attrs.filter(a => a.max && a.n >= a.max).length;
  const h = x.shardHunts;
  const hunts = [['Fishing', h.fishing, 'FISHING_ROD'], ['Combat', h.combat, 'DIAMOND_SWORD'], ['Foraging', h.forest, 'JUNGLE_AXE'], ['Ловушки', h.trap, 'LEASH'], ['Соль', h.salt, 'SUGAR']].filter(([, v], i) => i < 3 || v);
  return (
    <Card title="Hunting: атрибуты и осколки" icon={<ItemIcon id="LEASH" size={22} />} className="span-12 ex-card">
      <div className="ex-hunts">
        {hunts.map(([n, v, ic]) => <Tile key={n} icon={ic} label={`Охоты: ${n.toLowerCase()}`} value={num(v)} />)}
      </div>
      {attrs.length > 0 && <>
        <Section right={<span className="ex-note">{attrs.length} {plural(attrs.length, 'атрибут', 'атрибута', 'атрибутов')}, на максимуме {maxed}</span>}>Атрибуты</Section>
        <div className="ex-attrs">
          {shown.map(a => {
            const full = a.max && a.n >= a.max;
            return (
              <div key={a.id} className={`ex-attr ${full ? 'full' : ''}`} style={{ '--r': RARITY_COLOR[a.rarity] || '#8b90b0' }} title={a.effect ? `${a.name} (ур. I): ${(EN && a.effectEn) || a.effect}` : a.name}>
                {a.shardId ? <ItemIcon id={a.shardId} size={32} onClick={() => openItem(a.shardId)} /> : <span className="ex-attr-ph" />}
                <div className="grow">
                  <div className="ex-attr-head"><b>{a.name}</b><span>{a.n}{a.max && <span className="muted">/{a.max}</span>}</span></div>
                  {a.max ? <Progress value={a.n / a.max} max={full} color="var(--r)" /> : null}
                  {a.shard && <div className="tiny muted">осколок {a.shard}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {attrs.length > 12 && <button className="chip ex-more" onClick={() => setAll(v => !v)}>{all ? 'Свернуть' : `Показать все ${attrs.length}`}</button>}
        <a className="link small ex-guide-link" href="#/guides/hunting">Гайд по Hunting: что качать, где брать осколки →</a>
      </>}
      {view?.shards?.length > 0 && <>
        <Section right={<span className="ex-note">{num(view.shards.reduce((s, x) => s + x.owned, 0))} шт.</span>}>Осколки в Hunting Box</Section>
        <div className="ex-shards">
          {view.shards.map(s => (
            <div key={s.type} className="ex-shard" style={{ '--r': RARITY_COLOR[s.rarity] || '#8b90b0' }} title={s.attribute ? `Атрибут: ${s.attribute}` : s.name}>
              {s.shardId && <ItemIcon id={s.shardId} size={26} onClick={() => openItem(s.shardId)} />}
              <span>{s.name}</span><b>×{num(s.owned)}</b>
            </div>
          ))}
        </div>
      </>}
    </Card>
  );
}

function Garden({ m, x, view }) {
  const { openItem } = useApp();
  const gd = m.garden || {};
  const gl = view?.gardenLevel;
  const plots = view?.max?.plots || 24;
  return (
    <Card title="Garden" icon={<ItemIcon id="GARDEN_SCYTHE" size={22} />} className="span-6 ex-card">
      <div className="ex-tiles">
        {gl && <Tile icon="WHEAT" label="Garden Level" value={gl.level >= gl.max ? <>{gl.level} <span className="max-badge">МАКС</span></> : `${gl.level}/${gl.max}`} sub={gl.level >= gl.max ? `${num(gd.experience)} опыта` : `до след. ${num(gl.toNext)} опыта`} tone="green" />}
        <Tile icon="COMPOST" label="Компостер" value={`${num(gd.composterData?.organic)} / ${num(gd.composterData?.fuel)}`} sub="органика / топливо" />
      </div>
      <div className="ex-bar-row">
        <span>Участки</span>
        <Progress value={(gd.unlockedPlots || 0) / plots} max={gd.unlockedPlots >= plots} color="linear-gradient(90deg,#4ade80,#22d3ee)" />
        <b>{gd.unlockedPlots || 0}<span className="muted">/{plots}</span></b>
      </div>
      {view?.greenhouse?.length > 0 && <div className="ex-pills">
        <span className="muted small">Теплица:</span>
        {view.greenhouse.map(u => <span key={u.key} className="ex-pill">{u.name} <b>{u.level}</b></span>)}
      </div>}
      {view?.chips?.length > 0 && <>
        <Section right={<span className="ex-note">{view.chips.filter(c => c.level >= c.max).length} из {view.chips.length} на макс.</span>}>Garden Chips</Section>
        <div className="ex-chips">
          {view.chips.map(c => (
            <div key={c.key} className={`ex-chip ${c.level >= c.max ? 'full' : ''}`}>
              {c.id && <ItemIcon id={c.id} size={26} onClick={() => openItem(c.id)} />}
              <div className="grow">
                <div className="ex-attr-head"><b>{c.name}</b><span>{c.level}<span className="muted">/{c.max}</span></span></div>
                <Progress value={c.level / c.max} max={c.level >= c.max} color="linear-gradient(90deg,#22d3ee,#7c5cff)" />
              </div>
            </div>
          ))}
        </div>
      </>}
      {view?.visitors?.length > 0 && <>
        <Section right={<span className="ex-note">{view.visitors.length} {plural(view.visitors.length, 'гость', 'гостя', 'Visitors')}</span>}>Visitors в Garden сейчас</Section>
        <div className="ex-visitors">
          {view.visitors.map(v => (
            <div key={v.npc} className="ex-visitor">
              {v.npcId ? <ItemIcon id={v.npcId} size={30} /> : <span className="ex-attr-ph" />}
              <b>{v.name}</b>
              <div className="ex-wants">
                {v.items.map(i => (
                  <span key={i.id} className="ex-want" title={i.name}>
                    <ItemIcon id={i.id} size={22} onClick={() => openItem(i.id)} /><b>{num(i.amount)}</b> <span className="muted">{i.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>}
    </Card>
  );
}

function IslandCoop({ x, view }) {
  const { openItem } = useApp();
  return (
    <Card title="Galatea и кооператив" icon={<ItemIcon id="FIG_LOG" size={22} />} className="span-6 ex-card">
      {view?.treeGifts?.length > 0 && <>
        <Section>Подарки деревьев (Galatea)</Section>
        <div className="ex-tiles">
          {view.treeGifts.map(t => <Tile key={t.key} icon={t.id} label={`${t.name}: подарков`} value={num(t.n)} tone="green" />)}
        </div>
      </>}
      {view?.community?.length > 0 && <>
        <Section>Улучшения кооператива</Section>
        <div className="ex-coop">
          {view.community.map(u => (
            <div key={u.key} className="ex-bar-row">
              <span>{u.name}</span>
              {u.max ? <Progress value={u.level / u.max} max={u.level >= u.max} color="linear-gradient(90deg,#a78bfa,#7c5cff)" /> : <span />}
              <b>{u.level}{u.max && <span className="muted">/{u.max}</span>}</b>
            </div>
          ))}
        </div>
      </>}
      {x.harpSong && <div className="muted small" style={{ marginTop: 10 }}>Выбранная мелодия арфы: {title(x.harpSong)}</div>}
    </Card>
  );
}

function Records({ x }) {
  const r = x.races || {};
  const tiles = [
    ['DIAMOND_SWORD', 'Макс. урон за удар', num(x.highestDamage)],
    x.activeSlayer && [SLAYER_ICON[x.activeSlayer.type] || 'REVENANT_FLESH', 'Активный квест слеера', `${SLAYER_RU[x.activeSlayer.type] || title(x.activeSlayer.type)} T${x.activeSlayer.tier}`],
    x.mythos && ['GRIFFIN_FEATHER', 'Diana (Mythological)', `${num(x.mythos.kills)} мобов`, `${num(x.mythos.burrows)} нор${x.mythos.chains ? `, цепочек ${num(x.mythos.chains)}` : ''}`],
    ['SKYBLOCK_MENU', 'Задания SkyBlock-уровня', num(x.leveling.tasksDone), x.leveling.symbol ? `символ: ${title(x.leveling.symbol)}` : null],
    ['SOULFLOW', 'Soulflow', num(x.soulflow)],
    x.gifts && ['WHITE_GIFT', 'Подарки', `${num(x.gifts.total_received || 0)} / ${num(x.gifts.total_given || 0)}`, 'получено / отдано'],
    ['SKULL_ITEM', 'Смертей', num(x.deaths), `посещено зон: ${num(x.zones)}`],
    x.dragons != null && ['DRAGON_EGG', 'Драконов призвано', num(typeof x.dragons === 'object' ? x.dragons.total : x.dragons), `особый лут зилотов: ${num(x.zealotLoot)}`],
    ['ABIPHONE_XII_MEGA', 'Абифон: контактов', num(x.abiphone)],
    ['HEAVY_PEARL', 'Жемчуг Matriarch', num(x.matriarchPearls)],
    ['TRAPPER_CREST', 'Trapper: шкур', num(x.trapperPelts)],
  ].filter(Boolean);
  const races = [['End', r.end_race_best_time], ['Rift', r.rift_race_best_time], ['Foraging', r.foraging_race_best_time]].filter(([, v]) => v);
  return (
    <Card title="Рекорды и статистика" icon={<ItemIcon id="NETHER_STAR" size={22} />} className="span-12 ex-card">
      <div className="ex-records">
        {tiles.map(([ic, l, v, s]) => <Tile key={l} icon={ic} label={l} value={v} sub={s} />)}
        {races.length > 0 && <Tile icon="FEATHER" label="Лучшие гонки" value={races.map(([n, v]) => `${n} ${fmtTime(v)}`).join(' · ')} />}
      </div>
    </Card>
  );
}

export default function ProgressExtras({ m, advice }) {
  const x = m.extras;
  const view = x.view;
  return (
    <>
      {x.chocolate ? <Chocolate ch={x.chocolate} view={view} advice={advice} /> : null}
      <ExperimentsAuction x={x} />
      <Hunting x={x} view={view} />
      <Garden m={m} x={x} view={view} />
      <IslandCoop x={x} view={view} />
      <Records x={x} />
    </>
  );
}
