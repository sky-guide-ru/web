import { Ico } from './Icons.jsx';
import { EN } from '../i18n.js';
import { useEffect, useRef, useState } from 'react';
import { pub, renderRtb, nextAdId, needsConsent, getConsent, setConsent, onConsent, reopenConsent, loadYandex } from '../ads.js';

/** Согласие посетителя на Метрику и рекламу: null — не спрашивали, true/false — выбор */
function useConsent() {
  const [c, setC] = useState(getConsent);
  useEffect(() => onConsent(v => setC(v)), []);
  return c;
}

/** Рекламный блок РСЯ. where: 'bottom' (внизу страниц) или 'landing' (стартовая). Без id в .env — ничего. */
export function AdSlot({ where = 'bottom', page = '' }) {
  const consent = useConsent();
  const blockId = consent === true ? pub.rtb?.[where] : ''; // без согласия на cookie рекламу Яндекса не грузим
  const id = useRef(null);
  if (!id.current) id.current = nextAdId();
  useEffect(() => {
    if (!blockId) return;
    const el = document.getElementById(id.current);
    if (el) el.innerHTML = '';
    renderRtb(blockId, id.current);
  }, [blockId, page]);
  if (!blockId) return null;
  return (
    <div className="ad-slot" aria-label="Реклама">
      <div className="ad-label muted small">Реклама · помогает сайту оставаться бесплатным</div>
      <div id={id.current} />
    </div>
  );
}

/** Кнопка «Поддержать сайт» (ссылка из DONATE_URL) */
export function DonateButton({ className = '' }) {
  if (!pub.donateUrl) return null;
  return <a className={`btn donate ${className}`} href={pub.donateUrl} target="_blank" rel="noopener noreferrer"><Ico name="heart" size={15} />Поддержать сайт</a>;
}

/**
 * Подпись внизу: обязательная оговорка Mojang (дословно, по их правилам) и Hypixel («не связан и не одобрен»)
 * + ссылки на правовые страницы. Источники данных и лицензии — на /legal, чтобы не раздувать подвал.
 */
export function Disclaimer() {
  return (
    <div className="disclaimer muted small">
      <p>Неофициальный фан-сайт, не связан с Hypixel, Mojang и Microsoft и не одобрен ими.</p>
      <p className="legal-links">
        <a href={`${EN ? '/en' : ''}/legal`}>Правовая информация</a> · <a href={`${EN ? '/en' : ''}/privacy`}>Конфиденциальность</a> · <a href={`${EN ? '/en' : ''}/terms`}>Условия</a>
        {needsConsent() && <> · <button type="button" className="linklike" onClick={reopenConsent}>Cookie</button></>}
      </p>
    </div>
  );
}

/**
 * Баннер cookie. Показывается, только если в .env включены Метрика или реклама: без них сайт ставит лишь
 * необходимые cookie (вход, вид интерфейса), на которые согласие не нужно.
 */
export function CookieBanner() {
  const consent = useConsent();
  const [open, setOpen] = useState(() => needsConsent() && getConsent() === null);
  useEffect(() => { if (getConsent() === true) loadYandex(); }, []);
  useEffect(() => onConsent(v => setOpen(v === null)), []);
  if (!needsConsent() || !open) return null;
  const choose = yes => { setConsent(yes); setOpen(false); };
  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Согласие на cookie">
      <div className="cookie-text">
        Сайт использует необходимые cookie для работы. С вашего согласия также подключаются{pub.metrika ? ' Яндекс Метрика (статистика посещений)' : ''}{pub.metrika && (pub.rtb?.bottom || pub.rtb?.landing) ? ' и' : ''}{pub.rtb?.bottom || pub.rtb?.landing ? ' реклама Рекламной сети Яндекса' : ''}: они ставят свои cookie и получают ваш IP-адрес.
        Нажимая «Принять», вы даёте <a href={`${EN ? '/en' : ''}/consent`}>согласие на обработку персональных данных</a>. Подробнее — в <a href={`${EN ? '/en' : ''}/privacy#cookie`}>политике</a>.
        {consent !== null && <span className="muted"> Сейчас: {consent ? 'принято' : 'только необходимые'}.</span>}
      </div>
      <div className="cookie-actions">
        <button type="button" className="btn" onClick={() => choose(true)}>Принять</button>
        <button type="button" className="btn ghost" onClick={() => choose(false)}>Только необходимые</button>
      </div>
    </div>
  );
}
