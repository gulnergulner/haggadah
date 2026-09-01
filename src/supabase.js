import { createClient } from '@supabase/supabase-js'

// TODO(설정): Supabase 프로젝트의 URL과 anon(public) 키로 교체.
// anon 키는 공개되어도 안전하다 (RLS 정책이 접근을 통제).
const SUPABASE_URL = 'https://wjyiovkeduosubtzflqe.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_2cmG_9682z5LmArpnw6zwQ_lntf0RJY'

export const isConfigured =
  !SUPABASE_URL.startsWith('REPLACE') && !SUPABASE_ANON_KEY.startsWith('REPLACE')

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
