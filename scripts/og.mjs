// Картинки превью ссылки (og:image, 1200×630): public/og.png — русская, public/og-en.png — английская.
// Запуск: node scripts/og.mjs (нужен Playwright с Chromium). Знак — public/favicon.svg, шрифты — из node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = require('playwright')); }

const font = (pkg, file) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', pkg, 'files', file)).toString('base64')}`;
const faces = ['latin', 'cyrillic'].map(s => `
  @font-face { font-family: Rubik; font-weight: 300 900; src: url(${font('@fontsource-variable/rubik', `rubik-${s}-wght-normal.woff2`)}) format('woff2'); }
  @font-face { font-family: Inter; font-weight: 100 900; src: url(${font('@fontsource-variable/inter', `inter-${s}-wght-normal.woff2`)}) format('woff2'); }`).join('');
const logo = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

const CARDS = {
  'og.png': { lang: 'ru', kicker: 'Hypixel SkyBlock', sub: 'гид по SkyBlock на русском', lines: ['План прогрессии · гайды · вики предметов', 'цены Bazaar и аукциона · заработок'], url: 'sky-guide.ru' },
  'og-en.png': { lang: 'en', kicker: 'Hypixel SkyBlock', sub: 'your SkyBlock guide', lines: ['Progression plan · guides · item wiki', 'Bazaar and Auction House prices · money making'], url: 'sky-guide.ru/en' },
};

const html = c => `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8"><style>${faces}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; display: flex; align-items: center; gap: 64px; padding: 0 80px;
    background: radial-gradient(900px 600px at 20% 10%, #3a2b6e 0%, rgba(58,43,110,0) 60%), linear-gradient(135deg, #1b1830 0%, #12121a 70%);
    color: #fff; font-family: Inter, sans-serif; }
  .logo svg { width: 220px; height: 220px; display: block; filter: drop-shadow(0 18px 40px rgba(0,0,0,.45)); }
  .kicker { font: 500 30px/1 Inter; letter-spacing: .12em; text-transform: uppercase; color: #b9a6ff; }
  h1 { font: 700 112px/1 Rubik; letter-spacing: -.01em; margin-top: 22px; }
  .sub { font: 500 44px/1.15 Rubik; margin-top: 12px; background: linear-gradient(90deg, #ffb347, #ff5fd2); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .lines { font: 400 29px/1.45 Inter; color: #d9d6ea; margin-top: 30px; }
  .url { font: 500 28px/1 Inter; color: #8fd0ff; margin-top: 30px; }
</style></head><body>
  <div class="logo">${logo}</div>
  <div>
    <div class="kicker">${c.kicker}</div>
    <h1>Sky Guide</h1>
    <div class="sub">${c.sub}</div>
    <div class="lines">${c.lines.join('<br>')}</div>
    <div class="url">${c.url}</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [file, c] of Object.entries(CARDS)) {
  await page.setContent(html(c));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'public', file) });
  console.log('public/' + file);
}
await browser.close();
