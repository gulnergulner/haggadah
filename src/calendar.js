import { createElement, ChevronLeft, ChevronRight, X } from 'lucide'
import { todayKey } from './storage.js'
import { GOAL } from './journey.js'

export function initCalendar({ getCounts, getSelectedDate, onSelect }) {
  const $ = (id) => document.getElementById(id)
  const dialog = $('verse-calendar')
  const trigger = $('btn-calendar')
  const days = $('calendar-days')
  const status = $('calendar-status')
  let month = new Date()
  let busy = false

  for (const [id, icon] of [['calendar-close', X], ['calendar-prev', ChevronLeft], ['calendar-next', ChevronRight]]) {
    $(id).append(createElement(icon, { width: 18, height: 18, 'aria-hidden': 'true' }))
  }

  function render() {
    const focusedDay = days.contains(document.activeElement) ? document.activeElement.dataset.date : null
    const year = month.getFullYear()
    const index = month.getMonth()
    const today = todayKey()
    const selected = getSelectedDate()
    const counts = getCounts()
    $('calendar-title').textContent = `${year}년 ${index + 1}월`
    const first = new Date(year, index, 1)
    const last = new Date(year, index + 1, 0).getDate()
    days.replaceChildren()
    for (let n = 0; n < first.getDay(); n++) {
      const blank = document.createElement('span')
      blank.setAttribute('aria-hidden', 'true')
      days.append(blank)
    }
    let achieved = 0
    for (let n = 1; n <= last; n++) {
      const key = todayKey(new Date(year, index, n))
      const count = counts[key] || 0
      const done = count >= GOAL
      if (done) achieved++
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'calendar-day'
      button.textContent = n
      button.dataset.date = key
      button.classList.toggle('is-achieved', done)
      button.classList.toggle('is-selected', key === selected)
      button.setAttribute('aria-pressed', String(key === selected))
      if (key === today) button.setAttribute('aria-current', 'date')
      button.setAttribute('aria-label', `${year}년 ${index + 1}월 ${n}일${key === today ? ', 오늘' : ''}, ${count}회${done ? ', 100회 달성' : ''}`)
      button.disabled = busy || key > today
      days.append(button)
    }
    $('calendar-achieved').textContent = `이번 달 ${achieved}일`
    $('calendar-next').disabled = busy || (year === new Date().getFullYear() && index === new Date().getMonth())
    $('calendar-prev').disabled = busy
    $('calendar-today').disabled = busy
    days.setAttribute('aria-busy', String(busy))
    if (focusedDay) days.querySelector(`[data-date="${focusedDay}"]:not(:disabled)`)?.focus()
  }

  function restoreTrigger() {
    trigger.setAttribute('aria-expanded', 'false')
    trigger.focus()
  }
  function close() {
    dialog.close()
    restoreTrigger()
  }
  trigger.addEventListener('click', () => {
    const [year, index] = getSelectedDate().split('-').map(Number)
    month = new Date(year, index - 1, 1)
    status.textContent = ''
    render()
    dialog.showModal()
    trigger.setAttribute('aria-expanded', 'true')
    const focusTarget = days.querySelector('.is-selected:not(:disabled)') || $('calendar-close')
    focusTarget.focus()
  })
  dialog.addEventListener('close', () => { if (!dialog.open) restoreTrigger() })
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    close()
  })
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')]
    const first = buttons[0]
    const last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  $('calendar-close').addEventListener('click', close)
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
  })
  $('calendar-prev').addEventListener('click', () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1)
    status.textContent = ''
    render()
  })
  $('calendar-next').addEventListener('click', () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    status.textContent = ''
    render()
  })
  $('calendar-today').addEventListener('click', () => {
    month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    status.textContent = ''
    render()
    days.querySelector('[aria-current="date"]')?.focus()
  })
  days.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-date]')
    if (!button || busy) return
    const key = button.dataset.date
    busy = true
    status.textContent = '그 주의 말씀을 불러오는 중이에요…'
    render()
    try {
      if (await onSelect(key)) close()
    } catch (error) {
      status.textContent = error.message
    } finally {
      busy = false
      render()
      if (dialog.open) days.querySelector(`[data-date="${key}"]`)?.focus()
    }
  })
  return { refresh() { if (dialog.open) render() } }
}
