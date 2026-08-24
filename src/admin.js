import './styles/base.css'
import './styles/admin.css'
import { getFirebaseApp, isConfigured, useEmulator } from './firebase.js'
import { db } from './db.js'
import {
  connectAuthEmulator, getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth'
import {
  collection, deleteDoc, doc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, Timestamp,
} from 'firebase/firestore'
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

let auth = null

if (!isConfigured) {
  $('config-warning').hidden = false
} else {
  auth = getAuth(getFirebaseApp())
  if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  onAuthStateChanged(auth, (user) => {
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
  try {
    await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value)
  } catch (err) {
    errEl.textContent = '로그인에 실패했습니다. 이메일/비밀번호를 확인해 주세요.'
    errEl.hidden = false
    console.error(err)
  }
})

$('btn-logout').addEventListener('click', () => signOut(auth))

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
    bodyKo: fields.bodyKo.value.trim(),
    referenceEn: fields.referenceEn.value.trim(),
    bodyEn: fields.bodyEn.value.trim(),
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
  try {
    // publishedAt은 게시일에서 결정적으로 생성 → 과거 말씀을 수정해도 최신 순서가 바뀌지 않음
    await setDoc(doc(db, 'haggadot', dateStr), {
      ...readForm(),
      publishedAt: Timestamp.fromDate(new Date(`${dateStr}T00:00:00`)),
      updatedAt: serverTimestamp(),
    })
    showStatus(`${dateStr} 말씀을 게시했습니다.`)
    refreshList()
  } catch (err) {
    console.error(err)
    showStatus('게시에 실패했습니다. 관리자 계정으로 로그인했는지 확인해 주세요.', true)
  }
})

// ---------- 미리보기 ----------
let previewLang = 'ko'
function renderPreview() {
  const v = readForm()
  const en = previewLang === 'en'
  $('pv-reference').textContent = en ? v.referenceEn : v.reference
  $('pv-body').textContent = en ? v.bodyEn : v.bodyKo
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
  try {
    const snap = await getDocs(
      query(collection(db, 'haggadot'), orderBy('publishedAt', 'desc'), limit(20)),
    )
    if (snap.empty) {
      listEl.innerHTML = '<li class="verse-list-empty">아직 게시된 말씀이 없습니다.</li>'
      return
    }
    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const li = document.createElement('li')

      const loadBtn = document.createElement('button')
      loadBtn.type = 'button'
      loadBtn.className = 'verse-item'
      loadBtn.textContent = `${docSnap.id} · ${data.reference}`
      loadBtn.addEventListener('click', () => {
        fields.date.value = docSnap.id
        fields.reference.value = data.reference || ''
        fields.bodyKo.value = data.bodyKo || ''
        fields.referenceEn.value = data.referenceEn || ''
        fields.bodyEn.value = data.bodyEn || ''
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className = 'verse-delete'
      delBtn.textContent = '삭제'
      delBtn.addEventListener('click', async () => {
        if (!confirm(`${docSnap.id} 말씀을 삭제할까요?`)) return
        await deleteDoc(doc(db, 'haggadot', docSnap.id))
        refreshList()
      })

      li.append(loadBtn, delBtn)
      listEl.appendChild(li)
    }
  } catch (err) {
    console.error(err)
    listEl.innerHTML = '<li class="verse-list-empty">목록을 불러오지 못했습니다.</li>'
  }
}
