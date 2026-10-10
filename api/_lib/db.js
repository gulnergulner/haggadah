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

/** 누적 읊조림 상위 50명과 로그인 사용자의 순위. 원본 ID/개인 기록은 반환하지 않는다. */
export async function getLeaderboard(uid = null) {
  const sql = getSql()
  const rows = await sql`
    WITH records AS (
      SELECT id, COALESCE(NULLIF(nickname, ''), '이름 없는 성도') AS nickname,
        CASE WHEN jsonb_typeof(haggadah->'total') = 'number'
          AND (haggadah->>'total') ~ '^[0-9]{1,16}$'
          THEN (haggadah->>'total')::numeric ELSE 0 END AS total
      FROM "HarupingUser"
    ), ranked AS (
      SELECT nickname, total, id,
        RANK() OVER (ORDER BY total DESC) AS rank,
        ROW_NUMBER() OVER (ORDER BY total DESC, nickname, id) AS position,
        COUNT(*) OVER () AS participants
      FROM records WHERE total > 0
    )
    SELECT nickname, total, rank, position, participants,
      COALESCE(id = ${uid}, false) AS "isMe"
    FROM ranked WHERE position <= 50 OR id = ${uid}
    ORDER BY position
  `
  const entry = (row) => ({
    rank: Number(row.rank), nickname: row.nickname,
    total: Number(row.total), isMe: row.isMe,
  })
  return {
    entries: rows.filter((row) => Number(row.position) <= 50).map(entry),
    myEntry: rows.find((row) => row.isMe) ? entry(rows.find((row) => row.isMe)) : null,
    participants: Number(rows[0]?.participants ?? 0),
  }
}
