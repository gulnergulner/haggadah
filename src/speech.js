import { createElement, Volume2, Square, Pause, Play } from 'lucide'

// 음성 합성은 기기에 맡기며, 화면에 표시된 영문 말씀이 바뀌면 재생을 멈춘다.
export function initVerseSpeech({ container, button, stopButton, speedSelect, savedSpeed, onSpeedChange, onError }) {
  const synth = window.speechSynthesis
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function'
    && typeof synth.pause === 'function' && typeof synth.resume === 'function'
  let content = ''
  let state = 'idle'
  let request = 0
  stopButton.append(createElement(Square, {
    width: 15, height: 15, 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false',
  }))
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
    stopButton.hidden = state === 'idle'
    button.title = !supported ? 'Speech is not supported on this device.'
      : !content ? 'No English verse is available.' : ''
  }

  function stop() {
    if (state === 'idle') return
    const wasPaused = state === 'paused'
    state = 'idle'
    request++
    synth.cancel()
    // 취소해도 합성 엔진의 일시정지 상태는 유지될 수 있다.
    if (wasPaused) synth.resume()
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
      utterance.onend = () => {
        if (id !== request) return
        state = 'idle'
        render()
      }
      utterance.onerror = (event) => {
        if (id !== request) return
        state = 'idle'
        render()
        if (event.error !== 'canceled' && event.error !== 'interrupted') onError()
      }
      state = 'playing'
      render()
      synth.speak(utterance)
    } catch {
      state = 'idle'
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
  stopButton.addEventListener('click', () => {
    stop()
    button.focus()
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
      const next = visible && body?.trim()
        ? [reference?.trim(), body.trim()].filter(Boolean).join('. ') : ''
      if (next !== content) stop()
      content = next
      container.hidden = !visible
      render()
    },
  }
}
