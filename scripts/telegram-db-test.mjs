// 별도 임시 PostgreSQL에서만 실행한다. 운영 DB에는 연결하지 않는다.
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import postgres from 'postgres'
import { parseTelegramVerse } from '../api/_lib/telegram-verse.js'

let bin = process.env.PG_BIN
if (!bin) {
  try { bin = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim() } catch { /* 로컬 PostgreSQL 선택 사항 */ }
}
const available = !!bin && fs.existsSync(path.join(bin, 'initdb'))
let directory
let sql
let running = false
before(async () => {
  if (!available) return
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'haggadah-telegram-pg-'))
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  execFileSync(path.join(bin, 'initdb'), ['-D', directory, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' })
  execFileSync(path.join(bin, 'pg_ctl'), ['-D', directory, '-l', path.join(directory, 'server.log'), '-o', `-p ${port} -h 127.0.0.1 -k ${directory}`, '-w', 'start'], { stdio: 'pipe' })
  running = true
  sql = postgres({ host: '127.0.0.1', port, username: 'postgres', database: 'postgres', ssl: false, max: 4 })
  const schema = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
    .match(/create table if not exists public\.haggadot[\s\S]*?;\n/)[0]
  await sql.unsafe('create role anon; create role authenticated; create role service_role;\n' + schema)
  await sql.unsafe(fs.readFileSync(new URL('../supabase/telegram-bot.sql', import.meta.url), 'utf8'))
  // 재실행 가능성도 확인한다.
  await sql.unsafe(fs.readFileSync(new URL('../supabase/telegram-bot.sql', import.meta.url), 'utf8'))
})
after(async () => {
  if (sql) await sql.end()
  if (running) execFileSync(path.join(bin, 'pg_ctl'), ['-D', directory, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' })
  if (directory) fs.rmSync(directory, { recursive: true, force: true })
})
const row = (date, body = '말씀 전체') => parseTelegramVerse(`${date}\n[신15:4] ${body}\n[Dt 15:4, NIV] Full verse`)
const publish = async (id, verse, time = 1000, message = id) => {
  const [result] = await sql`select public.publish_telegram_verse(${id}, ${sql.json(verse)}, ${time}, ${message}) as status`
  return result.status
}

for (const [name, run] of [
  ['date-keyed publish/update matches administrator timestamps and keeps one row', async () => {
    assert.equal(await publish(1, row('2026-10-04')), 'saved')
    let [stored] = await sql`select *, updated_at::text as revision from haggadot where id = '2026-10-04'`
    assert.equal(stored.reference, '신명기 15:4')
    assert.equal(stored.published_at.toISOString(), '2026-10-03T15:00:00.000Z')
    assert.equal(await publish(2, row('2026-10-04', '수정한 말씀'), 1001), 'saved')
    const rows = await sql`select * from haggadot where id = '2026-10-04'`
    assert.equal(rows.length, 1)
    assert.equal(rows[0].body_ko, '수정한 말씀')
    assert.equal(rows[0].published_at.toISOString(), stored.published_at.toISOString())
  }],
  ['duplicate and out-of-order deliveries do not overwrite newer content', async () => {
    const verse = row('2026-10-11', '최신 말씀')
    await publish(10, verse, 2000)
    const [before] = await sql`select updated_at::text as revision from haggadot where id = '2026-10-11'`
    assert.equal(await publish(10, row(verse.id, '중복으로 덮어쓰면 안 됨'), 2000), 'duplicate')
    assert.equal(await publish(11, row(verse.id, '늦게 도착한 이전 말씀'), 1999), 'stale')
    const [stored] = await sql`select body_ko, updated_at::text as revision from haggadot where id = '2026-10-11'`
    assert.equal(stored.body_ko, '최신 말씀')
    assert.equal(stored.revision, before.revision)
    // Telegram update_id가 긴 미사용 기간 후 초기화돼도 메시지 시각이 새로우면 허용한다.
    assert.equal(await publish(3, row(verse.id, '다음 주 수정'), 3000), 'saved')
  }],
  ['failed writes roll back delivery marker and can be retried', async () => {
    const invalid = row('2026-10-18')
    delete invalid.body_ko
    await assert.rejects(publish(20, invalid))
    const markers = await sql`select * from telegram_verse_updates where update_id = 20`
    assert.equal(markers.length, 0)
    assert.equal(await publish(20, row('2026-10-18')), 'saved')
  }],
  ['parallel same-date deliveries leave the newest message', async () => {
    await Promise.all([
      publish(30, row('2026-10-25', '이전 메시지'), 4000),
      publish(31, row('2026-10-25', '최신 메시지'), 4001),
    ])
    const [stored] = await sql`select body_ko from haggadot where id = '2026-10-25'`
    assert.equal(stored.body_ko, '최신 메시지')
    // 서로 다른 관리자의 개인 대화는 message_id가 각각 증가하므로 비교에 쓰지 않는다.
    assert.equal(await publish(32, row('2026-10-25', '다른 관리자의 최신 메시지'), 4001, 1), 'saved')
  }],
  ['anonymous/authenticated users cannot invoke publishing or read delivery ledger', async () => {
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`)
        await tx`select public.publish_telegram_verse(99, ${tx.json(row('2026-11-01'))}, 5000, 99)`
      }), /permission denied/)
      await assert.rejects(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`)
        await tx`select * from telegram_verse_updates`
      }), /permission denied/)
    }
    await sql.begin(async (tx) => {
      await tx.unsafe('set local role service_role')
      const [result] = await tx`select public.publish_telegram_verse(100, ${tx.json(row('2026-11-01'))}, 5000, 100) as status`
      assert.equal(result.status, 'saved')
    })
  }],
]) test(name, { skip: available ? false : '로컬 PostgreSQL이 필요합니다 (PG_BIN 설정)' }, run)
