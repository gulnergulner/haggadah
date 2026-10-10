import { createClient } from '@supabase/supabase-js'

let client
export async function publishTelegramVerse(verse, updateId, event) {
  if (!client) {
    const key = process.env.HAGGADAH_SUPABASE_SERVICE_ROLE_KEY
    if (!key) throw new Error('말씀 저장용 서버 키가 설정되지 않았습니다.')
    client = createClient(
      process.env.HAGGADAH_SUPABASE_URL || 'https://wjyiovkeduosubtzflqe.supabase.co', key,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }) },
      },
    )
  }
  const { data, error } = await client.rpc('publish_telegram_verse', {
    p_update_id: updateId, p_verse: verse,
    p_event_time: event.time, p_message_id: event.messageId,
  })
  if (error) throw error
  return data
}
