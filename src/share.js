export function initShare({ button, counter, showToast }) {
  let sharing = false
  const ko = () => counter.getPref('lang') === 'ko'

  button.addEventListener('click', async () => {
    if (sharing) return
    // 오늘의 현재 카운터만 공유한다. URL이나 페이지 제목은 전달하지 않는다.
    const text = `${counter.get()}번 읊조렸습니다.`
    sharing = true
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    try {
      const data = { text }
      if (typeof navigator.share === 'function'
        && (!navigator.canShare || navigator.canShare(data))) {
        try {
          // 클릭 이벤트 안에서 바로 호출해 사용자 조작 권한을 유지한다.
          await navigator.share(data)
          return
        } catch (err) {
          // 공유창을 취소한 경우에는 메시지를 복사하지 않는다.
          if (err.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(text)
      showToast(ko()
        ? '메시지를 복사했습니다. 카카오톡에 붙여 넣어 주세요.'
        : 'Message copied. Paste it into KakaoTalk.', 4000)
    } catch {
      showToast(ko()
        ? '메시지를 공유하지 못했습니다. 다시 시도해 주세요.'
        : 'Could not share the message. Please try again.')
    } finally {
      sharing = false
      button.disabled = false
      button.removeAttribute('aria-busy')
    }
  })
}
