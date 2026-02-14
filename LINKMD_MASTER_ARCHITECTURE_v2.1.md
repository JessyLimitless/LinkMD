# LinkMD — Master Architecture Document (v2.1)

> **"AI와 나눈 모든 작업을 체계적으로 기록하고, 검색하고, 공유하는 지식 허브"**
> 이 문서는 LinkMD 전체 시스템의 기초 설계서입니다.
>
> **변경 이력**
> - v1.0~v1.1 — 변환 중심 설계
> - v2.0 — 아카이브 중심 피봇 + AI 검색
> - v2.1 — AI 기능을 Phase 2로 이동. Phase 1은 아카이브 + FTS 검색 + 내보내기에 집중

---

## 1. 프로젝트 정의

### 1.1 문제 정의

AI 시대의 지식 노동자는 Claude Code, Cursor, ChatGPT 등으로 작업하며 프로젝트당 10~30개 MD 파일을 생성한다. 이 파일들은:

- 프로젝트 폴더에 쌓이기만 하고 다시 보지 않는다
- 3개월 후 "그때 어떻게 했지?" 하면 찾을 수가 없다
- 체계적 분류/태깅이 없어 지식이 증발한다
- 다른 사람에게 공유하려면 링크가 없다
- 보고서가 필요하면 수작업 변환이 필요하다

### 1.2 솔루션

LinkMD는 **MD/문서를 프로젝트별로 아카이빙하고, 검색하고, 공유하고, 내보내는 지식 허브**이다.

| 기존 방식 | LinkMD |
|-----------|--------|
| MD 30개가 폴더에 방치 | 프로젝트별 분류 + 태깅 + 영구 아카이빙 |
| "그때 API 어떻게 했지?" → 파일 하나씩 열어봄 | 전문 검색으로 즉시 찾기 |
| 팀원에게 공유 → 파일 첨부 | 공유 링크 원클릭 생성 |
| 보고서 필요 → 복붙 수작업 | 선택 → 원클릭 Word/PDF 내보내기 |

### 1.3 킬러 피처 (3대 핵심)

**① Smart Archive (체계적 아카이브)**
- 프로젝트 폴더째 드래그 → 자동 파싱 + 메타데이터 추출
- 프로젝트별 / 태그별 / 날짜별 분류
- HackMD 스타일 카드 UI
- 영구 저장 (일회성 변환이 아닌 자산)

**② Power Search (전문 검색)**
- SQLite FTS5 기반 키워드 전문 검색
- BM25 관련도 랭킹
- 검색 결과 하이라이트
- 프로젝트 내 검색 + 전체 아카이브 검색
- 태그 필터 + 날짜 필터

**③ Share & Export (공유 + 내보내기)**
- 문서/프로젝트 공유 링크 생성
- 선택한 MD → 스타일 적용된 docx/pdf/html 내보내기
- Pandoc 엔진 + reference.docx 템플릿 4종
- 복수 MD 병합 + 목차 자동 생성

---

## 2. 시스템 아키텍처

### 2.1 전체 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                      │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │Workspace │  │ Search   │  │ Document │  │ Export  │  │
│  │(카드 UI) │  │ (검색바) │  │ Viewer   │  │ Panel   │  │
│  │프로젝트별│  │ FTS5     │  │MD 렌더링 │  │Pandoc   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
│       └──────── State Manager (app-state.js) ──────┘      │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                   API GATEWAY (Express)                    │
│                                                            │
│  ── 프로젝트 ──                                            │
│  POST /api/projects              - 프로젝트 생성           │
│  GET  /api/projects              - 프로젝트 목록           │
│  PUT  /api/projects/:id          - 프로젝트 수정           │
│  DELETE /api/projects/:id        - 프로젝트 삭제           │
│                                                            │
│  ── 문서 ──                                                │
│  POST /api/projects/:id/upload   - MD 업로드 → 아카이빙    │
│  GET  /api/projects/:id/docs     - 프로젝트 문서 목록      │
│  GET  /api/docs/:id              - 문서 상세 (원문+메타)   │
│  GET  /api/docs/:id/raw          - 문서 원문 (MD 텍스트)   │
│  PUT  /api/docs/:id              - 문서 수정 (태그/제목)   │
│  DELETE /api/docs/:id            - 문서 삭제               │
│                                                            │
│  ── 검색 ──                                                │
│  GET  /api/search?q=&project=&tag=&from=&to=              │
│                                                            │
│  ── 태그 ──                                                │
│  GET  /api/tags                  - 태그 목록 (사용 횟수순) │
│  POST /api/tags                  - 태그 생성               │
│  POST /api/docs/:id/tags         - 문서에 태그 추가        │
│  DELETE /api/docs/:id/tags/:tagId - 문서에서 태그 제거     │
│                                                            │
│  ── 공유 ──                                                │
│  POST /api/share/doc/:id         - 문서 공유 링크 생성     │
│  POST /api/share/project/:id     - 프로젝트 공유 링크 생성 │
│  GET  /api/shared/:token         - 공유 링크로 접근        │
│                                                            │
│  ── 내보내기 ──                                            │
│  POST /api/export                - 선택 문서 → docx/pdf    │
│  GET  /api/download/:id          - 결과물 다운로드          │
│  GET  /api/templates             - 스타일 템플릿 목록       │
│                                                            │
│  ── 기타 ──                                                │
│  GET  /api/health                - 서버 상태                │
│  GET  /api/stats                 - 아카이브 통계            │
│                                                            │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  CORE ENGINE LAYER                         │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Archive Engine   │  │  Search Engine    │              │
│  │                   │  │                   │              │
│  │ • MD 파싱/분석    │  │ • FTS5 전문 검색  │              │
│  │ • 메타데이터 추출 │  │ • BM25 랭킹       │              │
│  │ • 프로젝트 관리   │  │ • 검색 하이라이트 │              │
│  │ • 태그 관리       │  │ • 필터 (프로젝트/ │              │
│  │ • 소팅/분류       │  │   태그/날짜)      │              │
│  └──────────────────┘  └──────────────────┘               │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Share Engine     │  │  Export Engine    │              │
│  │                   │  │  (v1.1 계승)     │              │
│  │ • 공유 토큰 생성  │  │ • Pandoc 변환     │              │
│  │ • 공유 링크 관리  │  │ • MD 병합         │              │
│  │ • 만료 관리       │  │ • 템플릿 관리     │              │
│  │ • 읽기 전용 뷰    │  │ • 역변환          │              │
│  └──────────────────┘  └──────────────────┘               │
│                                                            │
│  ┌────────────────────────────────────────┐               │
│  │  AI Engine (Phase 2에서 추가)           │               │
│  │  • Claude 요약/키워드 자동 생성         │               │
│  │  • 벡터 임베딩 + 의미 검색              │               │
│  │  • 질문형 검색 (Ask Your Docs)          │               │
│  └────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  DATA LAYER                                │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  SQLite Database (linkmd.db)                         │  │
│  │                                                       │  │
│  │  projects        — 프로젝트 정보                      │  │
│  │  documents       — 문서 메타데이터 + 원문              │  │
│  │  documents_fts   — FTS5 전문 검색 인덱스              │  │
│  │  tags            — 태그                                │  │
│  │  document_tags   — 문서-태그 관계                      │  │
│  │  shared_links    — 공유 링크                           │  │
│  │  search_history  — 검색 이력                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  /storage                                                  │
│  ├── originals/     원본 MD 파일 (영구 보관)               │
│  ├── exports/       내보내기 결과물 (임시, 30분 삭제)      │
│  └── templates/     Pandoc 스타일 템플릿                   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### 2.2 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Archive-First** | 모든 MD는 영구 저장. 임시 파일이 아니라 자산 |
| **Search-Native** | 저장 시점에 FTS 인덱스 자동 생성 (트리거) |
| **AI-Ready** | Phase 2에서 AI 추가할 수 있도록 구조 준비 (ai_summary, ai_keywords 컬럼 예약) |
| **Export-Ready** | 아카이브된 문서는 언제든 Word/PDF로 내보내기 가능 |
| **SQLite-Only** | 외부 DB 없이 SQLite + FTS5만으로 Phase 1 구현 |
| **Share-Ready** | 토큰 기반 공유 링크로 로그인 없이 문서 열람 가능 |

---

## 3. 데이터베이스 설계

### 3.1 SQLite 스키마

```sql
-- 프로젝트
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366F1',
  icon TEXT DEFAULT '📁',
  doc_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 문서
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,                            -- 파싱된 제목
  content TEXT NOT NULL,                 -- MD 원문 전체
  file_size INTEGER,
  line_count INTEGER,
  heading_count INTEGER,
  code_block_count INTEGER,
  table_count INTEGER,
  image_count INTEGER,
  code_languages TEXT,                   -- JSON: ["javascript","bash"]
  heading_tree TEXT,                     -- JSON: [{level,text,line}]
  has_frontmatter INTEGER DEFAULT 0,
  -- Phase 2 AI용 예약 컬럼 (지금은 NULL)
  ai_summary TEXT,
  ai_keywords TEXT,
  --
  original_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- FTS5 전문 검색 인덱스
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title,
  content,
  content=documents,
  content_rowid=rowid,
  tokenize='unicode61'
);

-- FTS5 동기화 트리거
CREATE TRIGGER documents_fts_insert AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER documents_fts_delete AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
END;

CREATE TRIGGER documents_fts_update AFTER UPDATE OF title, content ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
  INSERT INTO documents_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

-- 태그
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6B7280',
  usage_count INTEGER DEFAULT 0
);

-- 문서-태그 관계
CREATE TABLE document_tags (
  document_id TEXT,
  tag_id INTEGER,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 공유 링크
CREATE TABLE shared_links (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  target_type TEXT NOT NULL,             -- 'document' | 'project'
  target_id TEXT NOT NULL,
  expires_at DATETIME,                   -- NULL이면 만료 없음
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 검색 이력
CREATE TABLE search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_created ON documents(created_at);
CREATE INDEX idx_document_tags_doc ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);
CREATE INDEX idx_shared_links_token ON shared_links(token);
CREATE INDEX idx_shared_links_target ON shared_links(target_type, target_id);
```

### 3.2 데이터 흐름: 문서 업로드 → 아카이빙

```
[사용자가 MD 파일 업로드]
    │
    ▼
┌─────────────────────────────────────────────┐
│ STEP 1: 파일 저장                            │
│ • 원본 MD를 /storage/originals/{projectId}/ │
│   에 영구 저장                               │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ STEP 2: MD 파싱 + 메타데이터 추출            │
│ • 파일명 파싱 (v1.1 §4.1 규칙)              │
│ • 첫 번째 # 헤딩 → title                    │
│ • 헤딩 구조 트리 추출                        │
│ • 코드블록/테이블/이미지 카운트              │
│ • 코드 언어 감지                             │
│ • YAML 프론트매터 파싱                       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ STEP 3: DB 저장 + FTS 인덱싱                 │
│ • documents 테이블 INSERT                    │
│ • → FTS5 트리거 자동 실행                    │
│ • → documents_fts에 전문 인덱스 생성         │
│ • projects.doc_count 업데이트                │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ STEP 4: 응답                                 │
│ • 업로드된 파일 목록 + 메타데이터 반환       │
│ • 즉시 검색 가능 상태                        │
└─────────────────────────────────────────────┘
```

---

## 4. 검색 엔진

### 4.1 FTS5 전문 검색

```sql
-- 기본 검색
SELECT d.id, d.title, d.filename, d.project_id,
       snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet,
       bm25(documents_fts) as rank
FROM documents_fts
JOIN documents d ON d.rowid = documents_fts.rowid
WHERE documents_fts MATCH ?
ORDER BY rank
LIMIT 20;

-- 프로젝트 필터 + 태그 필터 + 날짜 필터
SELECT d.id, d.title, d.filename, d.project_id,
       snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet,
       bm25(documents_fts) as rank
FROM documents_fts
JOIN documents d ON d.rowid = documents_fts.rowid
WHERE documents_fts MATCH ?
  AND (?2 IS NULL OR d.project_id = ?2)
  AND (?3 IS NULL OR d.created_at >= ?3)
  AND (?4 IS NULL OR d.created_at <= ?4)
ORDER BY rank
LIMIT 20;
```

### 4.2 검색 쿼리 처리

```javascript
// core/search-engine.js

class SearchEngine {
  search(query, options = {}) {
    const { projectId, tagId, dateFrom, dateTo, limit = 20 } = options;

    // FTS5 쿼리 빌드
    // "Cloud5 배포 설정" → "Cloud5 AND 배포 AND 설정"
    // 또는 "Cloud5 배포 설정" 그대로 (구문 검색)
    const ftsQuery = this.buildFTSQuery(query);

    // 태그 필터가 있으면 JOIN 추가
    // 날짜 필터가 있으면 WHERE 추가
    // BM25 랭킹으로 정렬
    // snippet()으로 하이라이트 텍스트 추출
  }

  buildFTSQuery(input) {
    // 사용자 입력을 FTS5 쿼리로 변환
    // "Cloud5 배포"  → Cloud5 배포 (암묵적 AND)
    // '"정확한 구문"' → "정확한 구문" (구문 검색)
    // "Cloud5 OR LinkMD" → Cloud5 OR LinkMD
    // 특수문자 이스케이프 처리
  }
}
```

### 4.3 검색 API

```
GET /api/search?q=Cloud5+배포&project=abc123&tag=배포&from=2026-01-01&to=2026-02-28&limit=20
```

응답:
```json
{
  "success": true,
  "query": "Cloud5 배포",
  "results": [
    {
      "id": "doc-xyz",
      "title": "아키텍처설계",
      "filename": "02_아키텍처설계.md",
      "projectId": "abc123",
      "projectName": "Cloud5",
      "snippet": "...Dokploy를 통한 <mark>배포</mark> 설정은 nginx 프록시와...",
      "rank": -4.82,
      "tags": ["배포", "아키텍처"],
      "createdAt": "2026-02-14T09:00:00Z"
    }
  ],
  "totalResults": 5,
  "searchTime": "12ms"
}
```

---

## 5. 공유 시스템

### 5.1 공유 링크 생성

```javascript
// 문서 공유
POST /api/share/doc/:docId
{ "expiresIn": "7d" }  // 7일 후 만료 (null이면 영구)
→ { "shareUrl": "https://linkmd.socialbrain.co.kr/s/abc123xyz" }

// 프로젝트 공유 (프로젝트 내 전체 문서)
POST /api/share/project/:projectId
{ "expiresIn": null }
→ { "shareUrl": "https://linkmd.socialbrain.co.kr/s/prj456def" }
```

### 5.2 공유 뷰

```
GET /s/:token → 공유 페이지 (읽기 전용)

문서 공유: MD 렌더링 뷰 (로그인 불필요)
프로젝트 공유: 프로젝트 내 문서 카드 목록 + 클릭하면 개별 문서 뷰
```

### 5.3 공유 뷰 UI

```
┌──────────────────────────────────────────────────────────┐
│  🔗 LinkMD                     Shared by Jessy / MuseAI  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📄 Cloud5 / 아키텍처설계                                │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  # 시스템 아키텍처                                 │  │
│  │                                                    │  │
│  │  Cloud5는 Dokploy 기반의 자동 배포 시스템으로...   │  │
│  │                                                    │  │
│  │  ## 기술 스택                                      │  │
│  │  | 구분 | 기술 |                                   │  │
│  │  |------|------|                                   │  │
│  │  | ...  | ...  |                                   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [📋 MD 복사]  [⬇ 다운로드]                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 6. 내보내기 (v1.1 계승)

내보내기 기능은 v1.1의 설계를 그대로 계승한다.

### 6.1 계승 항목 (v1.1 참조)

| v1.1 섹션 | 내용 | 상태 |
|-----------|------|------|
| §3 reference.docx 템플릿 4종 | 비즈니스/기술/심플/공공기관 스펙 | 그대로 사용 |
| §4 MD 병합 로직 | 파일명 파싱, 헤딩 충돌, 소팅 | 그대로 사용 |
| §4.3 헤딩 전략 3가지 | filename-first / content-first / smart-merge | 그대로 사용 |
| 부록A Pandoc 명령어 | 변환 커맨드 레퍼런스 | 그대로 사용 |
| 부록B Pandoc 래퍼 | Node.js execFile 래퍼 | 그대로 사용 |

### 6.2 내보내기 API

```
POST /api/export
{
  "documentIds": ["doc-1", "doc-2", "doc-3"],
  "outputFormat": "docx",
  "template": "business-report",
  "options": {
    "title": "Cloud5 개발 문서",
    "author": "Jessy / MuseAI",
    "date": "2026-02-14",
    "toc": true,
    "tocDepth": 3,
    "pageBreak": true,
    "headingStrategy": "filename-first",
    "highlightStyle": "tango"
  }
}
→ { "downloadUrl": "/api/download/xyz123", "filename": "Cloud5_개발문서.docx", "stats": {...} }
```

---

## 7. UI/UX 설계

### 7.1 브랜드/컬러/폰트 (v1.1 유지)

- 브랜드 컬러: 인디고 (#6366F1)
- 폰트: Pretendard (한글) + JetBrains Mono (코드)
- HackMD 스타일 카드 그리드

### 7.2 메인 레이아웃

```
┌──────────────────────────────────────────────────────────────────┐
│  🔗 LinkMD           [🔍 전체 검색...]              [내보내기]  │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  SIDEBAR   │  ┌─ 프로젝트: Cloud5 ──── [업로드] [공유] ────┐   │
│            │  │                                              │   │
│  📁 Projects│  │  정렬: [이름순▼] [날짜순] [크기순]          │   │
│   ▸ Cloud5 │  │  필터: [전체] [#배포] [#API] [#설계]        │   │
│     16 docs│  │                                              │   │
│   ▸ LinkMD │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│     6 docs │  │  │📄 01_    │  │📄 02_    │  │📄 03_    │  │   │
│   ▸ KDCA   │  │  │프로젝트  │  │아키텍처  │  │API설계   │  │   │
│     8 docs │  │  │개요      │  │설계      │  │          │  │   │
│   + 새 프로│  │  │          │  │          │  │          │  │   │
│            │  │  │#설계 #개요│  │#Dokploy  │  │#API #REST│  │   │
│  🏷️ Tags   │  │  │H:5 C:3  │  │#아키텍처 │  │#Express  │  │   │
│   #배포 (8)│  │  │2.0KB    │  │H:8 C:7   │  │H:4 C:2   │  │   │
│   #API (5) │  │  │2026-02  │  │3.5KB     │  │1.8KB     │  │   │
│   #설계 (4)│  │  └──────────┘  └──────────┘  └──────────┘  │   │
│            │  │                                              │   │
│  🔍 Recent │  │  ...                                        │   │
│  Searches  │  │                                              │   │
│  "배포 설정"│  └──────────────────────────────────────────────┘  │
│  "API 인증" │                                                    │
│            │                                                     │
│  📊 Stats  │                                                     │
│  문서: 30개│                                                     │
│  프로젝트:3│                                                     │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### 7.3 문서 뷰어

카드 클릭 시 문서 뷰어 열림:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 돌아가기     02_아키텍처설계.md     [공유] [내보내기] [삭제]  │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  문서 정보  │  # 시스템 아키텍처                                  │
│            │                                                     │
│  프로젝트:  │  Cloud5는 Dokploy 기반의 자동 배포 시스템으로,     │
│  Cloud5    │  GitHub 리포지토리를 연결하면 push 시 자동으로      │
│            │  빌드하고 배포합니다.                                │
│  태그:      │                                                     │
│  #Dokploy  │  ## 기술 스택                                       │
│  #아키텍처 │                                                     │
│  + 태그추가 │  | 구분 | 기술 | 역할 |                             │
│            │  |------|------|------|                             │
│  통계:      │  | ...  | ...  | ...  |                             │
│  H:8 C:7   │                                                     │
│  T:2 I:0   │  ## 배포 프로세스                                   │
│  120 lines │                                                     │
│  3.5 KB    │  ```bash                                            │
│            │  git push origin main                               │
│  작성일:    │  # → Dokploy 자동 감지 → 빌드 → 배포              │
│  2026-02-14│  ```                                                │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### 7.4 검색 결과 화면

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 "배포 설정"                     5건 (12ms)        [X 닫기]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  필터: [전체 프로젝트▼] [전체 태그▼] [전체 기간▼]               │
│                                                                  │
│  ┌─ Cloud5 / 02_아키텍처설계.md ─────────────────────────────┐  │
│  │  ...Dokploy를 통한 <mark>배포</mark> <mark>설정</mark>은   │  │
│  │  nginx 프록시와 SSL을 자동으로 처리합니다...                │  │
│  │  #Dokploy #배포 #아키텍처 | 2026-02-14                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Cloud5 / 13_OPS_GUIDE.md ────────────────────────────────┐  │
│  │  ...운영 가이드: <mark>배포</mark> 후 <mark>설정</mark>    │  │
│  │  확인 사항 체크리스트...                                    │  │
│  │  #운영 #배포 | 2026-02-14                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 기술 스택

### 8.1 Phase 1 기술 (AI 없음, 가벼움)

| 구분 | 기술 | 역할 |
|------|------|------|
| **DB** | better-sqlite3 | 메인 데이터베이스 |
| **전문 검색** | SQLite FTS5 | 키워드 검색 + BM25 랭킹 |
| **내보내기** | Pandoc 3.x | MD → DOCX/PDF/HTML 변환 |
| **Backend** | Node.js + Express | API 서버 |
| **Frontend** | HTML + Vanilla JS | HackMD 스타일 UI |
| **MD 파싱** | marked + gray-matter | 프리뷰 + 메타 추출 |
| **파일 업로드** | multer + adm-zip | 복수 파일 + ZIP |
| **스케줄러** | node-cron | 임시 파일 정리 |

### 8.2 Node.js 의존성

```json
{
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

### 8.3 환경 변수

```env
PORT=3500
NODE_ENV=development
DB_PATH=./data/linkmd.db
STORAGE_PATH=./storage
SHARE_BASE_URL=http://localhost:3500
```

---

## 9. 폴더 구조

```
linkmd/
├── server.js
├── package.json
├── .env
│
├── core/
│   ├── database.js              # SQLite 초기화 + FTS5 + 마이그레이션
│   ├── archive-engine.js        # MD 파싱/분석/저장/프로젝트/태그
│   ├── search-engine.js         # FTS5 전문 검색 + 필터 + 하이라이트
│   ├── share-engine.js          # 공유 토큰 생성/검증/만료
│   ├── export-engine.js         # Pandoc 변환 (v1.1 계승)
│   ├── md-processor.js          # MD 병합 (v1.1 계승, 내보내기용)
│   ├── template-manager.js      # 내보내기 템플릿 관리
│   ├── file-manager.js          # 파일 저장/관리
│   └── errors.js                # 에러 코드
│
├── routes/
│   ├── projects.js              # 프로젝트 CRUD
│   ├── documents.js             # 문서 CRUD + 업로드
│   ├── search.js                # 검색
│   ├── tags.js                  # 태그 관리
│   ├── share.js                 # 공유 링크
│   ├── export.js                # 내보내기
│   └── templates.js             # 스타일 템플릿
│
├── middleware/
│   ├── error-handler.js
│   └── upload-validator.js
│
├── templates/docx/              # Pandoc 템플릿 (v1.1 §3)
│   ├── business-report.docx
│   ├── technical-doc.docx
│   ├── simple-clean.docx
│   └── government-report.docx
│
├── public/                      # 프론트엔드
│   ├── index.html
│   ├── shared.html              # 공유 뷰 페이지
│   ├── css/
│   │   ├── variables.css
│   │   ├── layout.css
│   │   ├── cards.css
│   │   ├── search.css
│   │   ├── viewer.css
│   │   ├── export.css
│   │   ├── share.css
│   │   └── animations.css
│   └── js/
│       ├── app-state.js
│       ├── app.js
│       ├── projects.js
│       ├── upload.js
│       ├── cards.js
│       ├── search.js
│       ├── viewer.js
│       ├── tags.js
│       ├── share.js
│       ├── export.js
│       └── sidebar.js
│
├── data/                        # DB (자동 생성)
├── storage/
│   ├── originals/               # 원본 MD (영구)
│   ├── exports/                 # 내보내기 결과 (임시)
│   └── templates/
│
└── scripts/
    ├── create-templates.js      # Pandoc 템플릿 생성
    ├── migrate.js               # DB 마이그레이션
    └── seed.js                  # 테스트 데이터
```

---

## 10. Phase 로드맵 (v2.1)

### Phase 1: MVP — Archive + Search + Share + Export
| # | 작업 | 우선순위 |
|---|------|---------|
| 1 | 프로젝트 초기화 + SQLite + FTS5 설정 | 🔴 |
| 2 | 프로젝트 CRUD | 🔴 |
| 3 | 문서 업로드 + 파싱 + 영구 저장 + FTS 인덱싱 | 🔴 |
| 4 | 문서 CRUD + 태그 관리 | 🔴 |
| 5 | FTS5 전문 검색 (필터 + 하이라이트 + BM25) | 🔴 |
| 6 | 소팅 (이름/날짜/크기) + 분류 (프로젝트/태그) | 🔴 |
| 7 | 공유 링크 생성 + 공유 뷰 페이지 | 🔴 |
| 8 | 내보내기 (Pandoc, v1.1 계승) + 템플릿 4종 | 🔴 |
| 9 | 프론트엔드 UI (HackMD 스타일 + 검색바) | 🔴 |
| 10 | 문서 뷰어 (MD 렌더링) | 🔴 |
| 11 | 검색 결과 하이라이트 | 🟡 |
| 12 | 검색 이력 | 🟡 |
| 13 | 반응형 디자인 | 🟢 |

### Phase 2: AI Layer
| # | 작업 |
|---|------|
| 1 | Claude API 연동 (요약/키워드 자동 생성) |
| 2 | sqlite-vec 벡터 검색 추가 |
| 3 | AI 의미 검색 (질문 → 답변) |
| 4 | 하이브리드 검색 (FTS5 + 벡터 병합) |
| 5 | Knowledge Pack 생성 |

### Phase 3: Polish & Deploy
| # | 작업 |
|---|------|
| 1 | Cloud5에 배포 |
| 2 | 도메인 연결 |
| 3 | Google OAuth 로그인 |
| 4 | 랜딩 페이지 |
| 5 | PPTX 내보내기 |

### Phase 4: Integration & SaaS
| # | 작업 |
|---|------|
| 1 | Notion/GitHub/Slack 연동 |
| 2 | 팀 워크스페이스 |
| 3 | SaaS 과금 |
| 4 | DeployMe + LinkMD 패키지 |

---

## 11. 수익 모델

| 모델 | 대상 | 가격 | 핵심 기능 |
|------|------|------|-----------|
| **Free** | 개인 개발자 | 무료 | 프로젝트 3개, 문서 100개, 키워드 검색, 공유 |
| **Pro** | 프리랜서 | $12/월 | 무제한, AI 검색, 내보내기 전체, 태그 무제한 |
| **Team** | 팀 | $39/월 | Pro + 팀 워크스페이스 + 공유 아카이브 |
| **Enterprise** | 기업 | 별도 | Team + 온프레미스 + DeployMe 패키지 |

---

> **이 문서는 LinkMD v2.1의 기초 설계서입니다.**
> Phase 1: 아카이브 + 전문 검색(FTS5) + 공유 + 내보내기(Pandoc)
> Phase 2: AI 추가 (Claude 요약 + 벡터 검색 + 의미 검색)
> AI 없이도 가치 있는 서비스가 먼저, AI는 강화 기능으로 추가.
