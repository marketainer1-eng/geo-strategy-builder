# GEO Strategy Builder — Netlify 배포판

원본 사이트(`index.html`)를 그대로 두고, 빠져 있던 백엔드를 **Netlify Functions** 형식으로 복원한 패키지입니다.

```
geo-netlify/
├── public/
│   └── index.html              # 원본 그대로 (수정 없음) — 배포 publish 폴더
├── netlify/functions/
│   └── generate.mjs            # /api/generate 백엔드 (Netlify 형식)
├── netlify.toml                # publish/functions/리다이렉트 설정
└── README.md
```

`/api/generate` 호출은 `netlify.toml`의 리다이렉트가 자동으로 `generate.mjs`로 연결하므로 `index.html`은 한 글자도 고치지 않았습니다.

## 배포 방법 A — Git 연동 (권장)

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Netlify에서 **Add new site → Import an existing project**로 저장소 선택.
3. Build 설정은 비워둬도 됩니다. `netlify.toml`이 `publish = "public"`, 함수 디렉터리를 지정합니다.
4. **Site settings → Environment variables**에 아래를 등록 → **Deploy**.

## 배포 방법 B — CLI 드래그 배포

```bash
npm i -g netlify-cli
netlify deploy --prod
# publish 폴더 물어보면: public
```

환경변수는 CLI로:
```bash
netlify env:set OPENAI_API_KEY "sk-본인키"
```

## 환경변수

| 변수 | 필수 | 기본값 |
|------|------|--------|
| `OPENAI_API_KEY` | AI 모드 사용 시 | — |
| `OPENAI_MODEL` | 선택 | `gpt-4o-mini` |
| `OPENAI_BASE_URL` | 선택 | `https://api.openai.com/v1` |

> 키를 설정하지 않아도 사이트는 동작합니다. AI 호출이 실패하면 자동으로 로컬 템플릿으로 폴백되어 9섹션 보고서가 항상 완성됩니다.

## 동작 확인

- 폼에서 정보 입력 → **AI 토글 끔(기본)**: 로컬 템플릿으로 즉시 생성.
- **AI 토글 켬** + 서버에 키 등록됨: `/api/generate`가 OpenAI로 콘텐츠 제목·정의·FAQ 생성.
- 함수만 단독 점검: `https://<사이트>/.netlify/functions/generate` 에 POST.

## 주의

- Netlify Functions 동기 실행은 기본 10초, 최대 26초입니다(`netlify.toml`에서 26초로 설정함). gpt-4o-mini 기준 보통 그 안에 끝나지만, 초과 시엔 폴백됩니다.
- Vercel용 파일(`vercel.json`, 루트의 `api/generate.js`, `package.json`)은 Netlify에선 **넣지 마세요.** 이 패키지에는 포함되어 있지 않습니다.
