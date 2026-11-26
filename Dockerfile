# Образ сайта Sky Guide: внутри только собранные файлы (dist), без Node и без кода сервера.
# При старте кладёт сборку в общий том /out (его читают api и Caddy — см. репо deploy) и отдаёт файлы на :8080.
# Полный node:22 (не slim): в нём есть git, он нужен npm, чтобы поставить @sky-guide/core с GitHub
FROM node:22 AS build
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /web/dist /srv/dist
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
