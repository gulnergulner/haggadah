import { createElement, Volume2, Square } from 'lucide'

// 음성 합성은 기기에 맡기며, 화면에 표시된 영문 말씀이 바뀌면 재생을 멈춘다.
export function initVerseSpeech({ container, button, speedSelect, savedSpeed, onSpeedChange, onError }) {
  const supported = !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'
  let content = ''
  let active = false
  let request = 0
  speedSelect.value = [...speedSelect.options].some((option) => Number(option.value) === savedSpeed)
    ? String(savedSpeed) : '1'

  function render() {
    const label = !supported ? 'Audio unavailable' : !content ? 'English unavailable'
      : active ? 'Stop' : 'Listen'
    button.replaceChildren(
      createElement(active ? Square : Volume2, {
        width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false',
      }),
      document.createTextNode(label),
    )
    button.setAttribute('aria-pressed', String(active))
    button.setAttribute('aria-label', !supported ? 'Speech is not supported on this device'
      : !content ? 'No English verse is available' : active ? 'Stop reading the verse' : 'Listen to the verse')
    button.disabled = !supported || !content
    speedSelect.disabled = !supported || !content
    button.title = !supported ? 'Speech is not supported on this device.'
      : !content ? 'No English verse is available.' : ''
  }

  function stop() {
    if (!active) return
    active = false
    request++
    window.speechSynthesis.cancel()
    render()
  }

  function play() {
    if (!supported || !content) return
    const id = ++request
    try {
      const utterance = new SpeechSynthesisUtterance(content)
      utterance.lang = 'en-US'
      utterance.rate = Number(speedSelect.value)
      const voices = window.speechSynthesis.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang))
      const english = voices.find((voice) => voice.localService && /^en-us$/i.test(voice.lang))
        || voices.find((voice) => voice.localService)
        || voices.find((voice) => /^en-us$/i.test(voice.lang)) || voices[0]
      if (english) utterance.voice = english
      utterance.onend = () => {
        if (id !== request) return
        active = false
        render()
      }
      utterance.onerror = (event) => {
        if (id !== request) return
        active = false
        render()
        if (event.error !== 'canceled' && event.error !== 'interrupted') onError()
      }
      active = true
      render()
      window.speechSynthesis.speak(utterance)
    } catch {
      active = false
      render()
      onError()
    }
  }

  button.addEventListener('click', () => { if (active) stop(); else play() })
  speedSelect.addEventListener('change', () => {
    onSpeedChange(Number(speedSelect.value))
    if (active) {
      stop()
      play()
    }
  })

  window.addEventListener('pagehide', stop)
  render()
  return {
    stop,
    update({ visible, body, reference }) {
      const next = visible && body?.trim()
        ? [reference?.trim(), body.trim()].filter(Boolean).join('. ') : ''
      if (next !== content) stop()
      content = next
      container.hidden = !visible
      render()
    },
  }
}
