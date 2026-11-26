import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Шрифты лежат на нашем сервере (лицензия SIL OFL 1.1), а не грузятся с Google Fonts: так IP посетителя
// не уходит иностранному сервису (152-ФЗ) и сайт не зависит от доступности Google.
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/rubik/index.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles.css';
import './visual.css';
import './lite.css';
import './spotlight.js';
import { installKeyboardClicks } from './a11y.js';
import { watchSlowRendering } from './lite.js';
import { reportError } from './telemetry.js';

// Текстура не загрузилась (нет сети до хоста, нет файла): прячем картинку, а не показываем битую.
// Safari рисует битую картинку синим квадратом с «?», и всё меню было из таких квадратов.
// Обёртка .nav-ico тогда показывает запасной значок из data-fb.
document.addEventListener('error', e => {
  const img = e.target;
  // Аватар в подвале меню (сервер не отдал голову): просто убираем, имя рядом и так видно
  if (img?.tagName === 'IMG' && img.closest?.('.acct')) { img.style.display = 'none'; return; }
  if (img?.tagName !== 'IMG' || !/\/api\/(texture|img|skin)\//.test(img.src)) return;
  img.classList.add('tex-broken');
  img.parentElement?.classList.add('tex-broken-host');
}, true);
// Тот же <img> мог получить новый src (запасную текстуру) и загрузиться — снова показываем
document.addEventListener('load', e => {
  const img = e.target;
  if (img?.tagName !== 'IMG' || !img.classList.contains('tex-broken')) return;
  img.classList.remove('tex-broken');
  img.parentElement?.classList.remove('tex-broken-host');
}, true);

// Падение раздела React тоже попадает в журнал ошибок владельца (страница «Сервер»)
const withStack = (e, info) => { const x = e instanceof Error ? e : new Error(String(e)); if (info?.componentStack) x.stack = `${x.stack || x.message}\n${info.componentStack.trim().split('\n').slice(0, 4).join('\n')}`; return x; };
createRoot(document.getElementById('root'), {
  onUncaughtError: (e, info) => { console.error(e); reportError(withStack(e, info), 'react'); },
  onCaughtError: (e, info) => { console.error(e); reportError(withStack(e, info), 'react'); },
}).render(<App />);
window.__sbBooted?.(); // сайт запустился: страховка от белого экрана в index.html больше не нужна
installKeyboardClicks();

// Браузер рисует медленно (выключено аппаратное ускорение) — в режиме «авто» сам включится облегчённый режим (lite.js)
watchSlowRendering();
