import { EN } from '../i18n.js';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { needsConsent, reopenConsent, pub } from '../ads.js';
import { FeedbackModal } from './Feedback.jsx';

/* global __BUILD__ */
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { date: '', sha: '', core: '' };
const YEAR = (BUILD.date || '').slice(0, 4) || String(new Date().getFullYear());
const L = EN ? '/en' : '';
/** Откуда данные: ссылки на сами источники (переход только по клику), условия и лицензии — на /legal */
const SOURCES = [
  ['Hypixel API', 'https://developer.hypixel.net'],
  ['NotEnoughUpdates', 'https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO'],
  ['Hypixel SkyBlock Wiki', 'https://hypixelskyblock.minecraft.wiki'],
  ['SkyCofl', `${L}/legal`], // адрес SkyCofl в коде сайта запрещён тестом test/boundaries, прямая ссылка есть на /legal
];
const ext = { target: '_blank', rel: 'noopener noreferrer' };
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return EN ? iso : `${d}.${m}.${y}`;
};

/**
 * Подвал сайта по обычной схеме: слева о проекте, дальше колонки ссылок по темам, внизу строка © и оговорка.
 * Здесь же правовые ссылки и оговорка Mojang/Hypixel — в боковой панели их больше нет, чтобы не дублировать.
 */
export default function SiteFooter() {
  const [fb, setFb] = useState(false);
  return (
    <footer className="site-foot">
      <div className="sf-grid">
        <div className="sf-about">
          <div className="sf-brand">
            <img src="/favicon.svg" width={28} height={28} alt="" />
            <b>Sky Guide</b>
          </div>
          <p className="muted">Гид по Hypixel SkyBlock на русском: что делать дальше, заработок и цены.</p>
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
        <nav className="sf-col sf-contact" aria-label="Связь">
          <h4>Связь</h4>
          {pub.contactEmail && <a href={`mailto:${pub.contactEmail}`}>{pub.contactEmail}</a>}
          <a href="https://discord.gg/hHgJJFCGQe" {...ext}>Discord</a>
          <button type="button" className="linklike" onClick={() => setFb(true)}>Сообщить об ошибке</button>
        </nav>
        <div className="sf-col sf-data">
          <h4>Данные</h4>
          {SOURCES.map(([name, href]) => <a key={name} href={href} {...ext}>{name}</a>)}
        </div>
      </div>
      <div className="sf-bottom muted">
        <span>
          © {YEAR} Sky Guide · <a href="https://github.com/sky-guide-ru/web/blob/main/LICENSE" {...ext}>AGPL-3.0</a>
          {BUILD.date && <> · сборка {fmtDate(BUILD.date)}</>}
          {BUILD.sha && <> · <a href={`https://github.com/sky-guide-ru/web/commit/${BUILD.sha}`} {...ext}>{BUILD.sha.slice(0, 7)}</a></>}
          {BUILD.core && <> · <a href={`https://github.com/sky-guide-ru/core/releases/tag/v${BUILD.core}`} {...ext}>core {BUILD.core}</a></>}
        </span>
        <span>Неофициальный фан-сайт, не связан с Hypixel, Mojang и Microsoft и не одобрен ими.</span>
      </div>
      {fb && createPortal(<FeedbackModal onClose={() => setFb(false)} />, document.body)}
    </footer>
  );
}
