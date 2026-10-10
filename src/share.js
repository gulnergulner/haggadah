function formatReference(reference) {
  // 장:절 표기를 풀어 쓰되, 절 범위·여러 구절·이미 풀어 쓴 출처는 보존한다.
  return reference.trim().replace(/(\d+)\s*:\s*(\d+(?:\s*[-–~]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–~]\s*\d+)?)?)/g, '$1장 $2절')
}

export function initShare({ button, counter, getVerse, showToast }) {
  let sharing = false
  const ko = () => counter.getPref('lang') === 'ko'

  button.addEventListener('click', async () => {
    if (sharing) return
    // 버튼을 누른 시점의 카운터와 보고 있는 말씀 전체를 공유한다.
    const verse = getVerse()
    const body = verse?.bodyKo?.trim()
    const reference = verse?.reference?.trim()
    if (!body || !reference) {
      showToast(ko()
        ? '말씀을 불러온 뒤 공유해 주세요.'
        : 'Please wait for the verse before sharing.')
      return
    }
    const text = `${counter.get()}번 읊조렸습니다.\n\n${body} [${formatReference(reference)}]`.trimEnd()
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
