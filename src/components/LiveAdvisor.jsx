// «Живой советчик»: карточка на главной (совет от ИИ по последним изменениям) и чат, который открывается
// кнопкой в углу на любой странице (ChatDock). Предметы в ответах — кнопки, открывают карточку предмета.
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Badge } from './ui.jsx';
import { ago, viewHeaders, useView, viewKey, me } from '../api.js';
import Markdown, { fixStars } from './Markdown.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import { useApp } from '../App.jsx';

const usd = v => `$${(v || 0).toFixed(v && v < 0.01 ? 4 : 2)}`;

async function call(path, body) {
  if (me.guest) throw new Error('Советчик доступен после входа');
  const r = await fetch(`/api/live${path}`, body === undefined ? { headers: viewHeaders() } : { method: 'POST', headers: { 'Content-Type': 'application/json', ...viewHeaders() }, body: JSON.stringify(body) });
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Нужен вход'); }
  const j = await r.json().catch(() => ({}));
  if (j.mustChange) { location.href = '/account?must=1'; throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
}

// Что сейчас смотрит советчик: показываем человеку вместо молчаливого «…»
const TOOL_RU = {
  get_gear: 'смотрю снаряжение', compare_weapons: 'сравниваю оружие', find_items: 'ищу по хранилищам', get_pets: 'смотрю питомцев',
  get_accessories: 'смотрю аксессуары', get_item: 'смотрю предмет', get_price: 'смотрю цену', get_steps: 'смотрю план', get_money_methods: 'смотрю заработок', set_goal: 'ставлю цель',
};

/** Вопрос с потоковым ответом: onEvent получает { type: 'text' | 'tool' }, возвращает итоговую запись чата */
async function askStream(body, onEvent) {
  const r = await fetch('/api/live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json', ...viewHeaders() }, body: JSON.stringify({ ...body, stream: true }) });
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Нужен вход'); }
  if (!r.ok || !r.body || !String(r.headers.get('Content-Type')).includes('event-stream')) {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
    return j;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, '');
      buf = buf.slice(i + 2);
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'done') return ev.entry;
      if (ev.type === 'error') throw new Error(ev.error);
      onEvent(ev);
    }
  }
  throw new Error('Соединение оборвалось, ответ появится в чате, когда будет готов');
}

// Открыть чат из любого места сайта: openChat() или openChat('вопрос')
export const openChat = (q = '') => dispatchEvent(new CustomEvent('sb-chat', { detail: { q } }));

const SUGGEST = ['Почему я застрял?', 'Хочу M7: построй путь', 'На что копить деньги?', 'Как заработать больше в час?'];

/** Состояние советчика и отправка вопросов — общее для карточки на главной и для чата в углу */
function useAdvisor({ listen = true } = {}) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null); // ответ, который ещё печатается: { q, text, tool }
  const sending = useRef(false); // два быстрых Enter подряд не отправляют вопрос дважды
  // Открыт чужой профиль: и вопросы в чате, и совет — про него, по его данным
  const view = useView();
  const app = useApp();
  const friend = view ? (app?.state?.player?.name || view.player) : null;
  // Друг, вошедший под своим ником, на своём профиле: его вопросы помечены его же ником
  const subject = friend || (me.admin ? null : me.name);
  const mine = c => (subject ? (c.who || '').split(' (')[0].toLowerCase() === subject.toLowerCase() : !c.who);

  const vk = viewKey(view);
  const load = useCallback(() => call('/state').then(setS).catch(() => {}), [vk]);
  useEffect(() => {
    setS(null); // совет прошлого профиля не показываем ни секунды
    load();
    if (!listen) return undefined;
    const es = new EventSource('/api/stream');
    es.addEventListener('live', load);
    return () => es.close();
  }, [load, listen]);

  const run = async (kind, fn) => {
    setBusy(kind); setErr('');
    try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  /** Отправить вопрос; при ошибке вернёт его в поле через onFail */
  const [failed, setFailed] = useState(null); // вопрос, на который ответа не вышло: кнопка «Повторить»
  const ask = (question, deep, onFail) => !busy && !sending.current && question.trim() && run(deep ? 'deep' : 'ask', async () => {
    sending.current = true;
    setFailed(null);
    setDraft({ q: question, text: '', tool: '' });
    try {
      await askStream({ question, deep }, ev => setDraft(d => d && (ev.type === 'tool'
        ? { ...d, text: '', tool: TOOL_RU[ev.name] || ev.name } // текст до инструмента — черновик, итог придёт после
        : { ...d, text: d.text + ev.text, tool: '' })));
    } catch (e) { onFail?.(question); setFailed({ q: question, deep }); throw e; }
    finally { setDraft(null); sending.current = false; }
  });
  const clear = () => run('clear', () => call('/chat/clear', {}));
  const chat = (s?.chat || []).filter(mine);
  const live = s?.mode === 'live';
  const offText = s?.mode === 'off' ? 'Чат с советчиком сейчас выключен владельцем сайта.' : 'Чат с советчиком на этом сайте пока не подключён.';
  return { s, load, run, ask, clear, busy, err, draft, chat, live, friend, subject, offText, failed, openItem: app?.openItem };
}

function Budget({ s }) {
  if (s.mode === 'free') return <>{s.friend ? 'не подключён' : 'без ИИ: добавь ANTHROPIC_API_KEY в .env'}</>;
  if (s.mode === 'off') return <>выключен</>;
  // Другу не показываем доллары: только сколько вопросов осталось (0, если общий бюджет на день кончился)
  if (s.friend && s.questions) return <>вопросов сегодня: {s.budget.leftUsd > 0 ? s.questions.left : 0} из {s.questions.limit}</>;
  if (s.friend) return <>{s.budget.leftUsd > 0 ? 'можно спрашивать' : 'на сегодня вопросы кончились'}</>;
  return <>сегодня {usd(s.budget.today.usd)} из {usd(s.budget.dailyUsd)} · за месяц {usd(s.budget.monthUsd)}</>;
}

/** Переписка: вопросы справа, ответы слева; длинный ответ свёрнут */
function ChatThread({ adv }) {
  const end = useRef(null);
  // Прокручиваем только сам чат, а не всю страницу
  useEffect(() => { const box = end.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; }, [adv.chat.length, adv.subject, adv.draft?.text, adv.draft?.tool]);
  return (
    <div className="cd-thread">
      {adv.chat.map((c, i) => (
        <div key={c.at + '-' + i} className="cd-pair">
          <div className="cd-q">{c.q}</div>
          <div className="cd-a">
            {/* NPC, мобы, места и механики — пунктиром, с подсказкой, как в гайдах */}
            <RefsProvider refs={c.refs}><Markdown text={c.a} onItem={adv.openItem} collapse={i === adv.chat.length - 1 ? 0 : 4} /></RefsProvider>
            <div className="cd-meta">{c.model?.includes('sonnet') ? <Badge>подробно</Badge> : null} {usd(c.usd)}{c.ms ? ` · ${(c.ms / 1000).toFixed(1)} с` : ''}{c.tools?.length ? ` · смотрел: ${c.tools.map(t => TOOL_RU[t]?.replace(/^смотрю /, '') || t).join(', ')}` : ''}</div>
          </div>
        </div>
      ))}
      {adv.draft && (
        <div className="cd-pair">
          <div className="cd-q">{adv.draft.q}</div>
          <div className="cd-a">
            {adv.draft.text ? <Markdown text={adv.draft.text} /> : <div className="la-typing muted small"><span className="la-dots"><i /><i /><i /></span>{adv.draft.tool ? `${adv.draft.tool}…` : 'думаю…'}</div>}
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

/** Кнопка в углу и окно чата поверх любой страницы. На телефоне окно на весь экран. */
// Гостю советчик недоступен (/api/live только после входа): не дёргаем его вовсе, иначе 401 уводит гостя на страницу входа
export function ChatDock() {
  return me.guest ? null : <ChatDockInner />;
}

function ChatDockInner() {
  const [open, setOpen] = useState(false);
  const adv = useAdvisor({ listen: open });
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => {
    const f = e => { setOpen(true); if (e.detail?.q) setQ(e.detail.q); setTimeout(() => input.current?.focus(), 50); };
    addEventListener('sb-chat', f);
    return () => removeEventListener('sb-chat', f);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    adv.load();
    const k = e => { if (e.key === 'Escape' && !document.querySelector('.modal-bg, .gref-tip.pinned')) setOpen(false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = adv.s;
  // Нет ИИ и нет переписки — кнопку не показываем (на главной об этом говорит строка советчика)
  if (!s || (!adv.live && !adv.chat.length)) return null;
  const send = (text, deep = false) => { const v = (text ?? q).trim(); if (!v) return; setQ(''); adv.ask(v, deep, setQ); };
  return (
    <>
      {!open && (
        <button type="button" className="chat-fab" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 50); }} title="Спросить советчика про профиль" aria-label="Открыть чат с советчиком">
          <span aria-hidden="true">🧠</span><span className="chat-fab-text">Советчик</span>
        </button>
      )}
      {open && (
        <section className="chat-dock" role="dialog" aria-label="Чат с советчиком">
          <header className="cd-head">
            <div>
              <b>🧠 Советчик</b>
              <div className="cd-sub">{adv.friend ? <>про профиль <b>{adv.friend}</b> · </> : null}<Budget s={s} /></div>
            </div>
            {adv.chat.length > 0 && <button type="button" className="cd-icon" onClick={adv.clear} disabled={!!adv.busy} title="Очистить переписку">🗑</button>}
            <button type="button" className="cd-icon" onClick={() => setOpen(false)} title="Свернуть (Esc)" aria-label="Закрыть чат">✕</button>
          </header>
          {adv.chat.length || adv.draft ? <ChatThread adv={adv} /> : (
            <div className="cd-empty">
              <p className="muted small">Спроси про {adv.friend ? 'этот' : 'свой'} профиль: советчик видит скиллы, снаряжение, питомцев, хранилища и цены рынка. Предметы в ответе можно открыть кликом.</p>
              <div className="cd-suggest">
                {SUGGEST.map(t => <button key={t} type="button" className="chip" disabled={!adv.live || !!adv.busy} onClick={() => send(t)}>{t}</button>)}
              </div>
            </div>
          )}
          {(adv.err || s.error) && (
            <p className="la-warn cd-err">
              {adv.err || s.error}
              {adv.err && adv.failed && <button type="button" className="btn ghost sm cd-retry" disabled={!!adv.busy || !adv.live} onClick={() => { setQ(''); adv.ask(adv.failed.q, adv.failed.deep, setQ); }}>↻ Повторить</button>}
            </p>
          )}
          <div className="cd-input">
            <textarea ref={input} value={q} onChange={e => setQ(e.target.value)} rows={1} disabled={!adv.live} maxLength={500}
              placeholder={adv.live ? (adv.friend ? `Вопрос про ${adv.friend}…` : 'Твой вопрос…') : adv.offText}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn ghost cd-deep" disabled={!!adv.busy || !adv.live || !q.trim()} onClick={() => send(undefined, true)} title="Ответ модели посильнее (Claude Sonnet 5.5), примерно $0,03">Подробно</button>
            <button type="button" className="btn cd-send" disabled={!!adv.busy || !adv.live || !q.trim()} onClick={() => send()} aria-label="Отправить">{adv.busy === 'ask' || adv.busy === 'deep' ? '…' : '↑'}</button>
          </div>
        </section>
      )}
    </>
  );
}

/** Цель игрока: полоски прогресса считает сайт по данным профиля, путь — от советчика */
function Goal({ g, note, canEdit, busy, onClear }) {
  return (
    <div className={`la-goal${g.done ? ' done' : ''}`}>
      <div className="la-goal-head">
        <span>🎯 Цель: <b><Rich text={g.title} /></b>{g.done ? ' · достигнута!' : ''}</span>
        {canEdit && <button type="button" className="chip tiny" disabled={busy} onClick={onClear} title="Убрать цель. Новую можно поставить в чате">убрать</button>}
      </div>
      <div className="la-goal-bars">
        {g.targets.map((t, i) => (
          <div key={i} className="goal" title={t.label}>
            <span className="goal-label">{t.label}</span>
            <span className="goal-bar"><i style={{ width: `${Math.max(2, t.p * 100)}%` }} /></span>
            <b>{t.text}</b>
          </div>
        ))}
      </div>
      {note && <p className="la-goal-note small"><Rich text={fixStars(note)} /></p>}
      {g.route?.length > 0 && <p className="la-goal-route muted small">Путь: <Rich text={g.route.join(' → ')} /></p>}
    </div>
  );
}

/**
 * Карточка на главной: «диагноз аккаунта» — главное, что тормозит профиль, 1–2 факта (куда ушло время)
 * и цель игрока. План и ленту не повторяет. Сам чат — в окне по кнопке.
 */
export default function LiveAdvisor({ className = 'span-12' }) {
  const adv = useAdvisor();
  const { s, live, friend, chat, busy } = adv;
  if (!s) return null;
  const a = s.advice;

  // Без ключа ИИ и без накопленных советов/чата — одна строка вместо большого пустого блока,
  // чтобы «Что делать прямо сейчас» было видно сразу. Другу не пишем про .env: настроить советчика может только владелец
  if (!live && !a && !chat.length && !s.goal) {
    return (
      <div className={`la-compact muted small ${className}`}>
        {s.friend
          ? <>🧠 {adv.offText} Подсказки «Что делать» и гайды работают и без него.</>
          : <>🧠 Живой советчик {s.mode === 'off' ? 'выключен' : 'без ИИ'}: чтобы получать разбор профиля и задавать вопросы, добавь <code>ANTHROPIC_API_KEY</code> в <code>.env</code> (см. README).</>}
      </div>
    );
  }

  // Старые советы (до диагноза) хранили «что изменилось» в changes
  const facts = a ? (a.facts || [a.changes]).filter(Boolean).slice(0, 2) : [];
  const askBtn = <button type="button" className="btn sm" disabled={!live && !chat.length} onClick={() => openChat()}>💬 {chat.length ? `Чат (${chat.length})` : 'Спросить'}</button>;
  return (
    <Card title="Живой советчик" icon="🧠" right={<span className="muted small"><Budget s={s} /></span>} className={`live-advisor la-slim ${className}`}>
      {friend && <p className="la-friend small">Открыт профиль <b>{friend}</b>{s.coopMate ? ' (сосед по коопу)' : ''}: разбор и чат про него.</p>}
      {!a && s.busy ? (
        <p className="muted"><span className="spinner sm" /> Советчик разбирает профиль{s.adviceFor ? ` ${s.adviceFor.split(' (')[0]}` : ''}…</p>
      ) : !a && s.friend && !s.adviceFor ? (
        <p className="muted">Спроси советчика про свой профиль: почему застрял, на что копить, где взять предмет. Чат открывается кнопкой 🧠 в углу.</p>
      ) : a ? (
        <div className="la-advice">
          <div className="la-headline"><Rich text={fixStars(a.headline)} /></div>
          {facts.length > 0 && <ul className="la-facts">{facts.map((f, i) => <li key={i}><Rich text={fixStars(f)} /></li>)}</ul>}
        </div>
      ) : (
        <p className="muted">{!live ? 'Разбор ИИ выключен. Шаги — в блоке «Что делать прямо сейчас».'
          : s.adviceFor ? `Разбора по ${s.adviceFor.split(' (')[0]} пока нет${s.autoNote && s.autoNote !== 'недавно пробовали' ? `: ${s.autoNote}` : ''}. Нажми ↻.`
          : 'Первый разбор появится после загрузки профиля.'}</p>
      )}

      {s.goal && <Goal g={s.goal} note={a?.goal} canEdit={s.canGoal && !s.friend || s.viewSelf} busy={!!busy} onClear={() => adv.run('goal', () => call('/goal/clear', {}))} />}

      <div className="la-bar">
        <span className="muted tiny">{a ? `разбор ${ago(a.at)}` : ''}</span>
        <div className="row-gap">
          {!s.goal && s.canGoal && live && <button type="button" className="btn ghost sm" onClick={() => openChat('Хочу ')} title="Напиши в чате, чего хочешь добиться: советчик построит путь, а сайт будет вести прогресс">🎯 Цель</button>}
          {askBtn}
          {(!s.friend || s.adviceFor) && <button className="btn ghost sm" disabled={!!busy || !live || s.busy} onClick={() => adv.run('refresh', () => call('/refresh', {}))} title="Обновить разбор" aria-label="Обновить разбор">{busy === 'refresh' || s.busy ? '…' : '↻'}</button>}
        </div>
      </div>
      {(adv.err || s.error) && <p className="la-warn">{adv.err || s.error}</p>}
    </Card>
  );
}
