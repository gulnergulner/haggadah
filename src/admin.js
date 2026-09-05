import './styles/base.css'
import './styles/admin.css'
import { supabase, isConfigured } from './supabase.js'
import { todayKey } from './storage.js'

const $ = (id) => document.getElementById(id)
const views = { login: $('login-view'), editor: $('editor-view') }
const fields = {
  date: $('f-date'),
  reference: $('f-reference'),
  bodyKo: $('f-body-ko'),
  referenceEn: $('f-reference-en'),
  bodyEn: $('f-body-en'),
}

if (!isConfigured) {
  $('config-warning').hidden = false
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null
    views.login.hidden = !!user
    views.editor.hidden = !user
    $('btn-logout').hidden = !user
    if (user) refreshList()
  })
}

// ---------- 로그인 ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const errEl = $('login-error')
  errEl.hidden = true
  const { error } = await supabase.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-password').value,
  })
  if (error) {
    errEl.textContent = '로그인에 실패했습니다. 이메일/비밀번호를 확인해 주세요.'
    errEl.hidden = false
    console.error(error)
  }
})

$('btn-logout').addEventListener('click', () => supabase.auth.signOut())

// ---------- 게시 폼 ----------
function nearestSunday() {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)) // 오늘이 주일이면 오늘
  return todayKey(d)
}
fields.date.value = nearestSunday()

function readForm() {
  return {
    reference: fields.reference.value.trim(),
    body_ko: fields.bodyKo.value.trim(),
    reference_en: fields.referenceEn.value.trim(),
    body_en: fields.bodyEn.value.trim(),
  }
}

function showStatus(message, isError = false) {
  const el = $('save-status')
  el.textContent = message
  el.className = isError ? 'notice notice-error' : 'notice notice-ok'
  el.hidden = false
  setTimeout(() => { el.hidden = true }, 4000)
}

$('verse-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const dateStr = fields.date.value
  if (!dateStr) return
  // published_at은 게시일에서 결정적으로 생성 → 과거 말씀을 수정해도 최신 순서가 바뀌지 않음
  const { error } = await supabase.from('haggadot').upsert({
    id: dateStr,
    ...readForm(),
    published_at: new Date(`${dateStr}T00:00:00+09:00`).toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error(error)
    showStatus('게시에 실패했습니다. 관리자 계정으로 로그인했는지 확인해 주세요.', true)
    return
  }
  showStatus(`${dateStr} 말씀을 게시했습니다.`)
  refreshList()
})

// ---------- 미리보기 ----------
let previewLang = 'ko'
function renderPreview() {
  const v = readForm()
  const en = previewLang === 'en'
  $('pv-reference').textContent = en ? v.reference_en : v.reference
  $('pv-body').textContent = en ? v.body_en : v.body_ko
  $('pv-ko').classList.toggle('active', !en)
  $('pv-en').classList.toggle('active', en)
}
$('btn-preview').addEventListener('click', () => {
  const pv = $('preview')
  pv.hidden = !pv.hidden
  if (!pv.hidden) renderPreview()
})
$('pv-ko').addEventListener('click', () => { previewLang = 'ko'; renderPreview() })
$('pv-en').addEventListener('click', () => { previewLang = 'en'; renderPreview() })

// ---------- 이전 말씀 목록 ----------
async function refreshList() {
  const listEl = $('verse-list')
  listEl.innerHTML = ''
  const { data, error } = await supabase
    .from('haggadot')
    .select('id, reference, reference_en, body_ko, body_en')
    .order('published_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error(error)
    listEl.innerHTML = '<li class="verse-list-empty">목록을 불러오지 못했습니다.</li>'
    return
  }
  if (!data.length) {
    listEl.innerHTML = '<li class="verse-list-empty">아직 게시된 말씀이 없습니다.</li>'
    return
  }
  for (const row of data) {
    const li = document.createElement('li')

    const loadBtn = document.createElement('button')
    loadBtn.type = 'button'
    loadBtn.className = 'verse-item'
    loadBtn.textContent = `${row.id} · ${row.reference}`
    loadBtn.addEventListener('click', () => {
      fields.date.value = row.id
      fields.reference.value = row.reference || ''
      fields.bodyKo.value = row.body_ko || ''
      fields.referenceEn.value = row.reference_en || ''
      fields.bodyEn.value = row.body_en || ''
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'verse-delete'
    delBtn.textContent = '삭제'
    delBtn.addEventListener('click', async () => {
      if (!confirm(`${row.id} 말씀을 삭제할까요?`)) return
      const { error: delErr } = await supabase.from('haggadot').delete().eq('id', row.id)
      if (delErr) {
        console.error(delErr)
        showStatus('삭제에 실패했습니다.', true)
        return
      }
      refreshList()
    })

    li.append(loadBtn, delBtn)
    listEl.appendChild(li)
  }
}
