// Индикаторы графиков цен (src/components/chart/indicators.js). Сами свечи и их хранилище проверяет core
import test from 'node:test';
import assert from 'node:assert/strict';
import { sma, ema, bollinger, rsi, macd, heikinAshi, snapTime, summary } from '../src/components/chart/indicators.js';

const T0 = 1_790_000_000; // секунды, вторник 2026-09-21

const bars = Array.from({ length: 60 }, (_, i) => {
  const c = 100 + Math.sin(i / 4) * 10 + i * 0.2;
  return { time: T0 + i * 60, open: c - 1, high: c + 2, low: c - 2, close: c };
});

test('индикаторы: СС, ЭСС, Боллинджер, RSI, MACD, Хейкен-Аши', () => {
  const s5 = sma(bars, 5);
  assert.equal(s5.length, 56);
  assert.ok(Math.abs(s5[0].value - bars.slice(0, 5).reduce((a, b) => a + b.close, 0) / 5) < 1e-9);
  const e5 = ema(bars, 5);
  assert.equal(e5.length, 56);
  assert.ok(Math.abs(e5[0].value - s5[0].value) < 1e-9, 'ЭСС начинается с простой средней');
  const bb = bollinger(bars, 20, 2);
  assert.equal(bb.mid.length, 41);
  assert.ok(bb.up.every((p, i) => p.value >= bb.mid[i].value && bb.low[i].value <= bb.mid[i].value));
  const r = rsi(bars, 14);
  assert.equal(r.length, 46);
  assert.ok(r.every(p => p.value >= 0 && p.value <= 100));
  const up = rsi(bars.map((b, i) => ({ ...b, close: i })), 14);
  assert.equal(up.at(-1).value, 100);
  const m = macd(bars);
  assert.equal(m.signal.length, m.hist.length);
  assert.ok(m.hist.length > 0 && m.line.length > m.signal.length);
  const ha = heikinAshi(bars);
  assert.ok(ha.every(b => b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close)));
});

test('snapTime и summary', () => {
  const times = [10, 20, 30];
  assert.equal(snapTime(times, 5), 10);
  assert.equal(snapTime(times, 25), 20);
  assert.equal(snapTime(times, 99), 30);
  assert.equal(snapTime([], 5), null);
  const s = summary(bars.slice(0, 3), [{ value: 2 }, { value: 3 }]);
  assert.equal(s.volume, 5);
  assert.ok(s.high >= s.low);
});

