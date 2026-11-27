// План покупок с правками игрока: убрать шаг, добавить свою вещь (расчёт — на сервере, /api/roadmap/cart).
// - Владелец профиля, вошедший на сайт: список хранится на сервере и виден на всех его устройствах.
// - Гость: список лежит в этом браузере (свой на каждый открытый ник), сервер его только считает.
// - Вошедший смотрит чужой профиль: план покупок показывается как есть, без правок.
// Один общий список на все страницы: кнопка «+ В план покупок» в карточке предмета сразу видна в «Что делать».
import { useEffect, useState } from 'react';
import { api, me, useView, viewKey, profileKey, saveLocal, getView } from './api.js';

const LOCAL_KEY = 'sb-purchase-cart';
const EMPTY = { skip: {}, custom: {} };

const st = { vk: null, sig: null, data: null, loading: false, error: '' };
const listeners = new Set();
const emit = () => listeners.forEach(f => f({ ...st }));

const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(profileKey(LOCAL_KEY)) || 'null') || EMPTY; } catch { return EMPTY; }
};
const writeLocal = c => saveLocal(profileKey(LOCAL_KEY), JSON.stringify(c));

export const cartMode = state => (me.guest ? 'local' : state?.view?.owner ? 'server' : 'none');

async function load(mode) {
  const vk = viewKey(getView());
  st.vk = vk; st.loading = true; emit();
  try {
    const q = mode === 'local' ? `?local=${encodeURIComponent(JSON.stringify(readLocal()))}` : '';
    const d = await api(`/roadmap/cart${q}`);
    if (st.vk !== vk) return;
    // Сервер убрал купленное и давно пропавшие шаги — у гостя сохраняем это в браузере
    if (mode === 'local' && d.cart) writeLocal(d.cart);
    st.data = d; st.error = '';
  } catch (e) {
    if (st.vk === vk) st.error = e.message;
  } finally {
    if (st.vk === vk) { st.loading = false; emit(); }
  }
}

/** Изменить список: { skip: stepId, value } | { add: itemId, qty } | { remove: itemId } */
export async function changeCart(mode, op) {
  if (mode === 'none') return;
  if (mode === 'local') {
    const c = readLocal();
    const n = { skip: { ...c.skip }, custom: { ...c.custom } };
    if (op.skip != null) { if (op.value) n.skip[op.skip] = { at: Date.now() }; else delete n.skip[op.skip]; }
    else if (op.add != null) n.custom[op.add] = { qty: Math.max(1, Math.round(op.qty || n.custom[op.add]?.qty || 1)), at: n.custom[op.add]?.at || Date.now() };
    else if (op.remove != null) delete n.custom[op.remove];
    writeLocal(n);
    return load(mode);
  }
  try {
    const d = await api('/roadmap/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) });
    st.data = d; st.error = ''; emit();
  } catch (e) {
    st.error = /Ошибка \d|fetch/i.test(e.message) ? 'Не сохранилось: сервер не отвечает' : e.message;
    emit();
  }
}

/**
 * @returns {{ data: { rows, skipped, bought, total, liquid } | null, mode: 'server'|'local'|'none', change: (op)=>Promise, error: string, loading: boolean }}
 */
export function usePurchaseCart(state) {
  const mode = cartMode(state);
  const vk = viewKey(useView());
  const [s, setS] = useState(() => ({ ...st }));
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  // Перечитать, когда открыт другой профиль или пересчитан план (новые цены, купленные вещи)
  const sig = `${vk}|${mode}|${state?.updatedAt || ''}`;
  useEffect(() => { if (state?.analysis && st.sig !== sig) { st.sig = sig; load(mode); } }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = s.vk === vk;
  return { data: mine ? s.data : null, mode, change: op => changeCart(mode, op), error: mine ? s.error : '', loading: !mine || s.loading };
}
