// Сообщение «профиль не открылся» должно ясно говорить, кто виноват (Hypixel, ник, профиль игрока), а не сайт
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainProfileError as ex } from '../src/profileError.js';

test('профиль не открылся: виновник и что делать', () => {
  // сеть/сбой Hypixel — даже если раньше это приходило как NOT_FOUND с «fetch failed»
  for (const o of [{ errorCode: 'NETWORK' }, { error: 'Не удалось найти игрока X: fetch failed' }, { error: 'Hypixel 502' }]) {
    const x = ex({ ...o, player: 'X' });
    assert.equal(x.kind, 'network', JSON.stringify(o)); assert.match(x.who, /Hypixel/); assert.equal(x.retry, true);
  }
  assert.equal(ex({ errorCode: 'RATE' }).kind, 'rate');
  const nf = ex({ errorCode: 'NOT_FOUND', player: 'Frend4ik' });
  assert.equal(nf.kind, 'not_found'); assert.match(nf.title, /Frend4ik/); assert.equal(nf.retry, false);
  assert.match(ex({ errorCode: 'NOT_FOUND', self: true }).fix[0], /владельцу/);
  const np = ex({ errorCode: 'NO_PROFILE', player: 'Noob' });
  assert.equal(np.kind, 'no_profile'); assert.match(np.fix[0], /SkyBlock/);
  // ключ сайта: владельцу — как починить, остальным — к кому идти
  assert.match(ex({ error: 'Invalid API key', admin: true }).fix[0], /\.env/);
  assert.match(ex({ error: 'Invalid API key' }).fix[0], /владельцу/);
  assert.equal(ex({ errorCode: 'BAD_NAME', error: 'Такого ника не бывает' }).kind, 'bad_name');
  // всегда есть заголовок и хотя бы один совет
  for (const c of ['NETWORK', 'RATE', 'NOT_FOUND', 'NO_PROFILE', 'BAD_NAME', 'NO_KEY', null]) { const x = ex({ errorCode: c, error: 'что-то' }); assert.ok(x.title && x.fix.length && x.who, c); }
});
