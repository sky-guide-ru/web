// Язык сайта: русский по адресу /…, английский по адресу /en/…
// Весь русский текст в исходниках сборка сама оборачивает в __t/__tt/__tj (i18n/vite.js): исходники остаются
// на русском, а английская версия берёт перевод из словаря i18n/en/*.json. Нет перевода — остаётся русский.
// Этот файл не должен содержать русских строк и импортов: он грузится раньше словаря.
import { createElement, Fragment } from 'react';
import { fill, pieces } from '@sky-guide/core/i18n/runtime.js';

export const LANG = /^\/en(\/|$)/.test(location.pathname) ? 'en' : 'ru';
export const EN = LANG === 'en';
/** Начало адреса сайта для текущего языка: '/' или '/en/' */
export const BASE = EN ? '/en/' : '/';
/** Локаль для чисел и дат */
export const LOCALE = EN ? 'en-US' : 'ru-RU';
/** Десятичный знак: 1,5 / 1.5 */
export const DEC = EN ? '.' : ',';

let D = null;
export function setDict(d) { D = d; }
const tr = k => (D && D[k]) || k;

export const __t = k => tr(k);
export const __tt = (k, vals) => fill(tr(k), vals);
/** Текст JSX с вставками-элементами: порядок вставок берётся из перевода */
export function __tj(k, vals) {
  const p = pieces(tr(k));
  if (!vals.length) return p.join('');
  return createElement(Fragment, null, ...p.map(x => (typeof x === 'number' ? vals[x] : x)));
}
/** Явный перевод там, где сборка не может догадаться (текст пришёл из переменной) */
export const t = k => tr(k);

/** Путь без языка: '/en/guides/x' → '/guides/x' */
export const stripLang = p => p.replace(/^\/en(?=\/|$)/, '') || '/';
/** Тот же адрес на другом языке (с #/раздел и ?player=) */
export function langUrl(lang, loc = location) {
  const p = stripLang(loc.pathname);
  return (lang === 'en' ? (p === '/' ? '/en/' : `/en${p}`) : p) + loc.search + loc.hash;
}
/** Адрес внутри сайта с учётом языка: href('/guides') → '/en/guides' */
export const href = p => (EN ? (p === '/' ? '/en/' : `/en${p}`) : p);

// Сервер узнаёт язык по заголовку X-Lang (fetch), а страницы входа и поток событий — по cookie
try { document.cookie = `sb-lang=${LANG}; path=/; max-age=31536000; samesite=lax`; } catch { /* */ }
document.documentElement.lang = LANG;

// Все запросы сайта к /api несут язык вкладки: две вкладки на разных языках не мешают друг другу
if (typeof window !== 'undefined' && window.fetch && !window.fetch.sbLang) {
  const orig = window.fetch.bind(window);
  const wrapped = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!/^\/api\//.test(url) && !url.startsWith(location.origin + '/api/')) return orig(input, init);
    const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined));
    if (!headers.has('X-Lang')) headers.set('X-Lang', LANG);
    return orig(input, { ...init, headers });
  };
  wrapped.sbLang = true;
  window.fetch = wrapped;
}

/** Текст, который не переводится (подпись на другом языке: «Русская версия» на английском сайте) */
export const noT = s => s;
