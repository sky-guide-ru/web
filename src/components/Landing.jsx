import { EN } from '../i18n.js';
// Стартовая страница для гостя: ввёл ник — открылся весь сайт по этому игроку, как на SkyCrypt. Без регистрации.
import { useState } from 'react';
import { setView } from '../api.js';
import { AdSlot, DonateButton } from './Ads.jsx';

const NICK = /^[A-Za-z0-9_]{1,16}$/;
const FEATURES = [
  { icon: 'map', title: 'Что делать дальше', text: 'План прогрессии по твоему профилю: какие скиллы, слееры, данжи и снаряжение качать в первую очередь и почему.' },
  { icon: 'diamond_sword', title: 'Снаряжение и улучшения', text: 'Оружие, броня, аксессуары и питомцы с русскими описаниями и списком улучшений с ценами.' },
  { icon: 'gold_ingot', title: 'Заработок', text: 'Способы заработать монеты с учётом того, что у тебя уже есть, и живых цен Bazaar и аукциона.' },
  { icon: 'written_book', title: 'Гайды на русском', text: 'Рыбалка, Рифт, сбор ресурсов, бой: пошагово и с привязкой к твоему прогрессу.' },
  { icon: 'emerald', title: 'Рынок', text: 'Цены Bazaar и аукциона, флипы и история цен.' },
  { icon: 'comparator', title: 'Сравнение', text: 'Сравни свой профиль с друзьями: скиллы, слееры, данжи, богатство.' },
];

export default function Landing() {
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');
  const open = e => {
    e.preventDefault();
    const n = nick.trim();
    if (!NICK.test(n)) { setErr('Ник Minecraft: латиница, цифры и _, до 16 символов'); return; }
    setErr('');
    // Профиль не спрашиваем: сервер берёт тот, где игрок играл последним; сменить можно в шапке рядом с ником.
    setView({ player: n });
    if (!location.hash || location.hash === '#/') location.hash = '#/overview';
  };
  return (
    <div className="landing">
      <section className="card landing-hero">
        {/* значок SkyBlock Menu в паке текстур — три точки, похожие на «загрузку»: ставим знак сайта */}
        <img src="/favicon.svg" width={56} height={56} alt="" className="landing-mark" />
        <h1>SkyBlock трекер на русском</h1>
        <p className="muted">Введи ник в Minecraft, и сайт покажет твой профиль Hypixel SkyBlock, план прогрессии, снаряжение и способы заработка. Без регистрации и паролей.</p>
        <form className="landing-form" onSubmit={open}>
          <input className="input" value={nick} onChange={e => setNick(e.target.value)} placeholder="Ник, например Steve" maxLength={16} autoFocus aria-label="Ник Minecraft" />
          <button className="btn" type="submit">Открыть профиль</button>
        </form>
        {err && <div className="landing-err">{err}</div>}
        <div className="muted small">В игре должен быть включён доступ к API: SkyBlock Menu → Settings → API Settings.</div>
        <div className="landing-links">
          <a href="#/guides" className="link">Гайды</a> · <a href="#/market" className="link">Рынок</a> · <a href="#/wiki" className="link">Вики предметов</a> · <a href="#/compare" className="link">Сравнение</a> · <a href={EN ? '/login?next=%2Fen%2F' : '/login'} className="link">Вход</a>
        </div>
      </section>
      <section className="landing-grid">
        {FEATURES.map(f => (
          <div key={f.title} className="card landing-feature">
            <img src={`/api/texture/${f.icon}`} alt="" width={32} height={32} />
            <div><b>{f.title}</b><p className="muted small">{f.text}</p></div>
          </div>
        ))}
      </section>
      <div className="landing-donate"><DonateButton /></div>
      <AdSlot where="landing" page="landing" />
    </div>
  );
}
