// Клавиатура: всё, что открывается кликом (иконки, строки, карточки питомцев…), доступно через Tab
// и открывается Enter/Пробелом. Делается централизованно, чтобы не забывать в каждом компоненте.
const CLICKABLE = [
  '.item-icon.clickable', '.search-item', '.pet', '.acc', '.item-line', '.item-with-price', '.worn-pet',
  '.drop', '.node', 'th.sortable', 'td.clickable', 'tr.clickable-row',
].join(',');

function mark(root) {
  for (const el of root.querySelectorAll(CLICKABLE)) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role') && el.tagName !== 'TR' && el.tagName !== 'TH') el.setAttribute('role', 'button');
  }
}

export function installKeyboardClicks() {
  mark(document);
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; mark(document); });
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(CLICKABLE)) return;
    e.preventDefault();
    el.click();
  });
}
