// 한글 성경 약칭, 영문 약칭, 정식 이름. 텔레그램 본문은 번역하거나 변경하지 않는다.
const BOOKS = [
  ['창','Gn,Gen','창세기','Genesis'], ['출','Ex,Exo','출애굽기','Exodus'],
  ['레','Lv,Lev','레위기','Leviticus'], ['민','Nm,Nu,Num','민수기','Numbers'],
  ['신','Dt,Deut','신명기','Deuteronomy'], ['수','Jos,Josh','여호수아','Joshua'],
  ['삿','Jdg,Judg','사사기','Judges'], ['룻','Ru,Ruth','룻기','Ruth'],
  ['삼상','1Sa,1Sam','사무엘상','1 Samuel'], ['삼하','2Sa,2Sam','사무엘하','2 Samuel'],
  ['왕상','1Ki,1Kgs','열왕기상','1 Kings'], ['왕하','2Ki,2Kgs','열왕기하','2 Kings'],
  ['대상','1Ch,1Chr','역대상','1 Chronicles'], ['대하','2Ch,2Chr','역대하','2 Chronicles'],
  ['스','Ezr','에스라','Ezra'], ['느','Ne,Neh','느헤미야','Nehemiah'],
  ['에','Est,Esth','에스더','Esther'], ['욥','Job','욥기','Job'],
  ['시','Ps,Psa','시편','Psalms'], ['잠','Pr,Prov','잠언','Proverbs'],
  ['전','Ec,Ecc,Eccl','전도서','Ecclesiastes'], ['아','Ss,Song','아가','Song of Songs'],
  ['사','Is,Isa','이사야','Isaiah'], ['렘','Jr,Jer','예레미야','Jeremiah'],
  ['애','Lm,Lam','예레미야애가','Lamentations'], ['겔','Eze,Ezek','에스겔','Ezekiel'],
  ['단','Dn,Dan','다니엘','Daniel'], ['호','Hs,Hos','호세아','Hosea'],
  ['욜','Jl,Joel','요엘','Joel'], ['암','Am,Amos','아모스','Amos'],
  ['옵','Ob,Obad','오바댜','Obadiah'], ['욘','Jnh,Jon,Jonah','요나','Jonah'],
  ['미','Mc,Mic','미가','Micah'], ['나','Na,Nah','나훔','Nahum'],
  ['합','Hab','하박국','Habakkuk'], ['습','Zep,Zeph','스바냐','Zephaniah'],
  ['학','Hg,Hag','학개','Haggai'], ['슥','Zch,Zec,Zech','스가랴','Zechariah'],
  ['말','Ml,Mal','말라기','Malachi'], ['마','Mt,Matt','마태복음','Matthew'],
  ['막','Mk,Mark','마가복음','Mark'], ['눅','Lk,Luke','누가복음','Luke'],
  ['요','Jn,John','요한복음','John'], ['행','Ac,Acts','사도행전','Acts'],
  ['롬','Rm,Ro,Rom','로마서','Romans'], ['고전','1Co,1Cor','고린도전서','1 Corinthians'],
  ['고후','2Co,2Cor','고린도후서','2 Corinthians'], ['갈','Gl,Ga,Gal','갈라디아서','Galatians'],
  ['엡','Ep,Eph','에베소서','Ephesians'], ['빌','Php,Phil','빌립보서','Philippians'],
  ['골','Col','골로새서','Colossians'], ['살전','1Th,1Thes,1Thess','데살로니가전서','1 Thessalonians'],
  ['살후','2Th,2Thes,2Thess','데살로니가후서','2 Thessalonians'],
  ['딤전','1Ti,1Tim','디모데전서','1 Timothy'], ['딤후','2Ti,2Tim','디모데후서','2 Timothy'],
  ['딛','Ti,Tit,Titus','디도서','Titus'], ['몬','Phm,Phlm','빌레몬서','Philemon'],
  ['히','Heb','히브리서','Hebrews'], ['약','Jas,Jam','야고보서','James'],
  ['벧전','1Pe,1Pet','베드로전서','1 Peter'], ['벧후','2Pe,2Pet','베드로후서','2 Peter'],
  ['요일','1Jn,1John','요한일서','1 John'], ['요이','2Jn,2John','요한이서','2 John'],
  ['요삼','3Jn,3John','요한삼서','3 John'], ['유','Jd,Jude','유다서','Jude'],
  ['계','Rv,Rev','요한계시록','Revelation'],
]
const normalize = (name) => name.toLowerCase().replace(/[\s.]/g, '')
const aliases = new Map()
for (const [index, [ko, en, nameKo, nameEn]] of BOOKS.entries()) {
  for (const name of [ko, nameKo]) aliases.set(normalize(name), { index, lang: 'ko', name: nameKo })
  for (const name of [...en.split(','), nameEn]) aliases.set(normalize(name), { index, lang: 'en', name: nameEn })
}

export const TELEGRAM_HELP = `아래 형식으로 한 메시지에 보내 주세요. 같은 날짜는 수정됩니다.

2026-10-04

[신15:4] 한글 말씀 본문 전체

[Dt 15:4, NIV] English verse text

여러 절은 [신15:4-5]처럼 범위를 쓰거나 각 절의 [출처]를 줄마다 입력할 수 있습니다.`

function parseReference(header) {
  const cleaned = header.trim().replace(/,\s*[A-Za-z][A-Za-z0-9 -]*$/, '')
  const match = cleaned.match(/^(.+?)\s*(\d{1,3})\s*:\s*(\d{1,3}(?:\s*[-–~]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–~]\s*\d{1,3})?)*)$/)
  if (!match) throw new Error(`출처 형식을 확인해 주세요: [${header}]`)
  const book = aliases.get(normalize(match[1]))
  if (!book) throw new Error(`알 수 없는 성경 이름입니다: ${match[1].trim()}`)
  const chapter = Number(match[2])
  const verses = match[3].replace(/\s/g, '').replace(/[–~]/g, '-')
  if (!chapter || verses.split(',').some((part) => {
    const [start, end = start] = part.split('-').map(Number)
    return !start || end < start
  })) throw new Error('장·절 번호를 확인해 주세요.')
  return { ...book, chapter, verses, reference: `${book.name} ${chapter}:${verses}` }
}

export function parseTelegramVerse(text) {
  if (typeof text !== 'string' || text.length > 20000) throw new Error('말씀을 텍스트 메시지로 보내 주세요.')
  const cleaned = text.replace(/\r\n?/g, '\n').trim()
  const newline = cleaned.indexOf('\n')
  const date = (newline < 0 ? cleaned : cleaned.slice(0, newline)).trim()
  const day = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime())
    || day.toISOString().slice(0, 10) !== date) {
    throw new Error('첫 줄에 올바른 게시일을 YYYY-MM-DD 형식으로 입력해 주세요.')
  }
  const contents = newline < 0 ? '' : cleaned.slice(newline + 1).trim()
  const headers = [...contents.matchAll(/^\s*\[([^\]\n]+)\][ \t]*/gm)]
  if (!headers.length || contents.slice(0, headers[0].index).trim()) {
    throw new Error('날짜 다음에 [한글 출처]와 [영문 출처] 말씀을 입력해 주세요.')
  }
  const groups = { ko: [], en: [] }
  for (const [i, header] of headers.entries()) {
    const reference = parseReference(header[1])
    const body = contents.slice(header.index + header[0].length, headers[i + 1]?.index ?? contents.length).trim()
    if (!body) throw new Error(`[${header[1]}] 뒤에 말씀 본문이 필요합니다.`)
    groups[reference.lang].push({ ...reference, body })
  }
  if (!groups.ko.length || groups.ko.length !== groups.en.length) {
    throw new Error('한글과 영문 말씀을 같은 개수로 함께 입력해 주세요.')
  }
  groups.ko.forEach((ko, i) => {
    const en = groups.en[i]
    if (ko.index !== en.index || ko.chapter !== en.chapter || ko.verses !== en.verses) {
      throw new Error('한글과 영문의 성경·장·절이 일치해야 합니다.')
    }
  })
  return {
    id: date,
    reference: groups.ko.map((entry) => entry.reference).join('; '),
    reference_en: groups.en.map((entry) => entry.reference).join('; '),
    body_ko: groups.ko.map((entry) => entry.body).join('\n'),
    body_en: groups.en.map((entry) => entry.body).join('\n'),
    published_at: new Date(`${date}T00:00:00+09:00`).toISOString(),
  }
}
