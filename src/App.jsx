import { BASE, EN, stripLang, LOCALE } from './i18n.js';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { Ico } from './components/Icons.jsx';
import { restorePlace } from './keepPlace.js';
import { chunk } from './update.js';
import { useLiveState, ago, api, setView, viewKey, me } from './api.js';
import PlayerSwitcher, { FriendBanner, ApiOffNote } from './components/PlayerSwitcher.jsx';
import { TooltipProvider } from './components/Tooltip.jsx';
import { RefsProvider } from './guides/Rich.jsx';
import { ItemIcon } from './components/ItemIcon.jsx';
import GoalStrip from './components/GoalStrip.jsx';
import LiveToasts from './components/LiveToasts.jsx';
import { explainProfileError } from './profileError.js';
import { GlobalSearch } from './components/GlobalSearch.jsx';
import Landing from './components/Landing.jsx';
import Status, { LoadDot, HypixelBanner } from './pages/Status.jsx';
import { AdSlot, DonateButton, CookieBanner } from './components/Ads.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { installMetrikaHits } from './ads.js';
import { FeedbackButton } from './components/Feedback.jsx';
import LiteToggle from './components/LiteToggle.jsx';
import BottomNav from './components/BottomNav.jsx';
import { useNewsUnread } from './news.js';
import SurveyDock from './components/SurveyDock.jsx';
import NewsPopup, { NewsBadge, UpdateBar } from './components/NewsPopup.jsx';
import { ElectionPopup } from './components/Election.jsx';
import { LangSwitch } from './components/LangSwitch.jsx';
import { DiscordButton } from './components/Discord.jsx';

// Страницы грузятся отдельными кусками, когда их открывают (раньше весь сайт — один файл 626 КБ).
// На телефоне первым приходит только каркас и открытая страница; остальные подтягиваются в простое (prefetchPages).
// После обновления сайта старых кусков на сервере уже нет: chunk (update.js) тихо перезагружает вкладку на новую сборку.
const LOAD = {
  overview: (() => import('./pages/Overview.jsx')),
  roadmap: (() => import('./pages/Roadmap.jsx')),
  skills: (() => import('./pages/Skills.jsx')),
  gear: (() => import('./pages/Gear.jsx')),
  accessories: (() => import('./pages/Accessories.jsx')),
  pets: (() => import('./pages/Pets.jsx')),
  museum: (() => import('./pages/Museum.jsx')),
  stash: (() => import('./pages/Stash.jsx')),
  collections: (() => import('./pages/Collections.jsx')),
  minions: (() => import('./pages/Minions.jsx')),
  guides: (() => import('./pages/Guides.jsx')),
  events: (() => import('./pages/Events.jsx')),
  compare: (() => import('./pages/Compare.jsx')),
  top: (() => import('./pages/Leaderboard.jsx')),
  money: (() => import('./pages/Money.jsx')),
  market: (() => import('./pages/Market.jsx')),
  wiki: (() => import('./pages/Wiki.jsx')),
  news: (() => import('./pages/News.jsx')),
  feedback: (() => import('./pages/FeedbackAdmin.jsx')),
  chat: (() => import('./components/LiveAdvisor.jsx')),
};
const L = id => lazy(chunk(LOAD[id]));
const Overview = L('overview'), Roadmap = L('roadmap'), Skills = L('skills'), Gear = L('gear'), Accessories = L('accessories'), Pets = L('pets'),
  Museum = L('museum'), Stash = L('stash'), Collections = L('collections'), Minions = L('minions'), Guides = L('guides'), Events = L('events'),
  Compare = L('compare'), Leaderboard = L('top'), Money = L('money'), Market = L('market'), Wiki = L('wiki'), News = L('news'), FeedbackAdmin = L('feedback');
const ItemModal = lazy(chunk(() => LOAD.wiki().then(m => ({ default: m.ItemModal }))));
const ChatDock = lazy(chunk(() => LOAD.chat().then(m => ({ default: m.ChatDock }))));
// Остальные страницы — в простое браузера, чтобы переход по меню был мгновенным. При экономии трафика не грузим заранее
function prefetchPages() {
  const c = navigator.connection;
  if (c?.saveData || /2g/.test(c?.effectiveType || '')) return;
  const ids = Object.keys(LOAD);
  const next = () => { const id = ids.shift(); if (!id) return; LOAD[id]().catch(() => {}).finally(() => idleCb(next)); };
  idleCb(next);
}
const idleCb = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 300));

function PageSkeleton() {
  return (
    <div className="skeleton-page" aria-label="Загружаю страницу…">
      <div className="sk sk-hero" />
      <div className="sk-row"><div className="sk sk-card" /><div className="sk sk-card" /></div>
    </div>
  );
}

// Разделы, которые гость видит и без ника (остальные без выбранного игрока показывают стартовую страницу)
const GUEST_FREE = new Set(['guides', 'market', 'wiki', 'compare', 'top', 'news']);

const PAGES = [
  { id: 'overview', label: 'Обзор', icon: 'nether_star', fb: '✦', C: Overview },
  { id: 'roadmap', label: 'Что делать', icon: 'map', fb: '🗺', C: Roadmap },
  { id: 'skills', label: 'Прогресс', icon: 'experience_bottle', fb: '📈', C: Skills },
  { id: 'gear', label: 'Снаряжение', icon: 'diamond_sword', fb: '⚔', C: Gear },
  { id: 'accessories', label: 'Аксессуары', icon: 'ender_eye', fb: '💍', C: Accessories },
  { id: 'pets', label: 'Питомцы', icon: 'bone', fb: '🐾', C: Pets },
  { id: 'museum', label: 'Музей', icon: 'item_frame', fb: '🏛', C: Museum },
  { id: 'stash', label: 'Запасы', icon: 'leather', fb: '🎒', C: Stash },
  { id: 'collections', label: 'Коллекции', icon: 'painting', fb: '📦', C: Collections },
  { id: 'minions', label: 'Миньоны', icon: 'hopper', fb: '⛏', C: Minions },
  { id: 'guides', label: 'Гайды', icon: 'written_book', fb: '📚', C: Guides },
  { id: 'events', label: 'События', icon: 'clock_00', fb: '📅', C: Events, free: true },
  { id: 'compare', label: 'Сравнение', icon: 'comparator', fb: '⚖', C: Compare, free: true },
  { id: 'top', label: 'Рейтинг', icon: 'gold_block', fb: '🏆', C: Leaderboard, free: true },
  { id: 'money', label: 'Заработок', icon: 'gold_ingot', fb: '💰', C: Money },
  { id: 'market', label: 'Рынок', icon: 'emerald', fb: '💎', C: Market },
  { id: 'wiki', label: 'Вики', icon: 'book', fb: '📖', C: Wiki },
  { id: 'news', label: 'Новости', icon: 'bell', fb: '🔔', C: News, free: true },
  // Панель сервера — только владельцу (гостю и друзьям пункта нет)
  ...(me.admin && !me.guest ? [
    { id: 'status', label: 'Сервер', icon: 'redstone', fb: '🖥', C: Status, free: true },
    { id: 'feedback', label: 'Отзывы', icon: 'writable_book', fb: '✉', C: FeedbackAdmin, free: true },
  ] : []),
];

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// Обычные адреса открытых разделов (/guides/fishing, /market, /item/HYPERION) — для поисковиков (server/seo).
// Сайт внутри по-прежнему ходит по #/…; адрес без # понимаем при первом заходе.
const PATH_PAGES = new Set(['guides', 'market', 'wiki', 'events', 'news', 'top']);
function pathRoute() {
  const [p0, p1] = stripLang(location.pathname).split('/').filter(Boolean);
  if (p0 === 'item' && p1) return ['wiki'];
  if (PATH_PAGES.has(p0)) { try { return p1 ? [p0, decodeURIComponent(p1)] : [p0]; } catch { return [p0]; } }
  return null;
}
function pathItem() {
  const m = /^\/item\/([^/]+)$/.exec(stripLang(location.pathname));
  try { return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
}
function useHash() {
  const get = () => (location.hash.length > 2 ? location.hash.replace('#/', '').split('/') : pathRoute() || (location.hash.replace('#/', '') || 'overview').split('/'));
  const [h, setH] = useState(get);
  useEffect(() => {
    const f = () => {
      // ушли со страницы, открытой по обычному адресу, — дальше адрес вида /#/раздел (перезагрузка открывает то же)
      if (location.pathname !== BASE && location.hash) history.replaceState(history.state, '', BASE + location.search + location.hash);
      setH(get());
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

// Кнопка «наверх» на длинных страницах (план из 40 шагов, «Заработок» на телефоне — несколько экранов)
function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(scrollY > 1200);
    addEventListener('scroll', f, { passive: true }); f();
    return () => removeEventListener('scroll', f);
  }, []);
  if (!show) return null;
  return <button className="to-top" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Наверх" title="Наверх">↑</button>;
}

function LiveDot({ state, offline }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 5000); return () => clearInterval(t); }, []);
  const ok = state?.status === 'ok';
  // Данным больше 5 минут — профиль перестал обновляться (лимит API, Hypixel лежит, сервер завис)
  // Чужие профили сервер обновляет раз в 10 минут (бережёт лимит Hypixel), свой — каждую минуту
  const stale = ok && Date.now() - (state.updatedAt || 0) > (state.view?.live ? 5 : 12) * 60_000;
  // Ключ Hypixel на паузе после лимита: данные последние полученные, обновятся сами
  const limited = ok && state.limitedUntil > Date.now();
  const cls = offline ? 'off' : state?.fromCache ? 'stale' : stale || limited ? 'stale' : ok ? 'on' : 'off';
  const title = offline ? 'Сервер трекера не отвечает — показаны последние полученные данные'
    : limited ? `Сайт израсходовал лимит запросов к Hypixel. Профиль обновится сам примерно в ${new Date(state.limitedUntil).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`
    : stale ? 'Профиль давно не обновлялся. Нажми «Обновить» или проверь сервер'
    : 'Профиль обновляется автоматически';
  const when = state?.updatedAt ? ` · данные ${ago(state.updatedAt)}` : '';
  return (
    <div className={`live ${cls}`} title={title + when}>
      <span className="dot" />
      {offline ? <>Нет связи с сервером{state?.updatedAt ? ` · данные ${ago(state.updatedAt)}` : ''}</>
        : state?.fromCache ? <>Подключаюсь… · данные {ago(state.updatedAt)}</>
        : ok ? <>{limited ? 'Лимит Hypixel' : stale ? 'Давно не обновлялось' : 'Живые данные'} · {ago(state.updatedAt)}</>
        : state?.status === 'no_key' ? 'Нет API-ключа' : state?.status === 'error' ? 'Ошибка обновления' : 'Загрузка…'}
    </div>
  );
}

// Профиль игрока не открылся: крупно — кто виноват (Hypixel, ник, настройки игрока), чтобы не думали, что сломался сайт,
// и что сделать. Кнопки: повторить и вернуться (к своему профилю или к вводу другого ника у гостя)
function ProfileProblem({ state, view, reload }) {
  const [busy, setBusy] = useState(false);
  const x = explainProfileError({ error: state.error, errorCode: state.errorCode, player: state.view.player, self: state.view.self, admin: me.admin, guest: me.guest });
  const again = async () => { setBusy(true); await api('/refresh', { method: 'POST' }).catch(() => null); await reload(); setBusy(false); };
  const canBack = !state.view.self || view;
  return (
    <div className={`card warn-card profile-problem pp-${x.kind}`} role="alert">
      <div className="pp-site">✓ Сайт работает · проблема на стороне: <b>{x.who}</b></div>
      <h3>{x.title}{state.view.profile ? ` (профиль ${state.view.profile})` : ''}</h3>
      <p>{x.text}</p>
      <ul className="pp-fix">{x.fix.map(f => <li key={f}>{f}</li>)}</ul>
      <div className="row-gap">
        {x.retry && <button className="btn" onClick={again} disabled={busy}>{busy ? 'Проверяю…' : 'Попробовать ещё раз'}</button>}
        {canBack && <button className={`btn ${x.retry ? 'ghost' : ''}`} onClick={() => setView(null)}>{me.guest ? '← Ввести другой ник' : '← К своему профилю'}</button>}
      </div>
      {state.error && <details className="muted tiny pp-raw"><summary>Подробности для владельца сайта</summary>{state.error}</details>}
    </div>
  );
}

// Аккаунт внизу бокового меню (на телефоне — в листе «Ещё»).
// Карточка: аватар + ник целиком (длинный — мельче шрифтом, а не «L…») + подпись, вся карточка — ссылка на /account.
// «Выйти» — отдельная кнопка под чертой, чтобы не выйти случайно. Гостю — такая же карточка «Войти».
function Account() {
  if (me.name) {
    const size = me.name.length > 14 ? 'xlong' : me.name.length > 11 ? 'long' : '';
    return (
      <div className="acct">
        <a href="/account" className="acct-main" title={me.admin ? 'Пароль и аккаунты друзей' : 'Сменить пароль'}>
          <span className="acct-ava"><Ico name="user" size={18} /><img src={`/api/head/${encodeURIComponent(me.name)}?size=64`} alt="" width={30} height={30} onError={e => { e.currentTarget.style.display = 'none'; }} /></span>
          <span className="acct-text">
            <b className={`acct-name ${size}`}>{me.name}</b>
            <span className="acct-sub">Аккаунт</span>
          </span>
        </a>
        {!me.local && (
          <form method="post" action="/logout" className="acct-out">
            <button type="submit" className="acct-out-btn" title="Выйти с сайта"><Ico name="logout" size={15} />Выйти</button>
          </form>
        )}
      </div>
    );
  }
  if (me.guest) return (
    <a href={EN ? '/login?next=%2Fen%2F' : '/login'} className="acct acct-main acct-login" title="Вход по нику и паролю сайта">
      <span className="acct-ava"><Ico name="login" size={18} /></span>
      <span className="acct-text"><b className="acct-name">Войти</b><span className="acct-sub">ник и пароль сайта</span></span>
    </a>
  );
  return null;
}

export default function App() {
  const { state, reload, pulse, offline, view } = useLiveState();
  const [page, sub] = useHash();
  const [item, setItem] = useState(() => history.state?.item || pathItem()); // после перезагрузки карточка остаётся открытой; /item/ID — сразу карточка
  const [itemUuid, setItemUuid] = useState(() => history.state?.itemUuid || null); // какой именно свой экземпляр открыли (для чек-листа улучшений)
  useEffect(() => { restorePlace(); const t = setTimeout(prefetchPages, 2500); return () => clearTimeout(t); }, []);
  // Переход по ссылке на другую страницу — сверху, а не с прокруткой прошлой (с телефона попадал в середину «Питомцев»).
  // Прокрутку уходящей страницы запоминаем в её записи истории: «Назад» возвращает ровно туда, где был,
  // даже если страница дорисовывается не сразу (браузер сам не успевал и ставил случайное место).
  useEffect(() => {
    const f = e => {
      const a = e.target.closest?.('a[href^="#/"]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const to = a.getAttribute('href').slice(2).split('/')[0] || 'overview';
      const now = (location.hash.replace('#/', '') || 'overview').split('/')[0];
      if (to === now) return;
      try { history.replaceState({ ...(history.state || {}), pageScroll: scrollY }, ''); } catch { /* ignore */ }
      setTimeout(() => scrollTo(0, 0), 0);
    };
    let timer;
    const back = () => {
      const y = history.state?.pageScroll;
      clearTimeout(timer);
      if (typeof y !== 'number') return;
      let tries = 0;
      const apply = () => { scrollTo(0, y); if (Math.abs(scrollY - y) > 4 && ++tries < 15) timer = setTimeout(apply, 200); };
      timer = setTimeout(apply, 0);
    };
    const stop = () => clearTimeout(timer); // человек сам начал листать — не дёргаем
    document.addEventListener('click', f);
    addEventListener('hashchange', back);
    addEventListener('touchstart', stop, { passive: true });
    addEventListener('wheel', stop, { passive: true });
    return () => { document.removeEventListener('click', f); removeEventListener('hashchange', back); removeEventListener('touchstart', stop); removeEventListener('wheel', stop); clearTimeout(timer); };
  }, []);
  // Карточка предмета — отдельная запись в истории: «Назад» на телефоне закрывает карточку, а не уводит со страницы
  const openItem = useCallback((id, uuid = null) => {
    if (!id) return;
    if (history.state?.item) history.replaceState({ ...history.state, item: id, itemUuid: uuid }, '');
    else history.pushState({ ...(history.state || {}), item: id, itemUuid: uuid }, '');
    setItemUuid(typeof uuid === 'string' ? uuid : null);
    setItem(id);
  }, []);
  const closeItem = useCallback(() => {
    if (history.state?.item) history.back();
    else {
      if (pathItem()) history.replaceState(history.state, '', BASE + location.search + '#/wiki'); // карточку открыли по ссылке /item/ID
      setItem(null);
    }
  }, []);
  useEffect(() => {
    const f = () => { setItem(history.state?.item || null); setItemUuid(history.state?.itemUuid || null); };
    addEventListener('popstate', f);
    return () => removeEventListener('popstate', f);
  }, []);
  const newsUnread = useNewsUnread(); // число непрочитанных новостей: на кнопке «Новости» и в заголовке вкладки
  const [refreshing, setRefreshing] = useState(false);
  const P = PAGES.find(p => p.id === page) || PAGES[0];
  const landing = me.guest && !view && !GUEST_FREE.has(P.id); // гость ещё не ввёл ник
  // Заголовок вкладки браузера: видно, что открыто, в истории и среди вкладок
  useEffect(() => { document.title = `${newsUnread ? `(${newsUnread}) ` : ''}${P.label} · Sky Guide`; }, [P.label, newsUnread]);
  // Меню прокручивается само: на телефоне это горизонтальная лента, на ПК при низком окне — вертикальный список.
  // Прокручиваем его к открытой странице, чтобы было видно, где ты
  useEffect(() => {
    const nav = document.querySelector('.sidebar nav'), a = nav?.querySelector('a.active');
    if (!nav || !a) return;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
    else if (nav.scrollHeight > nav.clientHeight) {
      const top = a.offsetTop - nav.offsetTop;
      if (top < nav.scrollTop || top + a.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTo({ top: top - (nav.clientHeight - a.offsetHeight) / 2, behavior: 'smooth' });
    }
  }, [P.id]);
  const m = state?.member;
  // Итог ручного обновления виден на кнопке пару секунд: «Обновлено ✓» или «Не вышло»
  const [refreshMsg, setRefreshMsg] = useState(null);
  const refresh = async () => {
    setRefreshing(true);
    const r = await api('/refresh', { method: 'POST' }).catch(() => null);
    await reload();
    setRefreshing(false);
    setRefreshMsg(r?.status === 'ok' ? 'Обновлено ✓' : r?.status === 'limited' ? 'Лимит Hypixel' : 'Не вышло');
    setTimeout(() => setRefreshMsg(null), 2500);
  };

  return (
    <AppCtx.Provider value={{ state, openItem, sub, reload }}>
      <TooltipProvider>
      <RefsProvider refs={null}>{/* подсказки по игровым терминам в любом <Rich> на любой странице (guides/globalRefs.js) */}
        <div className="bg-orbs"><span /><span /><span /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              <img src="/favicon.svg" width={34} height={34} alt="" className="brand-mark" />
              <div><b>Sky Guide</b><small>гид по SkyBlock</small></div>
            </div>
            <nav>
              {PAGES.map(p => (
                <a key={p.id} href={`#/${p.id}`} className={p.id === P.id ? 'active' : ''} onPointerEnter={() => LOAD[p.id]?.().catch(() => {})} onTouchStart={() => LOAD[p.id]?.().catch(() => {})}>
                  <span className="nav-ico" data-fb={p.fb}><img src={`/api/texture/${p.icon}`} alt="" /></span>{p.label}
                  {p.id === 'news' && <NewsBadge n={newsUnread} />}
                </a>
              ))}
            </nav>
            <div className="sidebar-foot">
              <Account />
              <DonateButton className="small" />
              <FeedbackButton />
              <LiteToggle />
            </div>
          </aside>
          <main>
            <header className="topbar">
              <PlayerSwitcher state={state} view={view} />
              <GlobalSearch onOpen={openItem} />
              <div className="topbar-right">
                <DiscordButton />
                <LangSwitch />
                {state?.demo && <span className="badge warn demo-badge" title="Демо-данные: добавь API-ключ в .env"><span className="demo-long">Демо-данные: добавь API-ключ в .env</span><span className="demo-short">Демо</span></span>}
                <LoadDot />
                {/* Гость ещё не ввёл ник: обновлять нечего — без вечной «Загрузки…» и лишней кнопки */}
                {state?.status !== 'empty' && <>
                  <LiveDot state={state} offline={offline} />
                  <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? 'Обновляю…' : refreshMsg || 'Обновить'}</button>
                </>}
              </div>
            </header>
            <HypixelBanner updatedAt={state?.member ? state.updatedAt : 0} />
            <FriendBanner state={state} view={view} />
            {!view && state?.member?.apiDisabled && <ApiOffNote self />}
            {P.id !== 'overview' && <GoalStrip member={m} />}
            {state?.status === 'no_key' && !m && (
              <div className="card warn-card">
                <h3>Нужен ключ Hypixel API</h3>
                <p>Создай файл <code>.env</code> рядом с <code>package.json</code> и впиши <code>HYPIXEL_API_KEY=твой-ключ</code>. Ключ берётся на developer.hypixel.net. После этого перезапусти трекер.</p>
              </div>
            )}
            {state?.view?.failed && <ProfileProblem state={state} view={view} reload={reload} />}
            {state?.status === 'error' && !state?.view?.failed && (() => {
              const x = explainProfileError({ error: state.error, errorCode: state.errorCode, player: state.player?.name, admin: me.admin });
              return <div className="card warn-card"><b>Профиль не обновился. {x.title}.</b> <span className="muted">Сайт работает, проблема на стороне: {x.who}.</span>{state.member ? ' Показаны последние полученные данные, сервер повторит попытку сам.' : ` ${x.fix[0]}`}</div>;
            })()}
            <div className="page" key={P.id + viewKey(view) + pulse * 0}>
              <Suspense fallback={<PageSkeleton />}>
              {landing ? <Landing /> : P.free ? <P.C state={state} sub={sub} /> : state?.view?.failed && !state.member ? null : state && (state.member || (state.status !== 'starting' && !(view && state.status === 'loading'))) ? <P.C state={state} sub={sub} /> : offline && !state ? (
                <div className="card warn-card">
                  <h3>Сервер трекера не отвечает</h3>
                  <p>Проверь, что на ПК запущен <code>npm start</code> (или туннель/Render, если открываешь с телефона). Сайт сам подключится, как только сервер вернётся.</p>
                  <button className="btn" onClick={reload}>Проверить сейчас</button>
                </div>
              ) : (
                <div className="skeleton-page" aria-label="Загружаю профиль…">
                  <div className="sk sk-hero" />
                  <div className="sk-row"><div className="sk sk-card" /><div className="sk sk-card" /></div>
                  <div className="muted small sk-note"><div className="spinner" />{view ? `Загружаю профиль ${view.player}…` : 'Загружаю профиль…'}</div>
                </div>
              )}
              </Suspense>
            </div>
            {!landing && <AdSlot where="bottom" page={P.id + viewKey(view)} />}
            {/* Подвал: о проекте, разработчикам, правовые ссылки, источники данных, оговорка */}
            <SiteFooter />
          </main>
        </div>
        <BottomNav pages={PAGES} current={P.id} badges={{ news: newsUnread }} prefetch={id => LOAD[id]?.().catch(() => {})}>
          <Account />
          <div className="more-actions"><DonateButton className="small" /><FeedbackButton /></div>
          <LiteToggle />
        </BottomNav>
        {!item && <ToTop />}
        {P.id !== 'news' && !item && <NewsPopup />}
        {!item && <UpdateBar />}
        {P.id !== 'events' && P.id !== 'news' && !item && <ElectionPopup />}
        <LiveToasts feed={state?.feed} profileKey={state?.player?.uuid && state?.member?.profileId ? `${state.player.uuid}:${state.member.profileId}` : null} />
        <CookieBanner />
        {!landing && <Suspense fallback={null}><ChatDock /></Suspense>}
        {!item && <SurveyDock />}{/* опрос один для RU и EN: ответы общие */}
        {item && <Suspense fallback={null}><ItemModal id={item} uuid={itemUuid} onClose={closeItem} /></Suspense>}
      </RefsProvider>
      </TooltipProvider>
    </AppCtx.Provider>
  );
}
