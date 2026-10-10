import { timingSafeEqual } from 'node:crypto'
import { parseTelegramVerse, TELEGRAM_HELP } from './_lib/telegram-verse.js'
import { publishTelegramVerse } from './_lib/telegram-publish.js'

export function createTelegramHandler({ publish = publishTelegramVerse, env = () => process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method not allowed' })
    }
    const config = env()
    const secret = config.TELEGRAM_WEBHOOK_SECRET
    const admins = new Set((config.TELEGRAM_ADMIN_IDS || '').split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
    if (!secret || !admins.size) return res.status(503).json({ error: 'bot not configured' })
    const provided = req.headers['x-telegram-bot-api-secret-token']
    if (typeof provided !== 'string' || Buffer.byteLength(provided) !== Buffer.byteLength(secret)
      || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const update = req.body
    if (!update || !Number.isSafeInteger(update.update_id) || update.update_id < 0) {
      return res.status(400).json({ error: 'invalid update' })
    }
    const message = update.message || update.edited_message
    if (!message || message.chat?.type !== 'private' || !Number.isSafeInteger(message.from?.id)
      || message.from.is_bot || message.chat.id !== message.from.id) {
      return res.status(200).json({ ok: true })
    }
    const reply = (text) => res.status(200).json({
      method: 'sendMessage', chat_id: message.chat.id, text: text.slice(0, 4000),
    })
    if (!admins.has(String(message.from.id))) {
      return reply(`말씀 게시 권한이 없습니다. 관리자에게 사용자 ID ${message.from.id}를 알려 주세요.`)
    }
    if (/^\/(start|help)(?:@\w+)?(?:\s|$)/.test(message.text || '')) return reply(TELEGRAM_HELP)
    if (typeof message.text !== 'string') return reply('사진이나 파일 대신 말씀을 텍스트 메시지로 보내 주세요.')
    const eventTime = message.edit_date ?? message.date
    if (!Number.isSafeInteger(message.message_id) || message.message_id < 1
      || !Number.isSafeInteger(eventTime) || eventTime < 1) {
      return res.status(400).json({ error: 'invalid message' })
    }
    let verse
    try {
      verse = parseTelegramVerse(message.text)
    } catch (err) {
      return reply(`${err.message}\n\n${TELEGRAM_HELP}`)
    }
    try {
      const result = await publish(verse, update.update_id, { time: eventTime, messageId: message.message_id })
      if (result === 'duplicate') return res.status(200).json({ ok: true })
      if (result === 'stale') return reply('같은 날짜의 더 최신 메시지가 이미 반영되어 이 메시지는 건너뛰었습니다.')
      if (result !== 'saved') throw new Error('unexpected publish result')
      return reply(`${verse.id} 말씀을 게시했습니다.\n${verse.reference}\n${verse.reference_en}`)
    } catch {
      console.error('텔레그램 말씀 저장 실패')
      // 저장 실패는 Telegram이 재전송하게 한다. 중복 수신은 DB에서 처리한다.
      return res.status(500).json({ error: 'publication failed' })
    }
  }
}

export default createTelegramHandler()
