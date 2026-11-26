// Почему не открылся профиль игрока — простыми словами и с понятным виновником.
// Главное: человек должен видеть, что сломался не сайт, а Hypixel/Mojang или настройки самого игрока,
// и что с этим сделать. Чистая функция без React (её проверяют тесты сервера).

/**
 * @param {{ error?: string, errorCode?: string, player?: string, self?: boolean, admin?: boolean, guest?: boolean }} o
 * @returns {{ kind: string, title: string, who: string, text: string, fix: string[], retry: boolean }}
 */
export function explainProfileError({ error = '', errorCode = null, player = 'игрок', self = false, admin = false, guest = false } = {}) {
  const t = String(error || '');
  const P = player || 'игрок';
  if (errorCode === 'BAD_NAME') {
    return { kind: 'bad_name', who: 'опечатка в нике', title: 'Так ник не пишется', text: t || 'Ники Minecraft пишутся латиницей, цифрами и _, до 16 символов.',
      fix: ['Проверь ник: только латиница, цифры и _. Если набирал в русской раскладке, переключи раскладку.'], retry: false };
  }
  if (errorCode === 'NO_KEY' || /invalid api key|\b403\b|ключ API не подходит/i.test(t)) {
    return { kind: 'key', who: 'ключ Hypixel у сайта', title: 'Ключ Hypixel API истёк или не подходит',
      text: 'Hypixel перестал принимать ключ, через который сайт берёт данные. Сам сайт работает, но новые профили сейчас не загрузить.',
      fix: admin ? ['Создай новый ключ на developer.hypixel.net и впиши его в .env (HYPIXEL_API_KEY), потом перезапусти сайт.'] : ['Напиши владельцу сайта: ему нужно обновить ключ Hypixel API.'], retry: false };
  }
  if ((errorCode === 'RATE' || /429/.test(t)) && /суточн/i.test(t)) {
    return { kind: 'rate', who: 'ограничение Hypixel', title: 'Запросы к Hypixel на сегодня закончились',
      text: 'Hypixel ограничивает, сколько профилей сайт может спросить за сутки. Сайт исправен: уже открытые профили видны по последним данным, новые загрузятся после сброса лимита.',
      fix: ['Загляни через несколько часов: сайт сам продолжит обновлять профили.'], retry: false };
  }
  if (errorCode === 'RATE' || /429|rate.?limit|частоту запросов/i.test(t)) {
    return { kind: 'rate', who: 'ограничение Hypixel', title: 'Hypixel просит подождать',
      text: 'Hypixel ограничивает, как часто можно спрашивать профили. Сайт исправен, просто сейчас запросов слишком много.',
      fix: ['Подожди минуту: сайт сам попробует снова.'], retry: true };
  }
  if (errorCode === 'NETWORK' || /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket|network|timeout|\b5\d\d\b/i.test(t)) {
    return { kind: 'network', who: 'серверы Hypixel / Mojang', title: 'Hypixel сейчас не отвечает',
      text: `Сайт работает, но серверы Hypixel или Mojang не ответили на запрос про ${P}. Такое бывает при сбоях и обновлениях у Hypixel и обычно проходит за несколько минут.`,
      fix: ['Подожди пару минут и нажми «Попробовать ещё раз». Сайт и сам повторит попытку.'], retry: true };
  }
  if (errorCode === 'NOT_FOUND') {
    return { kind: 'not_found', who: 'ник игрока', title: `Игрока ${P} нет в Minecraft`,
      text: 'Mojang не знает такого ника. Скорее всего, в нике опечатка, или игрок недавно сменил ник.',
      fix: self ? ['Похоже, аккаунт на сайте заведён с опечаткой в нике. Напиши владельцу сайта: он поправит ник на странице аккаунтов.']
        : ['Проверь написание ника (регистр не важен).', 'Если игрок сменил ник, введи новый.'], retry: false };
  }
  if (errorCode === 'NO_PROFILE') {
    return { kind: 'no_profile', who: 'профиль игрока в Hypixel', title: `У ${P} нет профиля SkyBlock`,
      text: 'Hypixel не отдаёт ни одного профиля SkyBlock этого игрока: он ещё не заходил в SkyBlock или профиль только что создан.',
      fix: [self ? 'Зайди в SkyBlock хотя бы раз, подожди 1–2 минуты и нажми «Попробовать ещё раз».' : 'Игроку нужно хотя бы раз зайти в SkyBlock. Новый профиль появляется в Hypixel через 1–2 минуты.'],
      retry: true };
  }
  return { kind: 'other', who: 'Hypixel', title: `Hypixel не отдал профиль ${P}`, text: t || 'Неизвестная ошибка при запросе к Hypixel.',
    fix: ['Нажми «Попробовать ещё раз» через минуту.'], retry: true };
}
