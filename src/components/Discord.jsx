// Сервер Sky Guide в Discord: кнопка в шапке и карточка на стартовой странице. Ссылка-приглашение бессрочная.
export const DISCORD_URL = 'https://discord.gg/hHgJJFCGQe';
const ext = { target: '_blank', rel: 'noopener noreferrer' };

/** Логотип Discord (контур без надписи) */
export function DiscordLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.85a.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.49 0c-.17-.39-.41-.87-.62-1.25a.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.92 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.07 0a.07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1 0 .13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .09.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}

/** Кнопка в шапке: на телефоне только значок */
export function DiscordButton() {
  return (
    <a className="discord-btn" href={DISCORD_URL} {...ext} title="Сервер Sky Guide в Discord: новости, события SkyBlock, бот и помощь" aria-label="Discord">
      <DiscordLogo /><span className="discord-btn-text">Discord</span>
    </a>
  );
}

/** Карточка на стартовой странице, в ряду возможностей сайта */
export function DiscordCard() {
  return (
    <a className="card landing-feature discord-card" href={DISCORD_URL} {...ext}>
      <span className="discord-card-ico"><DiscordLogo size={22} /></span>
      <div><b>Сервер в Discord</b><p className="muted small">Новости сайта, напоминания о событиях SkyBlock, бот с профилем и ценами, помощь игрокам.</p></div>
      <span className="btn small discord-card-go">Зайти</span>
    </a>
  );
}
