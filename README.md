# LinkMD

> **MD 지식 아카이브 — 분류, 검색, 공유, 내보내기**

AI와 나눈 모든 작업을 체계적으로 기록하고, 검색하고, 공유하는 지식 허브.

---

## 문제 정의

AI 시대의 지식 노동자는 Claude Code, Cursor, ChatGPT 등으로 작업하며 프로젝트당 수십 개의 MD 파일을 생성한다. 하지만:

- 프로젝트 폴더에 쌓이기만 하고 다시 보지 않는다
- 3개월 후 "그때 어떻게 했지?" 하면 찾을 수가 없다
- 체계적 분류/태깅이 없어 지식이 증발한다
- 다른 사람에게 공유하려면 파일을 직접 전송해야 한다

## 핵심 기능

### Smart Archive (체계적 아카이브)
- 프로젝트 폴더째 드래그 앤 드롭으로 자동 파싱 + 메타데이터 추출
- 프로젝트별 / 태그별 / 날짜별 분류
- HackMD 스타일 카드 UI
- 폴더 트리 뷰 지원

### Power Search (전문 검색)
- SQLite FTS5 기반 키워드 전문 검색
- BM25 관련도 랭킹 + 검색 결과 하이라이트
- 프로젝트 내 검색 + 전체 아카이브 검색
- 태그 필터 + 날짜 필터

### Share & Export (공유 + 내보내기)
- 문서/프로젝트 공유 링크 원클릭 생성
- MD → Word(docx) / PDF / HTML 내보내기
- Pandoc 엔진 + reference.docx 템플릿 4종
- 복수 MD 병합 + 목차 자동 생성

### Universe (3D 지식 네트워크)
- 문서 간 관계를 시각화하는 인터랙티브 3D 우주 뷰
- 프로젝트/태그 기반 노드 네트워크 그래프
- Cockpit 사이드바 + 필터 + 문서 상세 패널

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Node.js + Express |
| Database | SQLite + FTS5 |
| Document Engine | Pandoc |
| Frontend | Vanilla JS (SPA) |
| Visualization | 3D Force Graph (Three.js) |

## 프로젝트 구조

```
LinkMD/
├── server.js              # Express 서버 엔트리포인트
├── core/                  # 핵심 엔진
│   ├── database.js        # SQLite + FTS5 DB 관리
│   ├── archive-engine.js  # 문서 아카이빙 엔진
│   ├── search-engine.js   # 전문 검색 엔진
│   ├── share-engine.js    # 공유 링크 엔진
│   ├── export-engine.js   # 내보내기 엔진
│   ├── pandoc-engine.js   # Pandoc 변환 엔진
│   ├── folder-engine.js   # 폴더 관리
│   ├── md-processor.js    # MD 파싱 + 메타데이터 추출
│   └── ...
├── routes/                # API 라우트
│   ├── projects.js        # 프로젝트 CRUD
│   ├── documents.js       # 문서 CRUD
│   ├── search.js          # 검색 API
│   ├── share.js           # 공유 API
│   ├── export.js          # 내보내기 API
│   └── ...
├── public/                # 프론트엔드 (Vanilla JS SPA)
│   ├── index.html
│   ├── js/
│   │   ├── app.js         # 메인 애플리케이션
│   │   ├── app-state.js   # 상태 관리
│   │   ├── universe.js    # 3D 우주 뷰
│   │   └── ...
│   └── css/
├── templates/             # Pandoc reference.docx 템플릿
├── storage/               # 파일 저장소
├── data/                  # SQLite DB
└── scripts/               # 유틸리티 스크립트
```

## 설치 및 실행

### 사전 요구 사항

- **Node.js** 18+
- **Pandoc** 3.x (Word/PDF 내보내기에 필요)

### 설치

```bash
git clone https://github.com/JessyLimitless/LinkMD.git
cd LinkMD
npm install
```

### 환경 설정

`.env` 파일을 프로젝트 루트에 생성:

```env
PORT=3500
DB_PATH=./data/linkmd.db
STORAGE_PATH=./storage
SHARE_BASE_URL=http://localhost:3500
PANDOC_PATH=/usr/local/bin/pandoc
```

> `PANDOC_PATH`는 Pandoc 설치 경로에 맞게 수정하세요.

### 실행

```bash
# 프로덕션
npm start

# 개발 (파일 변경 시 자동 재시작)
npm run dev
```

서버 시작 후 브라우저에서 `http://localhost:3500` 접속.

### 기타 스크립트

```bash
npm run migrate          # DB 마이그레이션
npm run seed             # 샘플 데이터 생성
npm run create-templates # Pandoc 템플릿 생성
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/stats` | 전체 통계 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects` | 프로젝트 목록 |
| POST | `/api/projects/:id/upload` | 문서 업로드 |
| GET | `/api/search` | 전문 검색 |
| POST | `/api/share` | 공유 링크 생성 |
| POST | `/api/export` | 문서 내보내기 |

## 라이선스

MIT
