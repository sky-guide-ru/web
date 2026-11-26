#!/bin/sh
# Кладёт сборку сайта в общий том /out, если он подключён, потом запускает CMD (раздачу файлов на :8080).
# Порядок важен для открытых вкладок и для api: сначала новые assets/, потом остальные файлы, index.html — последним
# и одной заменой (mv), чтобы api никогда не прочитал index.html со ссылками на ещё не скопированные файлы.
# Старые файлы assets/ живут ещё 2 дня: открытые вкладки старой версии догружают из них куски страниц.
# Любая ошибка копирования — выход с ненулевым кодом (контейнер падает, автообновление откатывает).
set -eu
SRC=/srv/dist
OUT=/out
if [ -d "$OUT" ]; then
  mkdir -p "$OUT/assets"
  cp -R "$SRC/assets/." "$OUT/assets/"
  # остальное, кроме assets/ и index.html
  for f in "$SRC"/* "$SRC"/.[!.]*; do
    [ -e "$f" ] || continue
    case "$(basename "$f")" in
      assets|index.html) ;;
      *) cp -R "$f" "$OUT/" ;;
    esac
  done
  cp "$SRC/index.html" "$OUT/.index.html.new"
  mv -f "$OUT/.index.html.new" "$OUT/index.html"
  # старые куски: нет в новой сборке и старше 2 дней
  find "$OUT/assets" -type f -mtime +2 | while read -r old; do
    [ -e "$SRC/assets/${old#"$OUT/assets/"}" ] || rm -f "$old"
  done
  echo "[web] сборка скопирована в $OUT"
fi
exec "$@"
