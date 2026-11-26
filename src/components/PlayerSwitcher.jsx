// Переключатель игрока в шапке: свой профиль, избранные друзья, поиск по нику и выбор профиля.
// Все страницы (обзор, план, снаряжение, заработок, советчик) показывают выбранного игрока.
import { useEffect, useRef, useState } from 'react';
import { setView, getFavorites, saveFavorites, viewKey, saveLocal, me, api } from '../api.js';

const OWNER_KEY = 'sb-owner';
// «Я» — тот, кто вошёл (у друга — его ник и профиль из аккаунта)
const meDefault = () => ({ name: me.name || '', profile: me.profile || undefined });
function readOwner() {
  try {
    const o = JSON.parse(localStorage.getItem(OWNER_KEY) || 'null');
    if (me.guest) return meDefault(); // у гостя нет «своего» профиля
    return o && (!me.name || o.name?.toLowerCase() === me.name.toLowerCase()) ? o : meDefault();
  } catch { return meDefault(); }
}

// key = адрес: при смене игрока рисуется новый <img>, а не старый с пометкой «broken».
// Раньше на стартовой гость без ника получал битую голову, пометка оставалась на том же <img>,
// и после ввода ника вместо аватарки висела заглушка до перезагрузки страницы
export const Avatar = ({ who, size = 44, className = 'avatar' }) => {
  const src = `/api/head/${encodeURIComponent(who || 'MHF_Steve')}?size=${size * 2}`;
  return <img key={src} className={className} width={size} height={size} src={src} alt=""
    onError={e => e.currentTarget.classList.add('broken')} />;
};

export default function PlayerSwitcher({ state, view }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [favs, setFavs] = useState(getFavorites);
  const [owner, setOwner] = useState(readOwner);
  const [siteUsers, setSiteUsers] = useState([]); // аккаунты сайта: друзья всегда под рукой в быстром выборе
  const [coop, setCoop] = useState(null); // кооп-соседи открытого профиля: { profile, profileId, members: [{ uuid, name, share }] }
  const box = useRef(null);
  const input = useRef(null);
  const m = state?.member;
  const isOwner = !view;

  // Соседи по кооп-острову: в переключателе и аватарками рядом с ником, чтобы перейти к ним в один клик.
  // Только на своём профиле (владельцу — и на чужих): друзья анонимны, гость соседей не видит
  const seesCoop = !me.guest && (state?.view?.owner || me.admin);
  useEffect(() => {
    if (!seesCoop || !m?.profileId || !(m.coopMembers > 1)) { setCoop(null); return; }
    if (coop?.profileId === m.profileId && coop?.uuid === m.uuid) return;
    let alive = true;
    api('/coop').then(r => { if (alive && r.profileId === m.profileId) setCoop({ ...r, uuid: m.uuid }); }).catch(() => {});
    return () => { alive = false; };
  }, [m?.profileId, m?.uuid, m?.coopMembers, seesCoop]);
  const mates = coop?.members || [];

  // Запоминаем свой ник и основной профиль: по ним «Мой профиль» работает и пока открыт чужой
  useEffect(() => {
    if (!me.guest && state?.view?.owner && state.player?.name && m) {
      const o = { name: state.player.name, uuid: state.player.uuid, profile: m.profileName };
      if (o.name !== owner.name || o.profile !== owner.profile) { setOwner(o); saveLocal(OWNER_KEY, JSON.stringify(o)); }
    }
  }, [state?.view?.owner, state?.player?.name, m?.profileName]);

  useEffect(() => {
    if (!open || siteUsers.length || !me.admin || me.guest) return; // аккаунты друзей — только владельцу
    api('/me').then(r => setSiteUsers((r.users || []).filter(u => u.name.toLowerCase() !== owner.name?.toLowerCase()))).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const f = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    const k = e => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', f); addEventListener('keydown', k);
    setTimeout(() => input.current?.focus(), 0);
    return () => { removeEventListener('mousedown', f); removeEventListener('keydown', k); };
  }, [open]);

  const go = v => {
    setOpen(false); setName('');
    // Свой основной профиль — обычный режим (живые обновления каждую минуту)
    const mine = !v || (v.player.toLowerCase() === owner.name?.toLowerCase() && (!v.profile || v.profile.toLowerCase() === owner.profile?.toLowerCase()));
    setView(mine && !me.guest ? null : v); // гость всегда смотрит выбранный ник (без ника — стартовая страница)
  };
  const submit = e => {
    e.preventDefault();
    const [p, prof] = name.trim().split(/[\s/]+/);
    if (p) go({ player: p, profile: prof || '' });
  };

  const curPlayer = me.guest && !view ? 'Выбрать игрока' : state?.player?.name || view?.player || owner.name;
  const cur = { player: curPlayer, profile: m?.profileName || view?.profile || '' };
  // Без ника (Mojang не ответил) соседа открываем по uuid: сервер понимает и так
  const mateView = c => ({ player: c.name || c.uuid, profile: coop?.profile || m?.profileName || '' });
  const mateLabel = c => c.name || `${c.uuid.slice(0, 8)}…`;
  const coopCompare = `#/compare/${encodeURIComponent([cur, ...mates.map(mateView)].slice(0, 4).map(p => `${p.player}:${p.profile}`).join(','))}`;
  const isFav = favs.some(f => viewKey(f) === viewKey(cur) || (f.player.toLowerCase() === cur.player?.toLowerCase() && !f.profile));
  const toggleFav = () => {
    const next = isFav ? favs.filter(f => f.player.toLowerCase() !== cur.player.toLowerCase()) : [...favs, cur];
    setFavs(next); saveFavorites(next);
  };
  const removeFav = f => { const next = favs.filter(x => viewKey(x) !== viewKey(f)); setFavs(next); saveFavorites(next); };
  const favRows = favs.filter(f => (f.player.toLowerCase() !== owner.name?.toLowerCase() || f.profile) && !siteUsers.some(u => u.name.toLowerCase() === f.player.toLowerCase()));
  const quick = (!me.guest && owner.name) || siteUsers.length > 0 || favRows.length > 0;
  const active = f => viewKey(f) === viewKey(view) || (!view && f.player.toLowerCase() === owner.name?.toLowerCase());

  return (
    <div className="who-wrap" ref={box}>
      <button className={`who who-btn ${isOwner ? '' : 'friend'}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog" title="Сменить игрока или профиль">
        <Avatar who={state?.player?.uuid || (me.guest && !view ? null : curPlayer)} />
        <div>
          <div className="who-name">{curPlayer || '…'}{m && <span className="profile-chip">{m.profileName}</span>}<span className="who-caret">▾</span></div>
          <div className="muted small">{m ? <>{m.rank?.id && m.rank.id !== 'NONE' && <span className={`rank-chip rank-${m.rank.id.toLowerCase()}`}>{m.rank.label}</span>}{m.mode && m.mode.id !== 'normal' && <span className="mode-chip" title={m.mode.note}>{m.mode.label}</span>}{`SkyBlock ${Math.floor(m.sbLevel)} уровень · ${m.coopMembers > 1 ? `кооп из ${m.coopMembers}` : 'соло'}`}{m.cookie === false && <span className="nocookie" title="Booster Cookie не активна: Bazaar и аукцион только в Hub, нет +25% опыта скиллов"> · без Cookie</span>}</> : state?.view?.failed ? 'Профиль не открылся' : view ? 'Загружаю профиль…' : ' '}</div>
        </div>
      </button>
      {mates.length > 0 && (
        <div className="coop-quick" role="group" aria-label={`Кооп ${coop.profile || ''}`}>
          {mates.slice(0, 4).map(c => (
            <button key={c.uuid} className="coop-head" onClick={() => go(mateView(c))} title={`Открыть кооп-соседа ${mateLabel(c)}`} aria-label={`Открыть кооп-соседа ${mateLabel(c)}`}>
              <Avatar who={c.uuid} size={26} className="avatar sm" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="ps-pop" role="dialog" aria-label="Выбор игрока">
          <form className="ps-search" onSubmit={submit}>
            <input ref={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ник, можно с профилем: Steve Apple" maxLength={60} autoComplete="off" spellCheck={false} />
            <button className="btn" disabled={!name.trim()}>Открыть</button>
          </form>

          {mates.length > 0 && (
            <div className="ps-section">
              <div className="ps-title">Кооп {coop.profile}</div>
              {mates.map(c => (
                <button key={c.uuid} className="ps-row" onClick={() => go(mateView(c))}>
                  <Avatar who={c.uuid} size={28} className="avatar sm" />
                  <span><b>{mateLabel(c)}</b><span className="muted"> · {coop.profile}</span></span>
                  <span className="ps-tag coop">кооп</span>
                </button>
              ))}
              <a className="ps-coop-cmp" href={coopCompare} onClick={() => setOpen(false)}>⚖ Сравнить с {mates.length > 1 ? 'коопом' : mateLabel(mates[0])}</a>
            </div>
          )}

          {state?.profiles?.length > 1 && (
            <div className="ps-section">
              <div className="ps-title">Профили {curPlayer}</div>
              <div className="ps-chips">
                {state.profiles.map(p => (
                  <button key={p.id} className={`ps-chip ${m?.profileId === p.id ? 'on' : ''}`} onClick={() => go({ player: curPlayer, profile: p.name })}
                    title={`${p.mode !== 'normal' ? `режим ${p.mode}, ` : ''}${p.members > 1 ? `кооп из ${p.members}` : 'соло'}`}>
                    {p.name}{p.selected ? ' ★' : ''}{p.mode === 'ironman' ? ' ♲' : p.mode === 'bingo' ? ' 🎲' : ''}
                  </button>
                ))}
              </div>
              <div className="tiny muted">★ — профиль, в котором игрок сейчас играет</div>
            </div>
          )}

          {quick && <div className="ps-section">
            <div className="ps-title">{me.guest ? 'Избранное' : 'Быстрый выбор'}</div>
            {!me.guest && owner.name && (
              <button className={`ps-row ${!view ? 'on' : ''}`} onClick={() => go(null)}>
                <Avatar who={owner.uuid || owner.name} size={28} className="avatar sm" />
                <span><b>{owner.name}</b>{owner.profile && <span className="muted"> · {owner.profile}</span>}</span>
                <span className="ps-tag">это я</span>
              </button>
            )}
            {siteUsers.filter(u => !mates.some(c => c.name?.toLowerCase() === u.name.toLowerCase())).map(u => {
              const f = { player: u.name, profile: u.profile || '' };
              return (
                <button key={`u-${u.name}`} className={`ps-row ${view?.player?.toLowerCase() === u.name.toLowerCase() ? 'on' : ''}`} onClick={() => go(f)}>
                  <Avatar who={u.name} size={28} className="avatar sm" />
                  <span><b>{u.name}</b>{u.profile && <span className="muted"> · {u.profile}</span>}</span>
                  <span className="ps-tag">на сайте</span>
                </button>
              );
            })}
            {favRows.map(f => (
              <div key={viewKey(f)} className={`ps-row ${active(f) ? 'on' : ''}`}>
                <button className="ps-row-main" onClick={() => go(f)}>
                  <Avatar who={f.player} size={28} className="avatar sm" />
                  <span><b>{f.player}</b>{f.profile && <span className="muted"> · {f.profile}</span>}</span>
                </button>
                <button className="x-btn sm danger" onClick={() => removeFav(f)} title="Убрать из избранного" aria-label={`Убрать ${f.player} из избранного`}>×</button>
              </div>
            ))}
          </div>}

          {!isOwner && curPlayer && (
            <button className="btn ghost ps-fav" onClick={toggleFav}>{isFav ? '★ В избранном' : '☆ Добавить в избранное'}</button>
          )}
          <div className="ps-foot">
            <a href="#/compare" onClick={() => setOpen(false)}>⚖ Сравнить профили</a>
            {me.name && <><a href="/account">{me.admin ? 'Пароль и аккаунты друзей' : 'Сменить пароль'}</a>{!me.local && <form method="post" action="/logout" className="inline-form"><button type="submit" className="linklike">Выйти ({me.name})</button></form>}</>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Под шапкой: гостю — только важные пометки (нет такого профиля, выключен API); вошедшему на чужом профиле — тихая подсказка */
export function FriendBanner({ state, view }) {
  if (!view || state?.view?.failed) return null;
  const name = state?.player?.name || view.player;
  const prof = state?.member?.profileName || view.profile;
  const missing = state?.view?.missingProfile && state?.member;
  const apiOff = state?.member?.apiDisabled;
  const hint = !me.guest;
  if (!hint && !missing && !apiOff) return null;
  return (
    <div className="friend-banner quiet">
      {hint && <span className="muted small">Открыт профиль <b>{name}</b>{prof ? <> · {prof}</> : null}</span>}
      {hint && <button className="linklike small" onClick={() => setView(null)}>← к своему профилю</button>}
      {missing && (
        <div className="api-off-note">Профиля «{state.view.missingProfile}» у {name} нет, поэтому открыт <b>{state.member.profileName}</b>. Другие профили — в списке под ником.</div>
      )}
      {apiOff && <ApiOffNote name={name} />}
    </div>
  );
}

/** У игрока в настройках выключен доступ к инвентарю: без пояснения профиль выглядит пустым («0 уровень») */
export function ApiOffNote({ name, self = false }) {
  return (
    <div className="api-off-note">
      ⚠️ {self ? 'У тебя' : <>У <b>{name}</b></>} в настройках Hypixel выключен доступ к инвентарю через API, поэтому снаряжение, аксессуары, деньги и план здесь неполные.
      {' '}Включить: в игре <b>SkyBlock Menu → Settings → API Settings</b>, затем подождать пару минут.
    </div>
  );
}
