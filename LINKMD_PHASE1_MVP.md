# LinkMD Phase 1: MVP 개발 실행 명세서

> **이 문서는 Claude Code에서 실행하기 위한 개발 명세서입니다.**
> 반드시 LINKMD_MASTER_ARCHITECTURE_v1.1.md를 먼저 읽은 후 이 문서를 실행하세요.
> 마스터 문서의 섹션 번호(§)를 참조합니다.

---

## 실행 전 확인사항

```bash
# 1. Pandoc 설치 확인
pandoc --version
# 없으면: sudo apt install pandoc

# 2. wkhtmltopdf 설치 확인 (PDF 변환용)
wkhtmltopdf --version
# 없으면: sudo apt install wkhtmltopdf

# 3. Node.js 확인
node --version  # v18 이상
npm --version
```

---

## 작업 1: 프로젝트 초기화

### 1.1 package.json 생성

```json
{
  "name": "linkmd",
  "version": "1.0.0",
  "description": "AI 문서를 비즈니스 자산으로 즉시 이식하는 문서 허브",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "create-templates": "node scripts/create-templates.js",
    "cleanup": "node scripts/cleanup.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "multer": "^1.4.5",
    "adm-zip": "^0.5.10",
    "marked": "^12.0.0",
    "gray-matter": "^4.0.3",
    "node-cron": "^3.0.3",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "string-similarity": "^4.0.4"
  }
}
```

### 1.2 .env 파일

```env
PORT=3500
NODE_ENV=development
MAX_FILE_SIZE=10485760
MAX_TOTAL_SIZE=52428800
MAX_FILE_COUNT=100
CLEANUP_INTERVAL_MINUTES=30
```

### 1.3 폴더 구조 생성

마스터 문서 §10 참조. 아래 구조를 전부 생성할 것:

```
linkmd/
├── server.js
├── package.json
├── .env
├── core/
│   ├── errors.js
│   ├── md-processor.js
│   ├── pandoc-engine.js
│   ├── template-manager.js
│   ├── file-manager.js
│   └── stats-generator.js
├── routes/
│   ├── upload.js
│   ├── preview.js
│   ├── convert.js
│   ├── download.js
│   ├── reverse.js
│   └── templates.js
├── middleware/
│   ├── error-handler.js
│   └── upload-validator.js
├── templates/
│   ├── docx/       (빈 폴더, 작업4에서 생성)
│   ├── pptx/       (빈 폴더)
│   └── css/
│       └── html-export.css
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── variables.css
│   │   ├── layout.css
│   │   ├── cards.css
│   │   ├── settings.css
│   │   └── animations.css
│   └── js/
│       ├── app-state.js
│       ├── app.js
│       ├── upload.js
│       ├── cards.js
│       ├── preview.js
│       ├── settings.js
│       ├── convert.js
│       └── sidebar.js
├── storage/
│   ├── uploads/
│   ├── workspace/
│   └── output/
└── scripts/
    ├── create-templates.js
    └── cleanup.js
```

### 1.4 npm install 실행

```bash
npm install
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 1 | package.json 생성됨 | ☐ |
| 2 | .env 생성됨 | ☐ |
| 3 | 전체 폴더/파일 구조 생성됨 | ☐ |
| 4 | npm install 성공 | ☐ |
| 5 | pandoc --version 정상 | ☐ |

---

## 작업 2: 에러 시스템 구현

마스터 문서 §5 참조.

### 2.1 core/errors.js

마스터 문서 §5.1의 에러 코드 체계를 **전부** 구현:

```javascript
// 구현할 클래스
class LinkMDError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LinkMDError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}
```

에러 코드 전체 목록 (§5.1에서 복사):
- 1001~1006: 업로드 관련
- 2001~2003: 파싱 관련
- 3001~3006: 변환 관련
- 4001~4002: 다운로드 관련
- 5001~5002: 역변환 관련
- 9001~9002: 서버 관련

에러 코드별로 사용자 친화적 한국어 메시지와 suggestion(해결 방법 안내) 포함.

### 2.2 middleware/error-handler.js

Express 글로벌 에러 핸들러:
- LinkMDError → 해당 코드의 HTTP status + JSON 응답
- 일반 Error → 500 Internal Server Error
- 모든 에러를 console.error로 로깅
- 프로덕션에서는 stack trace 숨김

### 2.3 middleware/upload-validator.js

multer 전에 실행되는 유효성 검증:
- 파일 확장자 체크 (.md, .zip만 허용)
- 개별 파일 크기 체크 (10MB)
- 전체 크기 체크 (50MB)
- 파일 수 체크 (100개)

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 6 | LinkMDError 클래스 + 에러 코드 전체 구현 | ☐ |
| 7 | 글로벌 에러 핸들러 동작 | ☐ |
| 8 | 업로드 유효성 검증 동작 (.txt 거부 등) | ☐ |

---

## 작업 3: 핵심 엔진 (Core Layer)

마스터 문서 §2.3, §4, §5.2 참조.

### 3.1 core/md-processor.js

**이 파일이 LinkMD의 심장부다. 마스터 문서 §4 전체를 빠짐없이 구현할 것.**

#### 3.1.1 analyzeFile(filePath) — 단일 MD 파일 분석

입력: MD 파일 경로
출력:
```javascript
{
  filename: "01_프로젝트개요.md",
  size: 2048,
  parsedTitle: "프로젝트개요",       // parseFilename() 결과
  firstHeading: "프로젝트 개요",     // MD 내부 첫 번째 # 텍스트
  headingCount: 5,
  headingTree: [                      // 헤딩 구조 트리
    { level: 1, text: "프로젝트 개요", line: 1 },
    { level: 2, text: "배경", line: 5 },
    ...
  ],
  codeBlockCount: 3,
  codeLanguages: ["javascript", "bash"],  // 감지된 언어
  tableCount: 1,
  imageCount: 2,
  imageRefs: ["./images/arch.png"],       // 이미지 경로 목록
  lineCount: 120,
  hasFrontmatter: false,
  encoding: "utf-8"
}
```

#### 3.1.2 parseFilename(filename) — 파일명 파싱

마스터 문서 §4.1의 정규식 5단계를 정확히 구현:

```
"01_프로젝트개요.md"         → "프로젝트개요"
"02-아키텍처설계.md"         → "아키텍처설계"
"PHASE_03_API설계.md"        → "API설계"
"CLOUD5_PHASE13_OPS.md"      → "OPS"
"README.md"                  → "README"
"meeting-notes-20260214.md"  → "meeting notes"
```

파싱 순서:
1. `.md` 확장자 제거
2. 선행 번호 제거: `01_`, `02-`, `3.`
3. PHASE 접두사 제거: `PHASE_03_`, `phase-12-`
4. 프로젝트명_PHASE 제거: `CLOUD5_PHASE13_`
5. 후행 날짜 제거: `_20260214`
6. 언더스코어/하이픈 → 공백
7. 연속 공백 정리 + trim

#### 3.1.3 sortFiles(files, strategy, customOrder) — 정렬

마스터 문서 §4.2 참조. 3가지 전략:
- `filename`: 자연수 정렬 (2 < 10, 한글 사전순)
- `modified`: 파일 수정일 순
- `custom`: customOrder 배열 순서

자연수 정렬 구현 필수: "2_xxx"가 "10_xxx"보다 앞에 와야 함.

#### 3.1.4 demoteHeadings(markdown, levels) — 헤딩 강등

마스터 문서 §4.5 참조:
- `#` → `##`, `##` → `###` (levels=1일 때)
- 최대 `######` (H6)까지만
- 정규식: `/^(#{1,6})\s/gm`

#### 3.1.5 isSimilar(str1, str2, threshold) — 유사도 비교

마스터 문서 §4.6 참조:
- string-similarity 패키지 사용
- 정규화: 공백, 특수문자, 숫자 제거 후 비교
- 완전 포함 체크 (한쪽이 다른 쪽에 포함되면 유사)
- threshold 기본값: 0.7

#### 3.1.6 mergeFiles(files, options) — 핵심 병합 함수

마스터 문서 §4.4의 파이프라인을 정확히 구현:

**입력 options:**
```javascript
{
  sortOrder: 'filename',           // 'filename' | 'modified' | 'custom'
  headingStrategy: 'filename-first', // 'filename-first' | 'content-first' | 'smart-merge'
  pageBreak: true,
  fileOrder: null,                  // custom일 때 파일명 배열
  title: 'Cloud5 개발 문서',
  author: 'Jessy / MuseAI',
  date: '2026-02-14'
}
```

**파이프라인:**
1. 정렬 (sortFiles)
2. 각 파일에 대해:
   - gray-matter로 프론트매터 파싱
   - 파일명에서 챕터 제목 추출 (parseFilename)
   - 헤딩 전략에 따라 처리:
     - `filename-first`: 파일명→H1 + 내부 헤딩 1단계 강등
     - `content-first`: 내부 그대로, 파일 간 `---` 구분
     - `smart-merge`: 파일명과 첫 헤딩 유사도 체크 → 중복이면 content-first, 다르면 filename-first
3. 페이지 브레이크 삽입: `\newpage` (pageBreak=true) 또는 `---`
4. YAML 프론트매터 생성 (title, author, date)
5. 통합 MD 파일 반환 + 통계

**출력:**
```javascript
{
  content: "---\ntitle: ...\n---\n\n# 프로젝트개요\n\n...",
  mergedPath: "/workspace/{sessionId}/merged.md",
  stats: {
    inputFiles: 16,
    totalLines: 1850,
    headings: 48,
    codeBlocks: 34,
    tables: 12,
    images: 5
  }
}
```

### 3.2 core/pandoc-engine.js

마스터 문서 §2.3 + 부록B 참조.

#### 3.2.1 convert(inputFiles, outputPath, options)

```javascript
// inputFiles: string[] — 입력 MD 파일 경로 (보통 merged.md 1개)
// outputPath: string — 출력 파일 경로
// options:
{
  template: '/path/to/reference.docx',  // --reference-doc
  toc: true,                             // --toc
  tocDepth: 3,                           // --toc-depth
  title: '문서 제목',                    // --metadata title=
  author: '작성자',                      // --metadata author=
  date: '2026-02-14',                    // --metadata date=
  highlightStyle: 'tango',              // --highlight-style
  pdfEngine: 'wkhtmltopdf',             // --pdf-engine (PDF일 때만)
  css: '/path/to/style.css',            // --css (HTML일 때만)
  standalone: true                       // --standalone (HTML일 때만)
}
```

- child_process.execFile로 pandoc 실행
- timeout: 30초
- stderr 파싱 (parsePandocError)
- 복구 가능 에러 → warnings 배열에 수집, 변환은 계속
- 복구 불가 에러 → LinkMDError throw

#### 3.2.2 parsePandocError(stderr)

마스터 문서 §5.2의 에러 패턴 매핑을 정확히 구현:
- `Could not find image` → recoverable, 이미지 스킵
- `Unknown extension` → not recoverable
- `openBinaryFile: does not exist` → template 404
- `pdflatex not found` / `wkhtmltopdf not found` → PDF 엔진 없음
- `UTF-8` / `encoding` → 인코딩 오류

#### 3.2.3 reverse(inputFile, outputDir)

역변환 (DOCX/PDF → MD):
```bash
pandoc input.docx -o output.md --extract-media=./media --wrap=none
```
- 결과: MD 파일 + media 폴더 → ZIP으로 묶어서 반환

### 3.3 core/template-manager.js

```javascript
class TemplateManager {
  // 사용 가능한 템플릿 목록 반환
  getTemplates() → [{ id, name, description, path, preview }]
  
  // 특정 템플릿 경로 반환 (없으면 에러)
  getTemplatePath(templateId, format) → string
  
  // 템플릿 존재 여부 확인
  exists(templateId, format) → boolean
}
```

템플릿 목록:
```javascript
const TEMPLATES = {
  'business-report': {
    name: '비즈니스 보고서',
    description: '표지 + 목차 + 페이지번호. 경영진 보고, 고객 제출용',
    formats: ['docx']
  },
  'technical-doc': {
    name: '기술 문서',
    description: '코드 강조 + 버전 헤더. 개발 문서, API 명세용',
    formats: ['docx']
  },
  'simple-clean': {
    name: '심플',
    description: '최소 스타일. 빠른 변환, 개인 정리용',
    formats: ['docx']
  },
  'government-report': {
    name: '공공기관 보고서',
    description: '장절 번호 + 흑백. 정부 기관 제출용',
    formats: ['docx']
  }
};
```

### 3.4 core/file-manager.js

```javascript
class FileManager {
  // 세션 폴더 생성 → /storage/uploads/{sessionId}/
  createSession() → { sessionId, uploadDir, workspaceDir, outputDir }
  
  // 세션 폴더 전체 삭제
  deleteSession(sessionId)
  
  // 만료된 세션 정리 (30분 이상 된 것)
  cleanupExpired()
  
  // 출력 파일 경로 반환 (다운로드용)
  getOutputPath(sessionId) → string | null
  
  // 세션 존재 여부 확인
  sessionExists(sessionId) → boolean
}
```

### 3.5 core/stats-generator.js

변환 결과 통계 생성:
```javascript
function generateStats(mergeStats, outputPath, startTime) {
  return {
    inputFiles: mergeStats.inputFiles,
    mergedLines: mergeStats.totalLines,
    outputSize: fs.statSync(outputPath).size,
    headings: mergeStats.headings,
    codeBlocks: mergeStats.codeBlocks,
    tables: mergeStats.tables,
    images: mergeStats.images,
    estimatedPages: Math.ceil(mergeStats.totalLines / 45), // 대략 45줄/페이지
    conversionTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
  };
}
```

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 9 | parseFilename() — 6가지 테스트 케이스 통과 | ☐ |
| 10 | sortFiles() — filename/modified/custom 3가지 동작 | ☐ |
| 11 | demoteHeadings() — #→##, ##→### 변환 정상 | ☐ |
| 12 | isSimilar() — "프로젝트개요" vs "프로젝트 개요" = true | ☐ |
| 13 | mergeFiles() — 3개 MD → 통합 MD 생성 | ☐ |
| 14 | 헤딩 전략 3가지 모두 동작 | ☐ |
| 15 | pandoc-engine convert() — MD→DOCX 변환 성공 | ☐ |
| 16 | parsePandocError() — 에러 패턴 매핑 동작 | ☐ |
| 17 | reverse() — DOCX→MD 역변환 동작 | ☐ |
| 18 | template-manager — 템플릿 목록/경로 반환 | ☐ |
| 19 | file-manager — 세션 생성/삭제/만료 정리 동작 | ☐ |

---

## 작업 4: reference.docx 스타일 템플릿 생성

마스터 문서 §3 전체 참조. **이 작업이 LinkMD의 차별화 핵심이다.**

### 4.1 기본 reference.docx 추출

```bash
pandoc -o templates/docx/base-reference.docx --print-default-data-file reference.docx
```

### 4.2 scripts/create-templates.js

Pandoc의 기본 reference.docx를 기반으로, docx-js(npm docx 패키지)를 사용하여 4종 템플릿을 프로그래밍 방식으로 생성하는 스크립트.

**먼저 추가 의존성 설치:**
```bash
npm install docx --save-dev
```

**각 템플릿에서 설정해야 할 Pandoc 스타일 이름:**

Pandoc이 reference.docx에서 읽는 스타일 이름이 정해져 있다. 반드시 아래 이름을 사용:

| Pandoc 요소 | Word 스타일 이름 |
|------------|-----------------|
| # Heading 1 | `Heading 1` |
| ## Heading 2 | `Heading 2` |
| ### Heading 3 | `Heading 3` |
| 일반 문단 (첫 번째) | `First Paragraph` |
| 일반 문단 (이후) | `Body Text` |
| 코드 블록 | `Source Code` |
| 인라인 코드 | `Verbatim Char` |
| 블록 인용 | `Block Text` |
| 표 캡션 | `Table Caption` |
| 이미지 캡션 | `Image Caption` |
| 목차 제목 | `TOC Heading` |

**§3.3 스펙을 정확히 반영하여 4종 생성:**

#### ① business-report.docx
- 마스터 문서 §3.3-① 스펙 그대로
- 폰트: 맑은 고딕 (Malgun Gothic), 코드: D2Coding → Consolas (호환성)
- 컬러: 네이비 (#1B365D) 계열
- Heading 1: 18pt Bold 네이비, 아래 1pt 라인
- Heading 2: 14pt Bold #2E5090
- Heading 3: 12pt Bold #4472C4
- Body Text: 11pt #333333, 줄간격 1.5
- Source Code: 9pt Consolas, 배경 #F8F9FA
- A4, 여백 25mm

#### ② technical-doc.docx
- 마스터 문서 §3.3-② 스펙
- 컬러: 다크네이비 (#1A1A2E) 계열
- Heading 1: 16pt Bold #16213E
- Source Code: 9pt Consolas, 배경 #F5F5F5 (라이트) — Word에서 다크 배경은 안 됨
- Body Text: 10.5pt, 줄간격 1.4

#### ③ simple-clean.docx
- 마스터 문서 §3.3-③ 스펙
- 최소 스타일, 흑백 계열
- Heading 1: 16pt Bold #111111
- Body Text: 11pt #333333, 줄간격 1.5
- Source Code: 9pt Consolas, 배경 #F5F5F5

#### ④ government-report.docx
- 마스터 문서 §3.3-④ 스펙
- 전부 검정(#000000), 장절 번호 체계
- Heading 1: 16pt Bold 검정
- Body Text: 11pt 검정, 줄간격 1.6, 들여쓰기 10pt
- Source Code: 9pt, 배경 없음, 보더만

### 4.3 생성 실행

```bash
node scripts/create-templates.js
# → templates/docx/business-report.docx
# → templates/docx/technical-doc.docx
# → templates/docx/simple-clean.docx
# → templates/docx/government-report.docx
```

### 4.4 검증

각 템플릿으로 테스트 변환 실행:
```bash
echo "# Test\n\nHello World\n\n\`\`\`javascript\nconsole.log('hi');\n\`\`\`" > /tmp/test.md
pandoc /tmp/test.md -o /tmp/test-business.docx --reference-doc=templates/docx/business-report.docx
pandoc /tmp/test.md -o /tmp/test-technical.docx --reference-doc=templates/docx/technical-doc.docx
pandoc /tmp/test.md -o /tmp/test-simple.docx --reference-doc=templates/docx/simple-clean.docx
pandoc /tmp/test.md -o /tmp/test-government.docx --reference-doc=templates/docx/government-report.docx
```

4개 docx 모두 정상 생성되는지 확인.

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 20 | scripts/create-templates.js 작성 완료 | ☐ |
| 21 | business-report.docx 생성됨 | ☐ |
| 22 | technical-doc.docx 생성됨 | ☐ |
| 23 | simple-clean.docx 생성됨 | ☐ |
| 24 | government-report.docx 생성됨 | ☐ |
| 25 | 4종 모두 pandoc --reference-doc으로 변환 성공 | ☐ |

---

## 작업 5: API 라우트 + 서버

마스터 문서 §11 참조.

### 5.1 routes/upload.js — POST /api/upload

- multer로 복수 파일 수신 (필드명: `files`)
- .zip인 경우 adm-zip으로 압축 해제 → .md만 추출
- 각 파일에 대해 md-processor.analyzeFile() 실행
- 마스터 문서 §11.2 응답 형식 반환
- 에러 시: UPLOAD_NO_FILES, UPLOAD_INVALID_TYPE 등

### 5.2 routes/preview.js — POST /api/preview

- 요청: `{ sessionId, filename }`
- 해당 MD 파일을 marked로 HTML 렌더링
- 응답: `{ success: true, html: "<h1>프로젝트 개요</h1>...", filename }`

### 5.3 routes/convert.js — POST /api/convert

**메인 변환 API. 마스터 문서 §11.3, §11.4 참조.**

파이프라인:
1. sessionId로 업로드된 파일 목록 가져오기
2. selectedFiles 필터링 (없으면 전체)
3. md-processor.mergeFiles() 호출 (§4.4 파이프라인)
4. template-manager에서 reference.docx 경로 가져오기
5. pandoc-engine.convert() 호출
6. stats-generator로 통계 생성
7. §11.4 응답 형식 반환 (warnings 포함)

### 5.4 routes/download.js — GET /api/download/:sessionId

- file-manager에서 출력 파일 경로 조회
- 없으면 DOWNLOAD_NOT_FOUND 에러
- 있으면 res.download()으로 파일 전송
- Content-Disposition: 한글 파일명 지원 (encodeURIComponent)

### 5.5 routes/reverse.js — POST /api/reverse

- 단일 .docx 또는 .pdf 업로드
- pandoc-engine.reverse() 호출
- 결과 MD + media 폴더를 ZIP으로 묶기
- ZIP 다운로드 링크 반환

### 5.6 routes/templates.js — GET /api/templates

- template-manager.getTemplates() 결과 반환
- 각 템플릿의 id, name, description 포함

### 5.7 server.js — Express 메인 서버

```javascript
// 구현 요구사항:
// 1. dotenv 로드
// 2. Express 앱 생성
// 3. cors, express.json, express.static 미들웨어
// 4. 라우트 연결:
//    - GET /           → public/index.html
//    - POST /api/upload    → routes/upload
//    - POST /api/preview   → routes/preview
//    - POST /api/convert   → routes/convert
//    - GET  /api/download/:sessionId → routes/download
//    - POST /api/reverse   → routes/reverse
//    - GET  /api/templates → routes/templates
//    - GET  /api/health    → { status: 'ok', pandoc: true/false }
// 5. 글로벌 에러 핸들러 (middleware/error-handler.js)
// 6. node-cron: 매 30분마다 file-manager.cleanupExpired() 실행
// 7. 서버 시작 시 storage 폴더 자동 생성
// 8. 서버 시작 시 pandoc 설치 여부 체크 (경고만, 중단 안 함)
```

### 5.8 templates/css/html-export.css

HTML 내보내기용 스타일:
- 깔끔한 타이포그래피 (Pretendard 또는 시스템 폰트)
- 코드 블록 스타일 (배경 + 고정폭)
- 테이블 스타일 (헤더 음영)
- 반응형 max-width: 800px
- 인쇄 최적화 (@media print)

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 26 | POST /api/upload — 복수 MD 업로드 + 분석 결과 반환 | ☐ |
| 27 | POST /api/upload — ZIP 업로드 → MD 추출 동작 | ☐ |
| 28 | POST /api/preview — MD → HTML 렌더링 | ☐ |
| 29 | POST /api/convert — MD → DOCX 변환 + 다운로드 URL | ☐ |
| 30 | POST /api/convert — 헤딩 전략 3종 모두 동작 | ☐ |
| 31 | POST /api/convert — 템플릿 4종 모두 동작 | ☐ |
| 32 | POST /api/convert — warnings 포함 응답 | ☐ |
| 33 | GET /api/download/:sessionId — 파일 다운로드 | ☐ |
| 34 | POST /api/reverse — DOCX → MD + ZIP 반환 | ☐ |
| 35 | GET /api/templates — 템플릿 목록 반환 | ☐ |
| 36 | GET /api/health — pandoc 상태 포함 | ☐ |
| 37 | cron — 30분 후 만료 세션 자동 삭제 | ☐ |

---

## 작업 6: 프론트엔드 UI (HackMD 스타일)

마스터 문서 §6 전체 참조. **HackMD의 워크스페이스 UI를 참조한 디자인.**

### 6.1 디자인 원칙

- **HackMD 참조**: 좌측 사이드바 + 우측 카드 그리드 레이아웃
- **브랜드 컬러**: 인디고 (#6366F1) — 마스터 문서 §6.2 컬러 시스템
- **폰트**: Pretendard (한글) + JetBrains Mono (코드)
  ```
  Pretendard CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css
  JetBrains Mono CDN: https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap
  ```
- **기본 테마**: 라이트 (다크 토글은 향후)
- **반응형**: 768px 이하에서 사이드바 숨김

### 6.2 public/css/variables.css

마스터 문서 §6.2 컬러 시스템을 CSS 변수로 정의:
- Primary (인디고 50~900)
- Neutral (gray 50~900)
- Accent (success, warning, error, info)
- Semantic (docx, pdf, pptx, html, md 포맷별 컬러)
- 타이포그래피 변수 (font-family, font-size 체계)
- 간격 변수 (spacing 4px~64px)
- 보더, 그림자 변수

### 6.3 public/css/layout.css

마스터 문서 §6.3 레이아웃:
- 헤더: 높이 56px, 좌측 로고 "🔗 LinkMD", 우측 [문서→MD] 토글
- 사이드바: 너비 240px, 좌측 고정
  - My Documents (폴더 트리)
  - Tags
  - Convert History
  - 접기 버튼 (→ 아이콘만 표시 56px)
- 메인 영역: 사이드바 우측 전체
  - 업로드 존
  - 카드 그리드
  - 하단 액션 바

### 6.4 public/css/cards.css

마스터 문서 §6.4 카드 컴포넌트:
- 카드 크기: 그리드 3열 (auto-fill, minmax(240px, 1fr))
- 기본: 흰 배경, 1px gray-200 보더, border-radius 8px
- 호버: box-shadow 확대, translateY(-2px)
- 선택됨: primary-50 배경, primary-500 보더 2px
- 드래그 중: opacity 0.5, 드롭 위치 파란 점선

카드 내부:
- 상단: 파일 아이콘 + 미리보기 아이콘
- 중앙: parsedTitle (파일명에서 추출된 제목)
- 하단: 통계 (H:5 C:3 T:1) + 파일 크기 + 날짜
- 좌하단: 체크박스 (선택/해제)

### 6.5 public/css/settings.css

마스터 문서 §6.5 변환 설정 슬라이드업 패널:
- 하단에서 슬라이드업 (transform + transition)
- 배경 오버레이 (rgba 블랙 50%)
- 포맷 선택: 4개 아이콘 버튼 (DOCX/PDF/PPTX/HTML)
- 스타일 프리셋: 라디오 버튼 4개
- 상세 설정: 토글로 접기/펼치기
- 하단: [변환 시작] 버튼 (primary 컬러) + [취소]

### 6.6 public/css/animations.css

- 카드 호버: transition transform 0.2s, box-shadow 0.2s
- 설정 패널 슬라이드: transition transform 0.3s ease-out
- 업로드 존 드래그 오버: 보더 색상 변경 + 스케일 애니메이션
- 로딩 스피너: CSS-only 회전 애니메이션
- 토스트 알림: 우하단에서 슬라이드인 + 3초 후 페이드아웃
- 파일 카드 추가: fadeIn + slideUp

### 6.7 public/js/app-state.js

마스터 문서 §6.6 상태 관리 Store를 정확히 구현:

```javascript
class AppState {
  constructor() {
    this.state = {
      view: 'workspace',
      sessionId: null,
      files: [],
      selectedFiles: new Set(),
      selectAll: false,
      sortOrder: 'filename',
      customOrder: [],
      convertSettings: {
        outputFormat: 'docx',
        template: 'business-report',
        title: '',
        author: '',
        date: new Date().toISOString().split('T')[0],
        headingStrategy: 'filename-first',
        toc: true,
        pageBreak: true,
        highlight: true,
        coverPage: false
      },
      result: null,
      warnings: [],
      settingsOpen: false,
      previewFile: null,
      dragTarget: null,
      error: null,
      loading: { upload: false, convert: false, preview: false }
    };
    this.listeners = new Map();
  }
  
  setState(path, value) { /* ... */ }
  getState(path) { /* ... */ }
  subscribe(path, callback) { /* ... */ }
  notify(path) { /* ... */ }
}

const store = new AppState();
```

### 6.8 public/js/app.js

마스터 문서 §6.7 컴포넌트-상태 바인딩:
- DOMContentLoaded에서 모든 subscribe 등록
- 각 상태 변경 → 해당 DOM 업데이트 함수 호출
- 초기 렌더링

### 6.9 public/js/upload.js

드래그앤드롭 업로드 존:
- dragenter/dragover/dragleave/drop 이벤트 핸들링
- 클릭으로 파일 선택 (input[type=file] 숨김)
- .md 파일 여러 개 또는 .zip 1개
- 업로드 시 loading.upload = true → FormData로 POST /api/upload
- 성공 시 store.setState('files', 응답.files)
- 실패 시 store.setState('error', 에러 메시지)

### 6.10 public/js/cards.js

파일 카드 렌더링:
- store.files 배열 기반으로 카드 DOM 생성
- 카드 클릭 → 선택 토글 (selectedFiles Set)
- 전체 선택/해제 버튼
- 드래그 순서 변경 (HTML5 Drag and Drop API)
  - dragstart: 카드 반투명
  - dragover: 드롭 위치 표시
  - drop: customOrder 업데이트
- 미리보기 아이콘 클릭 → POST /api/preview → 모달에 HTML 표시

### 6.11 public/js/settings.js

변환 설정 패널:
- "변환하기" 버튼 클릭 → settingsOpen = true → 패널 슬라이드업
- 포맷 선택 (DOCX/PDF/PPTX/HTML) → convertSettings.outputFormat 업데이트
- 스타일 프리셋 라디오 → convertSettings.template 업데이트
- 상세 설정 입력 → convertSettings 각 필드 업데이트
- [변환 시작] → convert.js의 startConvert() 호출
- [취소] → settingsOpen = false

### 6.12 public/js/convert.js

변환 실행:
- startConvert(): POST /api/convert (convertSettings + sessionId + selectedFiles)
- loading.convert = true → 로딩 오버레이 표시
- 성공 → result에 저장 → 결과 영역 표시 (다운로드 버튼)
- warnings 있으면 경고 토스트 표시
- 실패 → error에 저장 → 에러 토스트

### 6.13 public/js/sidebar.js

사이드바:
- 현재 세션의 폴더/파일 트리 (MVP에서는 단순 리스트)
- Convert History (MVP에서는 현재 세션만)
- 사이드바 접기/펼치기 토글

### 6.14 public/index.html

모든 CSS + JS를 로드하는 메인 HTML:
- §6.3 레이아웃 구조 구현
- 업로드 존
- 카드 그리드 컨테이너
- 하단 액션 바
- 설정 패널 (기본 숨김)
- 미리보기 모달 (기본 숨김)
- 결과 영역 (기본 숨김)
- 에러 토스트 컨테이너
- 로딩 오버레이

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 38 | CSS 변수 시스템 (인디고 브랜드 컬러) | ☐ |
| 39 | 사이드바 + 메인 레이아웃 (HackMD 스타일) | ☐ |
| 40 | 드래그앤드롭 업로드 동작 | ☐ |
| 41 | 파일 카드 그리드 렌더링 (통계 표시) | ☐ |
| 42 | 카드 선택/해제 + 전체 선택 | ☐ |
| 43 | 카드 드래그 순서 변경 | ☐ |
| 44 | MD 미리보기 모달 | ☐ |
| 45 | 변환 설정 슬라이드업 패널 | ☐ |
| 46 | 변환 실행 + 로딩 + 결과 다운로드 | ☐ |
| 47 | 에러 토스트 알림 | ☐ |
| 48 | 반응형 (768px 이하 사이드바 숨김) | ☐ |
| 49 | Pretendard + JetBrains Mono 폰트 적용 | ☐ |

---

## 작업 7: 통합 테스트

### 7.1 테스트 파일 생성

3개의 테스트 MD 파일을 생성하되, 실제 프로젝트 문서처럼 만들 것:

**test/01_프로젝트개요.md:**
- `# 프로젝트 개요` 로 시작
- 배경, 목적, 범위 섹션
- 테이블 1개 (기술 스택)
- 코드 블록 1개

**test/02_아키텍처설계.md:**
- `# 시스템 아키텍처` 로 시작
- 아키텍처 다이어그램 (ASCII)
- 코드 블록 3개 (javascript, bash, json)
- 테이블 1개 (API 엔드포인트)

**test/03_API설계.md:**
- `# API 설계` 로 시작
- REST API 명세
- 코드 블록 2개 (json 요청/응답)
- 테이블 2개 (엔드포인트, 에러코드)

### 7.2 자동 테스트 스크립트

```bash
# scripts/test.sh 생성

#!/bin/bash
echo "=== LinkMD 통합 테스트 ==="

BASE_URL="http://localhost:3500"

# 1. 서버 헬스 체크
echo "\n[1] Health Check"
curl -s $BASE_URL/api/health | jq .

# 2. 템플릿 목록
echo "\n[2] Templates"
curl -s $BASE_URL/api/templates | jq .

# 3. 파일 업로드
echo "\n[3] Upload"
UPLOAD_RESULT=$(curl -s -F "files=@test/01_프로젝트개요.md" \
  -F "files=@test/02_아키텍처설계.md" \
  -F "files=@test/03_API설계.md" \
  $BASE_URL/api/upload)
echo $UPLOAD_RESULT | jq .
SESSION_ID=$(echo $UPLOAD_RESULT | jq -r '.sessionId')

# 4. 변환 (비즈니스 보고서, DOCX)
echo "\n[4] Convert — Business Report DOCX"
CONVERT_RESULT=$(curl -s -X POST $BASE_URL/api/convert \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"outputFormat\": \"docx\",
    \"template\": \"business-report\",
    \"options\": {
      \"title\": \"LinkMD 테스트 문서\",
      \"author\": \"Jessy / MuseAI\",
      \"toc\": true,
      \"headingStrategy\": \"filename-first\",
      \"pageBreak\": true
    }
  }")
echo $CONVERT_RESULT | jq .

# 5. 다운로드
echo "\n[5] Download"
DOWNLOAD_URL=$(echo $CONVERT_RESULT | jq -r '.downloadUrl')
curl -s -o test-output.docx $BASE_URL$DOWNLOAD_URL
ls -la test-output.docx

# 6. 에러 케이스: 빈 업로드
echo "\n[6] Error: No files"
curl -s -X POST $BASE_URL/api/upload | jq .

# 7. 에러 케이스: 잘못된 파일 형식
echo "\n[7] Error: Invalid file type"
echo "test" > /tmp/test.txt
curl -s -F "files=@/tmp/test.txt" $BASE_URL/api/upload | jq .

echo "\n=== 테스트 완료 ==="
```

### 7.3 수동 UI 테스트

1. 브라우저에서 `http://localhost:3500` 접속
2. MD 파일 3개 드래그앤드롭 업로드
3. 카드 3개 표시되는지 확인
4. 카드 선택 + 변환 설정 열기
5. 비즈니스 보고서 / DOCX 선택
6. 변환 실행
7. 다운로드된 docx 파일 Word에서 열어서 확인:
   - 목차 있는지
   - 스타일 적용됐는지
   - 코드 블록 형식 유지되는지
   - 페이지 분리 되는지

### 체크리스트
| # | 항목 | 통과 |
|---|------|------|
| 50 | 테스트 MD 3개 생성 | ☐ |
| 51 | 서버 정상 실행 (node server.js) | ☐ |
| 52 | /api/health — pandoc: true | ☐ |
| 53 | /api/upload — 3파일 업로드 + 분석 결과 | ☐ |
| 54 | /api/convert — DOCX 변환 성공 | ☐ |
| 55 | /api/download — docx 다운로드 성공 | ☐ |
| 56 | 생성된 docx — Word에서 정상 열림 | ☐ |
| 57 | 생성된 docx — 목차 표시 | ☐ |
| 58 | 생성된 docx — 스타일 적용됨 | ☐ |
| 59 | 생성된 docx — 코드 블록 형식 유지 | ☐ |
| 60 | 생성된 docx — 파일 간 페이지 분리 | ☐ |
| 61 | 에러 케이스 — 빈 업로드 거부 | ☐ |
| 62 | 에러 케이스 — .txt 업로드 거부 | ☐ |
| 63 | UI — 드래그앤드롭 업로드 동작 | ☐ |
| 64 | UI — 카드 표시 + 선택 + 변환 + 다운로드 전체 플로우 | ☐ |
| 65 | UI — 반응형 (모바일 뷰) | ☐ |

---

## 최종 확인

모든 체크리스트 통과 후:

```bash
# 최종 파일 수 확인
find . -type f | grep -v node_modules | grep -v .git | wc -l
# 예상: 약 35~40개 파일

# 폴더 구조 확인
tree -I node_modules --dirsfirst
```

**Phase 1 완료 조건:**
- ☐ 65개 체크리스트 전부 통과
- ☐ 브라우저에서 전체 플로우 동작 (업로드 → 카드 → 설정 → 변환 → 다운로드)
- ☐ 4종 템플릿 모두 정상 변환
- ☐ 에러 케이스 처리 정상
- ☐ HackMD 스타일 UI 적용

---

> **Claude Code 실행 명령어:**
> "LINKMD_MASTER_ARCHITECTURE_v1.1.md와 LINKMD_PHASE1_MVP.md를 읽고, Phase 1 작업을 순서대로 전부 실행해줘. 작업 1부터 7까지 순서대로 진행하되, 각 작업의 체크리스트를 통과하면 다음 작업으로 넘어가줘. 에러가 나면 바로 수정하고 다시 테스트해줘."
