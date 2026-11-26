// Хеш слова для сторожа личных строк (test/no-private.test.js): node scripts/private-hash.mjs слово [слово…]
// Сам список слов в открытом репо не хранится — только хеши в test/private-hashes.json.
import { createHash } from 'node:crypto';
const words = process.argv.slice(2);
if (!words.length) { console.error('node scripts/private-hash.mjs слово [слово…]'); process.exit(1); }
for (const w of words) console.log(createHash('sha256').update(w.trim().toLowerCase()).digest('hex'));
