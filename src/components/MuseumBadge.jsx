// Строка «Музей» в карточке предмета: в музее ли он, засчитан ли высшим тиром, можно ли пожертвовать и сколько XP даст.
import { useApi } from '../api.js';

export function MuseumBadge({ id, onOpen }) {
  const { data } = useApi(`/museum/item/${encodeURIComponent(id)}`, [id]);
  const mu = data?.museum;
  if (!mu) return null;
  const nm = x => mu.names?.[x] || x;
  const go = <a className="link" href="#/museum">Музей →</a>;
  const set = mu.set ? <> Входит в сет <b>{mu.setName}</b>: в музей сдаётся весь сет целиком.</> : null;
  const where = mu.catRu ? `раздел «${mu.catRu}», ${mu.xp} XP` : '';
  let tone = 'muted', text;
  if (mu.special) {
    if (mu.status === 'special-donated') { tone = 'good'; text = <>🏛 Особый предмет, уже выставлен в музее ✔</>; }
    else text = <>🏛 Особый предмет (Special Items): можно выставить в музее, XP не даёт.</>;
  } else if (mu.status === 'donated') { tone = 'good'; text = <>🏛 В музее ✔ <span className="muted">({where})</span></>; }
  else if (mu.status === 'borrowed') { tone = 'good'; text = <>🏛 В музее ✔, сейчас одолжен обратно: XP засчитан <span className="muted">({where})</span>. Он стал Co-op Soulbound: продать или передать его нельзя.</>; }
  else if (mu.status === 'counted') { tone = 'good'; text = <>🏛 Засчитан в музее через <a className="link" onClick={() => onOpen?.(mu.via)}>{nm(mu.via)}</a> ✔ <span className="muted">(высший тир засчитывает низший)</span></>; }
  else if (mu.status === 'missing' && mu.owned) { tone = 'warn'; text = <>🏛 Можно пожертвовать: +{mu.gain} SkyBlock XP. Он у тебя есть, но ещё не в музее. После пожертвования предмет станет Co-op Soulbound, но его можно забрать обратно.</>; }
  else if (mu.status === 'missing') { text = <>🏛 Нет в музее: пожертвуешь — +{mu.gain} SkyBlock XP <span className="muted">({where})</span></>; }
  else if (mu.status === 'unknown') { text = <>🏛 Принимается в музей ({where}).{mu.apiOff ? ' Museum API у игрока выключен — статус не виден.' : ''}</>; }
  if (!text) return null;
  const hi = mu.status === 'missing' && mu.parents?.length ? <> Засчитают и высшие тиры: {mu.parents.map((p, i) => <span key={p}>{i ? ', ' : ''}<a className="link" onClick={() => onOpen?.(p)}>{nm(p)}</a></span>)}.</> : null;
  return <div className={`museum-badge small ${tone}`}>{text}{set}{hi} {go}</div>;
}
