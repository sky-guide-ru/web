// Перезагрузка на новую сборку сайта (кнопка «Обновить», сбой загрузки куска) с сохранением места:
// страница и выбранный профиль (в адресе), открытая карточка предмета (history.state),
// прокрутка, текст в полях поиска и чата. Всё кладётся в sessionStorage этой вкладки на минуту.

const KEY = 'sb-keep-place';

function fieldKey(el, i) {
  return el.dataset.keep || el.id || el.name || el.getAttribute('placeholder') || `${el.tagName}#${i}`;
}

const boxKey = el => el.dataset.keepScroll || String(el.className || el.tagName);

function scrollers() {
  // основная прокрутка окна и прокручиваемые блоки (чат советчика, списки, карточка предмета — на телефоне она во весь экран)
  return [...document.querySelectorAll('[data-keep-scroll], .chat-log, .main, main, .modal')].filter(el => el.scrollHeight > el.clientHeight);
}

export function savePlace() {
  const fields = {};
  document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea').forEach((el, i) => {
    if (el.value) fields[fieldKey(el, i)] = el.value;
  });
  // блок узнаём по имени, а не по порядку: карточка предмета после перезагрузки появляется позже остальных
  const boxes = scrollers().map((el, i) => ({ i, key: boxKey(el), top: el.scrollTop })).filter(b => b.top > 0);
  const data = { at: Date.now(), url: location.pathname + location.search + location.hash, scroll: scrollY, boxes, fields, focus: document.activeElement && fieldKey(document.activeElement, -1) };
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* приватный режим */ }
}

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Вызвать один раз после первого рендера: вернёт прокрутку и поля, если вкладка только что перезагрузилась сама */
export function restorePlace() {
  let data;
  try { data = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch { return; }
  if (!data || Date.now() - data.at > 60_000) return;
  if (data.url !== location.pathname + location.search + location.hash) return;
  // Данные страницы приходят не сразу: несколько попыток, пока высота не позволит прокрутить
  let tries = 0;
  const apply = () => {
    tries++;
    if (tries <= 3) {
      document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea').forEach((el, i) => {
        const v = data.fields[fieldKey(el, i)];
        if (v != null && el.value !== v) setNativeValue(el, v);
      });
    }
    const boxes = scrollers();
    let pending = false;
    for (const b of data.boxes || []) {
      const el = boxes.find(x => boxKey(x) === b.key) || (b.key == null ? boxes[b.i] : null);
      if (el) el.scrollTop = b.top;
      if (!el || Math.abs(el.scrollTop - b.top) > 4) pending = true; // ещё не дорисовался
    }
    window.scrollTo(0, data.scroll);
    if ((Math.abs(scrollY - data.scroll) > 4 || pending) && tries < 20) setTimeout(apply, 250);
  };
  setTimeout(apply, 100);
}
