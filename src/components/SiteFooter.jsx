import { Disclaimer } from './Ads.jsx';
import { EN } from '../i18n.js';

/* global __BUILD__ */
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { v: '', date: '' };
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return EN ? `${y}-${m}-${d}` : `${d}.${m}.${y}`;
};

/** Источники данных — коротко; ссылки и лицензии подробно на /legal (браузер не ходит на чужие сайты сам) */
const SOURCES = ['Hypixel API', 'NotEnoughUpdates', 'Hypixel SkyBlock Wiki', 'SkyCofl'];

const ext = { target: '_blank', rel: 'noopener noreferrer' };

/**
 * Подвал страницы: о проекте, GitHub и API для разработчиков, источники данных, версия сборки.
 * Оговорка и правовые ссылки на ПК стоят в боковой панели, поэтому здесь они только на телефоне.
 */
export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="sf-row">
        <div className="sf-brand">
          <img src="/favicon.svg" width={22} height={22} alt="" />
          <span><b>Sky Guide</b> <span className="muted">· гид по SkyBlock на русском</span></span>
        </div>
        <nav className="sf-links">
          <a href="https://github.com/sky-guide-ru" {...ext}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>
            GitHub
          </a>
          <a href="/api/docs/" {...ext} title="Документация API: адреса, лимиты, правила ключей">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg>
            API и правила
          </a>
        </nav>
      </div>
      <p className="sf-line muted">
        Данные: {SOURCES.join(' · ')} · <a href={`${EN ? '/en' : ''}/legal`}>источники и лицензии</a>
      </p>
      <p className="sf-line sf-meta muted">
        Открытый код, лицензия <a href="https://www.gnu.org/licenses/agpl-3.0.html" {...ext}>AGPL-3.0</a>
        {BUILD.v && <> · версия {BUILD.v}</>}
        {BUILD.date && <> · сборка {fmtDate(BUILD.date)}</>}
        {BUILD.sha && <> · <a href={`https://github.com/sky-guide-ru/web/commit/${BUILD.sha}`} {...ext}><code>{BUILD.sha.slice(0, 7)}</code></a></>}
      </p>
      <div className="sf-mobile"><Disclaimer /></div>
    </footer>
  );
}
