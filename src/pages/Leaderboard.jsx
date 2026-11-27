import { LOCALE } from '../i18n.js';
// Рейтинг игроков: самые богатые, уровень SkyBlock, Catacombs, слееры, навыки.
// Hypixel не даёт общего списка игроков, поэтому в таблице только профили, которые посетители открывали на этом сайте.
// Владелец сайта и его друзья в рейтинг не попадают (это решает сервер). Любой игрок может убрать себя сам.
import { useEffect, useState } from 'react';
import { Card, Empty } from '../components/ui.jsx';
import { coins, num, ago, setView, useHashTab, plural } from '../api.js';
import GuildTag from '../components/GuildTag.jsx';

// Без заголовков открытого профиля: рейтинг общий и не зависит от того, чей профиль сейчас открыт
async function lb(path, opts) {
  const r = await fetch(`/api/leaderboard${path}`, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
}

const BOARDS = [
  { id: 'networth', label: 'Networth', col: 'Networth' },
  { id: 'level', label: 'Уровень SkyBlock', col: 'Уровень' },
  { id: 'catacombs', label: 'Catacombs', col: 'Catacombs' },
  { id: 'slayer', label: 'Slayers', col: 'Опыт слееров' },
  { id: 'skills', label: 'Skills', col: 'Skill Average' },
];
const MODES = [['all', 'Все профили'], ['normal', 'Обычные'], ['ironman', 'Ironman'], ['other', 'Stranded и Bingo']];
const MODE_LABEL = { ironman: 'Ironman', island: 'Stranded', bingo: 'Bingo' };
const CLASS_RU = { healer: 'лекарь', mage: 'маг', berserk: 'берсерк', archer: 'лучник', tank: 'танк' };
const MEDAL = ['🥇', '🥈', '🥉'];

function mainValue(board, r) {
  if (board === 'networth') return coins(r.value);
  if (board === 'level') return Math.floor(r.value);
  if (board === 'catacombs') return <>{r.cata} <span className="muted tiny">({coins(r.value)} опыта)</span></>;
  if (board === 'slayer') return coins(r.value);
  return r.value.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

// Мелкая строка под ником: остальные показатели, чтобы таблица говорила больше, чем одно число
function details(board, r) {
  const parts = [];
  if (board !== 'networth' && r.nw) parts.push(coins(r.nw));
  if (board !== 'level' && r.level) parts.push(`${Math.floor(r.level)} ур.`);
  if (board !== 'catacombs' && r.cata) parts.push(`Catacombs ${r.cata}`);
  if (board === 'catacombs' && r.cls) parts.push(CLASS_RU[r.cls] || r.cls);
  if (board === 'slayer' && r.slayers) parts.push(Object.values(r.slayers).join(' / '));
  if (board !== 'skills' && r.skillAvg) parts.push(`навыки ${r.skillAvg.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}`);
  return parts.join(' · ');
}

function open(r) {
  setView({ player: r.name, profile: r.profile });
  location.hash = '#/overview';
}

function RemoveMe({ onDone }) {
  const [nick, setNick] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!nick.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await lb('/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: nick.trim() }) });
      setMsg({ ok: true, text: `Готово: ${nick.trim()} убран из рейтинга и больше туда не попадёт.` });
      setNick('');
      onDone();
    } catch (err) { setMsg({ ok: false, text: err.message || 'Не вышло, попробуй позже' }); }
    setBusy(false);
  };
  return (
    <details className="lb-remove">
      <summary>Не хочу быть в рейтинге</summary>
      <p className="muted small">Впиши свой ник: запись пропадёт сразу, и твой профиль больше не попадёт в эту таблицу, даже если его снова откроют. Сам профиль на сайте при этом открывается как обычно.</p>
      <form onSubmit={submit} className="cmp-add">
        <input value={nick} onChange={e => setNick(e.target.value)} placeholder="Ник, например Steve" maxLength={16} spellCheck={false} autoComplete="off" aria-label="Твой ник" />
        <button className="btn ghost" disabled={busy || !nick.trim()}>{busy ? 'Убираю…' : 'Убрать меня'}</button>
      </form>
      {msg && <div className={`small lb-msg ${msg.ok ? 'green' : 'lb-bad'}`} role="status">{msg.text}</div>}
    </details>
  );
}

export default function Leaderboard({ sub }) {
  const [board, setBoard] = useHashTab('top', sub, BOARDS.map(b => b.id), 'networth');
  const [mode, setMode] = useState('all');
  const [find, setFind] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null);
    lb(`?board=${board}&mode=${mode}&limit=100${query ? `&find=${encodeURIComponent(query)}` : ''}`)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [board, mode, query, tick]);

  const B = BOARDS.find(b => b.id === board);
  const rows = data?.board === board ? data.rows : null;
  const meRow = data?.me;
  const row = (r, extra = '') => (
    <tr key={`${r.uuid}${extra}`} className={`${r.place <= 3 ? `lb-top lb-top${r.place}` : ''} ${meRow && r.uuid === meRow.uuid ? 'row-current' : ''}`} onClick={() => open(r)} title={`Открыть профиль ${r.name}`}>
      <td className="lb-place">{MEDAL[r.place - 1] || r.place}</td>
      <td>
        <div className="lb-who">
          <img className="lb-head" width={28} height={28} src={`/api/head/${encodeURIComponent(r.uuid)}?size=56`} alt="" loading="lazy" onError={e => e.currentTarget.classList.add('broken')} />
          <div className="lb-name">
            <div>
              {r.rank?.id && r.rank.id !== 'NONE' && <span className={`rank-chip rank-${r.rank.id.toLowerCase()}`}>{r.rank.label}</span>}
              <b>{r.name}</b>
              {r.guild && <GuildTag tag={r.guild.tag} color={r.guild.color} />}
              {MODE_LABEL[r.mode] && <span className="mode-chip">{MODE_LABEL[r.mode]}</span>}
            </div>
            <div className="muted tiny">{r.profile}{r.coop > 1 ? ` · кооп из ${r.coop}` : ''}{details(board, r) ? ` · ${details(board, r)}` : ''}</div>
          </div>
        </div>
      </td>
      <td className="num lb-val">{mainValue(board, r)}</td>
      <td className="num muted tiny lb-when">{ago(r.at)}</td>
    </tr>
  );

  return (
    <>
      <Card title="Рейтинг игроков" icon="🏆" right={data ? <span className="muted small">{num(data.total)} {plural(data.total, 'игрок', 'игрока', 'игроков')} в таблице</span> : null}>
        <p className="muted small lb-note">
          Hypixel не даёт общего списка всех игроков, поэтому здесь только профили, которые кто-то открывал на этом сайте. Цифры обновляются, когда профиль открывают снова.
          Открой свой профиль через поиск ника, и он появится в рейтинге.
        </p>
        <div className="tabs" role="tablist">
          {BOARDS.map(b => <button key={b.id} className={b.id === board ? 'active' : ''} onClick={() => setBoard(b.id)} role="tab" aria-selected={b.id === board}>{b.label}</button>)}
        </div>
        <div className="lb-tools">
          <div className="row-gap">
            {MODES.map(([id, label]) => <button key={id} className={`chip ${mode === id ? 'active' : ''}`} onClick={() => setMode(id)}>{label}</button>)}
          </div>
          <form className="cmp-add" onSubmit={e => { e.preventDefault(); setQuery(find.trim()); }}>
            <input value={find} onChange={e => { setFind(e.target.value); if (!e.target.value.trim()) setQuery(''); }} placeholder="Найти себя: ник" maxLength={16} spellCheck={false} autoComplete="off" aria-label="Найти игрока в рейтинге" />
            <button className="btn ghost" disabled={!find.trim()}>Найти</button>
          </form>
        </div>
        {query && data?.board === board && (
          meRow
            ? <div className="lb-found small">{meRow.name}: <b>{meRow.place} место</b> из {num(data.total)} в таблице «{B.label}».</div>
            : <div className="lb-found small muted">{query} пока нет в этой таблице. Открой профиль через поиск ника, и через минуту он появится здесь.</div>
        )}
        {err ? <Empty>Не удалось загрузить рейтинг: {err}</Empty>
          : !rows ? <div className="loader"><div className="spinner" /></div>
          : !rows.length ? <Empty>Пока пусто: в этой таблице ещё нет ни одного профиля. Открой любой ник через поиск, и он появится здесь.</Empty>
          : (
            <div className="table-scroll">
              <table className="table lb-table">
                <thead><tr><th>#</th><th>Игрок</th><th className="num">{B.col}</th><th className="num lb-when">Данные</th></tr></thead>
                <tbody>
                  {rows.map(r => row(r))}
                  {meRow && !rows.some(r => r.uuid === meRow.uuid) && <>
                    <tr className="lb-gap"><td colSpan={4}>…</td></tr>
                    {row(meRow, '-me')}
                  </>}
                </tbody>
              </table>
            </div>
          )}
        {board === 'networth' && rows?.length > 0 && <p className="muted tiny lb-foot">Стоимость считается по ценам Bazaar и аукциона: предметы, питомцы, мешки, эссенции, монеты и музей. Профили с закрытым API инвентаря в эту таблицу не попадают, их стоимость не узнать.</p>}
        <RemoveMe onDone={() => setTick(t => t + 1)} />
      </Card>
    </>
  );
}
