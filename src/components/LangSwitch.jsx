// Переключатель языка (RU / EN). Языки — это разные адреса (/ и /en/), поэтому переключение — обычный переход по ссылке:
// поисковики видят обе версии. Первую страницу сервер сам открывает на языке посетителя (выбранном раньше или языке браузера),
// поэтому выбор запоминаем в cookie до перехода — иначе сервер вернул бы на прежнюю версию.
import { LANG, langUrl } from '../i18n.js';

const remember = l => { try { document.cookie = `sb-lang=${l}; path=/; max-age=31536000; samesite=lax`; } catch { /* */ } };

export function LangSwitch({ className = '' }) {
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language">
      {['ru', 'en'].map(l => (
        <a key={l} href={langUrl(l)} hrefLang={l} lang={l} className={l === LANG ? 'on' : ''} aria-current={l === LANG ? 'true' : undefined}
          onClick={() => remember(l)}>{l.toUpperCase()}</a>
      ))}
    </div>
  );
}
