// npm run telegram:setup — 이 스크립트를 직접 실행할 때만 웹훅을 등록한다.
import { loadEnv } from 'vite'

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const token = env.TELEGRAM_BOT_TOKEN
const secret = env.TELEGRAM_WEBHOOK_SECRET
const url = env.TELEGRAM_WEBHOOK_URL || 'https://haggadah.godagent.net/api/telegram-webhook'
if (!token || !/^[A-Za-z0-9_-]{16,256}$/.test(secret || '') || !env.TELEGRAM_ADMIN_IDS) {
  console.error('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET(16~256자), TELEGRAM_ADMIN_IDS 설정이 필요합니다.')
  process.exit(1)
}
if (new URL(url).protocol !== 'https:') {
  console.error('웹훅 URL은 HTTPS여야 합니다.')
  process.exit(1)
}
try {
  const identityResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) })
  const identity = await identityResponse.json()
  if (!identity.ok || identity.result.username !== 'haggadah_admin_bot') throw new Error('봇 확인 실패')
  // 메시지가 없는 점검 요청으로 배포 상태를 확인한다. 말씀 저장이나 답장은 하지 않는다.
  const healthResponse = await fetch(url, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret,
    },
    body: JSON.stringify({ update_id: 0 }), signal: AbortSignal.timeout(10000),
  })
  const health = await healthResponse.json()
  if (!healthResponse.ok || health.ok !== true) throw new Error('배포 확인 실패')
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message', 'edited_message'], max_connections: 1 }),
    signal: AbortSignal.timeout(15000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error('등록 실패')
  console.log(`텔레그램 웹훅 등록 완료: ${url}`)
} catch {
  console.error('웹훅 등록 실패. 봇 토큰과 배포된 URL을 확인해 주세요.')
  process.exitCode = 1
}
