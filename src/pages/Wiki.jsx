import { EN } from '../i18n.js';
import { MuseumBadge } from '../components/MuseumBadge.jsx';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Card, Empty, Sparkline, Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { McTooltipBox } from '../components/Tooltip.jsx';
import { coins, num, api, useApi, RARITY_COLOR, RARITY_RU, getRecent, pushRecent, variantLabel } from '../api.js';
import { useApp } from '../App.jsx';
import { UpgradePlan } from '../components/UpgradePlan.jsx';
import { ObtainGuide } from '../components/ObtainGuide.jsx';
import { RefsProvider, Rich } from '../guides/Rich.jsx';
import { openNewsLink } from '../newsLinks.jsx';
import { AbiphoneContacts } from '../guides/Collectibles.jsx';
import { PriceDuo, LivePrice } from '../components/PriceDuo.jsx';
import { chunk } from '../update.js';

// Мини-график цены Bazaar (библиотека графиков грузится только когда карточка товара Bazaar открыта)
const MiniChart = lazy(chunk(() => import('../components/chart/MiniChart.jsx')));

/** Закрыть карточку предмета и открыть товар на «Рынке» (полный биржевой график). */
export function openOnMarket(id) {
  const target = `#/market/${encodeURIComponent(id)}`;
  if (history.state?.item) { addEventListener('popstate', () => { location.hash = target; }, { once: true }); history.back(); }
  else location.hash = target;
}

// Карточка телефона: контакты игрока прямо здесь, подробности о каждом — по нажатию
function PhoneContacts() {
  const { data } = useApi('/guides/collectibles', []);
  const a = data?.collect?.abiphone;
  if (!a) return null;
  const close = () => { if (history.state?.item) { addEventListener('popstate', () => openNewsLink('guides/collectibles', 'abiphone'), { once: true }); history.back(); } else openNewsLink('guides/collectibles', 'abiphone'); };
  return (
    <section className="phone-contacts">
      <h4 className="sub-h">{a.available ? `Контакты в телефоне: ${a.have} из ${a.total}` : 'Контакты Abiphone'}
        {a.phone && <span className="muted small"> · {a.phone.name}{a.phone.max ? `, до ${a.phone.max} контактов` : ''}</span>}</h4>
      <AbiphoneContacts a={a} compact />
      <a className="link small" href="#/guides/collectibles" onClick={e => { e.preventDefault(); close(); }}><Rich text="Все контакты подробно — в гайде «Души и коллекции» →" /></a>
    </section>
  );
}

// Понятная ошибка вместо «Ошибка 404»: что случилось и куда идти дальше
function ItemError({ id, error }) {
  const missing = /404/.test(error);
  const q = String(id).split(';')[0].toLowerCase().replace(/_/g, ' ');
  return (
    <Empty>
      {missing
        ? <>Такого предмета нет в базе: <code>{id}</code>. Возможно, его убрали из игры или переименовали.</>
        : /fetch|network|failed/i.test(error) ? 'Сервер трекера не отвечает. Карточка откроется, когда связь вернётся.' : `Не удалось открыть карточку: ${error}`}
      {missing && <div style={{ marginTop: 10 }}><a className="link" href={`#/wiki/${encodeURIComponent(q)}`}>Поискать похожие в вики →</a></div>}
    </Empty>
  );
}

export function ItemView({ id, uuid, onOpen }) {
  const { data, error } = useApi(`/item/${encodeURIComponent(id)}`, [id]);
  const { data: inv } = useApi('/inventory', [], { keep: true });
  // Свои экземпляры предмета: вместо «где взять» показываем, как прокачать до максимума
  const { data: up } = useApi(`/item/${encodeURIComponent(id)}/upgrades`, [id]);
  const [sel, setSel] = useState(uuid || null);
  useEffect(() => setSel(uuid || null), [id, uuid]);
  const copies = up?.copies || [];
  const copy = copies.find(c => c.uuid === sel) || copies[0] || null;
  const owned = whereOwned(inv, id);
  const open = onOpen;
  useEffect(() => { if (data) pushRecent(data); }, [data]);
  if (error) return <ItemError id={id} error={error} />;
  if (!data) return <div className="loader"><div className="spinner" /></div>;
  if (data.gui) return <GuiItemView data={data} />;
  const bz = data.prices.bazaar, q = data.prices.quote;
  const hist = data.prices.history?.map(p => [p[0], p[2] || p[1]]) || data.prices.binHistory;
  const wiki = (data.info || []).filter(u => /^https?:/.test(u));
  // «Рынок»: товар Bazaar по своему ID, предмет аукциона — по ключу ah:ID
  const marketKey = bz ? data.priceId || data.id : `ah:${data.id}`;
  const goMarket = q ? () => openOnMarket(marketKey) : null;
  const rarity = copy?.rarity || data.rarity;
  return (
    <div className="item-view">
      <div className="item-view-head">
        <ItemIcon id={data.id} size={96} />
        <div>
          <h2 style={{ color: RARITY_COLOR[rarity] }}>{data.name}</h2>
          <div className="muted">{[...new Set([RARITY_RU[data.rarity], data.ru?.typeRu || data.type || data.ru?.categoryRu].filter(Boolean))].join(' · ')} · <code>{data.id}</code></div>
          {copy && (copy.recomb || (copy.baseRarity && copy.rarity && copy.rarity !== copy.baseRarity)) && (
            <div className="small item-mine-rarity">
              У тебя: <b style={{ color: RARITY_COLOR[copy.rarity] }}>{RARITY_RU[copy.rarity] || copy.rarity}</b>
              {copy.recomb && <span className="green"> · <Rich text="Recombobulator 3000" /> ✓</span>}
            </div>
          )}
          <div className="price-tags">
            {q && <PriceDuo q={q} onOpen={goMarket} trend />}
            {data.npc && <Badge color="#aaa">NPC: {coins(data.npc)}</Badge>}
            {!q && <span className="muted small">На Bazaar и аукционе сейчас не продаётся — где взять, смотри в блоке «Как получить».</span>}
          </div>
          {copy && <MyCopyPrice copy={copy} />}
          <MuseumBadge id={data.id} onOpen={open} />
          {owned.length > 0 && <div className="owned small">✔ У тебя: {owned.map(([p, n]) => `${p}${n > 1 ? ` ×${num(n)}` : ''}`).join(' · ')}</div>}
          {wiki.length > 0 && <div className="small">Вики: {wiki.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="link">{u.includes('fandom') ? 'Fandom' : 'hypixelskyblock.minecraft.wiki'}</a>).reduce((a, b) => [a, ' · ', b])}</div>}
        </div>
      </div>
      {data.variable && <VariableBonus v={data.variable} bonus={copy?.bonus} />}
      {data.ru?.descriptionRu && <p className="desc-ru"><Rich text={data.ru.descriptionRu} /></p>}
      {data.props && <ItemProps p={data.props} />}
      {/^ABIPHONE_/.test(data.id) && <PhoneContacts />}
      <div className="item-view-body">
        <div>
          <h4 className="sub-h">{copy?.loreRu?.length ? 'Твой предмет (как в игре)' : 'Описание (характеристики на русском)'}</h4>
          {copy?.loreRu?.length ? <LoreBox name={copy.rawName || data.name} lore={copy.loreRu} /> : <LoreBox name={data.name} lore={data.loreRu} />}
        </div>
        <div>
          {copy && <>
            <h4 className="sub-h">Как улучшить до максимума</h4>
            <UpgradePlan copies={copies} sel={copy.uuid} setSel={setSel} open={open} />
            {copy.family && <AccFamily f={copy.family} id={data.id} open={open} />}
          </>}
          <ObtainSection collapsed={!!copy}>
          <h4 className="sub-h">Как получить — пошагово</h4>
          <ObtainGuide id={data.id} open={open} fallbackText={data.crafttext}
            extra={[...(data.ru?.whereToGet || []).filter(w => (w.kind === 'other' || w.kind === 'shop') && !['BAZAAR', 'AUCTION', 'KAT_NPC', 'WIKI'].includes(w.source) && w.subkind !== 'kat' && w.subkind !== 'unknown'),
              ...(data.obtainment && !data.variable?.obtain ? [{ kind: 'other', textRu: `По данным Hypixel: ${data.obtainment}` }] : [])]} />
          </ObtainSection>
          {q ? <>
            <h4 className="sub-h">{bz ? 'График цены на Bazaar' : 'График цены на аукционе'}</h4>
            <Suspense fallback={<div className="mc-stage" />}><MiniChart id={bz ? data.priceId || data.id : data.id} market={bz ? 'bazaar' : 'ah'} quote={q} onOpenMarket={goMarket} /></Suspense>
          </> : hist?.length > 1 ? <>
            <h4 className="sub-h">История цены (14 дней)</h4>
            <Sparkline points={hist} color="#4ade80" format={coins} />
          </> : null}
          {data.usedIn?.length > 0 && (
            <>
              <h4 className="sub-h">Используется в крафтах</h4>
              <div className="item-row wrap">{data.usedIn.map(u => <ItemIcon key={u.id} id={u.id} size={38} slot onClick={() => open(u.id)} title={u.name} />)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Свойства предмета, как «Item Properties» на вики: продажа NPC, передача, аукцион, музей
function ItemProps({ p }) {
  const cell = (ok, label, note) => <div className={`ip-cell ${ok ? 'yes' : 'no'}`}><div className="ip-label"><Rich text={label} /></div><div className="ip-val">{ok ? '✓ да' : '✕ нет'}{note ? <span className="muted tiny"> · {note}</span> : null}</div></div>;
  return (
    <div className="item-props">
      {cell(p.salable, 'Продажа NPC', p.salable ? coins(p.npc) : null)}
      {cell(p.tradeable, 'Обмен с игроками', p.soulbound ? (p.soulbound === 'COOP' ? 'Co-op Soulbound' : 'Soulbound') : null)}
      {cell(p.auctionable, 'Auction House', p.bazaar ? 'торгуется на Bazaar' : null)}
      {cell(p.museum, 'Museum')}
    </div>
  );
}

// Цена своего экземпляра: похожие лоты аукциона (те же звёзды и Recombobulator) и оценка с улучшениями
function MyCopyPrice({ copy }) {
  const m = copy.market;
  if (!m && !(copy.value > 0)) return null;
  const what = [m?.recomb && 'с Recombobulator', m?.stars > 0 && `${m.stars}✪`].filter(Boolean).join(', ');
  return (
    <div className="small my-copy-price">
      Твой экземпляр: {m ? <>такие{what ? ` (${what})` : ''} на аукционе от <b className="gold">{coins(m.price)}</b>{m.count ? <span className="muted"> · лотов {m.count}</span> : null}</> : null}
      {copy.value > 0 && <span className="muted">{m ? ' · ' : ''}оценка с улучшениями ≈ {coins(copy.value)}</span>}
    </div>
  );
}

// Предмет с меняющимися статами: что он даёт прямо сейчас и что будет дальше
function VariableBonus({ v, bonus }) {
  const s = v.season;
  const left = s?.nextAt ? Math.max(0, s.nextAt - Date.now()) : 0;
  const h = Math.floor(left / 3_600_000), m = Math.round((left % 3_600_000) / 60_000);
  if (!bonus && !s?.nowStats && v.kind !== 'season') return null;
  return (
    <div className="var-bonus">
      {bonus && <div className="var-now"><span className="muted small">Сейчас даёт</span><b><Rich text={bonus.stats} /></b>{bonus.answer && <span className="muted small">«{bonus.answer}»</span>}</div>}
      {!bonus && s?.nowStats && <div className="var-now"><span className="muted small">Сейчас ({s.now})</span><b><Rich text={s.nowStats} /></b></div>}
      {v.options?.length > 0 && (
        <table className="var-table small">
          <thead><tr><th>{v.options[0].answer ? 'Фраза шара' : 'Сезон'}</th><th>Бонус</th></tr></thead>
          <tbody>{v.options.map(o => {
            const on = o.answer ? bonus?.answer === o.answer : s?.now === o.season;
            return <tr key={o.answer || o.season} className={on ? 'on' : ''}><td>{on ? '▶ ' : ''}{o.answer ? `«${o.answer}»` : o.season}</td><td><Rich text={o.stats} /></td></tr>;
          })}</tbody>
        </table>
      )}
      {v.options?.[0]?.answer && <div className="muted tiny">Каждый новый сезон шар «отвечает» случайной фразой, и от неё зависит бонус до конца сезона.</div>}
      {s && <div className="muted small">
        Сезон SkyBlock: {s.now}, через {h ? `${h} ч ` : ''}{m} мин — {s.next}.{' '}
        {v.random ? 'В новом сезоне бонус снова выпадет случайно.' : s.nextStats ? <>Тогда: <Rich text={s.nextStats} />.</> : null}
      </div>}
    </div>
  );
}

// Линейка аксессуара: младшие и старшие версии; из одной линейки Magical Power даёт только старший в сумке
function AccFamily({ f, id, open }) {
  const chain = [...f.lower.map(x => x.id), id, ...f.higher.map(x => x.id)];
  const inBag = new Set([...f.lower, ...f.higher].filter(x => x.inBag).map(x => x.id));
  return (
    <div className="acc-family small">
      <div className="muted">Линейка аксессуара:</div>
      <div className="item-row wrap">
        {chain.map((x, i) => <span key={x} className={`acc-fam-step${x === id ? ' me' : ''}`}>{i > 0 && <span className="muted"> → </span>}
          <ItemIcon id={x} size={26} onClick={x === id ? undefined : () => open(x)} title={x} />{inBag.has(x) && <span className="tiny green" title="Лежит в Accessory Bag">✓</span>}</span>)}
      </div>
      {!f.active && f.coveredBy && <div className="red">Этот аксессуар не даёт Magical Power: в сумке есть старшая версия. Его можно продать.</div>}
      {f.active && f.duplicates.length > 0 && <div className="gold">В сумке лежит и младшая версия ({f.duplicates.length} шт.) — она не даёт Magical Power, её можно продать.</div>}
    </div>
  );
}

// Длинное игровое описание сворачиваем: на первом экране — главное
function LoreBox({ name, lore = [] }) {
  const [all, setAll] = useState(false);
  const LIMIT = 14;
  if (lore.length <= LIMIT + 3 || all) return <McTooltipBox name={name} lore={lore} />;
  return <>
    <McTooltipBox name={name} lore={lore.slice(0, LIMIT)} />
    <button type="button" className="link small lore-more" onClick={() => setAll(true)}>Показать описание целиком (ещё {lore.length - LIMIT} строк)</button>
  </>;
}

// Служебный предмет интерфейса (меню SkyBlock): не вещь, а кнопка в 9-м слоте. Вместо «как улучшить»,
// цены и рецептов — короткая карточка-пасхалка по-русски.
function GuiItemView({ data }) {
  return (
    <div className="item-view gui-item">
      <div className="item-view-head">
        <ItemIcon id={data.id} size={96} />
        <div>
          <h2>{EN ? data.name.replace(/\s*\(Click\)$/, '') : data.gui.nameRu}</h2>
          {!EN && <div className="name-ru">{data.name.replace(/\s*\(Click\)$/, '')}</div>}
          <div className="muted">Кнопка интерфейса · <code>{data.id}</code></div>
          <div className="owned small">✔ Прокачано на 100%</div>
        </div>
      </div>
      <RefsProvider refs={data.gui.refs}>
        <p className="desc-ru"><Rich text={data.gui.textRu} /></p>
      </RefsProvider>
      {data.loreRu?.length > 0 && <McTooltipBox name={`§a${EN ? data.name : data.gui.nameRu}`} lore={data.loreRu} />}
    </div>
  );
}

// Если предмет уже есть, «где взять» и рецепты сворачиваются: главное — как его улучшить
function ObtainSection({ collapsed, children }) {
  if (!collapsed) return children;
  return <details className="obtain-more"><summary className="sub-h">Как получить ещё один</summary>{children}</details>;
}

export function ItemModal({ id, uuid, onClose }) {
  // Стек просмотренных предметов: переходы по ингредиентам можно отменить кнопкой «Назад»
  const [stack, setStack] = useState([id]);
  useEffect(() => setStack([id]), [id]);
  const cur = stack[stack.length - 1];
  const setCur = next => next !== cur && setStack(s => [...s, next]);
  const back = () => setStack(s => s.slice(0, -1));
  // Фокус в карточку при открытии (Tab ходит по её содержимому), при закрытии — обратно, откуда открыли
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    box.current?.focus();
    return () => prev?.focus?.();
  }, []);
  // Tab и Shift+Tab ходят по кругу внутри карточки, а не уходят на страницу под ней
  useEffect(() => {
    const f = e => {
      if (e.key !== 'Tab' || !box.current) return;
      const els = [...box.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!els.length) { e.preventDefault(); box.current.focus(); return; }
      const first = els[0], last = els[els.length - 1];
      const inside = box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);
  useEffect(() => { const f = e => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" tabIndex={-1} ref={box} onClick={e => e.stopPropagation()}>
        <button className="x-btn modal-x" onClick={onClose} aria-label="Закрыть">×</button>
        {stack.length > 1 && <button className="modal-back" onClick={back}>← {stack.length > 2 ? `Назад (${stack.length - 1})` : 'Назад'}</button>}
        <ItemView id={cur} uuid={stack.length === 1 ? uuid : null} onOpen={setCur} />
      </div>
    </div>
  );
}

const PLACES = {
  inventory: 'инвентарь', armor: 'надето', equipment: 'экипировка', wardrobe: 'гардероб', enderChest: 'эндер-сундук',
  vault: 'личное хранилище', talismans: 'Accessory Bag', quiver: 'колчан', potions: 'Potion Bag', fishingBag: 'Fishing Bag',
};
// Где этот предмет лежит у игрока: «инвентарь ×1 · рюкзак 3 ×2 · мешки ×120»
export function whereOwned(inv, id) {
  if (!inv || !id) return [];
  const out = [];
  const count = list => (Array.isArray(list) ? list : []).reduce((n, it) => n + (it?.id === id ? it.count || 1 : 0), 0);
  for (const [k, label] of Object.entries(PLACES)) { const n = count(inv[k]); if (n) out.push([label, n]); }
  for (const [k, list] of Object.entries(inv.backpacks || {})) { const n = count(list); if (n) out.push([`рюкзак ${Number(k) + 1}`, n]); }
  if (inv.sacks?.[id]) out.push(['мешки', inv.sacks[id]]);
  return out;
}

// [запрос, предмет для иконки]
const EXAMPLES = [['гиперион', 'HYPERION'], ['терма', 'TERMINATOR'], ['рекомб', 'RECOMBOBULATOR_3000'], ['печенька', 'BOOSTER_COOKIE'], ['зачарованный алмаз', 'ENCHANTED_DIAMOND'], ['питомец дракон', 'DRAGON_EGG'], ['меч', 'ASPECT_OF_THE_END'], ['аксессуары', 'SPEED_TALISMAN'], ['fpb', 'FUMING_POTATO_BOOK']];

// Пустая вики: недавно открытые и примеры запросов, чтобы не гадать, что можно искать
// Пустой результат с подсказкой, что попробовать: отдельные слова запроса и пару примеров
function NotFound({ q, setQ }) {
  const words = q.trim().split(/\s+/).filter(w => w.length >= 3);
  return (
    <Empty>
      Ничего не нашлось по «{q}». Попробуй короче, по-английски или жаргоном игроков.
      <div className="chips" style={{ justifyContent: 'center', marginTop: 10 }}>
        {(words.length > 1 ? words : ['терма', 'аоте', 'fpb']).map(w => <button key={w} className="chip" onClick={() => setQ(w)}>{w}</button>)}
      </div>
    </Empty>
  );
}

function WikiStart({ setQ, openItem }) {
  const recent = getRecent();
  return (
    <div className="wiki-start">
      {recent.length > 0 && <>
        <h4 className="sub-h">Недавно открытые</h4>
        <div className="search-results">
          {recent.map(r => (
            <div key={r.id} className="search-item" onClick={() => openItem(r.id)}>
              <ItemIcon id={r.id} size={32} />
              <div className="grow" style={{ color: RARITY_COLOR[r.rarity] }}>{r.name || r.id}</div>
            </div>
          ))}
        </div>
      </>}
      <h4 className="sub-h">Попробуй найти</h4>
      <div className="chips">{EXAMPLES.map(([e, id]) => <button key={e} className="chip chip-ico" onClick={() => setQ(e)}><ItemIcon id={id} size={22} />{e}</button>)}</div>
      <p className="muted small">База: ~9 000 предметов на русском с рецептами, источниками, координатами NPC и ценами. Понимает транслит, жаргон и падежи. Искать можно с любой страницы: Ctrl+K.</p>
    </div>
  );
}

// На телефоне не открываем клавиатуру сама: она закрывает полэкрана, а человек мог прийти просто полистать
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const decode = s => { try { return decodeURIComponent(s || ''); } catch { return s || ''; } };

export default function Wiki() {
  const { openItem, sub } = useApp();
  const [q, setQ] = useState(() => decode(sub));
  // Запрос живёт в адресе (#/wiki/гиперион): ссылкой можно поделиться, «Назад» возвращает к поиску
  useEffect(() => { const s = decode(sub); if (s !== q) setQ(s); }, [sub]);
  useEffect(() => {
    const t = setTimeout(() => {
      const want = q.trim() ? `#/wiki/${encodeURIComponent(q.trim())}` : '#/wiki';
      if (location.hash !== want) history.replaceState(history.state, '', want);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const [res, setRes] = useState([]);
  // пока идёт поиск, не показываем «Ничего не найдено» — оно мелькало после каждой буквы
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false); // нет связи — это не «ничего не нашлось»
  const [retry, setRetry] = useState(0);
  // Прямая ссылка #/wiki/HYPERION: если в адресе ID предмета и он нашёлся — сразу открываем карточку (один раз)
  const idLink = useRef(/^[A-Z0-9_]+(;\d+)?$/.test(decode(sub)) ? decode(sub) : null);
  useEffect(() => {
    const id = idLink.current;
    if (id && res.some(r => r.id === id)) { idLink.current = null; openItem(id); }
  }, [res]);
  useEffect(() => {
    let alive = true;
    setSearching(q.length >= 2);
    const t = setTimeout(() => (q.length >= 2 ? api(`/search?q=${encodeURIComponent(q)}`).then(r => { if (alive) { setRes(r); setFailed(false); } }).catch(() => { if (alive) { setRes([]); setFailed(true); } }).finally(() => alive && setSearching(false)) : setRes([])), 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, retry]);
  return (
    <div className="grid">
      <Card className="span-12" title="Вики предметов">
        <input className="search big" autoFocus={!TOUCH} placeholder="Найди любой предмет по-русски или по-английски: гиперион, терма, аоте, меч, питомец дракон…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="search-results">
          {res.map(r => (
            <div key={r.id} className="search-item" onClick={() => openItem(r.id)}>
              <ItemIcon id={r.id} size={40} />
              <div className="grow"><div style={{ color: RARITY_COLOR[r.rarity] }}>{r.name}</div><div className="muted tiny">{[RARITY_RU[r.rarity], r.type,
                // два предмета с одним названием и редкостью (Rift Necklace) различаем по ID
                res.some(x => x !== r && x.name === r.name && x.rarity === r.rarity) && variantLabel(r.id)].filter(Boolean).join(' · ')}</div></div>
              <div className="price">{r.price ? <LivePrice id={r.id} fallback={coins(r.price)} /> : ''}</div>
            </div>
          ))}
          {q.length >= 2 && !res.length && (searching ? <div className="loader"><div className="spinner" /></div> : failed ? (
            <Empty>Нет связи с сервером, поиск не сработал. <button className="btn ghost" onClick={() => setRetry(x => x + 1)}>Ещё раз</button></Empty>
          ) : <NotFound q={q} setQ={setQ} />)}
          {q.length < 2 && <WikiStart setQ={setQ} openItem={openItem} />}
        </div>
      </Card>
    </div>
  );
}
