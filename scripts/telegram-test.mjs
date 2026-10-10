import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTelegramVerse } from '../api/_lib/telegram-verse.js'
import { createTelegramHandler } from '../api/telegram-webhook.js'

const INPUT = `2026-10-04

[신15:4] 네가 만일 네 하나님 여호와의 말씀만 듣고 내가 오늘 네게 내리는 그 명령을 다 지켜 행하면 네 하나님 여호와께서 네게 기업으로 주신 땅에서 네가 반드시 복을 받으리니 너희 중에 가난한 자가 없으리라

[Dt 15:4, NIV] However, there need be no poor people among you, for in the land the LORD your God is giving you to possess as your inheritance, he will richly bless you,`

function response() {
  return { code: 200, headers: {}, body: null,
    status(code) { this.code = code; return this },
    setHeader(key, value) { this.headers[key] = value },
    json(body) { this.body = body; return this },
  }
}
function request(text = INPUT) {
  return { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
    body: { update_id: 100, message: { message_id: 1, date: 1791072000,
      from: { id: 62340378, is_bot: false }, chat: { id: 62340378, type: 'private' }, text } } }
}
function fixture(publish = async () => 'saved') {
  return createTelegramHandler({ publish, env: () => ({
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret', TELEGRAM_ADMIN_IDS: '62340378, 12345',
  }) })
}

test('provided message becomes the same date-keyed row as the administrator form', () => {
  const verse = parseTelegramVerse(INPUT)
  assert.equal(verse.id, '2026-10-04')
  assert.equal(verse.reference, '신명기 15:4')
  assert.equal(verse.reference_en, 'Deuteronomy 15:4')
  assert.equal(verse.published_at, '2026-10-03T15:00:00.000Z')
  assert.ok(verse.body_ko.startsWith('네가 만일'))
  assert.ok(verse.body_ko.endsWith('없으리라'))
  assert.ok(verse.body_en.endsWith('richly bless you,'))
  assert.equal(parseTelegramVerse(INPUT.replaceAll('\n', '\r\n')).body_en, verse.body_en)
})

test('multi-verse input preserves full bodies and matches Korean/English references', () => {
  const row = parseTelegramVerse(`2026-10-04
[신15:4] 첫째 줄
이어지는 줄
[신15:5] 둘째 구절
[Dt 15:4, NIV] First verse
continued line
[Dt 15:5, NIV] Second verse`)
  assert.equal(row.reference, '신명기 15:4; 신명기 15:5')
  assert.equal(row.body_ko, '첫째 줄\n이어지는 줄\n둘째 구절')
  assert.equal(row.body_en, 'First verse\ncontinued line\nSecond verse')
  assert.equal(parseTelegramVerse(INPUT.replaceAll('15:4', '15:4-5')).reference, '신명기 15:4-5')
})

for (const [name, input] of [
  ['invalid calendar date', INPUT.replace('2026-10-04', '2026-02-30')],
  ['missing English', INPUT.slice(0, INPUT.indexOf('[Dt'))],
  ['mismatched verse', INPUT.replace('[Dt 15:4, NIV]', '[Dt 15:5, NIV]')],
  ['mismatched book', INPUT.replace('[Dt 15:4, NIV]', '[Jn 15:4, NIV]')],
  ['unknown book', INPUT.replace('[신15:4]', '[없는책15:4]')],
  ['empty body', INPUT.replace(/\[신15:4\][\s\S]*?\[Dt/, '[신15:4]\n\n[Dt')],
  ['reversed range', INPUT.replaceAll('15:4', '15:5-4')],
]) {
  test(name + ' does not publish', async () => {
    assert.throws(() => parseTelegramVerse(input))
    let calls = 0
    const res = response()
    await fixture(async () => { calls++; return 'saved' })(request(input), res)
    assert.equal(calls, 0)
    assert.equal(res.code, 200)
    assert.equal(res.body.method, 'sendMessage')
  })
}

test('admin publication replies only after saving; edited messages use edit timestamp', async () => {
  const calls = []
  const handler = fixture(async (...args) => { calls.push(args); return 'saved' })
  const req = request()
  const res = response()
  await handler(req, res)
  assert.equal(calls[0][0].id, '2026-10-04')
  assert.equal(calls[0][1], 100)
  assert.deepEqual(calls[0][2], { time: 1791072000, messageId: 1 })
  assert.equal(res.body.chat_id, 62340378)
  assert.match(res.body.text, /2026-10-04 말씀을 게시했습니다/)
  req.body.edited_message = { ...req.body.message, edit_date: 1791073000 }
  delete req.body.message
  await handler(req, response())
  assert.equal(calls[1][2].time, 1791073000)
})

test('wrong secret, missing configuration, non-admin, groups and bots never write', async () => {
  let calls = 0
  const handler = fixture(async () => { calls++; return 'saved' })
  const missingConfig = response()
  await createTelegramHandler({ env: () => ({}) })(request(), missingConfig)
  assert.equal(missingConfig.code, 503)
  const badSecret = request()
  badSecret.headers['x-telegram-bot-api-secret-token'] = 'wrong'
  const denied = response()
  await handler(badSecret, denied)
  assert.equal(denied.code, 403)
  const stranger = request()
  stranger.body.message.from.id = stranger.body.message.chat.id = 555
  const noAdmin = response()
  await handler(stranger, noAdmin)
  assert.match(noAdmin.body.text, /권한이 없습니다/)
  for (const modify of [
    (r) => { r.body.message.chat.type = 'group' },
    (r) => { r.body.message.from.is_bot = true },
    (r) => { r.body.message.chat.id = 12345 },
  ]) {
    const req = request(); modify(req)
    await handler(req, response())
  }
  assert.equal(calls, 0)
})

test('duplicate deliveries are acknowledged silently and older updates are explained', async () => {
  const duplicate = response()
  await fixture(async () => 'duplicate')(request(), duplicate)
  assert.deepEqual(duplicate.body, { ok: true })
  const stale = response()
  await fixture(async () => 'stale')(request(), stale)
  assert.match(stale.body.text, /더 최신 메시지/)
})

test('storage failure returns a retryable error without claiming success', async () => {
  const res = response()
  await fixture(async () => { throw new Error('database detail') })(request(), res)
  assert.equal(res.code, 500)
  assert.deepEqual(res.body, { error: 'publication failed' })
})

test('help, photos and unsupported updates do not publish', async () => {
  let calls = 0
  const handler = fixture(async () => { calls++; return 'saved' })
  for (const text of ['/start', '/help@haggadah_admin_bot']) {
    const res = response()
    await handler(request(text), res)
    assert.match(res.body.text, /2026-10-04/)
  }
  const photo = request()
  delete photo.body.message.text
  await handler(photo, response())
  await handler({ ...request(), body: { update_id: 10 } }, response())
  assert.equal(calls, 0)
})
