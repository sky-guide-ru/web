import { DEC, LOCALE } from '../i18n.js';
import { useState, useEffect } from 'react';
import { Card, Stat, Sparkline, Progress, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, itemValue, num, ago, saveLocal, me, prettyId } from '../api.js';
import { useHiddenSteps } from '../hiddenSteps.js';
import { useApp } from '../App.jsx';
import { Rich } from '../guides/Rich.jsx';
import { pricesLoaded } from './Gear.jsx';
import PlayerModel from '../components/PlayerModel.jsx';
import GuildTag from '../components/GuildTag.jsx';
import LiveAdvisor from '../components/LiveAdvisor.jsx';
import { EventsStrip } from './Events.jsx';
import { ElectionLine } from '../components/Election.jsx';
import ShareCard from '../components/ShareCard.jsx';
import { Returning, Dailies } from '../components/Comeback.jsx';
import { useInterests, applyInterests } from '../interests.js';

const SKILL_ICON = { farming: 'golden_hoe', mining: 'stone_pickaxe', combat: 'stone_sword', foraging: 'jungle_sapling', fishing: 'fishing_rod', enchanting: 'enchanting_table', alchemy: 'brewing_stand', carpentry: 'crafting_table', runecrafting: 'magma_cream', taming: 'bone', social: 'emerald', hunting: 'lead' };
export { SKILL_ICON };

// Сколько осталось действовать зелью: зелья в SkyBlock тикают только в игре, поэтому это игровое время
const left = sec => {
  const h = Math.floor(sec / 3600), mn = Math.floor((sec % 3600) / 60);
  if (!h) return `${Math.max(1, Math.round(sec / 60))} мин`;
  return mn ? `${h} ч ${mn} мин` : `${h} ч`;
};

// Прибавка статов от действующих зелий и тортов Century Cake (выключенные и на паузе не считаем)
function buffTotals(ef) {
  const out = {};
  if (!ef) return out;
  const off = new Set(ef.disabled || []);
  for (const e of ef.active || []) if (!off.has(e.id)) for (const [k, v] of Object.entries(e.stats || {})) out[k] = (out[k] || 0) + v;
  for (const c of ef.cakes || []) if (c.amount && (!c.expireAt || c.expireAt > Date.now())) out[c.stat] = (out[c.stat] || 0) + c.amount;
  return out;
}

// Боевая сводка по данным профиля: лист статов, удар лучшим мечом, EHP. Зелья и торты — зелёной прибавкой; сетовые бонусы в API не видны
function PowerStrip({ p, effects }) {
  // Надет не боевой сет (фермерский, рыбацкий…) — показываем статы боевого набора из Wardrobe, иначе цифры занижены
  const c = p.combat && !p.combat.worn ? p.combat : null;
  const w = (c ? c.world : p.world) || {};
  const ehpN = c ? c.ehp?.world?.normal : p.ehp?.world?.normal;
  const weapon = c ? c.weapon : p.weapon;
  const r = v => num(Math.round(v || 0));
  const buff = buffTotals(effects);
  const off = new Set(effects?.disabled || []);
  // Бессрочные эффекты без статов (Night Vision от предмета) — шум, их не показываем
  const shown = (effects?.active || []).filter(e => !off.has(e.id) && !(e.infinite && !Object.keys(e.stats || {}).length));
  const cells = [
    ['Health', r(w.health), 'health'], ['Defense', r(w.defense), 'defense'], ['EHP', r(ehpN)],
    ['Strength', r(w.strength), 'strength'], ['Crit Damage', `${r(w.crit_damage)}%`, 'crit_damage'], ['Crit Chance', `${r(w.crit_chance)}%`, 'crit_chance'], ['Intelligence', r(w.intelligence), 'intelligence'],
  ];
  return (
    <div className="power-strip" title="Посчитано по данным профиля. Сетовые бонусы брони и мэры в API не видны, поэтому в игре цифры могут быть выше">
      <div className="power-cells">
        {cells.map(([k, v, key]) => (
          <div key={k} className="power-cell"><span className="muted tiny"><Rich text={k} /></span><b>{v}{buff[key] ? <span className="power-buff" title="От зелий и Century Cake, которые действуют сейчас">+{num(buff[key])}</span> : null}</b></div>
        ))}
      </div>
      {(shown.length > 0 || effects?.cakes?.length > 0) && (
        <div className="power-effects small" data-news="effects">
          {shown.map(e => (
            <span key={e.id} className="chip tiny" title={e.infinite ? 'Действует бессрочно' : 'Время идёт, только пока ты в игре'}>
              <Rich text={`${e.name} ${e.roman}`} />{e.infinite ? '' : ` · ${left(e.secLeft)}`}
            </span>
          ))}
          {(effects?.cakes || []).map(c => <span key={c.key} className="chip tiny" title="Бафф от Century Cake"><Rich text={`Century Cake: +${num(c.amount)} ${prettyId(c.stat)}`} /></span>)}
        </div>
      )}
      {c && <div className="muted small"><Rich text={`Посчитано для боя: ${c.short}. Сейчас надето другое.`} /></div>}
      {weapon && <div className="muted small"><Rich text={`Удар мечом ${weapon.name}: примерно ${num(weapon.hit.normal)}, с критом ${num(weapon.hit.crit)}.`} /></div>}
      <div className="muted tiny">Примерно: без сетовых бонусов брони. Зелёным — прибавка от зелий, которые действуют сейчас. EHP — сколько урона выдержишь с учётом Defense.</div>
    </div>
  );
}

// Профиль Hypixel из /player: Network Level, Achievement Points, с какого года на сервере и ссылки игрока
// Онлайн сейчас (/status, только свой профиль): остров SkyBlock или другая игра Hypixel. Не в сети — ничего
function OnlineBadge({ o }) {
  if (!o?.online) return null;
  const where = o.island || (o.game && o.game !== 'SKYBLOCK' ? prettyId(o.game.toLowerCase()) : null);
  return <span className="hero-online small" data-news="online" title="Hypixel показывает это, только если игрок не скрыл статус в настройках">{where ? `в игре: ${where}` : 'в игре'}</span>;
}

function HypixelLine({ h }) {
  if (!h) return null;
  const since = h.firstLogin ? new Date(h.firstLogin).getFullYear() : null;
  const parts = [`Network Level ${Math.floor(h.networkLevel)}`, h.achievementPoints ? `${num(h.achievementPoints)} Achievement Points` : null, since ? `на Hypixel с ${since} года` : null].filter(Boolean);
  return (
    <div className="muted small hero-hypixel">
      {parts.join(' · ')}
      {(h.socials || []).map(s => (s.url
        ? <a key={s.id} className="link" href={s.url} target="_blank" rel="noopener noreferrer nofollow"> · {prettyId(s.id.toLowerCase())}</a>
        : <span key={s.id}> · Discord: {s.name}</span>))}
    </div>
  );
}

export default function Overview({ state }) {
  const m = state.member;
  const a = state.analysis;
  const { openItem } = useApp();
  const [share, setShare] = useState(false);
  // Скрытые шаги: у вошедшего владельца — на сервере, у гостя — в этом браузере, в чужом плане скрывать нельзя
  const hs = useHiddenSteps(state);
  const { interests } = useInterests(); // «Нравится / Не хочу» из плана
  const [undo, setUndo] = useState(null); // только что скрытый шаг: «Отменить» несколько секунд
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 8000); return () => clearTimeout(t); }, [undo]);
  if (!m || !a) return <Empty>Профиль ещё не загружен.</Empty>;
  const nw = a.gear.networth;
  const nwHist = state.history.map(h => [h.t, h.nw]);
  // Шаги, скрытые на странице плана, на главной не показываем.
  // «✕» прямо на главной: шаг уходит, на его место встаёт следующий, а «Отменить» возвращает его
  const hideStep = (e, s) => {
    e.preventDefault(); e.stopPropagation();
    hs.hide(s.id);
    setUndo(s);
  };
  const visible = applyInterests(a.roadmap.filter(s => !hs.hidden[s.id]), interests);
  const top = visible.slice(0, 6);
  return (
    <div className="grid">
      <div className="hero card span-12">
        <PlayerModel uuid={m.uuid} className="hero-body" width={170} height={260} />
        <div className="hero-main">
          <div className="hero-level">
            <div className="lvl-ring" style={{ '--p': (m.sbLevel % 1) * 100 }}><span>{Math.floor(m.sbLevel)}</span></div>
            <div>
              <div className="muted small">Уровень SkyBlock</div>
              <div className="hero-title">{state.player.name} <span className="muted">на {m.profileName}</span> <OnlineBadge o={m.online} /></div>
              <div className="muted small">{Math.round((m.sbLevel % 1) * 100)}/100 опыта до {Math.floor(m.sbLevel) + 1} уровня</div>
              <HypixelLine h={m.hypixel} />
              {m.guild && (
                <div className="hero-guild small" data-news="guild">
                  <span className="muted">Гильдия</span>
                  <GuildTag tag={m.guild.tag} color={m.guild.tagColor} />
                  <b>{m.guild.name}</b>
                  <span className="muted">{[m.guild.rank, m.guild.joined && `с ${new Date(m.guild.joined).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}`, `уровень ${m.guild.level}`].filter(Boolean).join(' · ')}</span>
                </div>
              )}
            </div>
            <button className="btn ghost small share-btn" data-news="share" onClick={() => setShare(true)} title="Картинка с главными цифрами профиля, чтобы скинуть в Discord или ВК">Карточка для Discord</button>
          </div>
          <div className="stats-row">
            <Stat href="#/gear" title="Из чего складывается — на «Снаряжении»" label="Состояние" value={coins(nw.total)} sub={pricesLoaded(state) ? `оценка · предметы ${coins(nw.items)} · монеты ${coins(nw.coins)}` : `монеты ${coins(nw.coins)} · цены предметов ещё грузятся…`} accent="#f5c542" icon={<img src="/api/texture/gold_ingot" alt="" />} />
            <Stat href="#/accessories" title="Как поднять — на «Аксессуарах»" label="Magical Power" value={num(m.magicalPower)} sub={m.selectedPower ? `сила: ${prettyId(m.selectedPower)}` : 'сила не выбрана'} accent="#c879ff" icon={<img src="/api/texture/ender_eye" alt="" />} />
            <Stat href="#/skills" title="Классы и этажи — на «Прогрессе»" label="Catacombs" value={m.dungeons.catacombs.level} sub={`классы ~${m.dungeons.classAverage.toFixed(1).replace('.', DEC)}`} accent="#ff5e5e" icon={<img src="/api/texture/bone" alt="" />} />
            <Stat href="#/skills" title="Все скиллы — на «Прогрессе»" label="Skill Average" value={m.skillAverage.toFixed(1).replace('.', DEC)} sub="9 основных скиллов" accent="#4ade80" icon={<img src="/api/texture/experience_bottle" alt="" />} />
            <Stat href="#/money" title={m.coopMembers > 1 ? 'Общий Bank кооп-острова. Как заработать — на «Заработке»' : 'Как заработать — на «Заработке»'} label={m.coopMembers > 1 ? 'Bank коопа' : 'Bank'} value={coins(m.bank)} sub={m.personalBank >= 1000 ? `кошелёк ${coins(m.purse)} · личный ${coins(m.personalBank)}` : `кошелёк ${coins(m.purse)}`} accent="#60a5fa" icon={<img src="/api/texture/gold_block" alt="" />} />
          </div>
        </div>
      </div>

      {share && <ShareCard name={state.player.name} member={m} analysis={a} onClose={() => setShare(false)} />}
      <EventsStrip className="span-12" />
      <ElectionLine className="span-12" />
      <Returning info={a.returning} steps={visible} />
      <Dailies d={a.dailies} />

      {!me.guest && <LiveAdvisor className="span-12" />}

      <Card title="Что делать прямо сейчас" className="span-8" news="now" right={<a href="#/roadmap" className="link">весь план →</a>}>
        {a.power && <PowerStrip p={a.power} effects={m.effects} />}
        <div className="next-steps">
          {undo && (
            <div className="step-undo small" role="status">
              <span>Шаг «{undo.title}» скрыт{hs.mode === 'local' ? ' (только в этом браузере)' : ''}.</span>
              <button className="chip tiny" onClick={() => { hs.unhide(undo.id); setUndo(null); }}>Отменить</button>
            </div>
          )}
          {hs.error && <div className="step-undo small warn" role="alert">{hs.error}</div>}
          {top.map((s, i) => (
            <a key={s.id} href={`#/roadmap/${encodeURIComponent(s.id)}`} className="next-step" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="step-num">{i + 1}</div>
              <div className="step-body">
                <div className="step-cat">{s.cat} · {s.effort}</div>
                <div className="step-title">{s.title}</div>
                <div className="muted small"><Rich text={s.why} /></div>
                {s.calc && <div className="step-calc small"><Rich text={s.calc} /></div>}
              </div>
              {s.items?.[0] && <ItemIcon id={s.items[0]} size={44} />}
              {hs.mode !== 'none' && <button className="step-done" title={hs.mode === 'local' ? 'Скрыть шаг (только в этом браузере)' : 'Скрыть шаг'} aria-label="Скрыть шаг" onClick={e => hideStep(e, s)}>✕</button>}
            </a>
          ))}
        </div>
      </Card>

      <Card title="Живая лента" className="span-4 feed-card" news="feed">
        {state.feed.length ? (
          <ul className="feed">
            {state.feed.slice(0, 30).map((e, i) => <li key={i} className={`feed-${e.kind}`}><span>{e.text}</span><time>{ago(e.t)}</time></li>)}
          </ul>
        ) : (
          <div className="feed-empty">
            <div className="radar"><span /><span /><img src="/api/texture/ender_eye" alt="" /></div>
            <div>Слежу за профилем. Как только ты что-то сделаешь в игре, изменения появятся здесь.</div>
            <div className="muted tiny">Hypixel обновляет данные раз в 1–3 минуты</div>
          </div>
        )}
      </Card>

      <Card title="Skills" className="span-6" right={<a href="#/skills" className="link">подробнее →</a>}>
        <div className="skill-mini">
          {Object.entries(m.skills).filter(([k]) => k !== 'social').map(([k, s]) => (
            <div key={k} className="skill-mini-row">
              <img src={`/api/texture/${SKILL_ICON[k]}`} alt="" className={s.level >= s.maxLevel ? 'maxed' : ''} />
              <div className="grow"><Progress value={s.progress} max={s.level >= s.maxLevel} label={`${s.name} ${s.level}`} sub={s.level >= s.maxLevel ? (s.capMax ? `кап → ${s.capMax}` : 'МАКС') : `${Math.round(s.progress * 100)}%`} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Состояние за время отслеживания" className="span-6" right={<a href="#/skills/history" className="link">все графики →</a>}>
        <Sparkline points={nwHist} color="#f5c542" format={coins} />
        <div className="mini-stats">
          <div><span className="muted small">Самые ценные предметы</span></div>
          <div className="item-row">
            {a.gear.topItems.slice(0, 10).map((it, i) => (
              <div key={i} className="item-with-price" onClick={() => openItem(it.id, it.uuid)}>
                <ItemIcon item={it} size={42} slot />
                <span className="small" title={it.value > 0 ? '' : 'Цена неизвестна: нет на Bazaar/AH или аукцион ещё сканируется'}>{itemValue(it.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
