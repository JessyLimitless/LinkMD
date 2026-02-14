# LinkMD Phase 1: Archive + Search + Share + Export

> **이 문서는 Claude Code에서 실행하기 위한 개발 명세서입니다.**
> 반드시 LINKMD_MASTER_ARCHITECTURE_v2.1.md를 먼저 읽은 후 이 문서를 실행하세요.
> 마스터 문서의 섹션 번호(§)를 참조합니다.

---

## 실행 전 확인사항

```bash
pandoc --version        # 3.x 이상
node --version          # v18 이상
npm --version
```

---

## 작업 1: 프로젝트 초기화 + DB 설정

### 1.1 package.json

마스터 문서 §8.2 참조. 아래 의존성으로 생성:

```json
{
  "name": "linkmd",
  "version": "2.0.0",
  "description": "MD 지식 아카이브 - 분류, 검색, 공유, 내보내기",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "migrate": "node scripts/migrate.js",
    "seed": "node scripts/seed.js",
    "create-templates": "node scripts/create-templates.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "better-sqlite3": "^11.0.0",
    "multer": "^1.4.5",
    "adm-zip": "^0.5.10",
    "marked": "^12.0.0",
    "gray-matter": "^4.0.3",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "node-cron": "^3.0.3",
    "string-similarity": "^4.0.4"
  }
}
```

### 1.2 .env

```env
PORT=3500
NODE_ENV=development
DB_PATH=./data/linkmd.db
STORAGE_PATH=./storage
SHARE_BASE_URL=http://localhost:3500
```

### 1.3 폴더 구조

마스터 문서 §9 전체 구조를 생성. 빈 폴더 포함:
- data/ (DB 자동 생성됨)
- storage/originals/
- storage/exports/
- storage/templates/
- templates/docx/ (작업 6에서 파일 생성)
- templates/css/

### 1.4 npm install

```bash
npm install
```

### 1.5 core/database.js — SQLite 초기화 + FTS5

마스터 문서 §3.1 스키마를 전부 실행하는 초기화 모듈:

```javascript
// core/database.js
const Database = require('better-sqlite3');

class DB {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  init() {
    // 마스터 문서 §3.1의 CREATE TABLE 전부 실행:
    // 1. projects
    // 2. documents
    // 3. documents_fts (FTS5 가상 테이블)
    // 4. FTS5 동기화 트리거 3개 (INSERT/DELETE/UPDATE)
    // 5. tags
    // 6. document_tags
    // 7. shared_links
    // 8. search_history
    // 9. 인덱스 6개
    //
    // 중요: FTS5 tokenize='unicode61' — 한글 검색 지원
    // 중요: documents에 ai_summary, ai_keywords 컬럼은 만들되 Phase 1에서는 사용 안 함
  }
}

module.exports = DB;
```

**FTS5 동작 검증:**
```javascript
// DB 초기화 후 테스트
const row = db.prepare("SELECT fts5(?1)").get('test');
// 에러 없으면 FTS5 정상 동작
```

### 1.6 scripts/migrate.js

```javascript
// DB 파일이 없으면 생성, 있으면 스키마 버전 체크 후 마이그레이션
const DB = require('../core/database');
const db = new DB(process.env.DB_PATH || './data/linkmd.db');
console.log('Database initialized successfully');
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 1 | package.json + npm install 성공 | ☐ |
| 2 | 전체 폴더 구조 생성됨 | ☐ |
| 3 | SQLite DB 초기화 성공 (node scripts/migrate.js) | ☐ |
| 4 | FTS5 가상 테이블 생성됨 | ☐ |
| 5 | FTS5 트리거 3개 생성됨 | ☐ |
| 6 | 전체 테이블 8개 + 인덱스 6개 확인 | ☐ |

---

## 작업 2: Archive Engine (핵심)

### 2.1 core/errors.js

v1.1 에러 체계를 계승하되 아카이브용으로 확장:

```javascript
const ERROR_CODES = {
  // 업로드 (1xxx) — v1.1 계승
  UPLOAD_NO_FILES:      { code: 1001, http: 400, msg: '파일이 선택되지 않았습니다.' },
  UPLOAD_INVALID_TYPE:  { code: 1002, http: 400, msg: '.md 또는 .zip 파일만 업로드 가능합니다.' },
  UPLOAD_TOO_LARGE:     { code: 1003, http: 413, msg: '파일 크기가 제한을 초과했습니다. (최대 50MB)' },
  UPLOAD_TOO_MANY:      { code: 1004, http: 400, msg: '파일 수가 제한을 초과했습니다. (최대 100개)' },
  UPLOAD_ZIP_CORRUPT:   { code: 1005, http: 400, msg: 'ZIP 파일이 손상되었습니다.' },
  UPLOAD_ZIP_NO_MD:     { code: 1006, http: 400, msg: 'ZIP 내에 .md 파일이 없습니다.' },

  // 프로젝트 (2xxx) — 신규
  PROJECT_NOT_FOUND:    { code: 2001, http: 404, msg: '프로젝트를 찾을 수 없습니다.' },
  PROJECT_NAME_EMPTY:   { code: 2002, http: 400, msg: '프로젝트 이름을 입력해주세요.' },
  PROJECT_NAME_DUP:     { code: 2003, http: 409, msg: '같은 이름의 프로젝트가 이미 있습니다.' },

  // 문서 (3xxx) — 신규
  DOC_NOT_FOUND:        { code: 3001, http: 404, msg: '문서를 찾을 수 없습니다.' },
  DOC_EMPTY_FILE:       { code: 3002, http: 400, msg: '빈 MD 파일이 포함되어 있습니다.' },
  DOC_ENCODING:         { code: 3003, http: 400, msg: 'UTF-8 인코딩 파일만 가능합니다.' },

  // 검색 (4xxx) — 신규
  SEARCH_EMPTY_QUERY:   { code: 4001, http: 400, msg: '검색어를 입력해주세요.' },
  SEARCH_QUERY_TOO_LONG:{ code: 4002, http: 400, msg: '검색어가 너무 깁니다. (최대 200자)' },

  // 공유 (5xxx) — 신규
  SHARE_NOT_FOUND:      { code: 5001, http: 404, msg: '공유 링크를 찾을 수 없습니다.' },
  SHARE_EXPIRED:        { code: 5002, http: 410, msg: '만료된 공유 링크입니다.' },

  // 내보내기 (6xxx) — v1.1 3xxx 계승
  EXPORT_PANDOC_FAIL:   { code: 6001, http: 500, msg: 'Pandoc 변환에 실패했습니다.' },
  EXPORT_TIMEOUT:       { code: 6002, http: 504, msg: '변환 시간이 초과되었습니다. (30초)' },
  EXPORT_TEMPLATE_404:  { code: 6003, http: 404, msg: '선택한 템플릿을 찾을 수 없습니다.' },
  EXPORT_NO_DOCS:       { code: 6004, http: 400, msg: '내보낼 문서를 선택해주세요.' },

  // 서버 (9xxx) — v1.1 계승
  SERVER_PANDOC_404:    { code: 9001, http: 500, msg: 'Pandoc이 설치되어 있지 않습니다.' },
};
```

### 2.2 core/archive-engine.js

**이 파일이 v2.1 LinkMD의 심장부다.**

```javascript
class ArchiveEngine {
  constructor(db, storagePath) {
    this.db = db;
    this.storagePath = storagePath;
  }

  // ── 프로젝트 관리 ──

  createProject(name, description, color, icon)
  // → { id, name, description, color, icon, doc_count, created_at }
  // id는 uuid로 생성
  // name 중복 체크

  getProjects()
  // → [{ id, name, description, color, icon, doc_count, created_at, updated_at }]
  // doc_count 포함, updated_at 역순 정렬

  getProject(id)
  // → 단일 프로젝트 + 태그 통계

  updateProject(id, { name, description, color, icon })

  deleteProject(id)
  // → 프로젝트 삭제 시 CASCADE로 문서도 삭제
  // → /storage/originals/{projectId}/ 폴더도 삭제

  // ── 문서 관리 ──

  archiveDocuments(projectId, files)
  // 핵심 함수. 복수 MD 파일을 아카이빙:
  //
  // 각 파일에 대해:
  // 1. 원본 파일을 /storage/originals/{projectId}/{filename}에 저장
  // 2. MD 파싱: analyzeFile() 호출
  // 3. documents 테이블 INSERT
  //    → FTS5 트리거가 자동으로 documents_fts에 인덱싱
  // 4. projects.doc_count 업데이트
  //
  // ZIP인 경우: adm-zip으로 해제 → .md만 필터 → 위 과정 반복
  //
  // 반환:
  // {
  //   projectId,
  //   archived: [{ id, filename, title, headingCount, codeBlockCount, ... }],
  //   totalFiles: N,
  //   totalSize: N
  // }

  analyzeFile(content, filename)
  // v1.1 md-processor의 분석 기능:
  // - parseFilename(filename) → title
  // - 첫 번째 # 헤딩 추출
  // - heading_tree 생성: [{ level, text, line }]
  // - code_block_count + code_languages 추출
  // - table_count, image_count, line_count
  // - has_frontmatter (gray-matter)
  //
  // 반환: { title, headingCount, headingTree, codeBlockCount, codeLanguages,
  //         tableCount, imageCount, lineCount, hasFrontmatter }

  parseFilename(filename)
  // v1.1 §4.1 파일명 파싱 규칙 그대로:
  // "01_프로젝트개요.md" → "프로젝트개요"
  // "PHASE_03_API설계.md" → "API설계"
  // 정규식 5단계

  getDocuments(projectId, options)
  // options: { sortBy, sortOrder, tag, limit, offset }
  // sortBy: 'filename' | 'title' | 'created_at' | 'file_size' | 'heading_count'
  // sortOrder: 'asc' | 'desc'
  // tag 필터: document_tags JOIN
  // 페이지네이션: limit + offset

  getDocument(id)
  // → 문서 상세: 원문 content + 메타데이터 + 태그 목록

  getDocumentRaw(id)
  // → MD 원문 텍스트만 반환 (공유 다운로드용)

  updateDocument(id, { title, tags })
  // title 변경 시 FTS 트리거 자동 업데이트

  deleteDocument(id)
  // → documents 삭제 (CASCADE로 tags 관계도 삭제)
  // → FTS 트리거 자동 삭제
  // → /storage/originals/ 파일 삭제
  // → projects.doc_count 업데이트

  // ── 태그 관리 ──

  getTags()
  // → [{ id, name, color, usage_count }] — usage_count 역순

  createTag(name, color)

  addTagToDocument(docId, tagId)
  // → document_tags INSERT + tags.usage_count++

  removeTagFromDocument(docId, tagId)
  // → document_tags DELETE + tags.usage_count--

  getDocumentTags(docId)
  // → [{ id, name, color }]

  // ── 통계 ──

  getStats()
  // → { totalProjects, totalDocuments, totalTags, totalSearches,
  //     recentProjects: [...], topTags: [...] }
}
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 7 | 에러 코드 전체 구현 (errors.js) | ☐ |
| 8 | createProject + getProjects + deleteProject 동작 | ☐ |
| 9 | archiveDocuments — MD 파일 저장 + DB INSERT + FTS 인덱싱 | ☐ |
| 10 | archiveDocuments — ZIP 업로드 → MD 추출 → 아카이빙 | ☐ |
| 11 | analyzeFile — 메타데이터 추출 (헤딩/코드/테이블) | ☐ |
| 12 | parseFilename — 6가지 테스트 케이스 | ☐ |
| 13 | getDocuments — 소팅 4종 동작 (이름/날짜/크기/헤딩수) | ☐ |
| 14 | getDocuments — 태그 필터 동작 | ☐ |
| 15 | 태그 CRUD + 문서-태그 연결/해제 | ☐ |
| 16 | deleteDocument — DB + FTS + 파일 모두 삭제 | ☐ |

---

## 작업 3: Search Engine

### 3.1 core/search-engine.js

마스터 문서 §4 검색 엔진 참조.

```javascript
class SearchEngine {
  constructor(db) {
    this.db = db;
  }

  search(query, options = {})
  // options: { projectId, tagId, dateFrom, dateTo, limit = 20 }
  //
  // 1. buildFTSQuery(query)로 FTS5 쿼리 생성
  // 2. SQL 실행:
  //    SELECT d.*, 
  //           snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet,
  //           bm25(documents_fts) as rank
  //    FROM documents_fts
  //    JOIN documents d ON d.rowid = documents_fts.rowid
  //    WHERE documents_fts MATCH ?
  //      AND (프로젝트 필터)
  //      AND (날짜 필터)
  //    ORDER BY rank
  //    LIMIT ?
  // 3. 태그 필터가 있으면 document_tags JOIN 추가
  // 4. 각 결과에 프로젝트 이름 + 태그 목록 첨부
  // 5. 검색 이력 저장 (search_history INSERT)
  //
  // 반환:
  // {
  //   query, results: [{ id, title, filename, projectId, projectName,
  //                       snippet, rank, tags, createdAt }],
  //   totalResults, searchTime
  // }

  buildFTSQuery(input)
  // 사용자 입력을 FTS5 안전한 쿼리로 변환:
  //
  // "Cloud5 배포"       → "Cloud5" "배포"     (각 단어를 쌍따옴표로 래핑)
  // '"정확한 구문"'     → "정확한 구문"       (구문 검색 그대로)
  // "Cloud5 OR LinkMD"  → "Cloud5" OR "LinkMD"
  //
  // 특수문자 이스케이프: FTS5 예약 문자(* : ^ ( ) " .) 처리
  // 빈 쿼리 → SEARCH_EMPTY_QUERY 에러
  // 200자 초과 → SEARCH_QUERY_TOO_LONG 에러

  getSearchHistory(limit = 10)
  // → 최근 검색어 목록 (중복 제거, 최신순)
}
```

### 3.2 검색 동작 검증

```javascript
// 테스트 시나리오
// 1. "배포" 검색 → 배포 단어가 포함된 문서 반환
// 2. "Cloud5 API" 검색 → 두 단어 모두 포함된 문서 우선
// 3. 프로젝트 필터 적용 → 해당 프로젝트 문서만
// 4. 태그 필터 적용 → 해당 태그 문서만
// 5. BM25 랭킹 → 관련도 높은 문서 먼저
// 6. snippet → 검색어 주변 텍스트 + <mark> 하이라이트
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 17 | FTS5 기본 검색 동작 ("배포" → 결과) | ☐ |
| 18 | 복합 검색 ("Cloud5 API" → AND 동작) | ☐ |
| 19 | BM25 랭킹 정렬 동작 | ☐ |
| 20 | snippet 하이라이트 (<mark> 태그) | ☐ |
| 21 | 프로젝트 필터 동작 | ☐ |
| 22 | 태그 필터 동작 | ☐ |
| 23 | 날짜 범위 필터 동작 | ☐ |
| 24 | 검색 이력 저장 + 조회 | ☐ |
| 25 | 특수문자 이스케이프 (에러 안 남) | ☐ |
| 26 | 빈 쿼리 / 200자 초과 에러 처리 | ☐ |

---

## 작업 4: Share Engine

### 4.1 core/share-engine.js

마스터 문서 §5 공유 시스템 참조.

```javascript
class ShareEngine {
  constructor(db, baseUrl) {
    this.db = db;
    this.baseUrl = baseUrl;  // SHARE_BASE_URL
  }

  createShareLink(targetType, targetId, expiresIn = null)
  // targetType: 'document' | 'project'
  // expiresIn: '1h' | '1d' | '7d' | '30d' | null (영구)
  //
  // 1. 토큰 생성 (uuid 또는 nanoid 8자리)
  // 2. shared_links INSERT
  // 3. 만료 시간 계산
  //
  // 반환: { token, shareUrl: "{baseUrl}/s/{token}", expiresAt }

  getSharedContent(token)
  // 1. token으로 shared_links 조회
  // 2. 만료 체크 (expires_at < now → SHARE_EXPIRED)
  // 3. view_count++
  // 4. targetType에 따라:
  //    - document: 문서 상세 반환 (content + 메타)
  //    - project: 프로젝트 정보 + 문서 목록 반환
  //
  // 반환: { type, data }

  deleteShareLink(id)

  getShareLinks(targetType, targetId)
  // → 해당 문서/프로젝트의 공유 링크 목록
}
```

### 4.2 공유 뷰 페이지 (public/shared.html)

마스터 문서 §5.3 참조.
- 로그인 불필요
- 읽기 전용
- MD → HTML 렌더링 (marked)
- [MD 복사] [다운로드] 버튼
- 프로젝트 공유: 카드 목록 → 개별 문서 뷰
- 만료된 링크: 안내 메시지

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 27 | 문서 공유 링크 생성 | ☐ |
| 28 | 프로젝트 공유 링크 생성 | ☐ |
| 29 | 공유 링크로 문서 열람 (로그인 없이) | ☐ |
| 30 | 공유 링크로 프로젝트 열람 (문서 목록) | ☐ |
| 31 | 만료 설정 동작 (7d 후 접근 불가) | ☐ |
| 32 | view_count 증가 | ☐ |
| 33 | 공유 뷰 페이지 MD 렌더링 정상 | ☐ |
| 34 | [MD 복사] / [다운로드] 버튼 동작 | ☐ |

---

## 작업 5: Export Engine (v1.1 계승)

### 5.1 core/export-engine.js

v1.1의 pandoc-engine.js를 계승. 차이점은 입력이 "파일 경로"가 아니라 "DB에서 가져온 content"라는 것.

```javascript
class ExportEngine {
  constructor(templateManager) {
    this.templateManager = templateManager;
  }

  async exportDocuments(documents, outputFormat, options)
  // documents: [{ id, content, filename, title }] — DB에서 가져온 것
  //
  // 파이프라인:
  // 1. 각 문서의 content를 임시 MD 파일로 저장
  // 2. md-processor.mergeFiles()로 병합 (v1.1 §4 로직)
  // 3. Pandoc 변환 (reference.docx 템플릿 적용)
  // 4. 결과 파일을 /storage/exports/에 저장
  // 5. 다운로드 URL 반환
  //
  // options: v1.1 §11.3과 동일
  // { title, author, date, toc, tocDepth, pageBreak,
  //   headingStrategy, highlightStyle, template }
}
```

### 5.2 core/md-processor.js (v1.1 계승)

v1.1 §4의 병합 로직 그대로:
- parseFilename() — 파일명 파싱 (archive-engine과 공유)
- sortFiles() — 3가지 정렬
- demoteHeadings() — 헤딩 강등
- isSimilar() — 유사도 비교
- mergeFiles() — 핵심 병합

### 5.3 core/template-manager.js (v1.1 계승)

4종 템플릿 관리:
- business-report, technical-doc, simple-clean, government-report

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 35 | DB 문서 → 임시 파일 → Pandoc 변환 → DOCX 생성 | ☐ |
| 36 | 복수 문서 병합 + 변환 동작 | ☐ |
| 37 | 헤딩 전략 3종 동작 | ☐ |
| 38 | 템플릿 4종 모두 변환 성공 | ☐ |
| 39 | PDF 변환 동작 | ☐ |
| 40 | HTML 변환 동작 | ☐ |
| 41 | 다운로드 URL 반환 + 파일 다운로드 | ☐ |

---

## 작업 6: reference.docx 템플릿 생성

v1.1 작업 4와 동일. 마스터 문서 v1.1 §3 참조.

scripts/create-templates.js로 4종 생성:
- templates/docx/business-report.docx — 네이비, 표지+목차
- templates/docx/technical-doc.docx — 다크네이비, 코드 강조
- templates/docx/simple-clean.docx — 최소 스타일
- templates/docx/government-report.docx — 장절 번호, 흑백

```bash
npm install docx --save-dev
node scripts/create-templates.js
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 42 | 4종 템플릿 파일 생성됨 | ☐ |
| 43 | 4종 모두 pandoc --reference-doc으로 변환 성공 | ☐ |

---

## 작업 7: API 라우트 + 서버

### 7.1 routes/projects.js

```
POST   /api/projects           — 프로젝트 생성
GET    /api/projects           — 프로젝트 목록
GET    /api/projects/:id       — 프로젝트 상세
PUT    /api/projects/:id       — 프로젝트 수정
DELETE /api/projects/:id       — 프로젝트 삭제
```

### 7.2 routes/documents.js

```
POST   /api/projects/:id/upload  — MD 업로드 → 아카이빙 (multer)
GET    /api/projects/:id/docs    — 프로젝트 문서 목록 (?sort=&order=&tag=&limit=&offset=)
GET    /api/docs/:id             — 문서 상세
GET    /api/docs/:id/raw         — 문서 원문 (text/markdown)
PUT    /api/docs/:id             — 문서 수정 (제목/태그)
DELETE /api/docs/:id             — 문서 삭제
```

### 7.3 routes/search.js

```
GET    /api/search               — 전문 검색 (?q=&project=&tag=&from=&to=&limit=)
GET    /api/search/history       — 검색 이력
```

### 7.4 routes/tags.js

```
GET    /api/tags                 — 태그 목록 (usage_count 역순)
POST   /api/tags                 — 태그 생성
POST   /api/docs/:id/tags       — 문서에 태그 추가
DELETE /api/docs/:id/tags/:tagId — 문서에서 태그 제거
```

### 7.5 routes/share.js

```
POST   /api/share/doc/:id       — 문서 공유 링크 생성
POST   /api/share/project/:id   — 프로젝트 공유 링크 생성
GET    /api/shared/:token        — 공유 콘텐츠 조회 (API)
GET    /s/:token                 — 공유 뷰 페이지 (HTML)
DELETE /api/share/:id            — 공유 링크 삭제
```

### 7.6 routes/export.js

```
POST   /api/export               — 선택 문서 내보내기
GET    /api/download/:id         — 결과물 다운로드
```

### 7.7 routes/templates.js

```
GET    /api/templates            — 스타일 템플릿 목록
```

### 7.8 middleware/

- error-handler.js — LinkMDError → HTTP 응답 매핑
- upload-validator.js — 파일 타입/크기/개수 검증

### 7.9 server.js

```javascript
// 구현 요구사항:
// 1. dotenv 로드
// 2. Express 앱
// 3. DB 초기화 (core/database.js)
// 4. 미들웨어: cors, express.json, express.static
// 5. 라우트 연결 (위 7개 라우터)
// 6. /s/:token → shared.html 서빙 (공유 뷰)
// 7. 글로벌 에러 핸들러
// 8. node-cron: 30분마다 /storage/exports/ 임시 파일 정리
// 9. 서버 시작 시:
//    - data/ 폴더 자동 생성
//    - storage/ 하위 폴더 자동 생성
//    - pandoc 설치 여부 체크 (경고만)
// 10. GET /api/health → { status, pandoc, dbSize, docCount }
// 11. GET /api/stats → archive-engine.getStats()
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 44 | 서버 시작 성공 (node server.js) | ☐ |
| 45 | GET /api/health 정상 | ☐ |
| 46 | 프로젝트 CRUD 전체 동작 | ☐ |
| 47 | MD 업로드 → 아카이빙 → FTS 인덱싱 | ☐ |
| 48 | ZIP 업로드 → MD 추출 → 아카이빙 | ☐ |
| 49 | 문서 목록 조회 (소팅 + 태그 필터) | ☐ |
| 50 | 문서 상세 + 원문 조회 | ☐ |
| 51 | 검색 API 동작 (snippet + BM25) | ☐ |
| 52 | 태그 CRUD + 문서-태그 연결 | ☐ |
| 53 | 공유 링크 생성 + 콘텐츠 조회 | ☐ |
| 54 | 내보내기 API → DOCX 다운로드 | ☐ |
| 55 | 에러 핸들러 동작 (잘못된 요청 시 적절한 에러) | ☐ |

---

## 작업 8: 프론트엔드 UI

마스터 문서 §7 참조. HackMD 스타일 유지.

### 8.1 CSS (6개 파일)

**variables.css** — 인디고 브랜드 컬러, Pretendard + JetBrains Mono 폰트, 간격/그림자 변수

**layout.css** — 헤더(56px) + 사이드바(240px, 접기 가능) + 메인 영역

**cards.css** — 문서 카드 그리드 (3열, auto-fill)
- 카드 내부: 제목 + 태그 + 통계 + 날짜
- 호버/선택/드래그 상태
- 체크박스 (내보내기 선택용)

**search.css** — 검색 바 (상단 고정), 검색 결과 목록, snippet 하이라이트

**viewer.css** — 문서 뷰어 (좌측 메타 + 우측 MD 렌더링), 공유 뷰

**export.css** — 내보내기 슬라이드업 패널 (v1.1 설정 패널 계승)

**animations.css** — 트랜지션, 토스트, 로딩

### 8.2 JS (10개 파일)

**app-state.js** — 상태 관리 Store (v1.1 계승, 아카이브용 상태 추가)
```javascript
state = {
  // 앱
  view: 'workspace',              // 'workspace' | 'viewer' | 'search-results'
  currentProjectId: null,
  
  // 프로젝트
  projects: [],
  
  // 문서
  documents: [],
  selectedDocIds: new Set(),
  
  // 소팅
  sortBy: 'filename',             // 'filename' | 'title' | 'created_at' | 'file_size'
  sortOrder: 'asc',
  filterTag: null,
  
  // 검색
  searchQuery: '',
  searchResults: [],
  searchHistory: [],
  
  // 뷰어
  viewingDoc: null,
  
  // 내보내기
  exportOpen: false,
  exportSettings: { outputFormat: 'docx', template: 'business-report', ... },
  
  // 태그
  tags: [],
  
  // UI
  sidebarOpen: true,
  loading: { upload: false, search: false, export: false },
  error: null,
  toast: null
}
```

**app.js** — 상태-컴포넌트 바인딩, DOMContentLoaded 초기화

**projects.js** — 프로젝트 생성/선택/삭제, 사이드바 프로젝트 목록 렌더링

**upload.js** — 드래그앤드롭 + 클릭 업로드, POST /api/projects/:id/upload

**cards.js** — 문서 카드 렌더링, 소팅 버튼, 태그 필터 버튼, 체크박스 선택

**search.js** — 검색 바 입력 → GET /api/search → 결과 목록 렌더링, 검색 이력

**viewer.js** — 문서 뷰어: 좌측 메타(태그 관리 포함) + 우측 marked 렌더링

**tags.js** — 태그 생성, 문서에 태그 추가/제거, 태그 필터 클릭

**share.js** — 공유 링크 생성 모달, 링크 복사, 공유 뷰 페이지 로직

**export.js** — 내보내기 설정 패널, POST /api/export, 다운로드

**sidebar.js** — 사이드바: 프로젝트 목록 + 태그 목록 + 검색 이력 + 통계

### 8.3 HTML

**index.html** — 메인 앱 (§7.2 레이아웃)

**shared.html** — 공유 뷰 페이지 (§5.3)

### 8.4 디자인 핵심

- Pretendard: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`
- JetBrains Mono: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap`
- 브랜드 컬러: 인디고 #6366F1
- 기본 테마: 라이트
- 반응형: 768px 이하 사이드바 숨김

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 56 | 사이드바 + 메인 레이아웃 렌더링 | ☐ |
| 57 | 프로젝트 생성 + 목록 표시 | ☐ |
| 58 | 드래그앤드롭 업로드 → 카드 표시 | ☐ |
| 59 | 카드 그리드 (제목 + 태그 + 통계) | ☐ |
| 60 | 소팅 버튼 동작 (이름/날짜/크기) | ☐ |
| 61 | 태그 필터 클릭 → 필터링 | ☐ |
| 62 | 카드 클릭 → 문서 뷰어 열림 | ☐ |
| 63 | 문서 뷰어: MD 렌더링 정상 | ☐ |
| 64 | 문서 뷰어: 태그 추가/제거 | ☐ |
| 65 | 검색 바 입력 → 결과 표시 (하이라이트) | ☐ |
| 66 | 검색 결과 클릭 → 해당 문서 뷰어 | ☐ |
| 67 | 공유 버튼 → 링크 생성 → 복사 | ☐ |
| 68 | 공유 링크 접속 → shared.html 렌더링 | ☐ |
| 69 | 내보내기: 문서 선택 → 설정 → 변환 → 다운로드 | ☐ |
| 70 | 반응형 (768px 이하 사이드바 숨김) | ☐ |
| 71 | Pretendard + JetBrains Mono 폰트 적용 | ☐ |

---

## 작업 9: 통합 테스트

### 9.1 테스트 데이터 생성

scripts/seed.js — 테스트 프로젝트 + 문서 자동 생성:

```javascript
// 프로젝트 3개 생성:
// 1. "Cloud5" — MD 5개 (아키텍처, API, 배포, 테스트, 운영)
// 2. "LinkMD" — MD 3개 (설계, 프론트엔드, DB)
// 3. "KDCA 챗봇" — MD 3개 (요구사항, 시나리오, 테스트)
//
// 각 MD는 실제 프로젝트 문서처럼:
// - 헤딩 3~8개
// - 코드 블록 1~5개 (javascript, bash, sql)
// - 테이블 0~2개
// - 100~200줄
//
// 태그 생성: #배포, #API, #설계, #아키텍처, #테스트, #운영, #프론트엔드, #DB
// 각 문서에 2~3개 태그 연결

node scripts/seed.js
```

### 9.2 자동 테스트 스크립트

```bash
#!/bin/bash
# scripts/test.sh

BASE_URL="http://localhost:3500"
echo "=== LinkMD v2.1 통합 테스트 ==="

# 1. Health
echo "\n[1] Health"
curl -s $BASE_URL/api/health | jq .

# 2. 프로젝트 생성
echo "\n[2] Create Project"
PROJECT=$(curl -s -X POST $BASE_URL/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"테스트 프로젝트","description":"통합 테스트용"}')
echo $PROJECT | jq .
PID=$(echo $PROJECT | jq -r '.id')

# 3. MD 업로드
echo "\n[3] Upload"
curl -s -F "files=@test/01_프로젝트개요.md" \
  -F "files=@test/02_아키텍처설계.md" \
  -F "files=@test/03_API설계.md" \
  $BASE_URL/api/projects/$PID/upload | jq .

# 4. 문서 목록
echo "\n[4] Documents (sort by filename)"
curl -s "$BASE_URL/api/projects/$PID/docs?sort=filename&order=asc" | jq .

# 5. 검색
echo "\n[5] Search: 배포"
curl -s "$BASE_URL/api/search?q=배포" | jq .

# 6. 검색 (프로젝트 필터)
echo "\n[6] Search: API (project filter)"
curl -s "$BASE_URL/api/search?q=API&project=$PID" | jq .

# 7. 태그 생성 + 연결
echo "\n[7] Tags"
TAG=$(curl -s -X POST $BASE_URL/api/tags \
  -H "Content-Type: application/json" \
  -d '{"name":"테스트태그","color":"#EF4444"}')
echo $TAG | jq .
TAG_ID=$(echo $TAG | jq -r '.id')

# 문서 ID 가져오기
DOC_ID=$(curl -s "$BASE_URL/api/projects/$PID/docs" | jq -r '.documents[0].id')

# 태그 연결
curl -s -X POST "$BASE_URL/api/docs/$DOC_ID/tags" \
  -H "Content-Type: application/json" \
  -d "{\"tagId\":$TAG_ID}" | jq .

# 8. 공유 링크
echo "\n[8] Share"
SHARE=$(curl -s -X POST "$BASE_URL/api/share/doc/$DOC_ID" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn":"7d"}')
echo $SHARE | jq .
SHARE_URL=$(echo $SHARE | jq -r '.shareUrl')
echo "Share URL: $SHARE_URL"

# 9. 내보내기
echo "\n[9] Export"
EXPORT=$(curl -s -X POST $BASE_URL/api/export \
  -H "Content-Type: application/json" \
  -d "{
    \"documentIds\":[\"$DOC_ID\"],
    \"outputFormat\":\"docx\",
    \"template\":\"business-report\",
    \"options\":{\"title\":\"테스트 문서\",\"toc\":true}
  }")
echo $EXPORT | jq .
DL_URL=$(echo $EXPORT | jq -r '.downloadUrl')
curl -s -o test-output.docx "$BASE_URL$DL_URL"
ls -la test-output.docx

# 10. Stats
echo "\n[10] Stats"
curl -s $BASE_URL/api/stats | jq .

echo "\n=== 테스트 완료 ==="
```

### 9.3 수동 UI 테스트

```
1. 브라우저 http://localhost:3500 접속
2. 프로젝트 생성: "Cloud5"
3. MD 파일 3개 드래그앤드롭 업로드
4. 카드 그리드 표시 확인
5. 소팅 변경 (이름순 → 날짜순 → 크기순)
6. 태그 추가: 카드 클릭 → 뷰어 → 태그 추가
7. 태그 필터 클릭 → 필터링 확인
8. 검색 바에 "배포" 입력 → 결과 + 하이라이트
9. 검색 결과 클릭 → 문서 뷰어
10. 공유 버튼 → 링크 생성 → 새 탭에서 열기
11. 내보내기: 문서 선택 → 비즈니스 보고서 → DOCX → 다운로드
12. 다운로드된 docx Word에서 열어서 확인
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 72 | scripts/seed.js — 테스트 데이터 생성 | ☐ |
| 73 | 서버 정상 실행 | ☐ |
| 74 | 프로젝트 생성 + 문서 업로드 + 카드 표시 | ☐ |
| 75 | 소팅 3종 동작 | ☐ |
| 76 | 태그 추가/필터 동작 | ☐ |
| 77 | 전문 검색 + 하이라이트 | ☐ |
| 78 | 문서 뷰어 MD 렌더링 | ☐ |
| 79 | 공유 링크 → 외부 접속 가능 | ☐ |
| 80 | 내보내기 → DOCX 다운로드 → Word 정상 | ☐ |
| 81 | 에러 케이스 (빈 업로드, 잘못된 ID 등) | ☐ |
| 82 | 전체 UI 플로우 (업로드→분류→검색→공유→내보내기) | ☐ |

---

## 최종 확인

**Phase 1 완료 조건:**
- ☐ 82개 체크리스트 전부 통과
- ☐ 프로젝트별 MD 아카이빙 동작
- ☐ FTS5 전문 검색 (필터 + 하이라이트)
- ☐ 소팅/분류/태깅 동작
- ☐ 공유 링크 생성 + 외부 열람
- ☐ 내보내기 (DOCX/PDF/HTML) + 템플릿 4종
- ☐ HackMD 스타일 UI

---

> **Claude Code 실행 명령어:**
> "LINKMD_MASTER_ARCHITECTURE_v2.1.md와 LINKMD_PHASE1_v2.md를 읽고, Phase 1 작업을 순서대로 전부 실행해줘. 작업 1부터 9까지 순서대로 진행하되, 각 작업의 체크리스트를 통과하면 다음으로 넘어가줘. 에러가 나면 바로 수정하고 다시 테스트해줘."
