import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aggregate, bucketOf, openCandle, volumeDelta, coflToCandles, hourlyToCandles, compact, bridgeFlat, cleanSpikes } from '@sky-guide/core/market/candles.js';
import { createChartStore, encode, decode, fileId } from '@sky-guide/core/market/chart-store.js';
import { backfillCandles } from '@sky-guide/core/market/backfill.js';
import { sma, ema, bollinger, rsi, macd, heikinAshi, snapTime, summary } from '../src/components/chart/indicators.js';

const T0 = 1_790_000_000; // секунды, вторник 2026-09-21

test('bucketOf: минуты, часы, неделя с понедельника, месяц с 1-го числа (UTC)', () => {
  assert.equal(bucketOf(T0 + 59, '1m') % 60, 0);
  assert.equal(bucketOf(T0, '4h') % (4 * 3600), 0);
  const w = bucketOf(T0, '1w');
  assert.equal(new Date(w * 1000).getUTCDay(), 1);
  assert.ok(w <= T0 && T0 - w < 7 * 86400);
  const m = new Date(bucketOf(T0, '1M') * 1000);
  assert.equal(m.getUTCDate(), 1);
  assert.equal(m.getUTCHours(), 0);
});

test('aggregate: открытие первой, закрытие последней, максимум/минимум и объёмы складываются', () => {
  const a = openCandle(T0 - (T0 % 3600), 10, 9, 1, 2);
  const b = openCandle(a[0] + 60, 12, 8, 3, 4);
  const c = openCandle(a[0] + 120, 11, 10, 0, 1);
  const [h] = aggregate([a, b, c], '1h');
  assert.deepEqual(h, [a[0], 10, 12, 10, 11, 9, 10, 8, 10, 4, 7]);
  // дубль той же минуты (перезапуск сервера) сливается, а не даёт две свечи
  assert.equal(aggregate([a, openCandle(a[0], 5, 4)], '1m').length, 1);
});

test('volumeDelta: рост недельного счётчика + выпавшая часть, не меньше нуля', () => {
  assert.equal(volumeDelta(1000, 1000, 60), 1000 * 60 / 604800);
  assert.ok(Math.abs(volumeDelta(1000, 1100, 60) - (100 + 1100 * 60 / 604800)) < 1e-9);
  assert.equal(volumeDelta(1000, 0, 60), 0);
  assert.equal(volumeDelta(undefined, 10, 60), 0);
});

test('coflToCandles: средние и min/max Coflnet → свечи; перепутанные buy/sell меняются местами', () => {
  const list = [
    { timestamp: '2026-09-21T10:05:00', buy: 100, sell: 90, maxBuy: 110, minBuy: 95, maxSell: 92, minSell: 85 },
    { timestamp: '2026-09-21T10:35:00', buy: 104, sell: 91 },
    { timestamp: '2026-09-21T11:05:00', buy: 0, sell: 91 }, // без цены — пропуск
  ];
  const c = coflToCandles(list, '1h');
  assert.equal(c.length, 1);
  assert.equal(c[0][0], Date.UTC(2026, 8, 21, 10) / 1000);
  assert.deepEqual(c[0].slice(1, 9), [100, 110, 95, 104, 90, 92, 85, 91]);
  const swapped = coflToCandles([{ timestamp: '2026-09-21T10:05:00Z', buy: 90, sell: 100 }], '1h');
  assert.equal(swapped[0][4], 100);
  assert.equal(swapped[0][8], 90);
  assert.deepEqual(coflToCandles({ error: 'x' }, '1h'), []);
});

test('hourlyToCandles: старая почасовая история → дневная свеча', () => {
  const h = Date.UTC(2026, 8, 21, 0);
  const d = hourlyToCandles([[h, 10, 9], [h + 3600_000, 14, 8], [h + 7200_000, 12, 11]], '1d');
  assert.deepEqual(d[0].slice(0, 9), [h / 1000, 10, 14, 10, 12, 9, 11, 8, 11]);
});

test('encode/decode: 44 байта на свечу, недописанный хвост отбрасывается; имя файла без двоеточий', () => {
  const list = [openCandle(T0, 1234.5, 1200, 3, 4), openCandle(T0 + 60, 2, 1)];
  const buf = encode(list);
  assert.equal(buf.length, 88);
  const back = decode(Buffer.concat([buf, Buffer.alloc(10)]));
  assert.equal(back.length, 2);
  assert.equal(back[0][0], T0);
  assert.ok(Math.abs(back[0][1] - 1234.5) < 0.01);
  assert.equal(fileId('INK_SACK:3'), 'INK_SACK~3a3');
  assert.equal(compact([T0, 1234.567, 12.345, 1.2345])[1], 1235);
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sb-charts-'));
const bz = (buy, sell, week = 604800) => new Map([['BOOSTER_COOKIE', { buy, sell, buyWeek: week, sellWeek: week }], ['INK_SACK:3', { buy: 3, sell: 0, buyWeek: 0, sellWeek: 0 }]]);

test('хранилище: тики → свечи на диске, чтение по периодам, срез старого, перезапуск', async () => {
  const dir = tmp();
  let clock = (T0 - (T0 % 3600)) * 1000;
  const s = createChartStore({ dir, now: () => clock });
  for (let i = 0; i < 130; i++) { s.tick(bz(100 + i, 90 + i, 604800 + i * 10), clock); clock += 20_000; } // ~43 минуты
  await s.flush();
  const m = await s.candles('BOOSTER_COOKIE', '1m');
  assert.ok(m.candles.length >= 43 && m.candles.length <= 45, `минут: ${m.candles.length}`);
  assert.equal(m.candles[0][1], 100); // открытие первой минуты
  assert.equal(m.candles.at(-1)[4], 229); // закрытие — последняя цена
  const h = await s.candles('BOOSTER_COOKIE', '1h');
  assert.equal(h.candles.length, 1);
  assert.equal(h.candles[0][2], 229);
  assert.equal(h.candles[0][3], 100);
  assert.ok(h.candles[0][9] > 0, 'объём посчитан');
  const f15 = await s.candles('BOOSTER_COOKIE', '15m');
  assert.equal(f15.candles.length, 3);
  // нет продаж с одной стороны — берётся цена другой стороны, файл с двоеточием в ID пишется
  const ink = await s.candles('INK_SACK:3', '1m');
  assert.equal(ink.candles[0][8], 3);
  assert.ok(fs.existsSync(path.join(dir, '1m', 'INK_SACK~3a3.bin')));
  // лимит и «есть ещё»
  const lim = await s.candles('BOOSTER_COOKIE', '1m', { limit: 10 });
  assert.equal(lim.candles.length, 10);
  assert.equal(lim.hasMore, true);
  // перезапуск: та же минута дописывается второй раз и склеивается
  s.closeSync();
  const s2 = createChartStore({ dir, now: () => clock });
  s2.tick(bz(500, 400), clock - 20_000);
  const m2 = await s2.candles('BOOSTER_COOKIE', '1m');
  assert.equal(new Set(m2.candles.map(c => c[0])).size, m2.candles.length, 'без дублей минут');
  assert.equal(m2.candles.at(-1)[2], 500);
  // срез: через 4 суток минутные свечи старше 3 суток удаляются
  clock += 4 * 86400_000;
  for (let i = 0; i < 5200; i++) s2.tick(bz(100, 90), clock - (5200 - i) * 60_000);
  await s2.flush();
  const cut = await s2.compact();
  assert.ok(cut > 0);
  const after = await s2.readBase('BOOSTER_COOKIE', '1m');
  assert.ok(after[0][0] >= clock / 1000 - 3 * 86400 - 60);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('хранилище: дозаполнение прошлым только до первой своей свечи', async () => {
  const dir = tmp();
  const now = T0 * 1000;
  const s = createChartStore({ dir, now: () => now });
  s.tick(bz(100, 90), now);
  await s.close();
  const first = await s.firstTime('BOOSTER_COOKIE', '1h');
  const older = [openCandle(first - 7200, 50, 40), openCandle(first - 3600, 60, 50), openCandle(first, 1, 1)];
  assert.equal(await s.insertOlder('BOOSTER_COOKIE', '1h', older), 2);
  const list = await s.readBase('BOOSTER_COOKIE', '1h');
  assert.deepEqual(list.map(c => c[1]), [50, 60, 100]);
  assert.equal(await s.insertOlder('BOOSTER_COOKIE', '1h', older), 0, 'повторно не добавляет');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('backfillCandles: Coflnet за месяц → часовые и дневные свечи, пропуск товаров с историей', async () => {
  const dir = tmp();
  const s = createChartStore({ dir });
  const prices = { bazaar: bz(100, 90) };
  const h = Math.floor(Date.now() / 3600_000) * 3600_000 - 48 * 3600_000;
  const calls = [];
  const fetchJson = async url => { calls.push(url); return [{ timestamp: new Date(h).toISOString(), buy: 10, sell: 9 }, { timestamp: new Date(h + 3600_000).toISOString(), buy: 11, sell: 9 }]; };
  const added = await backfillCandles(s, prices, { coflToCandles, fetchJson, pause: 0, log: () => {} });
  assert.equal(added, 2 * 2 + 2 * 1); // 2 товара × (2 часа + 1 день)
  assert.ok(calls[0].includes('/bazaar/BOOSTER_COOKIE/history/month'));
  fs.rmSync(dir, { recursive: true, force: true });
});

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

test('bridgeFlat: плоская свеча открывается по закрытию предыдущей, разрывы не склеиваются', () => {
  const a = openCandle(3600, 10, 9), b = openCandle(7200, 12, 8), c = openCandle(7200 + 3600 * 10, 11, 9);
  const out = bridgeFlat([a, b, c]);
  assert.deepEqual(out[1].slice(1, 9), [10, 12, 10, 12, 9, 9, 8, 8]);
  assert.deepEqual(out[2].slice(1, 9), [11, 11, 11, 11, 9, 9, 9, 9], 'после разрыва в 10 часов не тянем');
  assert.equal(a[1], 10, 'вход не меняется');
  const real = [3600, 10, 11, 9, 10.5, 9, 9, 9, 9, 0, 0];
  assert.deepEqual(bridgeFlat([a, real])[1].slice(1, 5), [10, 11, 9, 10.5], 'настоящая свеча не трогается');
});

test('cleanSpikes: одиночная иголка заменяется прошлой ценой, длинные тени обрезаются', () => {
  const list = Array.from({ length: 12 }, (_, i) => openCandle(i * 60, 100 + i, 90 + i));
  list[6] = openCandle(360, 1000, 96); // покупка за минуту в 10 раз дороже
  list[3] = [180, 103, 400, 103, 103, 93, 93, 10, 93, 0, 0]; // тень вверх и вниз
  const out = cleanSpikes(list);
  assert.equal(out[6][4], 105, 'иголка закрытия убрана');
  assert.equal(out[6][8], 96, 'продажа без выброса не тронута');
  assert.equal(out[3][2], 103 * 1.5);
  assert.equal(out[3][7], 93 / 1.5);
  assert.equal(list[6][4], 1000, 'вход не меняется');
});

test('хранилище: во время записи на диск закрытые свечи не пропадают из ответа', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-flush-'));
  let clock = T0 * 1000;
  const s = createChartStore({ dir, now: () => clock });
  const ids = Array.from({ length: 40 }, (_, i) => `ITEM_${i}`);
  for (let m = 0; m < 5; m++) {
    s.tick(new Map(ids.map(id => [id, { buy: 10 + m, sell: 9 + m, buyWeek: 0, sellWeek: 0 }])), clock);
    clock += 60_000;
  }
  const flushing = s.flush();
  // Читаем во время записи: последний товар пишется в последней пачке
  const mid = await Promise.all([s.candles('ITEM_39', '1m'), s.candles('ITEM_0', '1m')]);
  await flushing;
  for (const r of mid) assert.equal(r.candles.length, 5);
  assert.equal((await s.candles('ITEM_39', '1m')).candles.length, 5);
  fs.rmSync(dir, { recursive: true, force: true });
});
