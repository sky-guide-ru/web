import { LOCALE, DEC } from '../i18n.js';
// Вкладки «Bank» и «Bits» на странице «Заработок» и блок Maxwell на странице «Аксессуары».
import { useEffect, useState } from 'react';
import { Stat, Empty, Badge } from '../components/ui.jsx';
import { ItemIcon } from '../components/ItemIcon.jsx';
import { coins, num, useApi, ago, saveLocal, useProfileStore } from '../api.js';
import { Rich } from '../guides/Rich.jsx';

// Сколько осталось до момента: «12 ч 5 мин»
function left(ts, now) {
  const m = Math.max(0, Math.round((ts - now) / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
}
const clock = ts => new Date(ts).toLocaleString(LOCALE, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function BankTab() {
  const { data: b } = useApi('/bank', []);
  const now = useNow();
  if (!b) return <div className="loader"><div className="spinner" /></div>;
  if (b.balance == null) return <Empty>Bank не виден: в настройках API Hypixel выключен доступ к банку.</Empty>;
  const next = b.nextAt > now ? b.nextAt : b.nextAt + b.periodHours * 3600_000;
  return (
    <div className="wealth">
      <div className="stats-row">
        <Stat label="Проценты" value={`+${coins(b.expected)}`} sub={`через ${left(next, now)} · ${clock(next)}`} accent="#4ade80" icon={<img src="/api/texture/clock_00" alt="" />} />
        <Stat label="В среднем за сутки" value={coins(b.expectedPerDay)} sub="одно начисление раз в 31 час" accent="#f5c542" icon={<img src="/api/texture/gold_ingot" alt="" />} />
        <Stat label="Счёт" value={b.tier.name} sub={b.tier.known ? (b.tier.max ? `хранит до ${coins(b.tier.max)}` : 'потолок не сверен') : 'определён по балансу, может быть выше'} accent="#60a5fa" icon={<img src="/api/texture/gold_block" alt="" />} />
        <Stat label="Потолок процентов" value={coins(b.cap)} sub={`при балансе от ${coins(b.capBalance)}`} accent="#c879ff" icon={<img src="/api/texture/emerald" alt="" />} />
      </div>

      <div className="bank-explain">
        <h4>Как на самом деле работают проценты</h4>
        <ul>
          <li>Проценты приходят не каждый день, а <b>раз в сезон SkyBlock, то есть раз в 31 час</b>. Если ты был не в игре, начисление придёт при входе.</li>
          <li>Процент ступенчатый: <b>2% на первые 10 млн</b>, 1% на следующие 10 млн, дальше 0,5%, 0,2% и 0,1% (зависит от счёта). Выше потолка баланс процентов не даёт совсем.</li>
          <li>При твоём балансе {coins(b.balance)} это <b>{coins(b.expected)} за начисление ≈ {coins(b.expectedPerDay)} в сутки</b>{b.expectedPerDay > 60_000 ? ', то есть больше, чем 50 тыс. в день' : ''}.</li>
          {b.coop && <li>Это общий Bank кооператива. Личный Bank каждого участника даёт ещё проценты по тем же ступеням, только всё в 5 раз меньше{b.personal > 0 ? `: у тебя ${coins(b.personal)} → +${coins(b.personalExpected)}` : ''}.</li>}
        </ul>
        {b.last && <div className="muted small">Последнее начисление в истории банка: <b className="green">+{coins(b.last.amount)}</b> {ago(b.last.at)}{b.history.length > 1 ? ` · до этого: ${b.history.slice(1, 4).map(h => '+' + coins(h.amount)).join(', ')}` : ''}</div>}
      </div>

      {b.tips.length > 0 && <div className="plan-summary"><img src="/api/texture/book" alt="" className="plan-ico" /><div>{b.tips.map((t, i) => <div key={i}>{t}</div>)}</div></div>}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Счёт</th><th>Хранит до</th><th>Макс. проценты</th><th>При твоём балансе</th><th>Прибавка</th><th>Улучшение</th><th>Окупится</th></tr></thead>
          <tbody>{b.tiers.map(t => (
            <tr key={t.id} className={t.current ? 'row-current' : ''}>
              <td>{t.name} {t.current && <Badge>твой</Badge>}</td>
              <td>{t.max ? coins(t.max) : '—'}</td>
              <td>{t.maxInterest ? coins(t.maxInterest) : <span className="muted tiny">не сверено</span>}</td>
              <td>{t.interestNow != null ? coins(t.interestNow) : '—'}</td>
              <td className={t.gain > 0 ? 'green' : 'muted'}>{t.gain == null ? '' : t.gain > 0 ? `+${coins(t.gain)}` : '0'}</td>
              <td>{t.owned ? <span className="muted tiny">есть</span> : t.cost ? `~${coins(t.cost)}` : '—'}</td>
              <td>{t.paybackDays ? (t.paybackDays > 365 ? `~${(t.paybackDays / 365).toFixed(1).replace('.', DEC)} г.` : `${num(t.paybackDays)} дн.`) : t.gain === 0 ? <span className="muted tiny">не окупится</span> : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="muted tiny" style={{ marginTop: 6 }}>Цена улучшения — монеты и предметы по ценам гайда 2021–22 (сейчас может отличаться), путь считается от твоего счёта. Luxurious и Palatial нужны, чтобы хранить больше, для них нужны ещё пожертвования в Музей; прибавку процентов у них не сверяли. Улучшать счёт — у Banker в Hub.</div>
    </div>
  );
}

export function BitsTab({ openItem }) {
  // Bits и Fame вводятся вручную (их нет в API) — свои у каждого профиля
  const [bitsRaw, setBits] = useProfileStore('sb-bits', 0);
  const [fameRaw, setFame] = useProfileStore('sb-fame', 0);
  const bits = Number(bitsRaw) || 0, fame = Number(fameRaw) || 0;
  const { data: r } = useApi(`/bits?bits=${bits}&fame=${fame}`, [], { keep: true });
  if (!r) return <div className="loader"><div className="spinner" /></div>;
  const ck = r.cookie;
  const roi = ck.price > 0 && ck.returnOnBest ? Math.round(ck.returnOnBest / ck.price * 100) : null;
  return (
    <div className="wealth">
      <div className="budget">
        <label>Твои Bits: <input type="number" min="0" step="100" value={bits || ''} placeholder="0" onChange={e => setBits(Math.max(0, +e.target.value || 0))} style={{ width: 110 }} /></label>
        <label>Ранг Fame: <select value={fame} onChange={e => setFame(+e.target.value)}>{r.ranks.map(x => <option key={x.idx} value={x.idx}>{x.name} (×{x.mult})</option>)}</select></label>
        <span className="muted tiny">Сайт не видит баланс Bits и Fame в данных профиля: посмотри их в игре (табло справа и меню Community Shop).</span>
      </div>

      <div className="stats-row">
        <Stat label="Booster Cookie" value={coins(ck.price)} sub={`даёт ${num(ck.bits)} Bits при твоём ранге`} accent="#f5c542" icon={<ItemIcon id="BOOSTER_COOKIE" size={28} />} />
        <Stat label="1 Bit из печенья стоит" value={`${num(Math.round(ck.coinsPerBit))} монет`} sub="если покупать печенье ради Bits" accent="#60a5fa" icon={<img src="/api/texture/gold_nugget" alt="" />} />
        <Stat label="Лучший обмен" value={r.best ? `${num(Math.round(r.best.perBit))} за Bit` : '—'} sub={r.best ? r.best.name : 'цены ещё грузятся'} accent="#4ade80" icon={r.best ? <ItemIcon id={r.best.id} size={28} /> : null} />
        <Stat label="Твои Bits стоят" value={bits ? coins(r.bitsWorth) : '—'} sub={bits ? 'если продать через лучший товар' : 'впиши баланс выше'} accent="#c879ff" icon={<img src="/api/texture/emerald" alt="" />} />
      </div>

      {r.best && <div className="plan-summary"><img src="/api/texture/book" alt="" className="plan-ico" /><div>
        Bits из одного печенья, обменянные на <b>{r.best.name}</b> и проданные, вернут ~<b>{coins(ck.returnOnBest)}</b>{roi ? ` — это ${roi}% цены печенья` : ''}. {roi >= 100 ? 'Печенье полностью окупается за счёт Bits.' : roi ? 'Остальное ты платишь за сам бафф печенья (опыт, магический поиск, сохранение монет при смерти, доступ к Bazaar отовсюду).' : ''}
        {' '}Bits приходят постепенно, пока бафф печенья активен, поэтому тратить их можно по мере накопления.
      </div></div>}

      {r.forYou.length > 0 && (
        <>
          <h4 className="sub-h">Что взять себе</h4>
          <div className="bits-picks">{r.forYou.map(i => (
            <div key={i.id} className="item-line" onClick={() => openItem(i.id)}>
              <ItemIcon id={i.id} size={30} /><div className="grow">{i.name} <span className="muted tiny">· {num(i.bits)} Bits</span><div className="muted tiny"><Rich text={i.why} /></div></div>
              {i.affordable != null && <Badge>{i.affordable > 0 ? 'хватает' : `не хватает ${num(i.bits - r.bits)}`}</Badge>}
            </div>
          ))}</div>
        </>
      )}

      <h4 className="sub-h">Все товары за Bits: сколько монет даёт 1 Bit</h4>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th></th><th>Товар</th><th>Bits</th><th>Продать за</th><th>Монет за Bit</th><th>Зачем</th></tr></thead>
          <tbody>{r.items.map(i => (
            <tr key={i.id} className="clickable-row" onClick={() => openItem(i.id)}>
              <td><ItemIcon id={i.id} size={28} /></td>
              <td>{i.name}{i.owned && <div className="muted tiny">уже есть</div>}</td>
              <td>{num(i.bits)}</td>
              <td>{i.price ? coins(i.price) : <span className="muted tiny">не продаётся</span>}</td>
              <td className={i === r.items[0] ? 'gold' : ''}>{i.perBit ? num(Math.round(i.perBit)) : '—'}</td>
              <td className="muted small">{i.use}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="muted tiny" style={{ marginTop: 6 }}>Цены — мгновенная продажа на Bazaar или самый дешёвый лот BIN, без налога аукциона. Список товаров и цены в Bits — по данным 2024 года; если в магазине что-то поменялось, сверь в игре.</div>
    </div>
  );
}

export function MaxwellCard() {
  const { data: r } = useApi('/maxwell', []);
  const [all, setAll] = useState(false);
  if (!r) return null;
  const shown = all ? r.powers : r.powers.slice(0, 8);
  const st = o => Object.entries(o).map(([k, v]) => `${v > 0 ? '+' : ''}${num(Math.round(v))} ${k}`).join(', ');
  return (
    <div className="wealth">
      {r.tips.length > 0 && <div className="plan-summary"><img src="/api/texture/ender_eye" alt="" className="plan-ico" /><div>{r.tips.map((t, i) => <div key={i}>{t}</div>)}</div></div>}
      <div className="muted small" style={{ marginBottom: 8 }}>
        Стиль: <b>{r.roleLabel}</b> (по выбранному классу данжа). Статы силы растут с Magical Power: у тебя {num(r.mp)} MP, это ≈{String(r.scale).replace('.', DEC)}× от значений при 250 MP.
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Сила</th><th>Статы сейчас ≈</th><th>Уникальный бонус</th><th>Очки</th><th>Как открыть</th></tr></thead>
          <tbody>{shown.map(p => (
            <tr key={p.power} className={p.selected ? 'row-current' : ''}>
              <td><b>{p.power}</b> {p.selected && <Badge>выбрана</Badge>}</td>
              <td className="small">{st(p.statsNow)}</td>
              <td className="small muted">{st(p.unique) || '—'}</td>
              <td className="gold">{num(p.score)}</td>
              <td className="small">{p.unlocked ? <span className="green">открыта</span> : <span className="stone-cell"><ItemIcon id={p.stone} size={20} /> 9 × {p.stoneName}{!p.combatOk && <span className="red"> · нужен Combat {p.reqCombat}</span>}</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {r.powers.length > 8 && <button className="btn ghost small" onClick={() => setAll(!all)} style={{ marginTop: 6 }}>{all ? 'Свернуть' : `Показать все ${r.powers.length}`}</button>}
      <div className="muted tiny" style={{ marginTop: 6 }}>«Очки» — {r.role === 'mage' ? 'Intelligence (+ бонус к урону способностями)' : 'Strength + Crit Damage'} вместе с уникальным бонусом. 9 одинаковых Power Stone превращает в силу Thaumaturgist в Hub. Стартовые силы ({r.starter.join(', ')}) слабее, их статы в таблицу не вошли.</div>

      <h4 className="sub-h">Stats Tuning: {r.tuning.spent} из {r.tuning.points} очков</h4>
      <div className="tuning-row">
        {r.tuning.dist.length ? r.tuning.dist.map(d => <span key={d.key} className="chip">{d.name}: {d.points} очк.{d.gives != null ? ` → +${num(d.gives)}` : ''}</span>) : <span className="muted small">Очки не распределены.</span>}
        {r.tuning.free > 0 && <span className="chip warn">свободно: {r.tuning.free}</span>}
      </div>
      <div className="muted small" style={{ marginTop: 6 }}><Rich text={r.tuning.advice} /> Одно очко даёт: {r.tuning.perPoint.map(p => `${p.v.toString().replace('.', DEC)} ${p.name}`).join(', ')}. Очки появляются за каждые 10 Magical Power.</div>
    </div>
  );
}
