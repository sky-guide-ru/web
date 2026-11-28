// Интерактивное дерево Heart of the Mountain / Heart of the Forest для гайдов (секция kind: 'tree').
// Сверху — короткий план «что сделать» для выбранной сборки (3–5 шагов), номера шагов нарисованы прямо
// на клетках дерева. Клик по перку открывает описание и цену. Подробности сборки спрятаны в «О сборке».
import { useMemo, useState } from 'react';
import { coins } from '../api.js';

const RES_SHORT = { MITHRIL: 'Mithril', GEMSTONE: 'Gemstone', GLACITE: 'Glacite', FOREST_WHISPERS: 'Forest Whispers', DESERT_WHISPERS: 'Desert Whispers' };
const STATE_RU = { max: 'на максимуме', partial: 'качается', open: 'можно взять', locked: 'закрыт уровнем дерева' };

function texture(p) {
  if (p.id === 'core_of_the_mountain' || p.id === 'center_of_the_forest') return p.level > 0 ? 'redstone_block' : 'coal_block';
  if (p.ability) return p.level > 0 ? 'emerald_block' : 'coal_block';
  return p.state === 'max' ? 'diamond' : p.state === 'partial' ? 'emerald' : 'coal';
}

const costText = obj => Object.entries(obj || {}).map(([k, v]) => `${coins(v)} ${RES_SHORT[k] || k}`).join(' + ');

// Номера шагов и пометки на клетках: id → { n, mark: 'add' | 'remove' | 'up' }
const TG = { add: '+', up: '↑', remove: '×', done: '✓', later: '…', bridge: '⇄' };
const TG_RU = { add: 'взять', up: 'докачать', remove: 'снять', done: 'готово', opt: 'по желанию', later: 'откроется позже', skip: 'не брать', bridge: 'оставить для прохода' };
const tgLabel = (p, t) => (!t?.target ? 'не брать' : t.target >= p.max ? (p.max > 1 ? `МАКС ${p.max}` : 'взять') : t.target === 1 ? 'взять, уровни по остатку' : `до ${t.target}`);

function marksOf(steps = []) {
  const m = {};
  steps.forEach((s, i) => {
    const n = i + 1;
    if (s.kind === 'up') m[s.id] ||= { n, mark: 'up' };
    for (const id of s.add || []) m[id] ||= { n, mark: 'add' };
    for (const id of s.remove || []) m[id] ||= { n, mark: 'remove' };
  });
  return m;
}

function PerkCell({ p, mk, tg, selected, onPick }) {
  const badge = mk ? (mk.mark === 'remove' ? '×' : mk.n) : tg && tg.status !== 'later' ? TG[tg.status] : null;
  return (
    <button
      type="button"
      className={`tree-cell st-${p.state}${tg ? ` tg-${tg.status}` : ''}${mk ? ' has-step' : ''}${selected ? ' sel' : ''}`}
      style={{ gridColumn: p.x + 2, gridRow: p.y + 1 }}
      onClick={() => onPick(p.id)}
      title={`${p.name} — ${p.short}${p.max > 1 ? ` · ${p.level}/${p.max}` : ''}`}
      aria-label={`${p.name}, уровень ${p.level} из ${p.max}${tg ? `, ${TG_RU[tg.status]}` : ''}${mk ? `, шаг ${mk.n}` : ''}`}
      aria-pressed={selected}
    >
      <img src={`/api/texture/${texture(p)}`} alt="" width={26} height={26} draggable={false} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
      {p.max > 1 && <span className="tree-lvl">{p.level}</span>}
      {badge != null && <span className="tree-num">{badge}</span>}
    </button>
  );
}

// Кнопка-перк в тексте: имя + короткое пояснение по-русски
function Perk({ p, onPick, tone, note }) {
  if (!p) return null;
  return (
    <button type="button" className={`tree-perk${tone ? ` ${tone}` : ''}`} onClick={() => onPick(p.id)} title={note ? 'Сам по себе не нужен: через него открывается следующий перк' : undefined}>
      {p.name} <span className="muted">{note || p.short}</span>
    </button>
  );
}

function Steps({ steps, byId, onPick, tree, tokensSpent, targets }) {
  if (!steps?.length) {
    const left = Object.values(targets || {}).filter(t => ['add', 'up', 'later'].includes(t.status)).length;
    return left
      ? <p className="muted tree-steps-done">Сейчас сделать нечего: для следующих перков нужен Powder, свободный токен или уровень дерева. Цели — в списке рядом с деревом.</p>
      : <p className="tone-good tree-steps-done">✓ По этой сборке всё сделано.</p>;
  }
  const P = (id, bridge) => <Perk key={id} p={byId[id]} onPick={onPick} note={bridge?.includes(id) ? 'для прохода' : null} />;
  return (
    <ol className="tree-steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="tree-step-n">{i + 1}</span>
          <div>
            {s.kind === 'take' && <>
              <b>{tokensSpent === 0 ? 'Открой первые перки' : 'Возьми перки'}</b>
              <span className="muted small"> {s.free ? `· свободных токенов: ${s.free}` : '· по одному токену, по порядку'}</span>
              <div className="tree-perks">{s.add.map(id => P(id, s.bridge))}</div>
            </>}
            {s.kind === 'swap' && <>
              <b>Переставь {s.add.length} {s.add.length === 1 ? 'токен' : s.add.length < 5 ? 'токена' : 'токенов'}</b>
              <span className="muted small"> · сброс дерева в меню {tree === 'hotf' ? 'HotF' : 'HotM'} возвращает токены</span>
              <div className="tree-perks"><span className="tree-tag bad">убрать</span>{s.remove.map(id => <Perk key={id} p={byId[id]} onPick={onPick} tone="bad" />)}</div>
              <div className="tree-perks"><span className="tree-tag good">взять</span>{s.add.map(id => P(id, s.bridge))}</div>
            </>}
            {s.kind === 'up' && <>
              <b>Докачай</b> <Perk p={byId[s.id]} onPick={onPick} /> <span className="nowrap">{s.from} → {s.to}</span>
              <span className="muted small nowrap"> · {coins(s.cost)} {RES_SHORT[s.powder] || s.powder}</span>
            </>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PerkInfo({ p, mk, tg, buildTitle }) {
  if (!p) return null;
  return (
    <div className="tree-info">
      <div className="tree-info-head">
        <b>{p.name}</b> <span className="muted">· {p.short}</span>
        <span className={`tree-pill st-${p.state}`}>{p.max > 1 ? `${p.level}/${p.max} · ` : ''}{STATE_RU[p.state]}</span>
      </div>
      {tg && (
        <div className={`tree-goal tg-${tg.status}`}>
          Сборка «{buildTitle}»: <b>{tg.status === 'remove' ? 'снять' : tg.status === 'bridge' ? 'оставить: через него проход к нужным перкам' : tg.status === 'opt' ? 'по желанию, если есть лишний токен' : tg.status === 'skip' ? 'не брать' : tgLabel(p, tg)}</b>
          {tg.status === 'done' && ' · ✓ готово'}{tg.status === 'up' && ` · сейчас ${p.level}`}{tg.status === 'later' && ' · откроется с уровнем дерева'}
          {mk && mk.mark !== 'remove' && <span className="muted"> · шаг {mk.n}</span>}
        </div>
      )}
      {p.now && <p><span className="tree-k">Сейчас:</span> {p.now}</p>}
      {p.next && <p><span className="tree-k">{p.level ? 'Следующий уровень:' : 'Если взять:'}</span> {p.next}</p>}
      {p.atMax && p.level < p.max && p.max > 1 && <p><span className="tree-k">На максимуме:</span> {p.atMax}</p>}
      {p.level < p.max && (
        <p className="small">
          {p.costNext > 0 && <>Следующий уровень: <b>{coins(p.costNext)} {RES_SHORT[p.powder] || p.powder}</b>. </>}
          {Object.keys(p.costToMax).length > 0 && <>До максимума: <b>{costText(p.costToMax)}</b>. </>}
          {p.level === 0 && p.state !== 'locked' && 'Открывается за 1 токен. '}
          {p.unknownCost && <span className="muted">Цену смотри в игре.</span>}
        </p>
      )}
    </div>
  );
}

// Цели сборки списком: что взять, что докачать и до какого уровня, что снять
function Goals({ build, byId, onPick, only, className = '' }) {
  const seq = [...new Set([...(build.order || []), ...build.perks])];
  const rank = id => { const i = seq.indexOf(id); return i < 0 ? 999 : i; };
  const groups = (only || ['add', 'up', 'later', 'remove', 'bridge', 'done']).map(st => [st, Object.entries(build.targets || {}).filter(([, t]) => t.status === st).map(([id]) => byId[id]).filter(Boolean).sort((a, b) => rank(a.id) - rank(b.id))]);
  return (
    <div className={`tree-goals ${className}`}>
      {groups.map(([st, list]) => list.length > 0 && (
        <div key={st} className={`tree-goal-g tg-${st}`}>
          <div className="tree-goal-h"><i className="tree-goal-i">{TG[st]}</i>{TG_RU[st][0].toUpperCase() + TG_RU[st].slice(1)} · {list.length}</div>
          <div className="tree-perks">
            {list.map(p => (
              <button key={p.id} type="button" className="tree-perk" onClick={() => onPick(p.id)}>
                {p.name}
                {!['remove', 'done', 'bridge'].includes(st) && <b className="tree-perk-t">{tgLabel(p, build.targets[p.id])}</b>}
                {st === 'later' && <span className="muted">с {p.tier} ур.</span>}
                {st === 'up' && <span className="muted">сейчас {p.level}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TreeView({ s }) {
  const builds = s.builds || [];
  const [buildId, setBuildId] = useState(s.recommended || builds[0]?.id || null);
  const build = builds.find(b => b.id === buildId);
  const byId = useMemo(() => Object.fromEntries((s.perks || []).map(p => [p.id, p])), [s.perks]);
  const marks = useMemo(() => marksOf(build?.steps), [build]);
  const firstStep = build?.steps?.[0];
  const [sel, setSel] = useState(firstStep?.add?.[0] || firstStep?.id || s.perks?.find(p => p.state === 'partial')?.id || s.perks?.[0]?.id);
  const rows = s.rows || 10;
  const label = s.tree === 'hotf' ? 'HotF' : 'HotM';
  const pick = id => setSel(id);
  const [view, setView] = useState('plan'); // plan — как должно быть по сборке, now — моё дерево как есть
  const plan = view === 'plan' && build;

  return (
    <div className="tree-wrap">
      <div className="tree-top">
        <span className="tree-chip"><b>{label} {s.level}/{s.maxLevel}</b></span>
        {s.tokens?.spent != null && (
          <span className="tree-chip">Токены: <b>{s.tokens.spent}{s.tokens.total ? ` из ${s.tokens.total}` : ''}</b>{s.tokens.free ? <> · свободно <b className="tone-warn">{s.tokens.free}</b></> : null}</span>
        )}
        {(s.resources || []).map(r => (r.avail != null || r.total) ? (
          <span key={r.id} className="tree-chip" title={r.avail == null ? 'API отдаёт только сколько получено всего' : undefined}>
            {RES_SHORT[r.id] || r.name}: <b>{coins(r.avail ?? r.total)}</b>{r.avail == null && <span className="muted"> всего</span>}
          </span>
        ) : null)}
      </div>

      {builds.length > 0 && (
        <div className="tree-plan">
          <div className="tree-plan-head">
            <b>Что сделать</b>
            <div className="tabs tree-tabs" role="tablist" aria-label="Сборка">
              {builds.map(b => (
                <button key={b.id} role="tab" aria-selected={b.id === buildId} className={b.id === buildId ? 'active' : ''} onClick={() => setBuildId(b.id)}>
                  {b.title}{b.id === s.recommended ? ' ★' : ''}
                </button>
              ))}
            </div>
          </div>
          <Steps steps={build?.steps} byId={byId} onPick={pick} tree={s.tree} tokensSpent={s.tokens?.spent} targets={build?.targets} />
        </div>
      )}

      <div className="tree-main">
        <div className="tree-grid-box">
          {build && (
            <div className="tabs tree-view" role="tablist" aria-label="Вид дерева">
              <button role="tab" aria-selected={view === 'plan'} className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Как надо: {build.title}</button>
              <button role="tab" aria-selected={view === 'now'} className={view === 'now' ? 'active' : ''} onClick={() => setView('now')}>Моё дерево</button>
            </div>
          )}
          <div className={`tree-grid${plan ? ' plan' : ''}`} style={{ gridTemplateColumns: `22px repeat(${s.cols || 7}, var(--tree-cell))`, gridTemplateRows: `repeat(${rows}, var(--tree-cell))` }}>
            {Array.from({ length: rows }, (_, y) => {
              const tier = rows - y;
              return <div key={`r${y}`} className={`tree-row-n${tier > s.level ? ' locked' : ''}`} style={{ gridColumn: 1, gridRow: y + 1 }}>{tier}</div>;
            })}
            {(s.perks || []).map(p => (
              <PerkCell key={p.id} p={p} mk={plan ? marks[p.id] : null} tg={plan ? build.targets?.[p.id] : null} selected={sel === p.id} onPick={pick} />
            ))}
          </div>
          <div className="tree-legend muted small">
            {plan
              ? <><span><i className="lg tg-add">+</i>взять</span><span><i className="lg tg-up">↑</i>докачать</span><span><i className="lg tg-remove">×</i>снять</span><span><i className="lg tg-done">✓</i>готово</span><span>цифра — шаг плана</span></>
              : <><span><i className="lg st-max" />максимум</span><span><i className="lg st-partial" />качается</span><span><i className="lg st-open" />не взят</span></>}
          </div>
        </div>
        <div className="tree-side">
          <PerkInfo p={byId[sel]} mk={plan ? marks[sel] : null} tg={build?.targets?.[sel]} buildTitle={build?.title} />
          {/* главное — рядом с деревом, «позже», «для прохода» и «готово» — под ним на всю ширину, чтобы колонки были ровными */}
          {build && <Goals build={build} byId={byId} onPick={pick} only={['add', 'up', 'remove']} />}
        </div>
      </div>
      {build && <Goals build={build} byId={byId} onPick={pick} only={['later', 'bridge', 'done']} className="wide" />}

      {build && (
        <details className="tree-more">
          <summary>О сборке «{build.title}»</summary>
          <p>{build.desc}{build.id === s.recommended && s.recommendReason ? ` ${s.recommendReason}` : ''}</p>
          <div className="tree-pc">
            <ul className="tree-pros">{build.pros.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <ul className="tree-cons">{build.cons.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          {s.sources && <p className="muted small">Сборки сверены с: {s.sources}. Где точных уровней в источниках нет, стоит «взять, уровни по остатку».</p>}
        </details>
      )}
    </div>
  );
}
