# LinkMD

> **MD 지식 아카이브 — 분류, 검색, 공유, 내보내기**

AI와 나눈 모든 작업을 체계적으로 기록하고, 검색하고, 공유하는 지식 허브.

---

## 핵심 기능

### Smart Archive
- 프로젝트 폴더째 드래그 앤 드롭 → 자동 파싱 + 메타데이터 추출
- 프로젝트별 / 태그별 / 폴더별 분류
- 업로드 시 자동 태그 추출 (코드 언어, 기술 키워드, frontmatter, 문서 유형)
- HackMD 스타일 카드 UI + 폴더 트리 뷰
- 문서 Heading 기준 분할

### Power Search
- SQLite FTS5 기반 전문 검색 (BM25 랭킹)
- 검색 결과 하이라이트 + 태그/날짜 필터
- 프로젝트 내 검색 + 전체 아카이브 검색

### Share & Export
- 문서/프로젝트 공유 링크 원클릭 생성
- MD → Word(docx) / PDF / HTML 내보내기 (Pandoc)
- reference.docx 템플릿 4종 (비즈니스, 기술문서, 공문, 심플)
- 복수 MD 병합 + 목차 자동 생성

### Universe (3D 지식 네트워크)
- 프로젝트/문서/태그 관계를 시각화하는 인터랙티브 3D 그래프
- Cockpit 사이드바 + 필터 + 문서 상세 패널

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Node.js + Express |
| Database | SQLite + FTS5 |
| Document Engine | Pandoc 3.x |
| Frontend | Vanilla JS (SPA) |
| Visualization | 3D Force Graph (Three.js) |

## 프로젝트 구조

```
LinkMD/
├── server.js                # Express 서버 엔트리포인트
├── core/                    # 핵심 엔진 (13개)
│   ├── database.js          #   SQLite + FTS5 초기화/쿼리
│   ├── archive-engine.js    #   문서 아카이빙 + 자동 태깅
│   ├── search-engine.js     #   FTS5 전문 검색
│   ├── share-engine.js      #   공유 링크 생성/조회
│   ├── export-engine.js     #   내보내기 관리
│   ├── pandoc-engine.js     #   Pandoc MD→docx/pdf/html 변환
│   ├── folder-engine.js     #   폴더 CRUD + 물리 경로
│   ├── md-processor.js      #   MD 파싱, 헤딩 트리, 메타데이터
│   ├── tag-extractor.js     #   자동 태그 추출 (4가지 전략)
│   ├── file-manager.js      #   파일 I/O 유틸리티
│   ├── template-manager.js  #   Pandoc 템플릿 관리
│   ├── stats-generator.js   #   통계 생성
│   └── errors.js            #   에러 코드 정의
├── routes/                  # API 라우트 (13개)
│   ├── projects.js          #   프로젝트 CRUD
│   ├── documents.js         #   문서 CRUD + 업로드 + 분할 + 태그
│   ├── folders.js           #   폴더 CRUD
│   ├── search.js            #   검색 API
│   ├── tags.js              #   태그 관리
│   ├── share.js             #   공유 링크
│   ├── export.js            #   내보내기
│   ├── templates.js         #   템플릿 목록
│   ├── convert.js           #   포맷 변환
│   ├── preview.js           #   문서 미리보기
│   ├── download.js          #   파일 다운로드
│   ├── reverse.js           #   역변환
│   └── upload.js            #   (레거시)
├── public/                  # 프론트엔드 SPA
│   ├── index.html           #   메인 앱
│   ├── shared.html          #   공유 링크 뷰
│   ├── js/ (21개)           #   앱 모듈
│   │   ├── app.js           #     메인 + 라우팅
│   │   ├── app-state.js     #     전역 상태
│   │   ├── universe.js      #     3D 우주 뷰 (940줄)
│   │   ├── graph-builder.js #     그래프 데이터 빌더
│   │   ├── editor.js        #     문서 편집기
│   │   ├── auto-tag.js      #     자동 태그 UI
│   │   └── ...
│   └── css/ (11개)          #   스타일시트
├── middleware/               # Express 미들웨어
│   ├── error-handler.js     #   에러 핸들링
│   └── upload-validator.js  #   업로드 검증
├── templates/               # Pandoc 템플릿
│   ├── docx/                #   reference.docx 4종
│   └── css/                 #   HTML 내보내기 스타일
├── scripts/                 # 유틸리티
│   ├── migrate.js           #   DB 마이그레이션
│   ├── seed.js              #   샘플 데이터
│   ├── create-templates.js  #   템플릿 생성
│   └── cleanup.js           #   DB 정리
├── test/                    # 테스트
│   └── integration.js       #   통합 테스트
├── data/                    # SQLite DB (git 제외)
└── storage/                 # 파일 저장소 (git 제외)
    ├── originals/           #   업로드 원본 MD
    ├── exports/             #   내보내기 임시 파일
    └── templates/           #   런타임 템플릿
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

> **배포 환경**: `DB_PATH`와 `STORAGE_PATH`를 앱 디렉토리 바깥의 절대경로로 설정하면 재배포 시에도 데이터가 보존됩니다.
> ```env
> DB_PATH=/var/linkmd/data/linkmd.db
> STORAGE_PATH=/var/linkmd/storage
> ```

### 실행

```bash
npm start            # 프로덕션
npm run dev          # 개발 (파일 변경 시 자동 재시작)
npm run migrate      # DB 마이그레이션
npm run seed         # 샘플 데이터 생성
npm run create-templates  # Pandoc 템플릿 생성
```

서버 시작 후 `http://localhost:3500` 접속.

## API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 + Pandoc 버전 |
| GET | `/api/stats` | 전체 통계 |
| **프로젝트** | | |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects` | 프로젝트 목록 |
| PUT | `/api/projects/:id` | 프로젝트 수정 |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 |
| **문서** | | |
| POST | `/api/projects/:id/upload` | MD/ZIP 업로드 (자동 태그) |
| POST | `/api/projects/:id/docs` | 빈 문서 생성 |
| GET | `/api/projects/:id/docs` | 문서 목록 |
| GET | `/api/docs/:id` | 문서 상세 |
| GET | `/api/docs/:id/raw` | 원본 MD |
| PUT | `/api/docs/:id` | 문서 수정 |
| DELETE | `/api/docs/:id` | 문서 삭제 |
| PUT | `/api/docs/:id/move` | 문서 이동 |
| POST | `/api/docs/:id/copy` | 문서 복사 |
| PUT | `/api/docs/:id/rename` | 문서 이름 변경 |
| **문서 분할/태그** | | |
| GET | `/api/docs/:id/headings` | Heading 통계 |
| POST | `/api/docs/:id/split` | Heading 기준 분할 |
| GET | `/api/docs/:id/suggest-tags` | 태그 추천 |
| POST | `/api/docs/:id/apply-tags` | 태그 적용 |
| **폴더** | | |
| POST | `/api/projects/:id/folders` | 폴더 생성 |
| GET | `/api/projects/:id/folders` | 폴더 트리 |
| PUT | `/api/folders/:id` | 폴더 수정 |
| DELETE | `/api/folders/:id` | 폴더 삭제 |
| **검색** | | |
| GET | `/api/search` | 전문 검색 (FTS5) |
| **공유** | | |
| POST | `/api/share` | 공유 링크 생성 |
| GET | `/api/shared/:token` | 공유 콘텐츠 조회 |
| **내보내기** | | |
| POST | `/api/export` | MD→docx/pdf/html 변환 |
| GET | `/api/download/:id/:filename` | 변환 파일 다운로드 |
| GET | `/api/templates` | 템플릿 목록 |

## DB 스키마

| 테이블 | 역할 |
|--------|------|
| `projects` | 프로젝트 (이름, 색상, 아이콘, 문서 수) |
| `documents` | 문서 (내용, 메타데이터, 분석 결과) |
| `documents_fts` | FTS5 전문 검색 인덱스 |
| `folders` | 폴더 트리 (parent_id 재귀) |
| `tags` | 태그 (이름, 색상, 사용 횟수) |
| `document_tags` | 문서-태그 연결 |
| `shared_links` | 공유 링크 (토큰, 만료일) |
| `search_history` | 검색 히스토리 |

## 라이선스

MIT
