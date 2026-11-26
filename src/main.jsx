// Вход сайта: сначала язык. На /en/ до запуска сайта подгружаем словарь, чтобы весь текст сразу был на английском
import { EN, setDict } from './i18n.js';

if (EN) {
  try { setDict((await import('virtual:i18n-en')).default); } catch (e) { console.warn('[i18n]', e); }
}
// Файл сайта не пришёл (502 во время перезапуска сервера) — не белый экран, а сообщение и повтор (index.html)
try { await import('./start.jsx'); } catch (e) { console.error(e); window.__sbBootFail?.(); }
