# Haggadah Web (React + Vite)

React 버전의 하가다 웹 앱입니다. 기존 웹/모바일 UI와 동일한 구조로 작성되어 있으며, `data.json`을 읽어 한글/영문 말씀을 표시합니다.

## 주요 기능

- `data.json` 원격 로드 + localStorage 캐시
- 한국어/영문 전환
- 카운터 및 칭호 배지
- 본문 가리기(HIDE1/HIDE2)
- 폰트 크기 조절
- 10회 단위 효과 및 100회 달성 보상 애니메이션

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 빌드

```bash
npm run build
npm run preview
```

## 설정

`data.json` URL은 [src/App.jsx](src/App.jsx) 상단의 `dataUrl` 상수에서 변경할 수 있습니다.
