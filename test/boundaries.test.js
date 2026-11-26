// Границы сайта (контракт между репо): данные — только у api на том же домене, из core — только словари перевода
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|css|html)$/.test(e.name)) files.push(p);
  }
})(path.join(root, 'src'));
files.push(path.join(root, 'index.html'));
const read = f => fs.readFileSync(f, 'utf8');
const rel = f => path.relative(root, f);

test('из @sky-guide/core сайт берёт только словари перевода (i18n)', () => {
  for (const f of files) {
    for (const m of read(f).matchAll(/from\s+['"](@sky-guide\/(?:core|api)[^'"]*)['"]|import\(\s*['"](@sky-guide\/[^'"]*)['"]/g)) {
      const spec = m[1] || m[2];
      assert.match(spec, /^@sky-guide\/core\/i18n\//, `${rel(f)}: ${spec}`);
    }
  }
});

test('браузер не ходит за данными и картинками на чужие сайты — только в свой /api', () => {
  // Сторонние сервисы видят IP посетителя; ключ Hypixel и запросы к нему — только на сервере (правила Hypixel)
  const banned = /mc-heads\.net|crafatar|minotar|api\.hypixel\.net|sky\.coflnet|textures\.minecraft\.net|sessionserver\.mojang|api\.mojang|moulberry|skyblock\.wiki|fandom\.com\/api/i;
  // fetch / EventSource / src= / url() на абсолютный адрес. Исключение — счётчик и реклама Яндекса (src/ads.js, включаются из .env)
  const absolute = /(?:fetch|EventSource|sendBeacon)\(\s*[`'"]https?:|\bsrc=\{?\s*[`'"]https?:|url\(\s*['"]?https?:/;
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, banned, rel(f));
    if (rel(f) !== path.join('src', 'ads.js')) assert.doesNotMatch(text, absolute, rel(f));
  }
});
