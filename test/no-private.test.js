// Сторож личных строк: ники владельца и друзей, почта не должны попасть в открытый репо.
// Список слов хранится только хешами (test/private-hashes.json), добавить слово — node scripts/private-hash.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { hashes } = JSON.parse(fs.readFileSync(path.join(root, 'test/private-hashes.json'), 'utf8'));
const BAD = new Set(hashes);
const sha = w => createHash('sha256').update(w).digest('hex');

function files() {
  try {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean);
  } catch { // архив без .git
    const out = [];
    (function walk(d) {
      for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        const p = d ? `${d}/${e.name}` : e.name;
        if (e.isDirectory()) { if (!['.git', 'node_modules'].includes(e.name)) walk(p); } else out.push(p);
      }
    })('');
    return out;
  }
}

test('в репо нет личных строк (ники, почта)', () => {
  const hits = [];
  const seen = new Map(); // слово → хеш, чтобы не считать одно и то же много раз
  for (const f of files()) {
    if (/\.(png|jpe?g|gif|webp|ico|zip|woff2?|ttf|otf)$/i.test(f) || f === 'test/private-hashes.json') continue;
    let text;
    try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    const words = new Set();
    for (const m of text.toLowerCase().matchAll(/[a-z0-9_]{3,32}(?:@[a-z0-9.-]+)?/g)) {
      const w = m[0];
      words.add(w);
      const at = w.indexOf('@');
      if (at > 0) words.add(w.slice(0, at));
      if (w.includes('_')) for (const part of w.split('_')) if (part.length >= 3) words.add(part);
    }
    for (const w of words) {
      let h = seen.get(w);
      if (h === undefined) { h = sha(w); seen.set(w, h); }
      if (BAD.has(h)) hits.push(f);
    }
  }
  assert.deepEqual([...new Set(hits)], [], 'в этих файлах есть слово из списка личных — замени на нейтральный пример');
});
