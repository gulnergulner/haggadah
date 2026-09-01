// dailyword(manna) Supabase PostgreSQL 공유 접속 — 하루핑과 같은 DB/롤 사용.
// 테이블 public."HarupingUser": id(카카오 id) PK, nickname, state(하루핑), haggadah(하가다)
// - transaction pooler(6543, pgbouncer) → prepare: false 필수
import postgres from 'postgres'

let sqlClient = null

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 설정되지 않았습니다.')
  if (!sqlClient) {
    sqlClient = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
      ssl: 'require',
    })
  }
  return sqlClient
}

/** 신규 유저만 닉네임을 심는다 — 기존 유저의 (직접 바꾼) 닉네임은 보존 */
export async function upsertUser(id, nickname) {
  const sql = getSql()
  await sql`
    INSERT INTO "HarupingUser" (id, nickname)
    VALUES (${id}, ${nickname})
    ON CONFLICT (id) DO UPDATE
    SET nickname = COALESCE("HarupingUser".nickname, EXCLUDED.nickname),
        "updatedAt" = now()
  `
}

export async function updateNickname(id, nickname) {
  const sql = getSql()
  await sql`
    UPDATE "HarupingUser"
    SET nickname = ${nickname}, "updatedAt" = now()
    WHERE id = ${id}
  `
}

export async function getUser(id) {
  const sql = getSql()
  const rows = await sql`
    SELECT nickname, state, haggadah FROM "HarupingUser" WHERE id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export async function saveHaggadah(id, data) {
  const sql = getSql()
  await sql`
    UPDATE "HarupingUser"
    SET haggadah = ${sql.json(data)}, "updatedAt" = now()
    WHERE id = ${id}
  `
}
