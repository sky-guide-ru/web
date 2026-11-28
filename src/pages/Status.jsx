import { LOCALE, DEC } from '../i18n.js';
// Панель состояния сервера — только владельцу сайта: жив ли сервер, нагрузка, лимит Hypixel, обновления и откаты.
import { Fragment, useEffect, useState } from 'react';
import { ago, me } from '../api.js';
import StatusMonitor from './StatusMonitor.jsx';

const LOAD = { low: ['Спокойно', 'ok'], medium: ['Занят', 'mid'], high: ['Перегружен', 'bad'] };
const KIND = { update: 'Обновился', rollback: 'Откат', crash: 'Падение сервера' };

function dur(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}

function Meter({ label, value, max, unit = '', hint }) {
  const pct = Math.max(0, Math.min(100, max ? value / max * 100 : 0));
  const cls = pct > 85 ? 'bad' : pct > 55 ? 'mid' : 'ok';
  return (
    <div className="st-meter" title={hint}>
      <div className="st-meter-top"><span>{label}</span><b>{value}{unit}{max ? <span className="muted"> / {max}{unit}</span> : null}</b></div>
      <div className={`st-bar ${cls}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// Один опрос на адрес для всей страницы: лампочка нагрузки и баннер Hypixel читают одни и те же данные,
// а раньше каждый спрашивал сервер сам (два одинаковых /api/status при открытии и каждые 30 с)
const polls = new Map();
function poll(path, every) {
  let p = polls.get(path);
  if (p) return p;
  p = { s: null, down: false, subs: new Set(), timer: null };
  const emit = () => p.subs.forEach(f => f(p));
  p.load = () => {
    if (document.hidden) return; // вкладка в фоне — не дёргаем сервер
    fetch(path, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { p.s = j; p.down = false; emit(); })
      .catch(() => { p.down = true; emit(); });
  };
  p.start = () => { p.load(); p.timer = setInterval(p.load, every); document.addEventListener('visibilitychange', p.load); };
  p.stop = () => { clearInterval(p.timer); document.removeEventListener('visibilitychange', p.load); polls.delete(path); };
  polls.set(path, p);
  return p;
}

export function useServerStatus(path = '/api/status', every = 30_000) {
  const [v, setV] = useState(() => { const p = polls.get(path); return { s: p?.s || null, down: !!p?.down }; });
  useEffect(() => {
    const p = poll(path, every);
    const on = q => setV({ s: q.s, down: q.down });
    p.subs.add(on);
    if (p.subs.size === 1) p.start(); else on(p);
    return () => { p.subs.delete(on); if (!p.subs.size) p.stop(); };
  }, [path, every]);
  return v;
}

const kb = b => b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', DEC)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`;

export default function Status() {
  const { s, down } = useServerStatus('/api/admin/status', 5000);
  if (!me.admin || me.guest) return <div className="card warn-card"><h3>Это страница владельца сайта</h3><p>Здесь видно состояние сервера. Игрокам она не нужна: нагрузку показывает лампочка вверху.</p></div>;
  if (!s) return <div className="card">{down ? 'Сервер не отвечает' : <><div className="spinner" /> Загружаю…</>}</div>;
  const [loadLabel, loadCls] = LOAD[s.load] || LOAD.low;
  const last = s.deploy.last;
  return (
    <div className="grid status-page">
      <div className="card span-12 st-hero">
        <span className={`st-light ${down ? "bad" : "ok"}`} />
        <div>
          <h2>{down ? 'Сервер не отвечает' : 'Сервер работает'}</h2>
          <div className="muted">Без перерыва {dur(s.uptimeSec)} · сборка {s.build} · Node {s.node.replace(/^v/, '')} · {s.platform}</div>
        </div>
        <span className={`st-chip ${loadCls}`} title={s.why}>Нагрузка: {loadLabel}</span>
      </div>

      <div className="card span-6">
        <h3>Нагрузка</h3>
        <p className="muted small">{s.why[0].toUpperCase() + s.why.slice(1)}. Обновляется раз в 5 секунд.</p>
        <Meter label="Запросы к Hypixel за 5 минут" value={s.hypixel.used5m} max={s.hypixel.limit5m} hint="Лимит ключа — 300 запросов за 5 минут. Ближе к пределу чужие профили обновляются реже" />
        <Meter label="CPU сайта" value={s.cpu.process} max={100} unit="%" hint={`Доля всех ядер сервера (их ${s.cpu.cores}), которую занимает сайт`} />
        {s.cpu.server != null && <Meter label="CPU всего сервера" value={s.cpu.server} max={100} unit="%" hint={`Сайт, Caddy, автообновление и система. Средняя загрузка за 1 / 5 / 15 минут: ${s.cpu.loadavg.join(' / ')}`} />}
        <div className="st-kv">
          <span>Запросов в работе</span><b>{s.requests.inFlight}</b>
          <span>Запросов за минуту</span><b>{s.requests.perMinute}</b>
          <span title="95-й перцентиль задержки цикла событий Node: чем больше, тем медленнее отвечает сайт">Задержка ответа</span><b>{s.requests.lagMs} мс</b>
        </div>
      </div>

      {s.stalls && <StallsCard st={s.stalls} />}
      <MemoryCard m={s.memory} disk={s.disk} />
      <ApiCard api={s.api} />
      <KeyUsageCard h={s.hypixel} />

      <div className="card span-6">
        <h3>Данные</h3>
        <div className="st-kv">
          <span>Свой профиль</span><b className={s.profile.status === 'ok' ? 'pos' : 'neg'}>{({ ok: 'обновляется', error: 'ошибка', loading: 'загружается', starting: 'запускается' })[s.profile.status] || s.profile.status || '—'}{s.profile.updatedAt ? ` · ${ago(s.profile.updatedAt)}` : ''}</b>
          <span>Цены Bazaar</span><b>{s.prices.bazaarAt ? ago(s.prices.bazaarAt) : 'ещё нет'}</b>
          <span>Цены аукциона</span><b>{s.prices.auctionsAt ? ago(s.prices.auctionsAt) : 'ещё нет'}</b>
          {s.history && <><span title="Графики на «Прогрессе»: последние 30 дней по часу, дальше по дню, после года по неделе">История графиков</span><b>{kb(s.history.ownBytes + s.history.friendBytes)} · {s.history.points} точек{s.history.friendFiles ? ` · друзей: ${s.history.friendFiles}` : ''}</b></>}
          {s.marketCharts && <><span title="Свечи Bazaar для «Рынка»: 1 минута за 3 суток, 5 минут за 30 суток, час за год, день — всё время">Графики рынка</span><b>{kb(s.marketCharts.bytes)} · товаров: {s.marketCharts.products}{s.marketCharts.errors ? ` · ошибок записи: ${s.marketCharts.errors}` : ''}</b></>}
        </div>
        {s.profile.error && <p className="neg small">Последняя ошибка: {s.profile.error}</p>}

        <h3 style={{ marginTop: 18 }}>Обновления сайта</h3>
        <p className="muted small">{s.deploy.autoUpdate ? 'Автообновление включено: раз в минуту сервер проверяет main и ставит новые слияния.' : 'Автообновление выключено (AUTO_UPDATE=0 в .env).'}</p>
        {last?.kind === 'rollback' && <div className="card warn-card small"><b>Последнее обновление откатилось:</b> {last.why}. Сайт работает на {last.to}, новая версия встанет после исправления в main.</div>}
        {s.deploy.events.length ? (
          <ul className="st-log">
            {s.deploy.events.map((e, i) => (
              <li key={i} className={e.kind}>
                <b>{KIND[e.kind] || e.kind}</b>
                <span>{e.kind === 'update' ? `${e.from} → ${e.to}, файлов: ${e.files}` : e.kind === 'rollback' ? `${e.why}, вернул ${e.to}` : `код ${e.code}`}</span>
                <span className="muted">{ago(e.at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Пока не было: журнал ведёт контейнер автообновления (updater).</p>}
      </div>

      <StatusMonitor />
    </div>
  );
}

const num = n => Number(n || 0).toLocaleString(LOCALE);
const sec = ms => `${(ms / 1000).toFixed(1).replace('.', DEC)} с`;
const BG = { bazaar: 'Bazaar', 'аукцион': 'аукцион', 'продажи AH': 'продажи AH', 'профиль': 'свой профиль', 'мэр': 'мэр', 'вики': 'вики' };

/** Замирания: сервер не отвечал никому (занят расчётом) — или ответы быстрые, а долго идёт сеть до посетителя */
function StallsCard({ st }) {
  const h = st.lastHour;
  const verdict = h.stalls ? `Сервер замирал ${h.stalls} раз за час, дольше всего ${sec(h.maxStallMs)}.`
    : h.slow ? `Замираний не было, но ${h.slow} запросов сервер считал дольше ${sec(st.slowMs)}.`
      : 'За час сервер не замирал и отвечал быстро. Если сайт грузится долго, время уходит в сети до сервера.';
  return (
    <div className="card span-6">
      <h3>Замирания сервера</h3>
      <p className="muted small">Замирание: сервер дольше {st.stallMs} мс не отвечал ни на один запрос. Время ответа здесь серверное, без сети до посетителя.</p>
      <p className={h.stalls ? 'neg' : h.slow ? '' : 'pos'}>{verdict}</p>
      <div className="st-kv">
        <span>Запросов за час</span><b>{num(h.requests)}</b>
        <span>Самый долгий ответ</span><b>{sec(h.maxRequestMs)}</b>
      </div>
      {/* Списки меняются каждые 5 секунд: окно постоянной высоты со своей прокруткой, иначе карточка растёт и страница прыгает */}
      {(st.stalls.length > 0 || st.slow.length > 0) && <div className="st-scroll">
      {st.stalls.length > 0 && <>
        <h4>Последние замирания</h4>
        <ul className="st-log">
          {st.stalls.slice(0, 8).map((x, i) => (
            <li key={i} className="crash">
              <b>{sec(x.ms)}</b>
              <span>{x.requests.length ? x.requests.map(r => `${r.route}${r.n > 1 ? ` ×${r.n}` : ''}`).join(', ') : 'без запросов'}{x.background.length ? ` · фон: ${x.background.map(b => BG[b] || b).join(', ')}` : ''}</span>
              <span className="muted">{ago(x.at)}</span>
            </li>
          ))}
        </ul>
      </>}
      {st.slow.length > 0 && <>
        <h4 style={{ marginTop: 12 }}>Долгие ответы</h4>
        <ul className="st-log">
          {st.slow.slice(0, 8).map((x, i) => (
            <li key={i}><b>{sec(x.ms)}</b><span>{x.en ? 'en ' : ''}{x.route}</span><span className="muted">{ago(x.at)}</span></li>
          ))}
        </ul>
      </>}
      </div>}
    </div>
  );
}

const gb = n => Number(n || 0).toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** Память и диск: сколько занимает сам сайт (у контейнера свой лимит) и сколько весь сервер — это разные вещи */
function MemoryCard({ m, disk }) {
  const used = Math.max(0, m.systemTotalMb - m.systemFreeMb);
  const serverPct = m.systemTotalMb ? Math.round(used / m.systemTotalMb * 100) : 0;
  const share = used ? Math.round(m.rssMb / used * 100) : 0;
  const diskPct = disk?.totalGb ? Math.round(disk.usedGb / disk.totalGb * 100) : 0;
  return (
    <div className="card span-6">
      <h3>Память и диск</h3>
      <Meter label="Сайт" value={m.rssMb} max={m.limitMb || m.systemTotalMb} unit=" МБ"
        hint={m.limitMb ? `Лимит контейнера сайта — ${num(m.limitMb)} МБ: дойдёт до него — Docker перезапустит сайт` : 'Сколько памяти занимает процесс сервера сайта'} />
      <Meter label="Весь сервер" value={serverPct} max={100} unit="%" hint={`Занято ${num(used)} МБ из ${num(m.systemTotalMb)} МБ`} />
      <p className="muted small">Из {num(used)} МБ, занятых на сервере, на сайт приходится {share}%. Остальное — система, Docker, Caddy и автообновление.</p>
      {disk && <Meter label="Диск сервера" value={diskPct} max={100} unit="%" hint={`Занято ${gb(disk.usedGb)} ГБ из ${gb(disk.totalGb)} ГБ, свободно ${gb(disk.freeGb)} ГБ`} />}
      <div className="st-kv">
        {disk && <><span title="Сколько ещё можно записать: данные сайта, графики, ночные копии">Свободно на диске</span><b>{gb(disk.freeGb)} ГБ</b></>}
        <span title="Объекты JavaScript: профили, анализ, цены, база предметов">Данные сервера</span><b>{num(m.heapMb)} МБ</b>
        <span title="Ответы API в обработке, картинки, файлы">Буферы и файлы</span><b>{num(m.buffersMb)} МБ</b>
        {(m.parts || []).map(p => <Fragment key={p.label}><span title={p.hint}>{p.label}</span><b>{num(p.count)} {p.unit}</b></Fragment>)}
      </div>
    </div>
  );
}

const KEY = {
  ok: ['работает', 'pos'],
  invalid: ['не принят', 'neg'],
  none: ['не задан в .env', 'neg'],
  unknown: ['ещё не проверялся', 'muted'],
};
const SRC = { ok: 'ok', error: 'bad', none: 'idle' };

const KINDS = { profiles: 'профили', garden: 'Garden', museum: 'музей', player: 'ранг игрока', guild: 'гильдия', status: 'онлайн', other: 'прочее' };

/** Расход ключа Hypixel за сутки (UTC): на что и чьё, пауза после лимита */
function KeyUsageCard({ h }) {
  const u = h?.usage;
  if (!u) return null;
  const t = u.today || {};
  const p = h.paused;
  const kinds = Object.entries(t.kind || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card span-6">
      <h3>Расход ключа Hypixel</h3>
      {p && <p className="neg small">{p.daily ? 'Исчерпан суточный лимит ключа' : 'Hypixel просит подождать'}: запросы с ключом на паузе до {new Date(p.until).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}. Профили показаны по последним данным.</p>}
      <div className="st-kv">
        <span>Запросов за сутки (UTC)</span><b>{num(t.total)}</b>
        <span>Свой профиль / чужие</span><b>{num(t.who?.own)} / {num(t.who?.others)}</b>
        {kinds.map(([k, n]) => <Fragment key={k}><span>· {KINDS[k] || k}</span><b>{num(n)}</b></Fragment>)}
        <span title="Такой же запрос уже летел — ждали его ответ">Склеено повторов</span><b>{num(t.deduped)}</b>
        <span title="Ключ стоял на паузе после 429 — запрос не отправляли">Не отправлено из-за лимита</span><b>{num(t.limited)}</b>
      </div>
      {u.recent?.length > 1 && <p className="muted small">По дням: {u.recent.slice(1, 7).map(d => `${d.day.slice(5)} — ${num(d.total)}`).join(' · ')}</p>}
      {u.perDay?.length > 0 && <KeyPerVisitor rows={u.perDay} />}
    </div>
  );
}

/** Для заявки на Production-ключ: сколько запросов к Hypixel уходит на одного посетителя и на один открытый ник.
 *  Сутки запросов — по UTC, посетителей — по часовому поясу сайта, поэтому день к дню совпадают примерно. */
function KeyPerVisitor({ rows }) {
  const sum = rows.reduce((a, r) => ({ calls: a.calls + r.calls, visitors: a.visitors + r.visitors, nicks: a.nicks + r.nicks, en: a.en + (r.langs?.en || 0) }), { calls: 0, visitors: 0, nicks: 0, en: 0 });
  const per = (a, b) => (b ? (a / b).toFixed(1).replace('.', DEC) : '—');
  return (
    <details className="muted small key-per">
      <summary>Запросов на посетителя: {per(sum.calls, sum.visitors)} · на открытый ник: {per(sum.calls, sum.nicks)} (за {rows.length} дн.)</summary>
      <table className="st-table">
        <thead><tr><th>День</th><th>Запросов</th><th>Посетителей</th><th>из них EN</th><th>Ников</th><th>На посетителя</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.day}><td>{r.day.slice(5)}</td><td>{num(r.calls)}</td><td>{num(r.visitors)}</td><td>{num(r.langs?.en || 0)}</td><td>{num(r.nicks)}</td><td>{per(r.calls, r.visitors)}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

/** Внешние сервисы: ключ Hypixel (сам ключ никогда не показываем), лимит, последние ответы и ошибки */
function ApiCard({ api }) {
  if (!api) return null;
  const [keyLabel, keyCls] = KEY[api.key.state] || KEY.unknown;
  const r = api.rate;
  const resetIn = r?.resetSec != null ? Math.max(0, Math.round(r.resetSec - (Date.now() - r.at) / 1000)) : null;
  return (
    <div className="card span-6">
      <h3>Внешние сервисы (API)</h3>
      <div className="st-kv">
        <span>Ключ Hypixel</span><b className={keyCls}>{keyLabel}</b>
        {api.key.type && <><span>Тип ключа</span><b>{api.key.type === 'dev' ? 'ключ разработчика' : 'ключ приложения'}</b></>}
        {api.key.since && <><span>Этот ключ работает</span><b>с {new Date(api.key.since).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })}</b></>}
        {r && <><span title="По заголовкам ответа Hypixel">Осталось запросов</span><b>{num(r.remaining)} / {num(r.limit)}{resetIn != null ? <span className="muted"> · сброс через {resetIn} с</span> : null}</b></>}
      </div>
      {api.key.error && <p className="neg small">Hypixel ответил: {api.key.error}. Выпусти новый ключ на developer.hypixel.net и впиши его в .env (HYPIXEL_API_KEY).</p>}
      {api.key.type === 'dev' && !api.key.error && <p className="muted small">Ключи разработчика Hypixel временные: когда ключ перестанет приниматься, здесь появится ошибка и подсказка.</p>}
      {api.sources.length ? (
        <ul className="st-api">
          {api.sources.map(x => (
            <li key={x.id} className={SRC[x.state]}>
              <i />
              <span className="st-api-name">{x.name}</span>
              <span className="muted">{x.lastMs != null ? `${num(x.lastMs)} мс` : ''}</span>
              <span className="muted">{x.lastOkAt ? ago(x.lastOkAt) : 'ещё не отвечал'}</span>
              {x.state === 'error' && <span className="st-api-err neg">Ошибка {ago(x.lastErrAt)}: {x.lastError}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted small">Запросов наружу ещё не было.</p>}
    </div>
  );
}

const hhmm = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** Баннер для всех: профили сейчас не обновляются из-за Hypixel (лимит запросов или нерабочий ключ) */
export function HypixelBanner({ updatedAt }) {
  const { s } = useServerStatus();
  const h = s?.hypixel;
  if (!h) return null;
  const limited = h.limitedUntil && h.limitedUntil > Date.now();
  if (!limited && !h.keyBroken) return null;
  const why = h.keyBroken ? 'ключ доступа к Hypixel перестал работать'
    : h.daily ? 'Hypixel ограничил число запросов сайта на сегодня' : 'Hypixel попросил сайт подождать';
  return (
    <div className="card warn-card hypixel-banner" role="status">
      <b>Данные профилей временно не обновляются:</b> {why}.{' '}
      Показаны сохранённые данные{updatedAt ? ` от ${hhmm(updatedAt)}` : ''}.
      {limited && !h.keyBroken ? ` Обновление примерно в ${hhmm(h.limitedUntil)}.` : ' Обновление начнётся само, как только доступ вернётся.'}
    </div>
  );
}

/** Лампочка для всех: показывает текст, только когда сервер занят */
export function LoadDot() {
  const { s, down } = useServerStatus();
  if (!s || down) return null; // «нет связи» уже показывает LiveDot
  const [label, cls] = LOAD[s.load] || LOAD.low;
  const title = s.load === 'low' ? 'Сервер не загружен — всё обновляется как обычно' : `Сервер ${label.toLowerCase()}: ${s.why}. Данные могут обновляться медленнее`;
  return (
    <span className={`load-dot ${cls}`} title={title} aria-label={title}>
      <i />{s.load !== 'low' && <span>{s.load === 'high' ? 'Высокая нагрузка' : 'Нагрузка'}</span>}
    </span>
  );
}
