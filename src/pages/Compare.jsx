import { DEC } from '../i18n.js';
// Сравнение профилей: до 4 игроков рядом — скиллы, слееры, данжи, состояние, снаряжение, аксессуары.
// Игроки — свой профиль, избранные, любой ник (владельцу — ещё аккаунты сайта). Выбор хранится в адресе (#/compare/Steve,Alex:Apple) и в браузере.
import { useEffect, useMemo, useState } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { api, coins, num, me, getFavorites, saveLocal, ago, friendlyError, setView, prettyId, getView } from '../api.js';
import { useApp } from '../App.jsx';
import { SKILL_ICON } from './Overview.jsx';

const KEY = 'sb-compare';
const MAX = 4;
const COLORS = ['#7c5cff', '#22d3ee', '#f5c542', '#f472b6'];
const SLAYER_ICON = { zombie: 'rotten_flesh', spider: 'string', wolf: 'mutton', enderman: 'ender_pearl', blaze: 'blaze_rod', vampire: 'redstone' };
const CLASS_ICON = { healer: 'potion', mage: 'blaze_rod', berserk: 'iron_sword', archer: 'bow', tank: 'leather_chestplate' };
const KUUDRA = [['basic', 'Basic'], ['hot', 'Hot'], ['burning', 'Burning'], ['fiery', 'Fiery'], ['infernal', 'Infernal']];

const enc = list => list.map(p => (p.profile ? `${p.player}:${p.profile}` : p.player)).join(',');
const dec = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, MAX).map(x => { const [player, profile = ''] = x.split(':'); return { player, profile }; });
const same = (a, b) => a.player.toLowerCase() === b.player.toLowerCase() && (a.profile || '').toLowerCase() === (b.profile || '').toLowerCase();

function initial(sub) {
  const fromHash = dec(decodeURIComponent(sub || ''));
  if (fromHash.length) return fromHash;
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(s) && s.length) return s.slice(0, MAX); } catch { /* */ }
  // открыт чей-то профиль (гость по нику, ?player=) — с него и начинаем, а не с пустого «Добавь игроков»
  const v = getView();
  if (!me.name && v?.player) return [{ player: v.player, profile: v.profile || '' }];
  if (!me.name) return []; // гость без ника начинает с пустого сравнения
  const mine = { player: me.name, profile: me.profile || '' };
  return [mine, ...getFavorites().filter(f => f.player.toLowerCase() !== mine.player.toLowerCase())].slice(0, 3);
}

const Head = ({ who, size = 32 }) => (
  <img key={who || ''} className="cmp-head" width={size} height={size} src={`/api/head/${encodeURIComponent(who || 'MHF_Steve')}?size=${size * 2}`} alt="" onError={e => e.currentTarget.classList.add('broken')} />
);

export default function Compare({ sub }) {
  const { openItem } = useApp();
  const [list, setList] = useState(() => initial(sub));
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const [coopMates, setCoopMates] = useState([]); // соседи по коопу открытого профиля — в «Быстро добавить»
  useEffect(() => { if (me.admin && !me.guest) api('/me').then(r => setUsers(r.users || [])).catch(() => {}); }, []);
  useEffect(() => { if (!me.guest) api('/coop').then(r => setCoopMates((r.members || []).map(c => ({ player: c.name || c.uuid, profile: r.profile || '', coop: true })))).catch(() => {}); }, []);
  // Перешли по ссылке «Сравнить с коопом», когда сравнение уже открыто: берём игроков из нового адреса
  useEffect(() => { const next = dec(decodeURIComponent(sub || '')); if (next.length && enc(next) !== enc(list)) setList(next); }, [sub]);
  useEffect(() => {
    saveLocal(KEY, JSON.stringify(list));
    const want = list.length ? `#/compare/${encodeURIComponent(enc(list))}` : '#/compare';
    if (location.hash !== want) history.replaceState(history.state, '', want);
    if (!list.length) { setData(null); return; }
    let alive = true;
    setLoading(true); setErr(null);
    const load = () => api(`/compare?${list.map(p => `p=${encodeURIComponent(`${p.player}/${p.profile || ''}`)}`).join('&')}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { if (alive) { setErr(e.message); setLoading(false); } });
    load();
    const t = setInterval(load, 90_000); // профили обновляются раз в 1–3 минуты
    return () => { alive = false; clearInterval(t); };
  }, [enc(list)]);

  const [note, setNote] = useState('');
  const add = p => {
    if (!p?.player) return;
    // Раньше дубль или пятый игрок молча игнорировались: человек жал «Добавить» и не понимал, почему ничего не происходит
    if (list.some(x => same(x, p))) { setNote(`${p.player}${p.profile ? ` · ${p.profile}` : ''} уже в сравнении`); return; }
    if (list.length >= MAX) { setNote(`Сравнить можно до ${MAX} профилей: убери кого-нибудь ✕`); return; }
    setList([...list, p]); setName(''); setNote('');
  };
  const remove = i => setList(list.filter((_, j) => j !== i));
  const submit = e => { e.preventDefault(); const [player, profile] = name.trim().split(/[\s/:]+/); add({ player, profile: profile || '' }); };

  const suggestions = useMemo(() => {
    const out = [];
    const push = p => { if (p.player && !list.some(x => x.player.toLowerCase() === p.player.toLowerCase()) && !out.some(x => x.player.toLowerCase() === p.player.toLowerCase())) out.push(p); };
    coopMates.forEach(push);
    users.forEach(u => push({ player: u.name, profile: u.profile || '', site: true }));
    if (me.name) push({ player: me.name, profile: me.profile || '' });
    getFavorites().forEach(push);
    return out.slice(0, 8);
  }, [users, coopMates, enc(list)]);

  const rows = data?.players || [];
  const ok = rows.filter(r => !r.error);

  return (
    <div className="grid">
      <Card title="Сравнение профилей" className="span-12" right={loading && data ? <span className="muted small"><span className="spinner sm" /> обновляю…</span> : data ? <span className="muted small">данные {ago(data.at)}</span> : null}>
        <div className="cmp-pick">
          {list.map((p, i) => (
            <div key={`${p.player}/${p.profile}`} className="cmp-chip" style={{ '--c': COLORS[i] }}>
              <Head who={p.player} size={22} />
              <b>{p.player}</b>{p.profile && <span className="muted">· {p.profile}</span>}
              <button className="x-btn sm" onClick={() => remove(i)} aria-label={`Убрать ${p.player}`} title="Убрать">×</button>
            </div>
          ))}
          {list.length < MAX && (
            <form onSubmit={submit} className="cmp-add">
              <input value={name} onChange={e => { setName(e.target.value); setNote(''); }} placeholder="Ник (можно с профилем)" maxLength={60} spellCheck={false} autoComplete="off" />
              <button className="btn" disabled={!name.trim()}>Добавить</button>
            </form>
          )}
        </div>
        {list.length < MAX && suggestions.length > 0 && (
          <div className="cmp-sugg">
            <span className="muted small">Быстро добавить:</span>
            {suggestions.map(s => (
              <button key={s.player} className="ps-chip" onClick={() => add(s)} title={s.coop ? 'Сосед по кооп-острову' : s.site ? 'Есть аккаунт на сайте' : 'Из избранного'}>
                <Head who={s.player} size={16} /> {s.coop && /^[0-9a-f]{32}$/i.test(s.player) ? `${s.player.slice(0, 8)}…` : s.player}{s.profile ? ` · ${s.profile}` : ''}{s.coop && <span className="cmp-coop-tag">кооп</span>}
              </button>
            ))}
          </div>
        )}
        {note && <div className="small" role="status" style={{ marginTop: 8, color: 'var(--gold)' }}>{note}</div>}
        <div className="tiny muted" style={{ marginTop: 8 }}>Лучшее значение в строке подсвечено. Bank, Garden и миньоны у кооп-соседей общие.</div>
      </Card>

      {coopGroups(ok).map(g => (
        <div key={g.profileId} className="card span-12 cmp-coop-note" role="note">
          <span className="cmp-coop-ico" aria-hidden>🤝</span>
          <div>
            <b>{g.players.map(p => p.player.name).join(' и ')}</b> играют на одном кооп-острове <b>{g.players[0].profile}</b>.
            {' '}Bank, Garden, миньоны и тиры коллекций у них общие, поэтому эти строки помечены «общее» и не соревнуются, а Networth посчитан с банком, поделённым поровну.
            {' '}Кто сколько насобирал сам — в строке «Вклад в коллекции».
          </div>
        </div>
      ))}

      {err && <div className="card warn-card span-12">Не удалось загрузить сравнение: {friendlyError(err)}</div>}
      {rows.filter(r => r.error).map(r => (
        <div key={r.query?.player} className="card warn-card span-12"><b>{r.query?.player}{r.query?.profile ? ` · ${r.query.profile}` : ''}:</b> {friendlyError(r.error)}</div>
      ))}

      {!list.length && <div className="span-12"><Empty>Добавь игроков, чтобы сравнить их профили.</Empty></div>}
      {list.length > 0 && !data && !err && (
        <div className="span-12 skeleton-page"><div className="sk sk-hero" /><div className="muted small sk-note"><div className="spinner" />Загружаю профили…</div></div>
      )}
      {ok.length > 0 && <CompareTable players={ok} openItem={openItem} colorOf={p => COLORS[list.findIndex(x => x.player.toLowerCase() === p.player.name?.toLowerCase())] || COLORS[0]} />}
    </div>
  );
}

/** Кооп-группы среди сравниваемых: игроки с одним profileId (один остров) */
export function coopGroups(players) {
  const by = new Map();
  for (const p of players) if (p.profileId && p.coop > 1) by.set(p.profileId, [...(by.get(p.profileId) || []), p]);
  return [...by.entries()].filter(([, ps]) => ps.length > 1).map(([profileId, ps]) => ({ profileId, players: ps }));
}

/**
 * Состояние для сравнения. Bank кооп-острова входит в состояние каждого соседа; если соседи сравниваются
 * между собой, Bank делим поровну, иначе у каждого «лишние» миллиарды соседа.
 */
export function comparableNetworth(p, grouped) {
  const total = p.networth?.total;
  if (total == null) return null;
  if (!grouped || !(p.coop > 1) || !p.bank) return total;
  return Math.round(total - p.bank + p.bank / p.coop);
}

/** Строка таблицы: get(p) → число; лучшее подсвечивается */
function Row({ label, icon, players, get, fmt = num, sub, higher = true, bar, shared }) {
  const vals = players.map(p => { try { return get(p); } catch { return null; } });
  const nums = vals.filter(v => typeof v === 'number' && Number.isFinite(v));
  const best = nums.length > 1 && new Set(nums).size > 1 ? (higher ? Math.max(...nums) : Math.min(...nums)) : null;
  return (
    <tr>
      <th>{icon && <img src={`/api/texture/${icon}`} alt="" className="cmp-ico" />}{label}</th>
      {players.map((p, i) => {
        const v = vals[i];
        const isBest = best != null && v === best;
        return (
          <td key={i} className={isBest ? 'best' : ''}>
            <span className="cmp-val">{v == null ? '—' : fmt(v, p)}{isBest && <span className="cmp-crown" title="Лучше всех">♛</span>}</span>
            {bar && v != null && <span className="cmp-bar"><i style={{ width: `${Math.max(2, Math.min(100, bar(p) * 100))}%` }} /></span>}
            {sub && <span className="tiny muted cmp-sub">{sub(p)}</span>}
            {shared?.(p) && <span className="cmp-shared" title={`Общее на кооп-острове с ${shared(p)}`}>общее с {shared(p)}</span>}
          </td>
        );
      })}
    </tr>
  );
}

const Section = ({ title, players, children }) => (
  <>
    <tr className="cmp-sec"><td colSpan={players.length + 1}>{title}</td></tr>
    {children}
  </>
);

function CompareTable({ players, openItem, colorOf }) {
  // Соседи по коопу среди сравниваемых: общие строки помечаем, Bank в состоянии делим
  const groups = coopGroups(players);
  const mateOf = new Map(groups.flatMap(g => g.players.map(p => [p, g.players.filter(x => x !== p)])));
  const shared = p => mateOf.get(p)?.map(x => x.player.name).join(', ') || null;
  const nw = p => comparableNetworth(p, mateOf.has(p));
  const anyCoop = players.some(p => p.coop > 1 && p.coopShare != null);
  // Кто впереди: сколько строк выиграл каждый (по ключевым показателям)
  const KEYS = [p => p.sbLevel, nw, p => p.skillAverage, p => p.accessories.mp, p => p.dungeons.level, p => p.dungeons.classAverage,
    ...['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'].map(k => p => p.slayers[k]?.xp), p => p.mining.hotm, p => p.fairySouls, p => p.pets.count, p => (p.museum?.status === 'ok' ? p.museum.xp : null)];
  const wins = players.map(() => 0);
  for (const k of KEYS) {
    const v = players.map(p => { try { return k(p) ?? null; } catch { return null; } });
    const m = Math.max(...v.filter(x => x != null));
    if (v.filter(x => x === m).length === 1) wins[v.indexOf(m)]++;
  }
  const lead = Math.max(...wins);
  const skills = Object.keys(players[0].skills || {}).filter(k => players.some(p => p.skills[k] && !p.skills[k].apiMissing));
  const lvl = (s, p) => (s ? `${s.level}${s.level >= s.maxLevel ? ' ★' : ''}` : '—');
  const ItemCell = ({ items }) => (
    <div className="cmp-items">
      {items.filter(Boolean).length ? items.map((it, j) => (it
        ? <span key={j} className="cmp-item" onClick={() => openItem(it.id, it.uuid)} title={it.name}><ItemIcon item={it} size={34} slot /><span className="tiny">{it.value > 0 ? coins(it.value) : ''}</span></span>
        : <span key={j} className="cmp-item empty" />)) : <span className="muted">—</span>}
    </div>
  );

  return (
    <div className="card span-12 cmp-card">
      <div className="cmp-scroll">
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {players.map((p, i) => (
                <th key={i} className="cmp-col" style={{ '--c': colorOf(p) }}>
                  <a href="#/overview" onClick={() => setView(me.name && p.player.name?.toLowerCase() === me.name.toLowerCase() && (!me.profile || me.profile.toLowerCase() === p.profile?.toLowerCase()) ? null : { player: p.player.name, profile: p.profile || '' })} title="Открыть профиль целиком">
                    <Head who={p.player.uuid || p.player.name} size={44} />
                    <div className="cmp-name">{p.player.name}</div>
                  </a>
                  <div className="tiny muted">{p.profile}{p.gameMode !== 'normal' ? ` · ${p.gameMode}` : ''} · {p.coop > 1 ? `кооп из ${p.coop}` : 'соло'}</div>
                  {shared(p) && <div className="cmp-coop-badge" title="Один кооп-остров: Bank, Garden, миньоны и коллекции общие">🤝 кооп с {shared(p)}</div>}
                  {p.missingProfile && <div className="tiny warn-text" title="Такого профиля у игрока нет">профиля «{p.missingProfile}» нет, показан {p.profile}</div>}
                  {lead > 0 && wins[i] === lead && <div className="cmp-lead">впереди по {wins[i]} из {KEYS.length}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Section title="Главное" players={players}>
              <Row label="Уровень SkyBlock" icon="nether_star" players={players} get={p => Math.floor(p.sbLevel)} bar={p => p.sbLevel % 1} />
              <Row label="Networth" icon="gold_ingot" players={players} get={nw} fmt={coins}
                sub={p => (p.networth ? `предметы ${coins(p.networth.items)} · питомцы ${coins(p.networth.pets)}${mateOf.has(p) && p.bank ? ` · Bank ÷${p.coop}` : ''}` : '')} />
              <Row label="Bank" icon="gold_block" players={players} get={p => p.bank} fmt={coins} sub={p => `кошелёк ${coins(p.purse)}`} shared={shared} />
              <Row label="Skill Average" icon="experience_bottle" players={players} get={p => +p.skillAverage.toFixed(2)} fmt={v => v.toFixed(1).replace('.', DEC)} />
              <Row label="Magical Power" icon="ender_eye" players={players} get={p => p.accessories.mp} sub={p => `${p.accessories.count ?? '—'} аксессуаров${p.accessories.power ? ` · ${prettyId(p.accessories.power)}` : ''}`} />
              <Row label="Catacombs" icon="bone" players={players} get={p => p.dungeons.level} bar={p => p.dungeons.progress} />
              <Row label="Heart of the Mountain" icon="diamond_pickaxe" players={players} get={p => p.mining.hotm} />
              <Row label="Garden Level" icon="sunflower" players={players} get={p => p.garden.level} shared={shared} />
              <Row label="Fairy Souls" icon="pink_dye" players={players} get={p => p.fairySouls} />
              <Row label="Enigma Souls" icon="purple_dye" players={players} get={p => p.rift?.enigma} />
              <Row label="Контакты Abiphone" icon="paper" players={players} get={p => p.abiphone} />
              <Row label="Песни арфы" icon="note_block" players={players} get={p => p.harp} />
            </Section>
            <Section title="Коллекции" players={players}>
              <Row label="Открыто тиров" icon="painting" players={players} get={p => p.collections?.tiers || null} shared={shared}
                sub={p => (p.coop > 1 && !shared(p) ? 'общие на кооп-острове' : '')} />
              {anyCoop && (
                <Row label="Вклад в коллекции" icon="chest" players={players} get={p => (p.coop > 1 && p.coopShare != null ? Math.round(p.coopShare * 100) : null)}
                  fmt={v => `${v}%`} bar={p => p.coopShare || 0} sub={p => (p.coop > 1 ? `сам насобирал из общего на острове ${p.profile}` : 'соло: всё своё')} />
              )}
            </Section>
            <Section title="Музей" players={players}>
              <Row label="XP музея" icon="gold_block" players={players} get={p => (p.museum?.status === 'ok' ? p.museum.xp : null)}
                sub={p => (p.museum?.status === 'ok' ? `веха ${p.museum.milestone} из 40` : p.museum?.status === 'off' ? 'Museum API выключен' : 'нет данных')} />
              <Row label="Пожертвовано" icon="item_frame" players={players} get={p => (p.museum?.status === 'ok' ? p.museum.donated : null)}
                fmt={(v, p) => `${v} из ${p.museum.total}`} bar={p => (p.museum?.total ? p.museum.donated / p.museum.total : 0)}
                sub={p => (p.museum?.status === 'ok' && p.museum.canDonate ? `ещё ${p.museum.canDonate} можно сдать из своего` : '')} />
              <Row label="Оценка музея" icon="emerald" players={players} get={p => (p.museum?.status === 'ok' && p.museum.value ? p.museum.value : null)} fmt={coins}
                sub={p => (p.museum?.status === 'ok' && p.museum.special ? `особых предметов: ${p.museum.special}` : '')} />
            </Section>
            <Section title="Skills" players={players}>
              {skills.map(k => (
                <Row key={k} label={players.find(p => p.skills[k])?.skills[k]?.name || k} icon={SKILL_ICON[k]} players={players}
                  get={p => (p.skills[k] ? p.skills[k].level + (p.skills[k].level < p.skills[k].maxLevel ? p.skills[k].progress : 0) : null)}
                  fmt={(v, p) => lvl(p.skills[k], p)} bar={p => (p.skills[k]?.level >= p.skills[k]?.maxLevel ? 1 : p.skills[k]?.progress || 0)}
                  sub={p => (p.skills[k]?.apiMissing ? 'API скиллов выключен' : '')} />
              ))}
            </Section>
            <Section title="Slayers" players={players}>
              {Object.keys(players[0].slayers || {}).map(k => (
                <Row key={k} label={players[0].slayers[k].name} icon={SLAYER_ICON[k]} players={players} get={p => p.slayers[k]?.xp}
                  fmt={(v, p) => `${p.slayers[k]?.level ?? 0} ур.`} sub={p => `${num(p.slayers[k]?.xp)} опыта`} />
              ))}
            </Section>
            <Section title="Dungeons и Kuudra" players={players}>
              <Row label="Средний класс" icon="iron_sword" players={players} get={p => +p.dungeons.classAverage.toFixed(2)} fmt={v => v.toFixed(1).replace('.', DEC)}
                sub={p => (p.dungeons.selectedClass ? `играет: ${p.dungeons.classes[p.dungeons.selectedClass]?.name || p.dungeons.selectedClass}` : '')} />
              {Object.keys(players[0].dungeons.classes || {}).map(k => (
                <Row key={k} label={players[0].dungeons.classes[k].name} icon={CLASS_ICON[k]} players={players} get={p => p.dungeons.classes[k]?.level} />
              ))}
              <Row label="Лучший этаж" icon="wither_skeleton_skull" players={players} get={p => p.dungeons.floor} fmt={v => (v === 0 ? 'Вход' : `F${v}`)} sub={p => (p.dungeons.master != null ? `Master: M${p.dungeons.master}` : 'Master Mode не открыт')} />
              <Row label="Пройдено F7" icon="nether_star" players={players} get={p => p.dungeons.f7} />
              <Row label="Всего забегов" icon="chest" players={players} get={p => p.dungeons.runs} />
              <Row label="Секреты" icon="player_head" players={players} get={p => p.dungeons.secrets} />
              <Row label="Kuudra" icon="magma_cream" players={players} get={p => KUUDRA.reduce((s, [k], i) => s + (p.crimson.kuudra?.[k] || 0) * (i + 1), 0)}
                fmt={(v, p) => KUUDRA.filter(([k]) => p.crimson.kuudra?.[k]).map(([k, n]) => `${n} ${p.crimson.kuudra[k]}`).join(' · ') || '—'}
                sub={p => (p.crimson.faction ? `фракция: ${p.crimson.faction === 'mages' ? 'маги' : 'варвары'}` : '')} />
            </Section>
            <Section title="Снаряжение" players={players}>
              <tr><th><img src="/api/texture/diamond_chestplate" alt="" className="cmp-ico" />Надето</th>{players.map((p, i) => <td key={i}><ItemCell items={p.gear.armor} /></td>)}</tr>
              <tr><th><img src="/api/texture/string" alt="" className="cmp-ico" />Экипировка</th>{players.map((p, i) => <td key={i}><ItemCell items={p.gear.equipment} /></td>)}</tr>
              <tr><th><img src="/api/texture/diamond_sword" alt="" className="cmp-ico" />Лучшее оружие</th>{players.map((p, i) => <td key={i}><ItemCell items={p.gear.weapons} /></td>)}</tr>
              <tr><th><img src="/api/texture/emerald" alt="" className="cmp-ico" />Самое ценное</th>{players.map((p, i) => <td key={i}><ItemCell items={p.gear.top} /></td>)}</tr>
            </Section>
            <Section title="Питомцы" players={players}>
              <Row label="Питомцев" icon="bone" players={players} get={p => p.pets.count} />
              <tr><th><img src="/api/texture/lead" alt="" className="cmp-ico" />Активный</th>{players.map((p, i) => (
                <td key={i}>{p.pets.active ? <span className="cmp-pet"><ItemIcon id={p.pets.active.id} size={30} /> <span>{prettyId(p.pets.active.type.toLowerCase())} <span className="muted">ур. {p.pets.active.level}</span></span></span> : <span className="muted">—</span>}</td>
              ))}</tr>
            </Section>
            <Section title="Что делать дальше" players={players}>
              <tr><th><img src="/api/texture/map" alt="" className="cmp-ico" />Ближайшие шаги</th>{players.map((p, i) => (
                <td key={i}><ol className="cmp-next">{p.next.map(s => <li key={s.id}><span className="tiny muted">{s.cat}</span> {s.title}</li>)}</ol></td>
              ))}</tr>
            </Section>
          </tbody>
        </table>
      </div>
    </div>
  );
}
