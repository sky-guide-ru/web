// Интерактивные блоки гайда Dungeons: калькулятор счёта и помощники для загадок (Tic Tac Toe, Three Weirdos, Quiz).
// Данные (этажи, нормы секретов, фразы, вопросы) приходят с сервера; здесь только отклик на ввод.
import { useMemo, useState } from 'react';
import { Badge } from '../components/ui.jsx';
import { Rich } from './Rich.jsx';

// ---------- Калькулятор счёта ----------

const RANK_COLOR = { 'S+': '#4ade80', S: '#f5c542', A: '#f87171', B: '#f87171', C: '#f87171', D: '#f87171' };
const rankOf = s => (s >= 300 ? 'S+' : s >= 269.5 ? 'S' : s >= 230 ? 'A' : s >= 160 ? 'B' : s >= 100 ? 'C' : 'D');

/** Та же формула, что dungeonScore в core (src/guides/dungeons-rooms.js), — там она покрыта тестами. */
export function scoreOf(fl, v) {
  const dead = Math.max(0, v.deaths);
  const skill = Math.max(0, Math.floor(100 - dead * 2 + (v.spirit && dead > 0 ? 1 : 0) - v.failed * 14));
  const roomPts = Math.floor(60 * Math.min(100, v.rooms) / 100);
  const secretPts = Math.floor(Math.min(40, 40 * v.secrets / fl.secretReq));
  const t = v.minutes * 60 + v.seconds - fl.offset;
  const speed = t < 480 ? 100 : t < 600 ? Math.ceil(140 - t / 12) : t < 840 ? Math.ceil(115 - t / 24) : t < 1140 ? Math.ceil(108 - t / 30) : t < 3940 ? Math.ceil(98.5 - t / 40) : 0;
  const bonus = Math.min(5, v.crypts) + (v.mimic && fl.mimic ? 2 : 0) + (v.paul ? 10 : 0);
  const total = skill + roomPts + secretPts + speed + bonus;
  return { skill, explore: roomPts + secretPts, roomPts, secretPts, speed, bonus, total, rank: rankOf(total), limit: (fl.offset + 480) / 60 };
}

function Num({ label, value, set, min = 0, max = 99, step = 1, suffix }) {
  const clamp = x => Math.max(min, Math.min(max, x));
  return (
    <label className="dt-num">
      <span className="muted small">{label}</span>
      <span className="dt-num-row">
        <button type="button" onClick={() => set(clamp(value - step))} aria-label="−">−</button>
        <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={e => set(clamp(Number(e.target.value) || 0))} />
        <button type="button" onClick={() => set(clamp(value + step))} aria-label="+">+</button>
        {suffix && <span className="muted small">{suffix}</span>}
      </span>
    </label>
  );
}

export function ScoreCalc({ s }) {
  const floors = s.floors || [];
  const [floor, setFloor] = useState(s.floor || floors[0]?.id);
  const fl = floors.find(f => f.id === floor) || floors[0];
  const [v, setV] = useState({ deaths: 0, spirit: false, failed: 0, rooms: 100, secrets: fl?.secretReq ?? 100, minutes: 10, seconds: 0, crypts: 5, mimic: true, paul: false });
  const put = k => x => setV(o => ({ ...o, [k]: x }));
  if (!fl) return null;
  const r = scoreOf(fl, v);
  const tips = [];
  if (r.total < 300) {
    if (r.secretPts < 40) tips.push(`Секреты: нужно ${fl.secretReq}% — это ещё +${40 - r.secretPts} очков.`);
    if (v.crypts < 5) tips.push(`Crypts: взорви ещё ${5 - v.crypts} — +${5 - v.crypts}.`);
    if (r.speed < 100) tips.push(`Время: лимит этажа ${r.limit} мин, сейчас −${100 - r.speed} очков.`);
    if (r.roomPts < 60) tips.push(`Комнаты: зачисти все — +${60 - r.roomPts}.`);
    if (fl.mimic && !v.mimic) tips.push('Mimic: убей его — +2.');
  }
  return (
    <div className="dt-calc">
      <div className="dt-floors" role="radiogroup">
        {floors.map(f => (
          <button key={f.id} type="button" className={`chip${f.id === floor ? ' active' : ''}`} onClick={() => setFloor(f.id)}>{f.id}</button>
        ))}
      </div>
      <div className="dt-calc-grid">
        <div className="dt-inputs">
          <label className="dt-range">
            <span className="muted small">Секреты найдено: <b>{v.secrets}%</b> <span className="muted">(норма {fl.secretReq}%)</span></span>
            <input type="range" min={0} max={100} value={v.secrets} onChange={e => put('secrets')(Number(e.target.value))} />
          </label>
          <label className="dt-range">
            <span className="muted small">Комнат зачищено: <b>{v.rooms}%</b></span>
            <input type="range" min={0} max={100} value={v.rooms} onChange={e => put('rooms')(Number(e.target.value))} />
          </label>
          <div className="dt-nums">
            <Num label="Время, мин" value={v.minutes} set={put('minutes')} max={90} />
            <Num label="сек" value={v.seconds} set={put('seconds')} max={59} step={10} />
            <Num label="Смерти" value={v.deaths} set={put('deaths')} max={20} />
            <Num label="Проваленные загадки" value={v.failed} set={put('failed')} max={5} />
            <Num label="Crypts" value={v.crypts} set={put('crypts')} max={5} />
          </div>
          <div className="dt-checks">
            {fl.mimic && <label className="check"><input type="checkbox" checked={v.mimic} onChange={e => put('mimic')(e.target.checked)} /> Mimic убит</label>}
            <label className="check"><input type="checkbox" checked={v.spirit} onChange={e => put('spirit')(e.target.checked)} /> Первый умерший с Spirit</label>
            <label className="check"><input type="checkbox" checked={v.paul} onChange={e => put('paul')(e.target.checked)} /> Мэр Paul (EZPZ)</label>
          </div>
        </div>
        <div className="dt-result">
          <div className="dt-total"><b>{r.total}</b> <Badge color={RANK_COLOR[r.rank]}>{r.rank}</Badge></div>
          <div className="dt-parts">
            <span>Skill <b>{r.skill}</b></span><span>Explore <b>{r.explore}</b></span><span>Speed <b>{r.speed}</b></span><span>Bonus <b>{r.bonus}</b></span>
          </div>
          {r.total >= 300
            ? <p className="small tone-good">S+ есть{r.total > 300 ? `, запас ${r.total - 300}` : ''}.</p>
            : <>
              <p className="small">До S+ не хватает <b>{300 - r.total}</b>.</p>
              {tips.length > 0 && <ul className="dt-tips small">{tips.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>}
            </>}
        </div>
      </div>
    </div>
  );
}

// ---------- Tic Tac Toe ----------

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = b => { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; return null; };

// Минимакс: игрок 'p' ищет ход, при котором компьютер 'c' не выиграет (ничья достаточно)
function value(b, turn) {
  const w = winner(b);
  if (w === 'p') return 1;
  if (w === 'c') return -1;
  if (b.every(Boolean)) return 0;
  const vals = b.map((x, i) => (x ? null : i)).filter(i => i != null).map(i => { const nb = b.slice(); nb[i] = turn; return value(nb, turn === 'p' ? 'c' : 'p'); });
  return turn === 'p' ? Math.max(...vals) : Math.min(...vals);
}
export function bestMove(b) {
  let best = null, bv = -2;
  // При равной оценке — центр, затем углы: так советуют и в игре
  for (const i of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
    if (b[i]) continue;
    const nb = b.slice(); nb[i] = 'p';
    const v = value(nb, 'c');
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}

function TicTacToe() {
  const [b, setB] = useState(Array(9).fill(null));
  const [last, setLast] = useState(null);
  const done = winner(b) || b.every(Boolean);
  const click = i => {
    if (b[i] || done) return;
    const nb = b.slice(); nb[i] = 'c';
    if (!winner(nb) && !nb.every(Boolean)) { const m = bestMove(nb); nb[m] = 'p'; setLast(m); } else setLast(null);
    setB(nb);
  };
  const w = winner(b);
  return (
    <div className="dt-ttt-wrap">
      <div className="dt-ttt" role="grid">
        {b.map((x, i) => (
          <button key={i} type="button" className={`dt-ttt-cell ${x || ''}${i === last ? ' last' : ''}`} onClick={() => click(i)} aria-label={x === 'c' ? 'компьютер' : x === 'p' ? 'твой ход' : 'пусто'}>
            {x === 'c' ? '✕' : x === 'p' ? '◯' : ''}
          </button>
        ))}
      </div>
      <div className="dt-ttt-side small">
        <p><span className="dt-ttt-key c">✕</span> — куда сходил компьютер (нажимай сам), <span className="dt-ttt-key p">◯</span> — куда ставить тебе.</p>
        <p className="muted">{w === 'c' ? 'Компьютер выиграл: проверь, верно ли отмечены ходы.' : done ? 'Ничья — загадка решена.' : last != null ? 'Поставь в подсвеченную клетку и отметь следующий ход компьютера.' : 'Нажми клетку, куда компьютер сходил первым.'}</p>
        <button type="button" className="chip" onClick={() => { setB(Array(9).fill(null)); setLast(null); }}>Заново</button>
      </div>
    </div>
  );
}

// ---------- Three Weirdos ----------

const norm = t => t.toLowerCase().replace(/[’`]/g, "'").replace(/^\s*(\[npc\])?[^:]{0,24}:\s*/i, '').replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function matchWeirdos(input, list) {
  const words = norm(input).split(' ').filter(w => w.length > 1);
  if (words.length < 2) return [];
  const scored = list.map(w => {
    const set = new Set(norm(w.text.replace(/…/g, ' ')).split(' '));
    const miss = words.filter(x => !set.has(x)).length;
    return { ...w, miss, extra: set.size - (words.length - miss) };
  }).filter(w => w.miss <= 1); // одно лишнее слово — имя другого NPC
  const best = Math.min(...scored.map(w => w.miss));
  return scored.filter(w => w.miss === best).sort((a, b) => a.extra - b.extra);
}

function Weirdos({ list }) {
  const [q, setQ] = useState('');
  const found = useMemo(() => matchWeirdos(q, list), [q, list]);
  const exact = found.length && found[0].extra === 0 ? [found[0]] : found;
  const same = exact.length > 0 && exact.every(w => !!w.reward === !!exact[0].reward);
  return (
    <div className="dt-weird">
      <input className="dt-input" placeholder="Вставь или начни печатать фразу NPC: The reward is…" value={q} onChange={e => setQ(e.target.value)} />
      {q && !found.length && <p className="muted small">Пока не похоже ни на одну фразу — допиши ещё пару слов.</p>}
      {same && (
        <p className={`dt-verdict ${exact[0].reward ? 'yes' : 'no'}`}>{exact[0].reward ? '✓ Награда в сундуке этого NPC' : '✗ Не этот: спроси следующего'}</p>
      )}
      {found.length > 0 && (
        <ul className="dt-weird-list small">
          {found.slice(0, 5).map((w, i) => <li key={i} className={w.reward ? 'tone-good' : 'muted'}>{w.reward ? '✓' : '✗'} {w.text}</li>)}
        </ul>
      )}
      {!q && <p className="muted small">Фраз всего 18, награду держит тот, кто сказал одну из шести «правильных» — их список в карточке Three Weirdos ниже.</p>}
    </div>
  );
}

// ---------- Quiz ----------

function Quiz({ list }) {
  const [q, setQ] = useState('');
  const words = norm(q).split(' ').filter(w => w.length > 1);
  const rows = words.length ? list.filter(x => { const t = norm(x.q); return words.every(w => t.includes(w)); }) : list;
  return (
    <div className="dt-quiz">
      <input className="dt-input" placeholder="Слова из вопроса: status Livid, fairy souls hub…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="dt-quiz-list">
        {rows.length ? rows.map((x, i) => (
          <div key={i} className="dt-quiz-row small"><span className="muted">{x.q}</span><b>{x.a}</b></div>
        )) : <p className="muted small">Такого вопроса нет в списке. Ответы — по вики; числа Fairy Souls и минионов в игре могли измениться.</p>}
      </div>
    </div>
  );
}

const TABS = [['ttt', 'Tic Tac Toe'], ['weirdos', 'Three Weirdos'], ['quiz', 'Quiz']];

export function PuzzleHelpers({ s }) {
  const [tab, setTab] = useState('ttt');
  return (
    <div className="dt-helpers">
      <div className="tabs">{TABS.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
      {tab === 'ttt' && <TicTacToe />}
      {tab === 'weirdos' && <Weirdos list={s.weirdos || []} />}
      {tab === 'quiz' && <Quiz list={s.quiz || []} />}
    </div>
  );
}

/** Секция kind: 'tool' — выбор блока по s.tool. */
export function GuideTool({ s }) {
  if (s.tool === 'dungeon-score') return <ScoreCalc s={s} />;
  if (s.tool === 'puzzle-helpers') return <PuzzleHelpers s={s} />;
  return null;
}
