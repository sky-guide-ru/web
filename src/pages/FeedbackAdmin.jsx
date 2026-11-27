import { LOCALE } from '../i18n.js';
// Раздел «Отзывы» — только владельцу: всё, что прислали через «Сообщить об ошибке», и состояние почты.
import { useCallback, useEffect, useState } from 'react';
import { ago } from '../api.js';

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json());

export default function FeedbackAdmin() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('new');
  const [msg, setMsg] = useState(null);
  const [removed, setRemoved] = useState([]); // кто убран из рейтинга (ники в нижнем регистре)
  const load = useCallback(() => {
    fetch('/api/admin/leaderboard/removed', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => j && setRemoved(j.items || [])).catch(() => {});
    return fetch('/api/admin/feedback', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Раздел только для владельца сайта' : `Ошибка ${r.status}`))))
      .then(j => { setD(j); setErr(null); }).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="card warn-card">{err}</div>;
  if (!d) return <div className="muted small"><div className="spinner" /> Загружаю отзывы…</div>;

  const act = async (id, what, body) => { const r = await post(`/api/admin/feedback/${id}/${what}`, body); if (r?.error) setMsg(r.error); load(); };
  // Запрос «Убрать ник»: убрать из рейтинга или вернуть
  const board = async (what, player, id) => {
    const r = await post(`/api/leaderboard/${what}`, { player });
    if (r?.error) setMsg(r.error);
    else if (what === 'remove' && id) await post(`/api/admin/feedback/${id}/status`, { status: 'done' });
    load();
  };
  const isRemoved = n => removed.some(x => x.name === String(n || '').toLowerCase());
  const test = async () => { setMsg('Отправляю письмо-проверку…'); const r = await post('/api/admin/feedback-test'); setMsg(r.ok ? 'Письмо-проверка ушло — посмотри почту ✓' : `Не ушло: ${r.error}`); };
  const counts = { new: d.items.filter(f => f.status === 'new').length, done: d.items.filter(f => f.status === 'done').length, all: d.items.length };
  const shown = d.items.filter(f => filter === 'all' || f.status === filter);
  const m = d.mail;

  return (
    <div className="fb-admin">
      <div className="card">
        <h2>Отзывы посетителей</h2>
        <p className="muted small">Всё, что прислали кнопкой «Сообщить об ошибке» внизу страниц. Каждый отзыв хранится здесь{m.configured ? ' и приходит письмом' : ''}.</p>
        <div className={`fb-mail ${m.configured ? (m.last?.ok === false ? 'bad' : 'ok') : 'off'}`}>
          {m.configured
            ? <>Почта: письма уходят на <b>{m.to}</b> с темой «{d.tag} …». {m.last?.at ? (m.last.ok ? `Последнее письмо ушло ${ago(m.last.at)}.` : `Последнее не ушло ${ago(m.last.at)}: ${m.last.error}`) : ''}</>
            : <>Почта не настроена: отзывы только сохраняются здесь. Чтобы они приходили на почту, впиши в <code>.env</code> <code>MAIL_DOMAIN</code> и <code>MAIL_TO</code> (прямая отправка, docs/mail.md) или <code>SMTP_USER</code> и <code>SMTP_PASS</code> (Gmail и пароль приложения) и перезапусти сайт.</>}
          {' '}<button className="btn ghost small" onClick={test}>Проверить почту</button>
        </div>
        {msg && <p className="small fb-msg">{msg}</p>}
        <div className="tabs fb-filter">
          {[['new', 'Новые'], ['done', 'Разобранные'], ['all', 'Все']].map(([id, label]) => (
            <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label} · {counts[id]}</button>
          ))}
        </div>
      </div>
      {!shown.length && <div className="card muted">{filter === 'new' ? 'Новых отзывов нет ✓' : 'Пока пусто'}</div>}
      {shown.map(f => (
        <div key={f.id} className={`card fb-item ${f.status}`}>
          <div className="fb-item-head">
            <span className={`badge fb-t-${f.type}`}>{(Object.hasOwn(d.types, f.type) && d.types[f.type]) || 'Отзыв'}</span>
            <span className="muted small">{new Date(f.at).toLocaleString(LOCALE)} · {ago(f.at)}</span>
            <span className="muted tiny">№ {f.id}</span>
          </div>
          {f.type === 'nick' && f.target && (
            <div className="fb-nick row-gap">
              <span>Убрать из рейтинга: <b>{f.target}</b></span>
              {isRemoved(f.target)
                ? <><span className="green small">убран ✓</span><button className="btn ghost small" onClick={() => board('restore', f.target)}>Вернуть</button></>
                : <button className="btn small" onClick={() => board('remove', f.target, f.id)}>Убрать из рейтинга</button>}
            </div>
          )}
          {f.text && <p className="fb-item-text">{f.text}</p>}
          <div className="muted small fb-item-meta">
            {f.page && <span>Страница: <a href={f.page} target="_blank" rel="noopener">{f.page}</a></span>}
            <span>Ник в поле: {f.player ? <b>{f.player}{f.profile ? ` / ${f.profile}` : ''}</b> : '—'}</span>
            <span>{f.user ? <>Вошёл как <b>{f.user}</b></> : 'Гость'}</span>
            {f.contact && <span>Связь: <b>{f.contact}</b></span>}
            {f.build && <span>Сборка: {f.build}</span>}
            {f.screen && <span>Экран: {f.screen}</span>}
            <span>{f.mailed ? 'Письмо ушло ✓' : f.mailError ? `Письмо не ушло: ${f.mailError}` : m.configured ? 'Письмо отправляется…' : 'Без письма'}</span>
          </div>
          {f.shot && <a href={`/api/admin/feedback/${f.id}/shot`} target="_blank" rel="noopener" className="fb-item-shot"><img src={`/api/admin/feedback/${f.id}/shot`} alt="Скриншот" loading="lazy" /></a>}
          {f.ua && <details className="muted tiny"><summary>Браузер</summary>{f.ua}</details>}
          <div className="row-gap">
            {f.status === 'new'
              ? <button className="btn small" onClick={() => act(f.id, 'status', { status: 'done' })}>Разобрано ✓</button>
              : <button className="btn ghost small" onClick={() => act(f.id, 'status', { status: 'new' })}>Вернуть в новые</button>}
            {m.configured && !f.mailed && <button className="btn ghost small" onClick={() => act(f.id, 'resend')}>Отправить письмо</button>}
            <button className="btn ghost small" onClick={() => act(f.id, 'delete')}>Удалить</button>
          </div>
        </div>
      ))}
      {removed.length > 0 && (
        <div className="card fb-removed">
          <h3>Убраны из рейтинга · {removed.length}</h3>
          <div className="row-gap">
            {removed.map(x => <span key={x.uuid || x.name} className="chip">{x.name || x.uuid}<button className="x-btn" title="Вернуть в рейтинг" aria-label={`Вернуть ${x.name || x.uuid}`} onClick={() => board('restore', x.name || x.uuid)}>×</button></span>)}
          </div>
        </div>
      )}
    </div>
  );
}
