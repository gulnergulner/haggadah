import { createElement, Volume2, Pause, Play } from 'lucide'

// 음성 합성은 기기에 맡기며, 화면에 표시된 영문 말씀이 바뀌면 재생을 멈춘다.
export function initVerseSpeech({ container, button, referenceElement, bodyElement, speedSelect, savedSpeed, onSpeedChange, onError }) {
  const synth = window.speechSynthesis
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function'
    && typeof synth.pause === 'function' && typeof synth.resume === 'function'
  let content = ''
  let state = 'idle'
  let request = 0
  let spokenReference = ''
  let spokenBody = ''
  let highlightedElement = null
  speedSelect.value = [...speedSelect.options].some((option) => Number(option.value) === savedSpeed)
    ? String(savedSpeed) : '1'

  function render() {
    const label = !supported ? 'Audio unavailable' : !content ? 'English unavailable'
      : state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen'
    button.replaceChildren(
      createElement(state === 'playing' ? Pause : state === 'paused' ? Play : Volume2, {
        width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false',
      }),
      document.createTextNode(label),
    )
    button.setAttribute('aria-label', !supported ? 'Speech is not supported on this device'
      : !content ? 'No English verse is available' : state === 'playing' ? 'Pause reading the verse'
        : state === 'paused' ? 'Resume reading the verse' : 'Listen to the verse')
    button.disabled = !supported || !content
    speedSelect.disabled = !supported || !content
    button.title = !supported ? 'Speech is not supported on this device.'
      : !content ? 'No English verse is available.' : ''
  }

  function clearHighlight() {
    if (!highlightedElement) return
    highlightedElement.textContent = highlightedElement.textContent
    highlightedElement = null
  }

  function highlightBoundary(event) {
    if (state !== 'playing' || (event.name && event.name !== 'word') || !Number.isInteger(event.charIndex)) return
    const bodyStart = spokenReference ? spokenReference.length + 2 : 0
    const isReference = !!spokenReference && event.charIndex < spokenReference.length
    const offset = isReference ? event.charIndex : event.charIndex - bodyStart
    const phrase = isReference ? spokenReference : spokenBody
    const element = isReference ? referenceElement : bodyElement
    if (offset < 0 || offset >= phrase.length) return
    const fullText = element.textContent
    const phraseStart = fullText.indexOf(phrase)
    if (phraseStart < 0) return
    const start = phraseStart + offset
    const length = event.charLength > 0 ? event.charLength : (phrase.slice(offset).match(/^\S+/u)?.[0].length || 0)
    if (!length) return
    const end = Math.min(phraseStart + phrase.length, start + length)
    clearHighlight()
    const mark = document.createElement('span')
    mark.className = 'verse-spoken-word'
    mark.textContent = fullText.slice(start, end)
    element.replaceChildren(document.createTextNode(fullText.slice(0, start)), mark, document.createTextNode(fullText.slice(end)))
    highlightedElement = element
  }

  function stop() {
    if (state === 'idle') return
    const wasPaused = state === 'paused'
    state = 'idle'
    request++
    synth.cancel()
    // 취소해도 합성 엔진의 일시정지 상태는 유지될 수 있다.
    if (wasPaused) synth.resume()
    clearHighlight()
    render()
  }

  function play() {
    if (!supported || !content) return
    const id = ++request
    try {
      const utterance = new SpeechSynthesisUtterance(content)
      utterance.lang = 'en-US'
      utterance.rate = Number(speedSelect.value)
      const voices = synth.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang))
      const english = voices.find((voice) => voice.localService && /^en-us$/i.test(voice.lang))
        || voices.find((voice) => voice.localService)
        || voices.find((voice) => /^en-us$/i.test(voice.lang)) || voices[0]
      if (english) utterance.voice = english
      utterance.onboundary = (event) => {
        if (id === request) highlightBoundary(event)
      }
      utterance.onend = () => {
        if (id !== request) return
        state = 'idle'
        clearHighlight()
        render()
      }
      utterance.onerror = (event) => {
        if (id !== request) return
        state = 'idle'
        clearHighlight()
        render()
        if (event.error !== 'canceled' && event.error !== 'interrupted') onError()
      }
      state = 'playing'
      render()
      synth.speak(utterance)
    } catch {
      state = 'idle'
      clearHighlight()
      render()
      onError()
    }
  }

  button.addEventListener('click', () => {
    if (state === 'idle') return play()
    try {
      if (state === 'playing') {
        synth.pause()
        state = 'paused'
      } else {
        synth.resume()
        state = 'playing'
      }
      render()
    } catch {
      stop()
      onError()
    }
  })
  speedSelect.addEventListener('change', () => {
    onSpeedChange(Number(speedSelect.value))
    if (state !== 'idle') {
      stop()
      play()
    }
  })

  window.addEventListener('pagehide', stop)
  render()
  return {
    stop,
    update({ visible, body, reference }) {
      const nextBody = visible ? body?.trim() || '' : ''
      const nextReference = nextBody ? reference?.trim() || '' : ''
      const next = nextBody ? [nextReference, nextBody].filter(Boolean).join('. ') : ''
      if (next !== content) stop()
      content = next
      spokenBody = nextBody
      spokenReference = nextReference
      container.hidden = !visible
      render()
    },
  }
}
