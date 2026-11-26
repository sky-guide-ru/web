import { EN } from '../i18n.js';
import { needsConsent, reopenConsent } from '../ads.js';

/* global __BUILD__ */
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { v: '', date: '', sha: '' };
const YEAR = (BUILD.date || '').slice(0, 4) || String(new Date().getFullYear());
const L = EN ? '/en' : '';
const ext = { target: '_blank', rel: 'noopener noreferrer' };
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return EN ? iso : `${d}.${m}.${y}`;
};

const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>
);

/**
 * Подвал сайта по обычной схеме: слева о проекте, дальше колонки ссылок по темам, внизу строка © и оговорка.
 * Здесь же правовые ссылки и оговорка Mojang/Hypixel — в боковой панели их больше нет, чтобы не дублировать.
 * Источники данных — только названия: ссылки и лицензии на /legal (браузер сам на чужие сайты не ходит).
 */
export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="sf-grid">
        <div className="sf-about">
          <div className="sf-brand">
            <img src="/favicon.svg" width={28} height={28} alt="" />
            <b>Sky Guide</b>
          </div>
          <p className="muted">Гид по Hypixel SkyBlock на русском: что делать дальше, заработок и цены.</p>
          <div className="sf-social">
            <a href="https://github.com/sky-guide-ru" {...ext} aria-label="GitHub" title="GitHub"><GitHubIcon /></a>
          </div>
        </div>
        <nav className="sf-col" aria-label="Разработчикам">
          <h4>Разработчикам</h4>
          <a href="https://github.com/sky-guide-ru" {...ext}>Исходный код</a>
          <a href="/api/docs/" {...ext}>API и правила</a>
        </nav>
        <nav className="sf-col" aria-label="Правовое">
          <h4>Правовое</h4>
          <a href={`${L}/legal`}>Правовая информация</a>
          <a href={`${L}/privacy`}>Конфиденциальность</a>
          <a href={`${L}/terms`}>Условия</a>
          {needsConsent() && <button type="button" className="linklike" onClick={reopenConsent}>Cookie</button>}
        </nav>
        <div className="sf-col sf-data">
          <h4>Данные</h4>
          <span>Hypixel API</span>
          <span>NotEnoughUpdates</span>
          <span>Hypixel SkyBlock Wiki</span>
          <span>SkyCofl</span>
          <a href={`${L}/legal`}>Источники и лицензии →</a>
        </div>
      </div>
      <div className="sf-bottom muted">
        <span>
          © {YEAR} Sky Guide · <a href="https://www.gnu.org/licenses/agpl-3.0.html" {...ext}>AGPL-3.0</a>
          {BUILD.v && <> · v{BUILD.v}</>}
          {BUILD.date && <> · сборка {fmtDate(BUILD.date)}</>}
          {BUILD.sha && <> · <a href={`https://github.com/sky-guide-ru/web/commit/${BUILD.sha}`} {...ext}>{BUILD.sha.slice(0, 7)}</a></>}
        </span>
        <span>Неофициальный фан-сайт, не связан с Hypixel, Mojang и Microsoft и не одобрен ими.</span>
      </div>
    </footer>
  );
}
