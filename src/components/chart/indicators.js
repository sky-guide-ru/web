// Индикаторы для биржевого графика «Рынка». Чистые функции без React и без библиотеки графиков,
// поэтому их проверяют серверные тесты (server/test/market-charts.test.js).
// Вход — массив баров { time, open, high, low, close }, выход — точки { time, value } (без первых, где ещё не хватает данных).

/** Простая скользящая средняя (СС) по закрытию. */
export function sma(bars, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out.push({ time: bars[i].time, value: sum / period });
  }
  return out;
}

/** Экспоненциальная скользящая средняя (ЭСС) по массиву чисел; первые period-1 значений — null. */
export function emaValues(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  let prev = null, sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i];
      if (i === period - 1) { prev = sum / period; out[i] = prev; }
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function ema(bars, period) {
  const v = emaValues(bars.map(b => b.close), period);
  return bars.map((b, i) => ({ time: b.time, value: v[i] })).filter(p => p.value != null);
}

/** Полосы Боллинджера: средняя ± mult стандартных отклонений. */
export function bollinger(bars, period = 20, mult = 2) {
  const mid = [], up = [], low = [];
  for (let i = period - 1; i < bars.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += bars[j].close;
    const m = s / period;
    let d = 0;
    for (let j = i - period + 1; j <= i; j++) d += (bars[j].close - m) ** 2;
    const sd = Math.sqrt(d / period);
    const time = bars[i].time;
    mid.push({ time, value: m }); up.push({ time, value: m + mult * sd }); low.push({ time, value: m - mult * sd });
  }
  return { mid, up, low };
}

/** Индекс относительной силы (RSI) по Уайлдеру, 0…100. */
export function rsi(bars, period = 14) {
  const out = [];
  if (bars.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = bars[i].close - bars[i - 1].close;
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  const val = () => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));
  out.push({ time: bars[period].time, value: val() });
  for (let i = period + 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out.push({ time: bars[i].time, value: val() });
  }
  return out;
}

/** Схождение-расхождение скользящих средних (MACD): линия, сигнальная линия и гистограмма. */
export function macd(bars, fast = 12, slow = 26, signal = 9) {
  const closes = bars.map(b => b.close);
  const f = emaValues(closes, fast), s = emaValues(closes, slow);
  const line = [];
  for (let i = 0; i < bars.length; i++) if (f[i] != null && s[i] != null) line.push({ time: bars[i].time, value: f[i] - s[i] });
  const sig = emaValues(line.map(p => p.value), signal);
  const signalLine = [], hist = [];
  line.forEach((p, i) => {
    if (sig[i] == null) return;
    signalLine.push({ time: p.time, value: sig[i] });
    hist.push({ time: p.time, value: p.value - sig[i] });
  });
  return { line, signal: signalLine, hist };
}

/** Свечи Хейкен-Аши (сглаженные): тренд виден лучше, шум меньше. */
export function heikinAshi(bars) {
  const out = [];
  let po = null, pc = null;
  for (const b of bars) {
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = po == null ? (b.open + b.close) / 2 : (po + pc) / 2;
    out.push({ time: b.time, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) });
    po = open; pc = close;
  }
  return out;
}

/** Ближайшее время бара, не позже t (для рисунков: линия, нарисованная на часах, на днях встаёт на свой день). */
export function snapTime(times, t) {
  if (!times.length) return null;
  if (t <= times[0]) return times[0];
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return times[lo];
}

/** Сводка по видимым барам: изменение, максимум, минимум, объём. */
export function summary(bars, vols = []) {
  if (!bars.length) return null;
  const first = bars[0], last = bars[bars.length - 1];
  let hi = -Infinity, lo = Infinity, vol = 0;
  for (const b of bars) { if (b.high > hi) hi = b.high; if (b.low < lo) lo = b.low; }
  for (const v of vols) vol += v.value || 0;
  return { open: first.open, close: last.close, change: last.close - first.open, pct: first.open ? (last.close / first.open - 1) * 100 : 0, high: hi, low: lo, volume: vol };
}
