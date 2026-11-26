import { Ico } from './Icons.jsx';
import { EN } from '../i18n.js';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getView, me } from '../api.js';

// «Сообщить об ошибке / идея»: кнопка в подвале каждой страницы и окно с формой.
// К отзыву само прикрепляется: страница, ник из поля (если введён), версия сборки, размер экрана, браузер.
// Скриншот — по желанию: выбрать файл или вставить из буфера (Ctrl+V). Перед отправкой сжимаем до ~1600 px в JPEG.

// На телефоне клавиатуры с Ctrl нет — подсказку про вставку не показываем
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const TYPES = [
  ['bug', 'Ошибка', 'Что-то сломалось или работает не так'],
  ['translate', 'Перевод', 'Неправильный или непонятный русский текст'],
  ['data', 'Данные', 'Неверные цифры, цены, рецепты, советы'],
  ['idea', 'Идея', 'Чего не хватает на сайте'],
];

// Картинку уменьшаем на клиенте: на сервер и в письмо уходит лёгкий JPEG
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const d = c.toDataURL('image/jpeg', q);
      if (d.length < 1_900_000) return d;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

export function FeedbackModal({ onClose }) {
  const [type, setType] = useState('bug');
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [shot, setShot] = useState(null);
  const [hp, setHp] = useState('');
  const [state, setState] = useState({ busy: false, error: null, done: false });
  const opened = useRef(Date.now());
  const box = useRef(null);
  const view = getView();
  const page = location.pathname + location.hash;

  useEffect(() => {
    box.current?.querySelector('textarea')?.focus();
    const k = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  const takeFile = async f => {
    if (!f || !/^image\//.test(f.type)) return;
    const d = await shrink(f).catch(() => null);
    if (d) setShot(d); else setState(s => ({ ...s, error: 'Не вышло прочитать картинку' }));
  };
  const onPaste = e => {
    const f = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))?.getAsFile();
    if (f) { e.preventDefault(); takeFile(f); }
  };

  const submit = async e => {
    e.preventDefault();
    if (text.trim().length < 5) { setState({ busy: false, error: 'Опиши подробнее — хотя бы пару слов', done: false }); return; }
    setState({ busy: true, error: null, done: false });
    const build = await fetch('/api/version').then(r => r.json()).then(v => v.build).catch(() => '');
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, text, contact, website: hp, openedAt: opened.current, page, build,
          player: view?.player || '', profile: view?.profile || '',
          screen: `${innerWidth}×${innerHeight}`, ua: navigator.userAgent, screenshot: shot,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
      setState({ busy: false, error: null, done: true });
    } catch (err) {
      setState({ busy: false, error: err.message || 'Не отправилось. Попробуй ещё раз', done: false });
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal card fb-modal" role="dialog" aria-modal="true" aria-label="Сообщить об ошибке" onClick={e => e.stopPropagation()} ref={box}>
        <button className="x-btn modal-x" onClick={onClose} aria-label="Закрыть">×</button>
        {state.done ? (
          <div className="fb-done">
            <h3>Спасибо! Отзыв отправлен ✓</h3>
            <p className="muted">Владелец сайта его увидит и поправит. {contact ? 'Если понадобится уточнение — напишет по указанному контакту.' : ''}</p>
            <button className="btn" onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <form onSubmit={submit} onPaste={onPaste}>
            <h3>Сообщить об ошибке или предложить идею</h3>
            <div className="chips fb-types" role="radiogroup" aria-label="Что случилось">
              {TYPES.map(([id, label, hint]) => (
                <button type="button" key={id} role="radio" aria-checked={type === id} className={`chip ${type === id ? 'active' : ''}`} title={hint} onClick={() => setType(id)}>{label}</button>
              ))}
            </div>
            <p className="muted small fb-hint">{TYPES.find(t => t[0] === type)[2]}</p>
            <textarea className="input fb-text" rows={6} maxLength={4000} value={text} onChange={e => setText(e.target.value)}
              placeholder={type === 'idea' ? 'Что добавить или сделать удобнее?' : 'Что не так и где? Например: «в карточке Hyperion цена 0 монет»'} />
            <input className="input fb-contact" maxLength={120} value={contact} onChange={e => setContact(e.target.value)} placeholder="Как с тобой связаться (необязательно): Discord, Telegram, почта" />
            {/* Ловушка для ботов: человек это поле не видит */}
            <input className="fb-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e => setHp(e.target.value)} name="website" />
            <div className="fb-shot">
              {shot ? (
                <div className="fb-shot-prev"><img src={shot} alt="Скриншот" /><button type="button" className="link small linklike" onClick={() => setShot(null)}>убрать скриншот</button></div>
              ) : (
                <label className="link small fb-shot-pick">📎 Прикрепить скриншот<input type="file" accept="image/*" onChange={e => takeFile(e.target.files?.[0])} hidden /></label>
              )}
              {!shot && !TOUCH && <span className="muted tiny"> или вставь его сюда (Ctrl+V)</span>}
            </div>
            <p className="muted tiny fb-auto">Вместе с текстом уйдут: эта страница, {view?.player ? <>ник <b>{view.player}</b>, </> : null}версия сайта и размер экрана. {me.guest ? '' : 'И ник, под которым ты вошёл. '}Подробнее — в <a href={`${EN ? '/en' : ''}/privacy`} target="_blank" rel="noopener">политике конфиденциальности</a>.</p>
            {state.error && <p className="fb-err" role="alert">{state.error}</p>}
            <div className="row-gap">
              <button className="btn" type="submit" disabled={state.busy}>{state.busy ? 'Отправляю…' : 'Отправить'}</button>
              <button className="btn ghost" type="button" onClick={onClose}>Отмена</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function FeedbackButton({ className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn ghost small fb-btn ${className}`} onClick={() => setOpen(true)} title="Нашёл ошибку, кривой перевод или есть идея — напиши"><Ico name="mail" size={15} />Сообщить об ошибке</button>
      {/* Окно — прямо в body: кнопка живёт в сайдбаре, и его слой иначе прятал окно под страницей */}
      {open && createPortal(<FeedbackModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
