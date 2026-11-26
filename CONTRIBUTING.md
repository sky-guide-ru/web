# Как помочь Sky Guide

Sky Guide — русскоязычный сайт-помощник по Hypixel SkyBlock ([sky-guide.ru](https://sky-guide.ru)). Код разделён на четыре репо:

| Репо | Что там |
|---|---|
| [core](https://github.com/sky-guide-ru/core) | расчёты без HTTP: разбор профиля, план «Что делать», рынок, гайды, русская база предметов, переводы. Пакет `@sky-guide/core` |
| [api](https://github.com/sky-guide-ru/api) | сервер: адреса `/api/*`, вход и аккаунты, SEO-страницы, OpenAPI и Swagger |
| [web](https://github.com/sky-guide-ru/web) | сайт [sky-guide.ru](https://sky-guide.ru) на React + Vite, данные берёт только у api |
| [deploy](https://github.com/sky-guide-ru/deploy) | запуск на сервере: Docker, Caddy, автообновление, бэкапы, браузерный e2e |

## Рабочая папка

Нужен [Node.js 22+](https://nodejs.org). Склонируй репо рядом друг с другом и свяжи их одной общей папкой:

```
mkdir sky-guide && cd sky-guide
git clone https://github.com/sky-guide-ru/core && git clone https://github.com/sky-guide-ru/api && git clone https://github.com/sky-guide-ru/web && git clone https://github.com/sky-guide-ru/deploy
echo '{"private":true,"workspaces":["core","api","web","deploy"]}' > package.json
npm install
```

Так `api` и `web` берут `core` из соседней папки, и правка в расчётах сразу видна на сайте.

## Запуск у себя

```
cd api
cp ../deploy/.env.example .env          # впиши HYPIXEL_API_KEY с https://developer.hypixel.net
node ../core/scripts/make-fixture.js    # или без ключа: тестовый профиль и цены в data/
npm run dev                             # сервер на http://localhost:3000
cd ../web && npm run dev                # сайт на http://localhost:5173, /api идёт на :3000
```

## Проверки

- `npm test` — в каждом репо свои тесты. Сверки с исходниками сайта (ссылки в новостях, подписи CSS) идут, когда `web` лежит рядом,
  иначе пропускаются.
- `npm run e2e` в `deploy` — прогон сайта в браузере на компьютере и телефоне (перед ним `npm run build` в `web`).

## Pull request

1. Ветка от `main` в нужном репо, одна тема на PR.
2. Правила текстов, игровых терминов и новостей — в `CLAUDE.md` (одинаковый во всех репо).
3. `npm test` зелёный; если меняется вид — скриншот в описании.
4. Сливает владелец после проверки. В `main` напрямую не пушим.

Правка сразу в расчётах и на экране: сначала PR в `core` (после слияния владелец ставит тег версии), потом PR в `api`/`web` с новой версией.

## Чего в коде быть не должно

- Ключей, паролей, `.env`, папки `data/` — только на сервере.
- Ников игроков, почты, IP и других личных данных. Списки друзей и скрытых игроков задаются в `.env` (`SEED_FRIENDS`, `HIDDEN_PLAYERS`).
- Ключа Hypixel в браузере, моде или боте: по [правилам Hypixel](https://developer.hypixel.net/policies) запросы к Hypixel делает только сервер,
  а данные игроков через наш API получают только наши клиенты по ключу.

Коммить от адреса `…@users.noreply.github.com` (GitHub → Settings → Emails → «Keep my email addresses private»).

## Лицензия

[AGPL-3.0](LICENSE). Присылая PR, ты соглашаешься, что твой код распространяется на тех же условиях.
