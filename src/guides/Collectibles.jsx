// Гайд «Души и коллекции»: Fairy Souls по островам с маршрутом и отметками, контакты Abiphone,
// песни арфы Melody и сводка Enigma Souls (подробно — в гайде «Рифт»). Остальные секции — общим рендером.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Card, Progress } from '../components/ui.jsx';
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { Rich } from './Rich.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';

function copy(text) {
  try { navigator.clipboard?.writeText(text); } catch { /* буфер недоступен — не страшно */ }
}

function Filter({ value, onChange, options }) {
  return (
    <div className="chips collect-filter">
      {options.map(([k, t]) => <button key={k} className={value === k ? 'chip active' : 'chip'} onClick={() => onChange(k)}>{t}</button>)}
    </div>
  );
}

function Fairy({ f, onMark, busy, readOnly }) {
  const firstOpen = f.islands.find(i => i.found < i.total)?.id || f.islands[0]?.id;
  const [island, setIsland] = useState(firstOpen);
  const [show, setShow] = useState('left');
  const isl = f.islands.find(i => i.id === island) || f.islands[0];
  const list = useMemo(() => (isl?.souls || []).filter(s => show === 'all' || (show === 'left' ? s.status !== 'found' : s.status === 'found')), [isl, show]);
  const leftHere = isl ? isl.souls.filter(s => s.status !== 'found').map(s => s.id) : [];
  return (
    <Card title={`Fairy Souls: ${f.collected} из ${f.max}`} className="collect-card"
      right={<span className="muted small">осталось {f.left}{f.unspent >= 5 ? ` · ${f.unspent} ждут обмена у Tia` : ''}</span>}>
      {f.left > 0 && f.unmarkedFound > 0 && (
        <p className="small rift-warn">
          Hypixel говорит только, что собрано {f.collected}, но не какие. Отмечено на сайте: {f.marked}.
          Отметь «Нашёл» у собранных душ — и в списке останутся только {f.left} недостающих.
        </p>
      )}
      <div className="rift-areas">
        {f.islands.map(i => {
          const done = i.found >= i.total;
          return (
            <button key={i.id} className={`rift-area ${island === i.id ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => setIsland(i.id)}>
              <b>{i.name}</b>
              <small className="muted">{i.ru}</small>
              <Progress value={i.total ? i.found / i.total : 0} max={done} />
              <small>{done ? '✓ ' : ''}{i.found} / {i.total}</small>
            </button>
          );
        })}
      </div>
      {isl && (
        <>
          {isl.tip && <p className="small collect-tip"><Rich text={isl.tip} /></p>}
          <div className="collect-bar">
            <Filter value={show} onChange={setShow} options={[['left', 'не отмечены'], ['found', 'отмечены'], ['all', 'все']]} />
            {!readOnly && leftHere.length > 0 && (
              <button className="chip" disabled={busy} onClick={() => onMark(leftHere, true)} title="Если на этом острове ты собрал всё">Отметить весь остров</button>
            )}
          </div>
          {list.length ? (
            <div className="rift-soul-grid">
              {list.map(s => (
                <div key={s.id} className={`rift-soul ${s.status === 'found' ? 'found' : 'maybe'}`}>
                  <div className="rift-soul-head">
                    <b>Душа №{s.n}</b>
                    <span className={`small ${s.status === 'found' ? 'tone-good' : 'muted'}`}>{s.status === 'found' ? 'найдена' : 'не отмечена'}</span>
                  </div>
                  <div className="small">{s.hint}</div>
                  <div className="rift-soul-foot">
                    <button className="chip tiny" title="Скопировать координаты" onClick={() => copy(`${s.x} ${s.y} ${s.z}`)}>📍 {s.x} {s.y} {s.z}</button>
                    {!readOnly && s.status !== 'found' && <button className="chip tiny" disabled={busy} onClick={() => onMark([s.id], true)}>Нашёл</button>}
                    {!readOnly && s.marked && <button className="chip tiny" disabled={busy} onClick={() => onMark([s.id], null)}>Сбросить</button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="muted">{show === 'left' ? 'На этом острове всё отмечено 🎉' : 'Пусто.'}</p>}
        </>
      )}
    </Card>
  );
}

const contactWhere = c => (c.islandName ? `${c.islandName}${c.where ? ` · ${c.where}` : ''}` : 'по квесту или ивенту');

function ContactBadge({ c }) {
  return c.status === 'have' ? <span className="small tone-good">в телефоне</span> : c.free ? <span className="small tone-good">без условий</span> : null;
}

// Строка контакта: имя, остров и как дойти, условие, координаты
function ContactRow({ c, className = '' }) {
  return (
    <div className={`collect-row ${c.status} ${className}`}>
      <div className="collect-row-main">
        <b>{c.name}</b>
        <ContactBadge c={c} />
        <div className="small muted">{contactWhere(c)}</div>
      </div>
      <div className="collect-row-req small">
        {c.requirement.length ? c.requirement.map((r, i) => <div key={i}><Rich text={r} /></div>) : '—'}
      </div>
      {c.pos && <button className="chip tiny" title="Скопировать координаты" onClick={() => copy(`${c.pos.x} ${c.pos.y} ${c.pos.z}`)}>📍 {c.pos.x} {c.pos.y} {c.pos.z}</button>}
    </div>
  );
}

// Сетка контактов как меню телефона в игре: головы NPC, полученные — яркие, остальные — тусклые.
// Нажатие на голову показывает подробности под сеткой.
function PhoneGrid({ list: all }) {
  const [sel, setSel] = useState(null);
  const list = [...all].sort((a, b) => (a.status === 'have' ? 0 : 1) - (b.status === 'have' ? 0 : 1));
  const c = list.find(x => x.name === sel) || null;
  const detail = useRef(null);
  useEffect(() => { if (sel) detail.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [sel]);
  return (
    <>
      <div className="mc-grid phone-grid">
        {list.map(x => (
          <span key={x.name} className={`phone-slot ${x.status}${sel === x.name ? ' sel' : ''}`}>
            <ItemIcon id={x.id || 'PAPER'} size={36} slot title={`${x.name} — ${x.status === 'have' ? 'в телефоне' : 'нет в телефоне'}`}
              onClick={() => setSel(sel === x.name ? null : x.name)} />
          </span>
        ))}
      </div>
      <div ref={detail}>
        {c ? <ContactRow c={c} className="phone-detail" />
          : <p className="small muted">Нажми на контакт, чтобы увидеть, где он и что для него нужно.</p>}
      </div>
    </>
  );
}

/** Контакты Abiphone. compact — для карточки телефона: сетка голов, подробности по нажатию. */
export function AbiphoneContacts({ a, compact = false }) {
  const [show, setShow] = useState(compact ? 'all' : 'left');
  const list = a.contacts.filter(c => show === 'all' || (show === 'left' ? c.status !== 'have' : c.status === 'have'));
  const n = v => (a.available ? ` · ${v}` : '');
  return (
    <>
      {!a.available && <p className="small rift-warn">В профиле нет данных Abiphone: телефона ещё не было или API их не отдал. Ниже — все контакты и что для них нужно.</p>}
      <Filter value={show} onChange={setShow} options={[['left', `нет в телефоне${n(a.total - a.have)}`], ['have', `в телефоне${n(a.have)}`], ['all', 'все']]} />
      {!list.length ? <p className="muted">{show === 'left' ? 'Все контакты собраны 🎉' : 'Пусто.'}</p>
        : compact ? <PhoneGrid list={list} />
        : <div className="collect-rows">{list.map(c => <ContactRow key={c.name} c={c} />)}</div>}
      {a.other?.length > 0 && <p className="small muted">Ещё в телефоне (нет в справочнике): {a.other.join(', ')}</p>}
    </>
  );
}

function Abiphone({ a }) {
  return (
    <Card title={a.available ? `Контакты Abiphone: ${a.have} из ${a.total}` : 'Контакты Abiphone'} className="collect-card" news="abiphone"
      right={a.phone ? <span className="muted small">телефон: {a.phone.name}{a.phone.max ? `, до ${a.phone.max} контактов` : ''}</span> : null}>
      <AbiphoneContacts a={a} />
    </Card>
  );
}

const TIER = { Easy: 'лёгкая', Hard: 'сложная', Expert: 'эксперт', Virtuoso: 'виртуоз', 'Personal Harp': 'Personal Harp' };

function Harp({ h }) {
  return (
    <Card title={`Арфа Melody: ${h.done} из ${h.total}`} className="collect-card"
      right={<span className="muted small">+{h.intGot} из +{h.intMax} Intelligence</span>}>
      {!h.available && <p className="small muted">Данных арфы в профиле нет: похоже, ни одна песня ещё не сыграна. Melody стоит в Парке.</p>}
      <ol className="collect-songs">
        {h.songs.map(s => (
          <li key={s.id} className={`${s.done ? 'done' : ''} ${h.next?.id === s.id ? 'current' : ''}`}>
            <div className="collect-song-head">
              <b>{s.name}</b>
              <span className="small muted">{TIER[s.tier] || s.tier}{s.int ? ` · +${s.int} Int` : ''}</span>
            </div>
            <Progress value={s.done ? 1 : s.best / 100} max={s.done} />
            <span className={`small ${s.perfectDone ? 'tone-good' : s.done ? 'tone-good' : h.next?.id === s.id ? 'tone-warn' : 'muted'}`}>
              {s.perfectDone ? 'идеально' : s.done ? 'пройдена' : h.next?.id === s.id ? `следующая${s.best ? ` · лучший ${s.best}%` : ''}` : s.best ? `лучший ${s.best}%` : 'не пройдена'}
            </span>
          </li>
        ))}
      </ol>
      <p className="small">{h.hair ? '✓ Melody\'s Hair получен.' : 'Melody\'s Hair (+6 Intelligence) Melody даёт, когда все 11 её песен пройдены минимум на 90%.'}</p>
    </Card>
  );
}

function Enigma({ e }) {
  return (
    <Card title={`Enigma Souls: ${e.found} из ${e.total}`} className="collect-card"
      right={<a className="link small" href="#/guides/rift">Гайд «Рифт» →</a>}>
      <Progress value={e.total ? e.found / e.total : 0} max={e.found >= e.total} label={`+${e.found * 20} с к Rift Time`} sub={`из +${e.total * 20} с`} />
      {e.byArea.length ? (
        <ul className="collect-areas small">
          {e.byArea.map(a => <li key={a.area}><span>{a.name}</span><b>{a.left}</b></li>)}
        </ul>
      ) : <p className="muted">Все Enigma Souls найдены 🎉</p>}
      <p className="small muted">Подсказки к каждой душе, координаты и отметки — в гайде «Рифт».</p>
    </Card>
  );
}

// Секции, которые заменены интерактивными карточками выше
const REPLACED = /^(Fairy Souls по островам|Недостающие контакты Abiphone|Контакты Abiphone|Песни арфы|Enigma Souls)/;

export default function Collectibles({ guide: initial, state }) {
  const [guide, setGuide] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setGuide(initial), [initial]);
  const readOnly = state?.view?.self === false; // чужой профиль: отмечать нельзя
  const onMark = async (ids, value) => {
    setBusy(true); setErr('');
    try {
      await api('/collectibles/marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fairy', ids, value }) });
      setGuide(await api('/guides/collectibles'));
    } catch (e) {
      setErr(/Ошибка \d|fetch/i.test(e.message) ? 'Отметка не сохранилась: сервер не отвечает' : e.message);
    }
    setBusy(false);
  };
  const c = guide.collect;
  const sections = (guide.sections || []).filter(s => !REPLACED.test(s.title));
  return (
    <>
      <GuideHero guide={guide}>
        {c && (
          <div className="rift-stats">
            <span>Fairy Souls: <b>{c.fairy.collected}/{c.fairy.max}</b></span>
            <span>Enigma Souls: <b>{c.enigma.found}/{c.enigma.total}</b></span>
            <span>Abiphone: <b>{c.abiphone.available ? `${c.abiphone.have}/${c.abiphone.total}` : '—'}</b></span>
            <span>Арфа: <b>{c.harp.done}/{c.harp.total}</b></span>
          </div>
        )}
      </GuideHero>
      <NextSteps guide={guide} />
      {err && <div className="card warn-card span-12" role="alert">{err}</div>}
      {c && <Fairy f={c.fairy} onMark={onMark} busy={busy} readOnly={readOnly} />}
      {c && <div className="collect-pair"><Harp h={c.harp} /><Enigma e={c.enigma} /></div>}
      {c && <Abiphone a={c.abiphone} />}
      {sections.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
