import { LOCALE } from '../i18n.js';
// Посещения, ошибки и почта на странице «Сервер» (только владелец). Данные — свой учёт сайта (server/monitor),
// без внешних счётчиков: IP не хранится, уникальные посетители считаются по хешу с солью, которая меняется каждые сутки.
import { useCallback, useEffect, useState } from 'react';
import { ago } from '../api.js';

const SECTIONS = {
  overview: 'Обзор', roadmap: 'Что делать', skills: 'Прогресс', gear: 'Снаряжение', accessories: 'Аксессуары', pets: 'Питомцы',
  museum: 'Музей', stash: 'Запасы', collections: 'Коллекции', minions: 'Миньоны', guides: 'Гайды', events: 'События',
  compare: 'Сравнение', top: 'Рейтинг', money: 'Заработок', market: 'Рынок', wiki: 'Вики', status: 'Сервер', item: 'Карточка предмета', other: 'Другое',
};
const PERIODS = [['today', 'Сегодня'], ['yesterday', 'Вчера'], ['week', '7 дней'], ['month', '30 дней'], ['quarter', '90 дней']];
// Сколько дней показывать на графике и с чем сравнивать
const SPAN = { today: 30, yesterday: 30, week: 30, month: 30, quarter: 90 };
const VS = { yesterday: 'к позавчера', week: 'к прошлой неделе', month: 'к прошлым 30 дням' };
const KIND = { client: 'браузер', server: 'сервер', api: 'внешний API' };
const num = n => Number(n || 0).toLocaleString(LOCALE);
const sec = ms => (ms == null ? '—' : ms >= 10_000 ? 'дольше 7 с' : `до ${(ms / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} с`);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
// Названия стран и языков — из браузера (Intl), флаг — из кода страны
const names = type => { try { return new Intl.DisplayNames([LOCALE], { type }); } catch { return null; } };
const REGION = names('region'), LANGUAGE = names('language');
const flag = c => String.fromCodePoint(...[...c].map(ch => 0x1f1a5 + ch.charCodeAt(0)));
const countryName = c => (c === '?' ? 'не определена' : `${flag(c)} ${REGION?.of(c) || c}`);
const langName = c => (c === '?' ? 'не указан' : `${LANGUAGE?.of(c) || c} (${c})`);
const GROUPS = { search: 'Поиск', social: 'Соцсети и мессенджеры', sites: 'Другие сайты', direct: 'Прямой заход' };

/** Полоски с числом и долей в % */
function Bars({ rows, total, label = k => k }) {
  if (!rows.length) return <p className="muted small">Пока пусто.</p>;
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <ul className="mon-bars">
      {rows.map(([k, v]) => (
        <li key={k}>
          <span title={String(label(k))}>{label(k)}</span><i style={{ width: `${Math.max(3, v / max * 100)}%` }} />
          <b>{num(v)}{total ? <small className="muted"> · {pct(v, total)}%</small> : null}</b>
        </li>
      ))}
    </ul>
  );
}

/** Изменение к прошлому такому же периоду: ▲ 12% / ▼ 5% */
function Delta({ now, before }) {
  if (before == null) return null;
  if (!before) return now ? <em className="mon-delta up">новое</em> : null;
  const d = Math.round((now - before) / before * 100);
  return <em className={`mon-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d)}%</em>;
}

/** Столбики по дням: русская версия снизу, английская сверху; красная точка — день с ошибками */
function Days({ days }) {
  const max = Math.max(1, ...days.map(d => d.visitors));
  return (
    <>
      <div className="mon-days" role="img" aria-label={`Посетители по дням за ${days.length} дней`}>
        {days.map(d => (
          <span key={d.day} title={`${d.day.split('-').reverse().join('.')}: посетителей ${d.visitors} (на /en/ ${d.en}), просмотров ${d.views}, ников ${d.nicks}${d.errors ? `, ошибок ${d.errors}` : ''}`}>
            {d.en > 0 && <i className="en" style={{ height: `${d.en / max * 100}%` }} />}
            <i style={{ height: `${Math.max(2, (d.visitors - d.en) / max * 100)}%` }} />{d.errors > 0 && <em />}
          </span>
        ))}
      </div>
      <div className="mon-axis muted"><span>{days[0]?.day.split('-').reverse().slice(0, 2).join('.')}</span>
        <span><i className="mon-key" /> русская <i className="mon-key en" /> /en/</span><span>сегодня</span></div>
    </>
  );
}

/** Просмотры по часам суток (время сервера LIVE_TZ) */
function Hours({ hours, tz }) {
  const max = Math.max(1, ...hours);
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return <p className="muted small">Пока пусто.</p>;
  return (
    <>
      <div className="mon-days mon-hours" role="img" aria-label="Просмотры по часам">
        {hours.map((v, h) => <span key={h} title={`${h}:00–${h}:59 — просмотров ${v} (${pct(v, total)}%)`}><i style={{ height: `${Math.max(2, v / max * 100)}%` }} /></span>)}
      </div>
      <div className="mon-axis muted"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
      <p className="muted small">Время: {tz}.</p>
    </>
  );
}

const VIA = { direct: 'напрямую со своего сервера', resend: 'через Resend', smtp: 'через SMTP' };

// Нужные DNS-записи для прямой отправки и что в DNS сейчас (docs/mail.md)
function MailDns({ d }) {
  if (d.loading) return <p className="muted small"><span className="spinner" /> Проверяю DNS…</p>;
  if (!d.ok) return <p className="neg small">{d.error}</p>;
  return (
    <div className="small">
      <p><b className={d.port25.ok ? 'pos' : 'neg'}>{d.port25.ok ? '✓ Порт 25 открыт' : '✗ Порт 25 закрыт'}</b> <span className="muted">{d.port25.note}</span></p>
      <ul className="st-log">
        {d.records.map(r => (
          <li key={r.id}>
            <b className={r.ok ? 'pos' : r.id === 'dmarc' ? 'muted' : 'neg'}>{r.ok ? '✓' : r.id === 'dmarc' ? '○' : '✗'} {r.type}</b>
            <span><code>{r.name}</code> → <code style={{ wordBreak: 'break-all' }}>{r.want}</code>
              {!r.ok && <span className="muted"> · сейчас: {r.have || 'нет'}</span>}</span>
          </li>
        ))}
      </ul>
      <p className="muted">{d.ready ? 'Всё готово: письма уходят напрямую. DMARC — по желанию, но лучше добавить.' : 'Пока не всё настроено, письма уходят запасным способом. DNS обновляется от 5 минут до нескольких часов.'}</p>
    </div>
  );
}

export default function StatusMonitor() {
  const [m, setM] = useState(null);
  const [fail, setFail] = useState(false);
  const [period, setPeriod] = useState('today');
  const [mailMsg, setMailMsg] = useState(null);
  const [dnsCheck, setDnsCheck] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    if (document.hidden) return;
    fetch('/api/admin/monitor', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { setM(j); setFail(false); }).catch(() => setFail(true));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (!m) return <div className="card span-12">{fail ? 'Не удалось загрузить статистику' : <><div className="spinner" /> Загружаю статистику…</>}</div>;
  const s = m[period];
  const devTotal = s.devices.mobile + s.devices.desktop;
  const p = m.prev?.[period];

  const resolve = fp => fetch('/api/admin/monitor/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fp }) }).then(load);
  const testMail = () => {
    setMailMsg('Отправляю…');
    fetch('/api/admin/monitor/test-mail', { method: 'POST' }).then(r => r.json())
      .then(j => setMailMsg(!j.ok ? j.error || 'Не получилось отправить'
        : `Письмо ушло ${VIA[j.via] || ''}, проверь почту (и папку «Спам»).${j.failed?.length ? ` Напрямую не получилось: ${j.failed[0]}` : ''}`))
      .catch(() => setMailMsg('Сервер не ответил'));
  };
  const checkDns = () => {
    setDnsCheck({ loading: true });
    fetch('/api/admin/mail/check', { cache: 'no-store' }).then(r => r.json()).then(setDnsCheck).catch(() => setDnsCheck({ ok: false, error: 'Сервер не ответил' }));
  };


  return (
    <>
      <div className="card span-12">
        <div className="mon-head">
          <h3>Посещения</h3>
          <div className="tabs" role="tablist">
            {PERIODS.map(([k, l]) => <button key={k} className={period === k ? "active" : ""} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
        </div>
        <p className="muted small">Свой счётчик сайта: без cookie и сторонних сервисов, IP не сохраняется, хранятся только суммы за день. Ты сам, боты и браузеры с «Не отслеживать» не считаются.</p>
        <div className="mon-stats">
          <div><b>{num(s.visitors)}</b><span>посетителей <Delta now={s.visitors} before={p?.visitors} /></span></div>
          <div><b>{num(s.views)}</b><span>просмотров разделов <Delta now={s.views} before={p?.views} /></span></div>
          <div title="Сколько разделов в среднем открыл один посетитель"><b>{s.visitors ? (s.views / s.visitors).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) : '—'}</b><span>разделов на человека</span></div>
          <div><b>{pct(s.devices.mobile, devTotal)}%</b><span>с телефона</span></div>
          <div><b>{pct(s.langs.en, s.visitors)}%</b><span>на /en/ ({num(s.langs.en)}) <Delta now={s.langs.en} before={p?.en} /></span></div>
          <div title="Сколько разных ников открыли гости. За несколько дней — сумма по дням. Сами ники не сохраняются; твой профиль, кооп, друзья и скрытые игроки не считаются"><b>{num(s.nicks.distinct)}</b><span>{period === 'today' || period === 'yesterday' ? 'разных ников' : 'ников (сумма по дням)'} <Delta now={s.nicks.distinct} before={p?.nicks} /></span></div>
        </div>
        {VS[period] && <p className="muted small">▲▼ — {VS[period]}.</p>}
        <Days days={m.days.slice(-SPAN[period])} />
      </div>

      <div className="card span-6">
        <h3>Страны</h3>
        <p className="muted small">По офлайн-базе <a href="https://db-ip.com" target="_blank" rel="noreferrer">DB-IP</a> на нашем сервере: адрес сверяется и сразу забывается, хранится только «страна +1».
          {!m.geo?.ready && <> {m.geo?.off ? 'Определение стран выключено (GEO_OFF).' : `База стран ещё не скачалась${m.geo?.lastError ? ` (${m.geo.lastError})` : ''}, пока страна «не определена».`}</>}</p>
        <Bars rows={s.countries} total={s.visitors} label={countryName} />
      </div>
      <div className="card span-6">
        <h3>Язык и версия сайта</h3>
        <Bars rows={[['ru', s.langs.ru], ['en', s.langs.en]].filter(r => r[1] > 0)} total={s.visitors} label={k => (k === 'en' ? 'Английская (/en/)' : 'Русская')} />
        <h3 style={{ marginTop: 18 }}>Язык браузера</h3>
        <p className="muted small">Основной язык, который браузер сообщает сайту: кому может пригодиться английская версия.</p>
        <Bars rows={s.blangs} total={s.visitors} label={langName} />
      </div>

      <div className="card span-6">
        <h3>Откуда пришли</h3>
        <Bars rows={Object.entries(s.refGroups || {}).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1])} total={s.visitors} label={k => GROUPS[k] || k} />
        <h3 style={{ marginTop: 18 }}>Сайты</h3>
        <Bars rows={s.refs.filter(([k]) => k !== 'прямой заход')} total={s.visitors} />
        <h3 style={{ marginTop: 18 }}>Метки utm</h3>
        <p className="muted small">Чтобы видеть, какая ссылка привела людей, добавь к ней метку: <code>sky-guide.ru/?utm_source=discord&amp;utm_campaign=guide</code>.</p>
        <Bars rows={s.utm} total={s.visitors} />
      </div>
      <div className="card span-6">
        <h3>Когда заходят</h3>
        <Hours hours={s.hours || []} tz={m.tz} />
        <h3 style={{ marginTop: 18 }}>Устройства</h3>
        <Bars rows={[['desktop', s.devices.desktop], ['mobile', s.devices.mobile]].filter(r => r[1] > 0)} total={devTotal} label={k => (k === 'mobile' ? 'Телефон и планшет' : 'Компьютер')} />
        <div className="mon-two">
          <div><h4>Система</h4><Bars rows={s.oses || []} total={s.visitors} /></div>
          <div><h4>Браузер</h4><Bars rows={s.browsers || []} total={s.visitors} /></div>
        </div>
      </div>

      <div className="card span-6">
        <h3>Разделы</h3>
        <Bars rows={s.sections.slice(0, 12)} total={s.views} label={k => SECTIONS[k] || k} />
      </div>
      <div className="card span-6">
        <h3>С чего начинают</h3>
        <p className="muted small">Первый раздел, который человек открыл за день: куда ведут ссылки и поиск.</p>
        <Bars rows={s.entries || []} total={s.visitors} label={k => SECTIONS[k] || k} />
        <h3 style={{ marginTop: 18 }}>Скорость загрузки</h3>
        <div className="st-kv">
          <span title="Медиана и 75-й перцентиль: у половины и у трёх четвертей посетителей страница загрузилась быстрее">Компьютер (половина / ¾)</span><b>{sec(s.load.desktop.p50)} / {sec(s.load.desktop.p75)}</b>
          <span>Телефон (половина / ¾)</span><b>{sec(s.load.mobile.p50)} / {sec(s.load.mobile.p75)}</b>
          <span>Вошедших на сайт</span><b>{num(s.who.user)}</b>
        </div>
      </div>

      <div className="card span-12">
        <div className="mon-head">
          <h3>Ошибки</h3>
          <span className="muted small">за выбранный период: браузер {num(s.errors.client)}, сервер {num(s.errors.server)}, сбои внешних API {num(s.errors.api)}, ответов с ошибкой 5xx {num(s.s5xx)}</span>
        </div>
        {m.errors.length ? (
          <ul className="mon-errs">
            {m.errors.map(g => (
              <li key={g.fp} className={g.last10m ? 'hot' : ''}>
                <button className="mon-err-top" onClick={() => setOpen(open === g.fp ? null : g.fp)} aria-expanded={open === g.fp}>
                  <span className={`mon-kind ${g.kind}`}>{KIND[g.kind] || g.kind}</span>
                  <span className="mon-err-msg">{g.msg}{g.where && <span className="muted"> · {g.where}</span>}</span>
                  <b>{num(g.count)}×</b>
                  <span className="muted">{ago(g.last)}</span>
                </button>
                {open === g.fp && (
                  <div className="mon-err-body small">
                    {g.where && <div><span className="muted">Где:</span> <code>{g.where}</code></div>}
                    {g.sections.length > 0 && <div><span className="muted">Раздел:</span> {g.sections.map(k => SECTIONS[k] || k).join(', ')}</div>}
                    <div className="muted">Впервые {ago(g.first)}{g.mobile ? ` · с телефона ${g.mobile} раз` : ''}{g.build ? ` · сборка ${g.build}` : ''}{g.last10m ? ` · за 10 минут ${g.last10m} раз` : ''}</div>
                    {g.stack && <pre>{g.stack}</pre>}
                    <button className="btn ghost small" onClick={() => resolve(g.fp)}>Исправлено — убрать из списка</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Ошибок нет. Если появятся, здесь будет текст, место и сколько раз повторилась.</p>}
      </div>

      <div className="card span-12">
        <h3>Почта и тревоги</h3>
        <div className="st-kv">
          <span>Почта</span><b className={m.mail.configured ? 'pos' : 'neg'}>{m.mail.configured ? `шлёт на ${m.mail.to}` : 'не настроена'}</b>
          {m.mail.configured && <><span>Способ</span><b>{VIA[m.mail.transport] || m.mail.transport}{m.mail.from ? ` с ${m.mail.from}` : ''}{m.mail.fallback ? `, запасной — ${VIA[m.mail.fallback]}` : ''}</b></>}
          <span>Сводка за сутки</span><b>{m.mail.configured ? `каждый день в 9:00${m.mail.digestDay ? `, последняя ${m.mail.digestDay.split('-').reverse().join('.')}` : ''}` : '—'}</b>
        </div>
        {!m.mail.configured && <p className="muted small">Чтобы письма приходили, впиши в .env на сервере MAIL_DOMAIN (домен сайта) и MAIL_TO (куда слать) — письма пойдут напрямую с сервера, инструкция в docs/mail.md. Или SMTP_USER и SMTP_PASS (Gmail и пароль приложения). Без почты тревоги всё равно видны здесь.</p>}
        <p className="muted small">Сразу пишу, если: сервер упал или откатил обновление, ключ Hypixel перестал работать, Hypixel молчит больше 15 минут, новая ошибка повторилась 5 раз за 10 минут, сервер ответил ошибкой 20 раз за 10 минут, кончился дневной лимит ИИ-советчика. Одна и та же тревога — не чаще раза в 3 часа.</p>
        {m.mail.configured && <p><button className="btn ghost small" onClick={testMail}>Отправить проверочное письмо</button>{mailMsg && <span className="muted small" style={{ marginLeft: 10 }}>{mailMsg}</span>}</p>}
        {m.mail.transport === 'direct' && <p><button className="btn ghost small" onClick={checkDns}>Проверить DNS для прямой отправки</button></p>}
        {dnsCheck && <MailDns d={dnsCheck} />}
        {m.alerts.length > 0 && (
          <ul className="st-log">
            {m.alerts.map(a => (
              <li key={`${a.key}${a.at}`} className="crash">
                <b>{a.mailed ? 'Письмо ушло' : 'Без письма'}</b><span>{a.title}</span><span className="muted">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
