# LinkMD — Master Architecture Document (v1.1)

> **"AI와 나눈 대화를 비즈니스 자산으로 즉시 이식하세요."**
> 이 문서는 LinkMD 전체 시스템의 기초 설계서입니다.
> 모든 Phase별 MD 문서는 이 문서의 아키텍처를 기반으로 작성됩니다.
>
> **변경 이력**
> - v1.0 (2026-02-14) — 초기 아키텍처 수립
> - v1.1 (2026-02-14) — UI/UX 설계(HackMD 참조), reference.docx 템플릿 스펙, MD 병합 상세 로직, 에러 핸들링, 프론트엔드 상태 관리, DeployMe 연동 구체화 추가

---

## 1. 프로젝트 정의

### 1.1 문제 정의
AI 코딩/컨설팅 시대에 Claude Code, Cursor, GitHub Copilot 등으로 작업하면 프로젝트당 **10~30개의 MD 파일**이 생성된다. 이 파편화된 MD 파일들은:

- 실무 보고서(docx/hwp)로 변환하려면 수작업이 필요
- 팀 공유(Notion/Slack)하려면 하나씩 복사-붙여넣기
- AI에게 다시 학습시키려면 토큰 낭비 + 컨텍스트 손실
- 아카이빙/버전 관리 체계가 없어서 쌓이기만 함

### 1.2 솔루션
LinkMD는 **파편화된 MD를 비즈니스 자산으로 즉시 이식하는 엔터프라이즈 문서 허브**이다.

| 기존 방식 | LinkMD |
|-----------|--------|
| MD 30개를 하나씩 열어서 Word에 복붙 | 폴더째 드래그 → 스타일 적용된 docx 원클릭 생성 |
| Notion에 하나씩 페이지 생성 | 프로젝트 구조 그대로 Notion 이식 |
| AI에게 30개 파일 하나씩 첨부 | 토큰 최적화된 단일 학습 팩 생성 |
| PDF로 내보내기 (수정 불가) | 편집 가능한 docx/hwp로 내보내기 |

### 1.3 경쟁 환경 분석

| 서비스 | 방향 | 핵심 기능 | LinkMD 차별점 |
|--------|------|-----------|--------------|
| **HackMD** | MD 편집 | 실시간 협업 MD 에디터 | 편집이 아닌 "이식/변환/통합"에 집중 |
| **AnythingMD** | 역방향 (문서→MD) | PDF/DOCX → MD 변환 | 우리는 양방향 지원 (MD→문서 + 문서→MD) |
| **Monkt** | 역방향 (문서→JSON/MD) | API 기반 문서 파싱 | 우리는 UI 기반 + 복수 파일 통합 |
| **Pandoc CLI** | 변환 엔진 | 만능 포맷 변환기 | CLI가 아닌 웹 UI + AI 구조화 + 스타일 프리셋 |
| **CloudConvert** | 단일 변환 | 1:1 파일 변환 | 복수 MD 통합 + 비즈니스 스타일 적용 불가 |
| **StackEdit** | MD 에디터 | 브라우저 MD 편집 | 단일 파일, 통합/변환 기능 없음 |

**블루오션**: "복수 MD → 통합 → 스타일 적용된 비즈니스 문서" 영역은 현재 비어있음.

### 1.4 킬러 피처 (3대 핵심)

**① Editable Bridge (편집 가능한 문서 이식)**
- 복수 MD → 스타일 적용된 docx/pptx 변환
- 기업 문서 양식(보고서/제안서/기술문서) 프리셋 제공
- 표, 코드블록, 목차가 Word 기능 그대로 유지 → 바로 수정 가능

**② One-Click Notion Sink (노션 구조화 이식)**
- 30개 MD → Notion 워크스페이스에 계층형 페이지로 즉시 이식
- 데이터베이스 또는 페이지 트리 형태 선택 가능

**③ AI Knowledge Pack (컨텍스트 압축기)**
- 30개 MD → 토큰 최적화된 단일 학습 팩으로 변환
- Claude 프로젝트/GPTs에 바로 첨부 가능한 형태
- 연관 관계 분석 + 중복 제거 + 구조 요약

---

## 2. 시스템 아키텍처

### 2.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Workspace│  │ Preview  │  │ Convert  │  │Download │ │
│  │ (카드UI) │  │ & Edit   │  │ Settings │  │ Zone    │ │
│  │(HackMD형)│  │ (MD렌더) │  │(스타일등)│  │(결과물) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│       └──────── State Manager (app-state.js) ──────┘     │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY (Express)                   │
│                                                           │
│  POST /api/upload          - 파일 업로드 + 압축 해제      │
│  POST /api/convert         - 변환 실행                    │
│  POST /api/preview         - MD 미리보기                  │
│  GET  /api/download/:id    - 결과물 다운로드              │
│  POST /api/reverse         - 역변환 (DOCX→MD)            │
│  GET  /api/templates       - 스타일 템플릿 목록           │
│  GET  /api/health          - 서버 상태                    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Error Handler (Middleware)                  │ │
│  │  • PandocError  → 변환 실패 상세 메시지              │ │
│  │  • UploadError  → 파일 형식/크기 오류                │ │
│  │  • ParseError   → 깨진 MD 문법                       │ │
│  │  • TimeoutError → Pandoc 30초 초과                   │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  CORE ENGINE LAYER                        │
│                                                           │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │  MD Processor    │  │  Pandoc Engine    │              │
│  │                  │  │                   │              │
│  │ • 복수 MD 읽기   │  │ • MD → DOCX      │              │
│  │ • 파일명 파싱    │  │ • MD → PPTX      │              │
│  │ • 메타데이터 추출│  │ • MD → PDF       │              │
│  │ • 구조 분석      │  │ • MD → HTML      │              │
│  │ • 헤딩 충돌 해결 │  │ • DOCX → MD (역) │              │
│  │ • 통합/병합      │  │ • 커스텀 템플릿   │              │
│  │ • 목차 자동 생성 │  │ • 에러 파싱       │              │
│  └────────┬────────┘  └────────┬─────────┘               │
│           │                     │                         │
│           ▼                     ▼                         │
│  ┌─────────────────────────────────────────┐             │
│  │         Template Engine                  │             │
│  │                                          │             │
│  │  • reference.docx (Word 스타일 템플릿)   │             │
│  │  • 비즈니스 보고서 / 기술문서 / 심플     │             │
│  │  • 공공기관 보고서 (B2G)                 │             │
│  │  • 기업 커스텀 템플릿 (Enterprise)       │             │
│  └──────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │         AI Layer (Phase 3)               │             │
│  │                                          │             │
│  │  • Claude API: 구조 분석/재구조화        │             │
│  │  • 중복 제거 + 연관 관계 분석            │             │
│  │  • Knowledge Pack 생성                   │             │
│  │  • 자동 목차/요약 생성                   │             │
│  └──────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │    DeployMe Hook (Phase 5)               │             │
│  │                                          │             │
│  │  • Cloud5 Webhook 수신                   │             │
│  │  • 배포 이벤트 → 기술 문서 자동 생성     │             │
│  │  • README.md + 배포 로그 → 운영 가이드   │             │
│  └──────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  STORAGE LAYER                            │
│                                                           │
│  /uploads     임시 업로드 (30분 후 자동 삭제)             │
│  /workspace   작업 중간 파일 (통합 MD, 변환 중간물)       │
│  /output      최종 결과물 (docx, pptx, pdf, html)        │
│  /templates   스타일 템플릿 저장소                         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 핵심 설계 원칙

| 원칙 | 설명 | Cloud5 대비 |
|------|------|-------------|
| **Pandoc-First** | 변환 엔진은 Pandoc에 위임, 직접 구현 최소화 | Cloud5의 Dokploy+Nixpacks와 동일 전략 |
| **Template-Driven** | 스타일은 reference.docx 템플릿으로 분리 관리 | 변환 로직과 디자인을 완전 분리 |
| **Pipeline Pattern** | Upload → Parse → Merge → Convert → Output 단계별 처리 | 각 단계 독립적으로 교체/확장 가능 |
| **양방향 변환** | MD→문서 + 문서→MD 양방향 지원 | 경쟁사 대비 유일한 양방향 서비스 |
| **AI-Ready** | AI Layer를 분리해서 향후 Claude API 연동 대비 | Phase별 점진적 AI 기능 추가 |
| **HackMD-Inspired UI** | 워크스페이스 카드 UI + 사이드바 구조 참조 | Cloud5가 Render UI를 참조한 것과 동일 전략 |

### 2.3 Pandoc 엔진 활용 전략

Cloud5가 Dokploy를 쓴 것처럼, LinkMD의 핵심 변환은 **Pandoc**에 위임한다.

**Pandoc이 해주는 것:**
```bash
# 단일 MD → DOCX (스타일 템플릿 적용)
pandoc input.md -o output.docx --reference-doc=template.docx

# 복수 MD → 통합 DOCX
pandoc ch01.md ch02.md ch03.md -o output.docx --reference-doc=template.docx --toc

# MD → PPTX
pandoc input.md -o output.pptx --reference-doc=template.pptx

# MD → PDF (via wkhtmltopdf)
pandoc input.md -o output.pdf --pdf-engine=wkhtmltopdf

# DOCX → MD (역변환)
pandoc input.docx -o output.md --extract-media=./media --wrap=none

# MD → HTML
pandoc input.md -o output.html --standalone --css=style.css
```

**우리가 직접 구현하는 것:**
- 복수 MD 파일 정렬/병합 로직 (파일명 파싱 포함)
- 파일명 기반 챕터 자동 구조화
- 헤딩 충돌 감지 및 해결
- 메타데이터 주입 (제목, 작성자, 날짜)
- 스타일 프리셋 관리 (reference.docx 템플릿들)
- 웹 UI (HackMD 스타일 워크스페이스)
- 에러 핸들링 및 사용자 피드백
- AI 기반 구조 분석 (향후)

---

## 3. reference.docx 템플릿 상세 스펙 (v1.1 신규)

### 3.1 템플릿 파일 구조

```
/templates/docx/
├── business-report.docx      # 비즈니스 보고서
├── technical-doc.docx         # 기술 문서
├── simple-clean.docx          # 심플
├── government-report.docx     # 공공기관 보고서 (B2G)
└── custom/                    # 기업 커스텀 (Enterprise)
```

### 3.2 공통 스타일 규칙

모든 템플릿에 적용되는 기본 규칙:

| 항목 | 값 | 비고 |
|------|------|------|
| 용지 | A4 (210mm × 297mm) | 한국 기본 용지 |
| 여백 | 상하좌우 25mm | 공공기관 보고서 기준 |
| 기본 폰트 | 맑은 고딕 (Malgun Gothic) | 한글 환경 기본 |
| 기본 폰트 크기 | 11pt | |
| 줄간격 | 1.5줄 (160%) | |
| 코드 폰트 | D2Coding 또는 Consolas | 한글 코드 가독성 |
| 코드 폰트 크기 | 9pt | |
| 언어 | 한국어 (ko-KR) | 맞춤법 검사 언어 |

### 3.3 템플릿별 상세 스펙

#### ① business-report.docx (비즈니스 보고서)

**용도**: 경영진 보고, 프로젝트 결과 보고, 고객 제출용

| 스타일 | 폰트 | 크기 | 색상 | 기타 |
|--------|------|------|------|------|
| **Title** | 맑은 고딕 Bold | 28pt | #1B365D (네이비) | 중앙 정렬, 아래 2pt 네이비 라인 |
| **Heading 1** | 맑은 고딕 Bold | 18pt | #1B365D | 상단 여백 24pt, 하단 12pt, 아래 1pt 라인 |
| **Heading 2** | 맑은 고딕 Bold | 14pt | #2E5090 | 상단 여백 18pt, 하단 8pt |
| **Heading 3** | 맑은 고딕 Bold | 12pt | #4472C4 | 상단 여백 12pt, 하단 6pt |
| **Normal (본문)** | 맑은 고딕 | 11pt | #333333 | 줄간격 1.5, 문단 간격 6pt |
| **Code Block** | D2Coding | 9pt | #2D2D2D | 배경 #F8F9FA, 왼쪽 3pt 파란 보더 |
| **Table Header** | 맑은 고딕 Bold | 10pt | #FFFFFF | 배경 #1B365D |
| **Table Cell** | 맑은 고딕 | 10pt | #333333 | 짝수행 #F2F6FC |
| **Caption** | 맑은 고딕 | 9pt | #666666 | 이탤릭 |

**구성 요소:**
- 표지 페이지: 제목 + 부제 + 작성자 + 날짜 + 로고 영역
- 자동 목차 (TOC depth 3)
- 헤더: 좌측 문서 제목 / 우측 날짜
- 푸터: 중앙 페이지 번호

#### ② technical-doc.docx (기술 문서)

**용도**: 개발 문서, API 명세, 아키텍처 설계서

| 스타일 | 폰트 | 크기 | 색상 | 기타 |
|--------|------|------|------|------|
| **Title** | 맑은 고딕 Bold | 24pt | #1A1A2E (다크네이비) | 좌측 정렬 |
| **Heading 1** | 맑은 고딕 Bold | 16pt | #16213E | 상단 20pt, 하단 10pt |
| **Heading 2** | 맑은 고딕 Bold | 13pt | #0F3460 | 상단 16pt, 하단 8pt |
| **Heading 3** | 맑은 고딕 SemiBold | 11.5pt | #533483 | 상단 12pt, 하단 6pt |
| **Normal** | 맑은 고딕 | 10.5pt | #2D2D2D | 줄간격 1.4 |
| **Code Block** | D2Coding | 9pt | #E8E8E8 on #1E1E1E | 다크 테마, 라운드 보더 |
| **Inline Code** | D2Coding | 9.5pt | #E74C3C | 배경 #FDF2F2 |
| **Table Header** | 맑은 고딕 Bold | 9.5pt | #FFFFFF | 배경 #16213E |
| **Table Cell** | 맑은 고딕 | 9.5pt | #2D2D2D | 짝수행 #F7F8FA |

**구성 요소:**
- 버전 정보 헤더 (문서명 / 버전 / 최종 수정일)
- 자동 목차 (TOC depth 3)
- 코드 블록에 언어 라벨 표시
- 헤더: 좌측 문서명 / 우측 버전
- 푸터: 좌측 "Confidential" / 우측 페이지 번호

#### ③ simple-clean.docx (심플)

**용도**: 빠른 변환, 개인 정리, 메모

| 스타일 | 폰트 | 크기 | 색상 | 기타 |
|--------|------|------|------|------|
| **Heading 1** | 맑은 고딕 Bold | 16pt | #111111 | 상단 20pt, 하단 10pt |
| **Heading 2** | 맑은 고딕 Bold | 13pt | #333333 | 상단 16pt, 하단 8pt |
| **Heading 3** | 맑은 고딕 SemiBold | 11pt | #555555 | 상단 12pt, 하단 6pt |
| **Normal** | 맑은 고딕 | 11pt | #333333 | 줄간격 1.5 |
| **Code Block** | D2Coding | 9pt | #2D2D2D | 배경 #F5F5F5 |

**구성 요소:**
- 표지 없음
- 목차 없음
- 헤더/푸터 없음
- 최소한의 스타일만 적용

#### ④ government-report.docx (공공기관 보고서)

**용도**: 정부 기관 제출용, 공공 프로젝트 보고서 (B2G)

| 스타일 | 폰트 | 크기 | 색상 | 기타 |
|--------|------|------|------|------|
| **Title** | 맑은 고딕 Bold | 22pt | #000000 | 중앙 정렬 |
| **Heading 1** | 맑은 고딕 Bold | 16pt | #000000 | "제1장" 자동 번호 |
| **Heading 2** | 맑은 고딕 Bold | 14pt | #000000 | "제1절" 자동 번호 |
| **Heading 3** | 맑은 고딕 Bold | 12pt | #000000 | "1." 자동 번호 |
| **Normal** | 맑은 고딕 | 11pt | #000000 | 줄간격 1.6, 들여쓰기 10pt |
| **Table** | 맑은 고딕 | 10pt | #000000 | 흑백 테두리, 헤더 회색 배경 |

**구성 요소:**
- 표지: 기관명 + 문서명 + 날짜 + "대외비" 표시 옵션
- 목차 (필수)
- 헤더: 기관명
- 푸터: 페이지 번호 (- N -)
- 장절 자동 번호 체계

### 3.4 reference.docx 생성 방법

```bash
# Pandoc 기본 reference.docx 추출
pandoc -o custom-reference.docx --print-default-data-file reference.docx

# 이 파일을 Word에서 열어서 스타일 수정 후 저장
# → 위 스펙표대로 각 스타일(Heading 1, Normal, Code 등) 수정
# → 저장된 .docx를 /templates/docx/ 에 배치

# 변환 시 적용
pandoc input.md -o output.docx --reference-doc=templates/docx/business-report.docx
```

---

## 4. MD 병합 상세 로직 (v1.1 신규)

### 4.1 파일명 파싱 규칙

MD 파일명에서 챕터 제목을 추출하는 규칙:

```javascript
// core/md-processor.js — parseFilename()

// 입력 → 출력 변환 규칙
"01_프로젝트개요.md"           → "프로젝트개요"       // 번호 + 언더스코어 제거
"02-아키텍처설계.md"           → "아키텍처설계"       // 번호 + 하이픈 제거
"PHASE_03_API설계.md"          → "API설계"           // PHASE 접두사 + 번호 제거
"CLOUD5_PHASE13_OPS.md"        → "OPS"               // 프로젝트명 + PHASE 제거
"README.md"                    → "README"             // 그대로
"meeting-notes-20260214.md"    → "meeting notes"      // 날짜 제거, 하이픈→공백
"설계문서.md"                  → "설계문서"           // 그대로

// 파싱 순서 (정규식)
const FILENAME_PATTERNS = [
  /^(\d+)[_\-.\s]+/,              // 1. 선행 번호 제거: "01_", "02-", "3."
  /^(PHASE|phase|Phase)[_\-]?\d+[_\-]?/i,  // 2. PHASE 접두사 제거
  /^[A-Z0-9]+[_\-](PHASE|phase)[_\-]?\d+[_\-]?/i, // 3. 프로젝트명_PHASE 제거
  /[_\-]?\d{8}$/,                 // 4. 후행 날짜(YYYYMMDD) 제거
  /\.md$/i,                       // 5. 확장자 제거
];

// 최종 정리
// 언더스코어/하이픈 → 공백
// 연속 공백 → 단일 공백
// 앞뒤 공백 trim
```

### 4.2 정렬 전략

```javascript
// 정렬 옵션 3가지
const SORT_STRATEGIES = {
  
  // 1. 파일명 순 (기본) — 번호 기반 자연 정렬
  "filename": (a, b) => {
    // "01_xxx" vs "02_yyy" → 숫자 기준
    // "10_xxx" vs "2_yyy" → 10 > 2 (자연수 비교)
    // 번호 없으면 → 한글/영어 사전순
    return naturalSort(a.filename, b.filename);
  },
  
  // 2. 수정일 순 — 파일 mtime 기준
  "modified": (a, b) => a.modifiedAt - b.modifiedAt,
  
  // 3. 사용자 커스텀 — 프론트엔드 드래그 순서
  "custom": (files, customOrder) => {
    return customOrder.map(name => files.find(f => f.filename === name));
  }
};
```

### 4.3 헤딩 충돌 해결 (Critical)

**문제**: 각 MD 파일 내부에 이미 `# 제목`이 있고, 파일명도 Heading 1로 추가하면 Heading 1이 중복됨.

```markdown
<!-- 문제 상황 -->
# 프로젝트개요           ← 파일명에서 생성한 Heading 1
# 프로젝트 개요          ← MD 내부의 원래 Heading 1  ← 중복!
## 배경                  ← 원래 Heading 2
```

**해결 전략 3가지** (사용자 선택):

```javascript
const HEADING_STRATEGIES = {

  // Strategy A: "파일명 우선" (기본값)
  // 파일명 → H1, MD 내부 # → H2로 한 단계 강등 (demote)
  "filename-first": {
    fileNameLevel: 1,    // 파일명 = Heading 1
    demoteBy: 1,         // 내부 헤딩 전부 1단계 내림
    // # → ##, ## → ###, ### → ####
    description: "파일명이 챕터 제목, 내부 헤딩은 한 단계씩 내려감"
  },

  // Strategy B: "내부 헤딩 우선"
  // 파일명 Heading 삽입 안 함, MD 내부 # 그대로 유지
  "content-first": {
    fileNameLevel: null,  // 파일명 Heading 없음
    demoteBy: 0,          // 내부 헤딩 그대로
    // 대신 파일 간 수평선(---)으로 구분
    description: "MD 내용 그대로, 파일 간 수평선으로 구분"
  },

  // Strategy C: "스마트 병합"
  // MD 첫 번째 # 이 파일명과 유사하면 중복 제거
  "smart-merge": {
    // "01_프로젝트개요.md" 의 첫 # 이 "프로젝트 개요"이면 → 중복 판단 → 스킵
    // 유사도 체크: Levenshtein distance 또는 공백/특수문자 제거 후 비교
    similarityThreshold: 0.7,
    description: "파일명과 첫 헤딩이 유사하면 중복 제거, 아니면 Strategy A 적용"
  }
};
```

### 4.4 병합 파이프라인 상세

```javascript
// core/md-processor.js — merge()

async function mergeFiles(files, options) {
  const {
    sortOrder = 'filename',
    headingStrategy = 'filename-first',
    pageBreak = true,
    fileOrder = null
  } = options;

  // Step 1: 정렬
  const sorted = sortFiles(files, sortOrder, fileOrder);

  // Step 2: 각 파일 처리
  const chunks = [];
  
  for (const file of sorted) {
    const content = await fs.readFile(file.path, 'utf-8');
    const { data: frontmatter, content: body } = grayMatter(content);
    
    // Step 2a: 파일명에서 챕터 제목 추출
    const chapterTitle = parseFilename(file.filename);
    
    // Step 2b: 헤딩 충돌 해결
    let processedBody;
    switch (headingStrategy) {
      case 'filename-first':
        processedBody = demoteHeadings(body, 1);
        chunks.push(`# ${chapterTitle}\n\n${processedBody}`);
        break;
      case 'content-first':
        chunks.push(body);
        break;
      case 'smart-merge':
        const firstHeading = extractFirstHeading(body);
        if (firstHeading && isSimilar(chapterTitle, firstHeading)) {
          // 중복 → 첫 헤딩 유지, 파일명 제목 스킵
          chunks.push(body);
        } else {
          // 다름 → 파일명 제목 추가 + 강등
          processedBody = demoteHeadings(body, 1);
          chunks.push(`# ${chapterTitle}\n\n${processedBody}`);
        }
        break;
    }
  }

  // Step 3: 페이지 브레이크 삽입
  const separator = pageBreak
    ? '\n\n\\newpage\n\n'    // Pandoc이 인식하는 페이지 브레이크
    : '\n\n---\n\n';         // 수평선 구분

  // Step 4: 메타데이터 YAML 프론트매터 생성
  const frontmatter = [
    '---',
    `title: "${options.title || 'LinkMD Document'}"`,
    `author: "${options.author || 'LinkMD'}"`,
    `date: "${options.date || new Date().toISOString().split('T')[0]}"`,
    '---',
  ].join('\n');

  // Step 5: 최종 통합
  const merged = frontmatter + '\n\n' + chunks.join(separator);
  
  return {
    content: merged,
    stats: {
      inputFiles: files.length,
      totalLines: merged.split('\n').length,
      headings: countHeadings(merged),
      codeBlocks: countCodeBlocks(merged),
      tables: countTables(merged),
      images: countImages(merged)
    }
  };
}
```

### 4.5 헤딩 강등(Demote) 함수

```javascript
function demoteHeadings(markdown, levels = 1) {
  // # → ##, ## → ###, ... (levels만큼)
  // 최대 H6까지만 (######)
  return markdown.replace(/^(#{1,6})\s/gm, (match, hashes) => {
    const newLevel = Math.min(hashes.length + levels, 6);
    return '#'.repeat(newLevel) + ' ';
  });
}
```

### 4.6 유사도 비교 함수

```javascript
function isSimilar(str1, str2, threshold = 0.7) {
  // 정규화: 공백, 특수문자, 숫자 제거 후 소문자
  const normalize = (s) => s.replace(/[\s_\-\d.]/g, '').toLowerCase();
  const a = normalize(str1);
  const b = normalize(str2);
  
  // 완전 포함 체크
  if (a.includes(b) || b.includes(a)) return true;
  
  // Levenshtein 기반 유사도
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const similarity = 1 - (distance / maxLen);
  
  return similarity >= threshold;
}
```

---

## 5. 에러 핸들링 시스템 (v1.1 신규)

### 5.1 에러 분류

```javascript
// core/errors.js

class LinkMDError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// 에러 코드 체계
const ERROR_CODES = {
  // 업로드 관련 (1xxx)
  UPLOAD_NO_FILES:      { code: 1001, msg: '파일이 선택되지 않았습니다.' },
  UPLOAD_INVALID_TYPE:  { code: 1002, msg: '.md 또는 .zip 파일만 업로드 가능합니다.' },
  UPLOAD_TOO_LARGE:     { code: 1003, msg: '파일 크기가 제한을 초과했습니다. (최대 50MB)' },
  UPLOAD_TOO_MANY:      { code: 1004, msg: '파일 수가 제한을 초과했습니다. (최대 100개)' },
  UPLOAD_ZIP_CORRUPT:   { code: 1005, msg: 'ZIP 파일이 손상되었습니다.' },
  UPLOAD_ZIP_NO_MD:     { code: 1006, msg: 'ZIP 내에 .md 파일이 없습니다.' },

  // 파싱 관련 (2xxx)
  PARSE_EMPTY_FILE:     { code: 2001, msg: '빈 MD 파일이 포함되어 있습니다.' },
  PARSE_ENCODING:       { code: 2002, msg: '파일 인코딩을 인식할 수 없습니다. UTF-8을 사용해주세요.' },
  PARSE_BINARY:         { code: 2003, msg: '바이너리 파일이 포함되어 있습니다. MD 파일만 가능합니다.' },

  // 변환 관련 (3xxx)
  CONVERT_PANDOC_FAIL:  { code: 3001, msg: 'Pandoc 변환에 실패했습니다.' },
  CONVERT_TIMEOUT:      { code: 3002, msg: '변환 시간이 초과되었습니다. (30초)' },
  CONVERT_TEMPLATE_404: { code: 3003, msg: '선택한 템플릿을 찾을 수 없습니다.' },
  CONVERT_PDF_ENGINE:   { code: 3004, msg: 'PDF 엔진(wkhtmltopdf)을 찾을 수 없습니다.' },
  CONVERT_OUTPUT_FAIL:  { code: 3005, msg: '출력 파일 생성에 실패했습니다.' },
  CONVERT_IMAGE_BROKEN: { code: 3006, msg: '이미지 경로가 깨져있습니다. (무시하고 계속 변환)' },

  // 다운로드 관련 (4xxx)
  DOWNLOAD_NOT_FOUND:   { code: 4001, msg: '파일을 찾을 수 없습니다. 만료되었을 수 있습니다.' },
  DOWNLOAD_EXPIRED:     { code: 4002, msg: '파일이 만료되었습니다. 다시 변환해주세요.' },

  // 역변환 관련 (5xxx)
  REVERSE_INVALID_TYPE: { code: 5001, msg: '.docx 또는 .pdf 파일만 역변환 가능합니다.' },
  REVERSE_PANDOC_FAIL:  { code: 5002, msg: '역변환에 실패했습니다.' },

  // 서버 관련 (9xxx)
  SERVER_DISK_FULL:     { code: 9001, msg: '서버 저장 공간이 부족합니다.' },
  SERVER_PANDOC_404:    { code: 9002, msg: 'Pandoc이 설치되어 있지 않습니다.' },
};
```

### 5.2 Pandoc 에러 파싱

```javascript
// core/pandoc-engine.js — parsePandocError()

function parsePandocError(stderr) {
  const errorMap = [
    {
      pattern: /Could not find image/i,
      code: 'CONVERT_IMAGE_BROKEN',
      recoverable: true,    // 이미지 스킵하고 계속 변환
      userMsg: '일부 이미지를 찾을 수 없어 건너뛰었습니다.'
    },
    {
      pattern: /Unknown extension/i,
      code: 'CONVERT_PANDOC_FAIL',
      recoverable: false,
      userMsg: '지원하지 않는 Markdown 문법이 포함되어 있습니다.'
    },
    {
      pattern: /openBinaryFile: does not exist/i,
      code: 'CONVERT_TEMPLATE_404',
      recoverable: false,
      userMsg: '스타일 템플릿 파일을 찾을 수 없습니다.'
    },
    {
      pattern: /pdflatex not found|wkhtmltopdf not found/i,
      code: 'CONVERT_PDF_ENGINE',
      recoverable: false,
      userMsg: 'PDF 변환 엔진이 서버에 설치되어 있지 않습니다.'
    },
    {
      pattern: /UTF-8|encoding/i,
      code: 'PARSE_ENCODING',
      recoverable: false,
      userMsg: '파일 인코딩 오류입니다. UTF-8로 저장 후 다시 시도해주세요.'
    }
  ];

  for (const { pattern, code, recoverable, userMsg } of errorMap) {
    if (pattern.test(stderr)) {
      return { code, recoverable, userMsg, raw: stderr };
    }
  }

  return {
    code: 'CONVERT_PANDOC_FAIL',
    recoverable: false,
    userMsg: '변환 중 알 수 없는 오류가 발생했습니다.',
    raw: stderr
  };
}
```

### 5.3 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "code": 3001,
    "message": "Pandoc 변환에 실패했습니다.",
    "details": "지원하지 않는 Markdown 문법이 포함되어 있습니다.",
    "recoverable": false,
    "suggestion": "문제가 되는 MD 파일을 확인하고 특수 문법을 제거해주세요.",
    "file": "03_API설계.md",
    "line": 45
  }
}
```

### 5.4 복구 가능한 에러 처리

```javascript
// 이미지 깨짐 같은 복구 가능한 에러는 경고로 처리하고 변환 계속
{
  "success": true,
  "warnings": [
    {
      "code": 3006,
      "message": "2개 이미지 경로가 깨져있어 건너뛰었습니다.",
      "files": ["./images/diagram1.png", "./assets/screenshot.png"]
    }
  ],
  "downloadUrl": "/api/download/abc123",
  "stats": { ... }
}
```

---

## 6. 프론트엔드 UI/UX 설계 (v1.1 전면 개편)

### 6.1 디자인 방향: HackMD 참조

Cloud5가 Render의 UI를 참조한 것처럼, LinkMD는 **HackMD의 워크스페이스 UI**를 참조한다.

**참조 포인트:**
- 좌측 사이드바 (폴더/태그/필터) + 우측 카드 그리드
- 깔끔한 카드 UI (제목 + 날짜 + 상태 아이콘)
- 태그 기반 분류
- 보라색 계열 포인트 컬러 → LinkMD 브랜드 컬러로 변형

**차별화 포인트:**
- HackMD = "노트 편집기" → LinkMD = **"변환 허브"**
- 카드 클릭 시 MD 편집이 아니라 **변환 설정 패널** 열림
- 상단에 드래그앤드롭 업로드 존
- "Convert" 버튼이 핵심 CTA

### 6.2 브랜드 컬러 시스템

```css
:root {
  /* Primary — 딥 인디고 (HackMD 보라색에서 영감, 더 비즈니스적으로) */
  --color-primary-50:  #EEF2FF;
  --color-primary-100: #E0E7FF;
  --color-primary-200: #C7D2FE;
  --color-primary-400: #818CF8;
  --color-primary-500: #6366F1;  /* 메인 브랜드 컬러 */
  --color-primary-600: #4F46E5;
  --color-primary-700: #4338CA;
  --color-primary-900: #312E81;

  /* Neutral */
  --color-gray-50:  #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* Accent */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error:   #EF4444;
  --color-info:    #3B82F6;

  /* Semantic */
  --color-docx:  #2B579A;   /* Word 파란색 */
  --color-pdf:   #FF0000;   /* PDF 빨간색 */
  --color-pptx:  #D24726;   /* PPT 오렌지 */
  --color-html:  #E44D26;   /* HTML 오렌지 */
  --color-md:    #083FA1;   /* MD 파란색 */
}
```

### 6.3 화면 레이아웃 (HackMD 스타일)

```
┌──────────────────────────────────────────────────────────────────┐
│  🔗 LinkMD                                    [문서→MD] [로그인]│
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  SIDEBAR   │  MY WORKSPACE                          [Grid][List]│
│            │                                                     │
│  📁 My     │  ┌─ Upload Zone ────────────────────────────────┐  │
│  Documents │  │                                              │  │
│   📂 Cloud5│  │   📁 MD 파일을 드래그하거나 클릭하세요       │  │
│   📂 LinkMD│  │       .md 여러 개 또는 .zip                  │  │
│   📂 기타  │  │                                              │  │
│            │  └──────────────────────────────────────────────┘  │
│  🏷️ Tags   │                                                     │
│   Phase별  │  ┌─ 문서 카드 그리드 ───────────────────────────┐  │
│   프로젝트별│  │                                              │  │
│   날짜별   │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│            │  │  │📄 01_    │  │📄 02_    │  │📄 03_    │   │  │
│  ⚙️ Settings│  │  │프로젝트  │  │아키텍처  │  │API설계   │   │  │
│            │  │  │개요      │  │설계      │  │          │   │  │
│  🔄 Convert│  │  │          │  │          │  │          │   │  │
│  History   │  │  │ H:5 C:3  │  │ H:8 C:7  │  │ H:4 C:2  │   │  │
│            │  │  │ 2.0KB    │  │ 3.5KB    │  │ 1.8KB    │   │  │
│  🗑️ Trash  │  │  │ 2026-02  │  │ 2026-02  │  │ 2026-02  │   │  │
│            │  │  └──────────┘  └──────────┘  └──────────┘   │  │
│            │  │                                              │  │
│            │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│            │  │  │📄 04_    │  │📄 05_    │  │📄 ...    │   │  │
│            │  │  │DB설계    │  │테스트    │  │          │   │  │
│            │  │  │          │  │          │  │          │   │  │
│            │  │  └──────────┘  └──────────┘  └──────────┘   │  │
│            │  │                                              │  │
│            │  └──────────────────────────────────────────────┘  │
│            │                                                     │
│            │  ┌─ 하단 액션 바 ───────────────────────────────┐  │
│            │  │  ☑ 16개 선택 │ 스타일:[비즈니스▼] 포맷:[DOCX▼]│  │
│            │  │                                              │  │
│            │  │           [ 🔄 변환하기 (16 파일) ]           │  │
│            │  └──────────────────────────────────────────────┘  │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### 6.4 카드 컴포넌트 상세

```
┌────────────────────────┐
│  📄  👁️                │   ← 문서 아이콘 + 미리보기 버튼
│                        │
│  프로젝트개요           │   ← 파싱된 챕터 제목 (파일명에서 추출)
│                        │
│  H:5  C:3  T:1         │   ← Headings, Code blocks, Tables 카운트
│  2.0 KB                │   ← 파일 크기
│  2026-02-14            │   ← 수정일
│                        │
│  [☑ 선택]              │   ← 변환 대상 선택 체크박스
└────────────────────────┘
```

**카드 상태:**
- 기본: 흰 배경 + 회색 보더
- 선택됨: `--color-primary-50` 배경 + `--color-primary-500` 보더
- 호버: 그림자 + 약간 위로 이동 (translateY -2px)
- 드래그 중: 반투명 + 드롭 위치 표시

### 6.5 변환 설정 패널 (슬라이드업)

"변환하기" 버튼 클릭 시 하단에서 슬라이드업되는 설정 패널:

```
┌──────────────────────────────────────────────────────────────┐
│  변환 설정                                            [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  출력 포맷                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                    │
│  │ DOCX │  │ PDF  │  │ PPTX │  │ HTML │                    │
│  │  📘  │  │  📕  │  │  📙  │  │  🌐  │                    │
│  │ (선택)│  │      │  │      │  │      │                    │
│  └──────┘  └──────┘  └──────┘  └──────┘                    │
│                                                              │
│  스타일 프리셋                                               │
│  ○ 비즈니스 보고서  ● 기술 문서  ○ 심플  ○ 공공기관        │
│                                                              │
│  ┌─ 상세 설정 ──────────────────────────────────────────┐   │
│  │  문서 제목: [Cloud5 개발 문서                      ]  │   │
│  │  작성자:    [Jessy / MuseAI                        ]  │   │
│  │  날짜:      [2026-02-14                            ]  │   │
│  │                                                       │   │
│  │  헤딩 전략: [● 파일명 우선  ○ 내용 우선  ○ 스마트]   │   │
│  │                                                       │   │
│  │  ☑ 목차 자동 생성    ☑ 파일 간 페이지 분리           │   │
│  │  ☑ 코드 하이라이팅    ☐ 표지 페이지 포함             │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│              [ 🔄 변환 시작 ]    [ 취소 ]                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.6 프론트엔드 상태 관리 (v1.1 신규)

Vanilla JS에서 복잡한 UI 상태를 관리하기 위한 간단한 Store 패턴:

```javascript
// public/js/app-state.js

class AppState {
  constructor() {
    this.state = {
      // 앱 상태
      view: 'workspace',        // 'workspace' | 'preview' | 'converting' | 'result'
      
      // 세션
      sessionId: null,
      
      // 업로드된 파일 목록
      files: [],                // [{ filename, size, headings, codeBlocks, tables, selected }]
      
      // 선택 상태
      selectedFiles: new Set(), // 변환 대상으로 선택된 파일명
      selectAll: false,
      
      // 정렬/순서
      sortOrder: 'filename',    // 'filename' | 'modified' | 'custom'
      customOrder: [],          // 사용자 드래그 순서
      
      // 변환 설정
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
      
      // 변환 결과
      result: null,             // { downloadUrl, filename, stats }
      warnings: [],
      
      // UI 상태
      settingsOpen: false,
      previewFile: null,        // 미리보기 중인 파일
      dragTarget: null,         // 드래그 중 타겟
      
      // 에러
      error: null,
      
      // 로딩
      loading: {
        upload: false,
        convert: false,
        preview: false
      }
    };
    
    this.listeners = new Map();
  }

  // 상태 업데이트 + 리렌더링
  setState(path, value) {
    setNestedValue(this.state, path, value);
    this.notify(path);
  }

  // 특정 상태 변경 구독
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(callback);
  }

  // 구독자 알림
  notify(path) {
    // 정확한 경로 + 상위 경로 모두 알림
    for (const [key, callbacks] of this.listeners) {
      if (path.startsWith(key) || key.startsWith(path)) {
        callbacks.forEach(cb => cb(this.state));
      }
    }
  }
}

// 전역 상태 인스턴스
const store = new AppState();

// 사용 예시:
// store.subscribe('files', (state) => renderFileCards(state.files));
// store.subscribe('loading.convert', (state) => toggleSpinner(state.loading.convert));
// store.setState('convertSettings.template', 'technical-doc');
```

### 6.7 UI 컴포넌트 매핑

```javascript
// public/js/app.js — 각 컴포넌트와 상태 연결

document.addEventListener('DOMContentLoaded', () => {
  
  // 파일 카드 그리드 — files 변경 시 리렌더
  store.subscribe('files', renderFileCards);
  store.subscribe('selectedFiles', renderFileCards);
  
  // 업로드 존 — loading.upload 변경 시
  store.subscribe('loading.upload', renderUploadZone);
  
  // 변환 설정 패널 — settingsOpen 변경 시
  store.subscribe('settingsOpen', toggleSettingsPanel);
  store.subscribe('convertSettings', renderSettingsForm);
  
  // 하단 액션 바 — selectedFiles 변경 시
  store.subscribe('selectedFiles', renderActionBar);
  
  // 결과 영역 — result 변경 시
  store.subscribe('result', renderResult);
  
  // 에러 토스트 — error 변경 시
  store.subscribe('error', showErrorToast);
  
  // 로딩 오버레이 — loading.convert 변경 시
  store.subscribe('loading.convert', toggleConvertOverlay);
  
  // 사이드바 — view 변경 시
  store.subscribe('view', renderSidebar);
});
```

---

## 7. DeployMe(Cloud5) 연동 설계 (v1.1 신규)

### 7.1 연동 아키텍처

```
┌──────────────┐     Webhook      ┌──────────────┐
│              │  ──────────────>  │              │
│   Cloud5     │   deploy.success │   LinkMD     │
│  (DeployMe)  │   deploy.fail    │              │
│              │                   │              │
│  배포 완료 시│                   │  Webhook 수신│
│  POST 전송   │                   │  → MD 수집   │
│              │  <──────────────  │  → 자동 변환 │
│              │   문서 링크 반환  │  → 결과 전송 │
└──────────────┘                   └──────────────┘
```

### 7.2 Cloud5 Webhook 이벤트

```javascript
// Cloud5에서 LinkMD로 보내는 Webhook Payload
{
  "event": "deploy.success",           // 이벤트 타입
  "timestamp": "2026-02-14T09:30:00Z",
  "app": {
    "name": "my-express-app",
    "repository": "https://github.com/user/my-express-app",
    "branch": "main",
    "commitHash": "a1b2c3d",
    "commitMessage": "feat: add user authentication",
    "deployUrl": "https://my-express-app.deployme.socialbrain.co.kr"
  },
  "deploy": {
    "id": "deploy-xyz-123",
    "status": "success",
    "duration": "45s",
    "buildLog": "...",                  // 빌드 로그 (요약)
    "nixpacksDetected": "node-20"       // 감지된 런타임
  },
  "linkmd": {
    "autoGenerate": true,               // 자동 문서 생성 활성화 여부
    "template": "technical-doc",         // 사용할 템플릿
    "notifyEmail": "jessy@museai.co.kr"  // 결과 전송 이메일
  }
}
```

### 7.3 자동 문서 생성 파이프라인

```
[Cloud5 배포 성공]
    │
    ▼
[LinkMD Webhook 수신]
    │
    ▼
[GitHub 리포지토리에서 MD 수집]
    │ • README.md
    │ • docs/ 폴더 전체
    │ • CHANGELOG.md
    │ • API 관련 MD
    ▼
[자동 생성 MD 추가]
    │ • 배포 정보 요약 (앱명, URL, 빌드 시간, 런타임)
    │ • 최근 커밋 이력
    │ • 환경 변수 목록 (값 제외, 키만)
    ▼
[MD 병합 + 변환]
    │ • template: technical-doc
    │ • 자동 목차 생성
    ▼
[결과 전달]
    │ • 이메일로 docx 첨부 전송
    │ • Cloud5 대시보드에 문서 링크 표시
    │ • Slack 알림 (선택)
    ▼
[완료]
```

### 7.4 자동 생성 문서 구조

```markdown
# [앱명] 배포 문서

## 1. 배포 정보
- 배포 URL: https://xxx.deployme.socialbrain.co.kr
- 배포 일시: 2026-02-14 09:30 KST
- 빌드 시간: 45초
- 런타임: Node.js 20 (Nixpacks 자동 감지)
- 브랜치: main
- 커밋: a1b2c3d — "feat: add user authentication"

## 2. 프로젝트 개요
<!-- README.md 내용 자동 삽입 -->

## 3. API 문서
<!-- docs/ 폴더 MD 자동 삽입 -->

## 4. 변경 이력
<!-- CHANGELOG.md 또는 최근 10개 커밋 -->

## 5. 환경 설정
<!-- 환경 변수 키 목록 (값 제외) -->
```

---

## 8. 데이터 흐름 (Pipeline)

### 8.1 정방향: MD → 문서 변환

```
[사용자 입력]
    │
    ▼
┌─────────────────────────────────────┐
│ STEP 1: UPLOAD & EXTRACT            │
│                                      │
│ • 복수 .md 파일 또는 .zip 업로드     │
│ • zip인 경우 압축 해제               │
│ • .md 파일만 필터링                  │
│ • 파일 유효성 검증                   │
│   - 크기 체크 (개별 10MB, 전체 50MB) │
│   - 인코딩 체크 (UTF-8)             │
│   - 바이너리 파일 거부               │
│ • /uploads/{sessionId}/ 에 저장      │
│ • ⚠️ 에러: 1001~1006                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ STEP 2: PARSE & ANALYZE             │
│                                      │
│ • 각 MD 파일 메타데이터 추출         │
│   - 파일명 파싱 (§4.1 규칙 적용)    │
│   - 첫 번째 # 헤딩 (→ 챕터 제목)    │
│   - 헤딩 구조 트리                   │
│   - 코드블록/테이블/이미지 카운트    │
│ • YAML 프론트매터 파싱 (있으면)      │
│ • 빈 파일 경고 (2001)               │
│ • 전체 통계 계산                     │
│ • 프리뷰 데이터 생성 → 클라이언트    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ STEP 3: SORT & MERGE (§4 상세)      │
│                                      │
│ • 정렬 (§4.2)                        │
│ • 파일명 파싱 (§4.1)                 │
│ • 헤딩 충돌 해결 (§4.3)             │
│ • 페이지 브레이크 삽입               │
│ • YAML 프론트매터 생성               │
│ • 단일 통합 MD 생성                  │
│   → /workspace/{sessionId}/merged.md │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ STEP 4: CONVERT (Pandoc Engine)      │
│                                      │
│ • 출력 포맷 + 템플릿 선택            │
│ • Pandoc CLI 실행 (timeout: 30s)     │
│ • 에러 파싱 (§5.2)                   │
│ • 복구 가능 에러 → warnings 수집     │
│ • 복구 불가 에러 → 즉시 반환         │
│   → /output/{sessionId}/result.docx  │
│ • ⚠️ 에러: 3001~3006                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ STEP 5: POST-PROCESS & DELIVER      │
│                                      │
│ • 결과 파일 검증 (크기 > 0)          │
│ • 변환 통계 생성                     │
│ • 다운로드 링크 생성                 │
│ • warnings 포함하여 응답             │
│ • 30분 후 자동 정리 스케줄 등록      │
└─────────────────────────────────────┘
```

### 8.2 역방향: 문서 → MD 변환

```
[DOCX/PDF 업로드]
    │
    ▼
┌─────────────────────────────────────┐
│ • 파일 유효성 검증                   │
│ • Pandoc 역변환 실행                 │
│   pandoc input.docx -o output.md     │
│     --extract-media=./media          │
│     --wrap=none                      │
│ • 이미지 자동 추출 → /media 폴더    │
│ • 결과: .md + media 폴더 → zip      │
│ • ⚠️ 에러: 5001~5002                 │
└─────────────────────────────────────┘
```

---

## 9. 기술 스택

### 9.1 핵심 기술

| 구분 | 기술 | 역할 | 선택 이유 |
|------|------|------|-----------|
| **변환 엔진** | Pandoc 3.x | MD↔DOCX/PPTX/PDF/HTML | Cloud5의 Dokploy처럼 검증된 오픈소스 엔진 |
| **Backend** | Node.js + Express | API 서버 | Cloud5와 동일 스택, 빠른 개발 |
| **Frontend** | HTML + Vanilla JS | 웹 UI | HackMD 스타일 워크스페이스 |
| **파일 업로드** | multer | 멀티파일 업로드 | Node.js 표준 |
| **압축** | adm-zip | ZIP 처리 | 경량 + 순수 JS |
| **MD 파싱** | marked + gray-matter | 프리뷰 + 프론트매터 | Pandoc 보조용 |
| **프로세스** | child_process | Pandoc CLI 실행 | Node.js 내장 |
| **스케줄러** | node-cron | 임시 파일 자동 삭제 | 경량 |
| **유사도** | string-similarity | 헤딩 충돌 스마트 병합 | Levenshtein |

### 9.2 서버 의존성

```bash
# 필수
sudo apt-get install pandoc          # 핵심 변환 엔진
sudo apt-get install wkhtmltopdf     # PDF 변환
# 선택
sudo apt-get install texlive-xetex   # 고품질 PDF (한글 지원)
```

### 9.3 Node.js 의존성

```json
{
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

---

## 10. 폴더 구조

```
linkmd/
│
├── server.js                    # Express 메인 서버
├── package.json
├── .env
│
├── core/                        # 핵심 엔진 레이어
│   ├── md-processor.js          # MD 파싱/분석/병합 (§4 전체)
│   ├── pandoc-engine.js         # Pandoc CLI 래퍼 + 에러 파싱 (§5.2)
│   ├── template-manager.js      # 스타일 템플릿 관리
│   ├── file-manager.js          # 업로드/다운로드/정리
│   ├── stats-generator.js       # 변환 통계 생성
│   └── errors.js                # 에러 코드 정의 (§5.1)
│
├── routes/                      # API 라우트
│   ├── convert.js               # POST /api/convert
│   ├── upload.js                # POST /api/upload
│   ├── preview.js               # POST /api/preview
│   ├── download.js              # GET  /api/download/:id
│   ├── reverse.js               # POST /api/reverse
│   └── templates.js             # GET  /api/templates
│
├── middleware/                   # 미들웨어
│   ├── error-handler.js         # 글로벌 에러 핸들러 (§5)
│   └── upload-validator.js      # 업로드 유효성 검증
│
├── templates/                   # Pandoc reference 템플릿 (§3)
│   ├── docx/
│   │   ├── business-report.docx # 비즈니스 보고서 (§3.3-①)
│   │   ├── technical-doc.docx   # 기술 문서 (§3.3-②)
│   │   ├── simple-clean.docx    # 심플 (§3.3-③)
│   │   └── government-report.docx # 공공기관 (§3.3-④)
│   ├── pptx/
│   │   └── default-slide.pptx
│   └── css/
│       └── html-export.css
│
├── public/                      # 프론트엔드 (§6)
│   ├── index.html               # 메인 UI
│   ├── css/
│   │   ├── variables.css        # 컬러/폰트 변수 (§6.2)
│   │   ├── layout.css           # 사이드바 + 메인 레이아웃
│   │   ├── cards.css            # 파일 카드 스타일 (§6.4)
│   │   ├── settings.css         # 변환 설정 패널 (§6.5)
│   │   └── animations.css       # 트랜지션/애니메이션
│   └── js/
│       ├── app-state.js         # 상태 관리 Store (§6.6)
│       ├── app.js               # 메인 앱 + 컴포넌트 바인딩 (§6.7)
│       ├── upload.js            # 드래그앤드롭 + 파일 관리
│       ├── cards.js             # 카드 렌더링 + 드래그 순서
│       ├── preview.js           # MD 미리보기 렌더링
│       ├── settings.js          # 변환 옵션 설정 패널
│       ├── convert.js           # 변환 API 호출 + 결과 처리
│       └── sidebar.js           # 사이드바 (폴더/태그)
│
├── storage/                     # 런타임 스토리지 (자동 생성)
│   ├── uploads/
│   ├── workspace/
│   └── output/
│
└── scripts/
    ├── create-templates.js      # reference.docx 초기 생성 스크립트
    └── cleanup.js               # 수동 정리 스크립트
```

---

## 11. API 설계

### 11.1 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 프론트엔드 UI |
| POST | `/api/upload` | MD/ZIP 파일 업로드 |
| POST | `/api/preview` | 업로드된 MD 미리보기 |
| POST | `/api/convert` | 변환 실행 |
| GET | `/api/download/:sessionId` | 결과물 다운로드 |
| POST | `/api/reverse` | 역변환 (DOCX→MD) |
| GET | `/api/templates` | 스타일 템플릿 목록 |
| POST | `/api/webhook/deploy` | Cloud5 Webhook 수신 (Phase 5) |
| GET | `/api/health` | 서버 상태 |

### 11.2 POST /api/upload — 응답

```json
{
  "success": true,
  "sessionId": "a1b2c3d4-e5f6-...",
  "files": [
    {
      "filename": "01_프로젝트개요.md",
      "size": 2048,
      "parsedTitle": "프로젝트개요",
      "firstHeading": "프로젝트 개요",
      "headingCount": 5,
      "codeBlockCount": 3,
      "tableCount": 1,
      "imageCount": 2,
      "lineCount": 120,
      "hasFrontmatter": false,
      "encoding": "utf-8"
    }
  ],
  "totalFiles": 16,
  "totalSize": 45056
}
```

### 11.3 POST /api/convert — 요청

```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
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
    "highlightStyle": "tango",
    "coverPage": false,
    "sortOrder": "filename",
    "fileOrder": null,
    "selectedFiles": ["01_개요.md", "02_설계.md", "03_API.md"]
  }
}
```

### 11.4 POST /api/convert — 응답 (성공 + 경고)

```json
{
  "success": true,
  "sessionId": "a1b2c3d4-e5f6-...",
  "downloadUrl": "/api/download/a1b2c3d4-e5f6-...",
  "filename": "Cloud5_개발문서_20260214.docx",
  "outputFormat": "docx",
  "warnings": [
    {
      "code": 3006,
      "message": "2개 이미지 경로가 깨져있어 건너뛰었습니다.",
      "files": ["./images/diagram1.png"]
    }
  ],
  "stats": {
    "inputFiles": 16,
    "selectedFiles": 16,
    "mergedLines": 1850,
    "outputSize": 125440,
    "headings": 48,
    "codeBlocks": 34,
    "tables": 12,
    "images": 3,
    "estimatedPages": 42,
    "conversionTime": "2.3s",
    "template": "business-report",
    "headingStrategy": "filename-first"
  }
}
```

---

## 12. Phase 로드맵

### Phase 1: MVP — Core Engine (이번 작업)
| # | 작업 | 우선순위 | 참조 섹션 |
|---|------|---------|-----------|
| 1 | Express 서버 + 폴더 구조 세팅 | 🔴 | §10 |
| 2 | 에러 코드 + 핸들러 구현 | 🔴 | §5 |
| 3 | 파일 업로드 (복수 MD + ZIP) + 유효성 검증 | 🔴 | §8.1 Step1 |
| 4 | MD 파싱 + 파일명 파싱 + 통계 | 🔴 | §4.1, §8.1 Step2 |
| 5 | MD 병합 (정렬 + 헤딩 충돌 해결 + 페이지브레이크) | 🔴 | §4 전체 |
| 6 | Pandoc 엔진 래퍼 + 에러 파싱 | 🔴 | §2.3, §5.2 |
| 7 | reference.docx 템플릿 4종 생성 | 🔴 | §3 전체 |
| 8 | DOCX 변환 + 다운로드 API | 🔴 | §11 |
| 9 | 프론트엔드 UI (HackMD 스타일 워크스페이스) | 🔴 | §6 전체 |
| 10 | 상태 관리 (AppState) | 🔴 | §6.6 |
| 11 | 파일 카드 + 드래그 순서 변경 | 🟡 | §6.4 |
| 12 | 변환 설정 슬라이드업 패널 | 🟡 | §6.5 |
| 13 | PDF/HTML 출력 지원 | 🟡 | |
| 14 | 역변환 (DOCX→MD) | 🟡 | §8.2 |
| 15 | 임시 파일 자동 정리 (cron) | 🟡 | |
| 16 | 반응형 디자인 | 🟢 | |

### Phase 2: Polish & Deploy
| # | 작업 |
|---|------|
| 1 | PPTX 출력 지원 |
| 2 | Cloud5(DeployMe)에 자동 배포 |
| 3 | 도메인 연결 (linkmd.socialbrain.co.kr) |
| 4 | Google OAuth 로그인 |
| 5 | 변환 이력 저장 (DB) |
| 6 | 랜딩 페이지 |

### Phase 3: AI Layer
| # | 작업 |
|---|------|
| 1 | Claude API 연동 — MD 구조 분석/재구조화 제안 |
| 2 | AI 자동 목차 생성 |
| 3 | 중복 제거 + 연관 관계 분석 |
| 4 | AI Knowledge Pack 생성 (토큰 최적화 압축) |
| 5 | 자연어 명령 ("보고서 스타일로 변환해줘") |

### Phase 4: Integration & Enterprise
| # | 작업 |
|---|------|
| 1 | Notion API 연동 (One-Click Notion Sink) |
| 2 | Slack 연동 (변환 결과 자동 전송) |
| 3 | GitHub 연동 (리포지토리 MD 직접 가져오기) |
| 4 | 기업 커스텀 템플릿 업로드 |
| 5 | hwp 변환 지원 |
| 6 | 팀 워크스페이스 + 권한 관리 |
| 7 | SaaS 과금 시스템 |

### Phase 5: DeployMe + LinkMD 패키지
| # | 작업 | 참조 |
|---|------|------|
| 1 | Cloud5 Webhook 수신 엔드포인트 | §7.2 |
| 2 | GitHub MD 자동 수집 파이프라인 | §7.3 |
| 3 | 배포 이벤트 → 기술 문서 자동 생성 | §7.4 |
| 4 | 이메일/Slack 자동 전송 | §7.3 |
| 5 | Cloud5 대시보드에 문서 링크 표시 | |
| 6 | "개발부터 문서화까지 끊김 없는 AX 자동화" 패키지 상품화 | |

---

## 13. 수익 모델

| 모델 | 대상 | 가격 | 핵심 기능 |
|------|------|------|-----------|
| **Free** | 개인 개발자 | 무료 | MD 병합 + DOCX 변환 (3종 템플릿) |
| **Pro** | 프리랜서/1인 기업 | $15/월 | 무제한 변환 + PDF/PPTX + 역변환 + Notion 연동 |
| **Team** | 스타트업/팀 | $49/월 | 팀 워크스페이스 + 커스텀 템플릿 + AI 구조화 |
| **Enterprise** | AX 도입 기업 | 별도 협의 | 온프레미스 + 기업 양식 매핑 + DeployMe 패키지 |

---

## 14. 성공 지표 (KPI)

| 지표 | Phase 1 목표 | Phase 4 목표 |
|------|-------------|-------------|
| 변환 성공률 | 95% | 99.5% |
| 평균 변환 시간 | < 5초 (16파일) | < 3초 |
| 지원 포맷 | docx, pdf, html | docx, pptx, pdf, html, hwp, notion |
| 동시 접속 | 5명 | 100명 |
| 월 변환 건수 | 100건 | 10,000건 |

---

## 부록 A: Pandoc 명령어 레퍼런스

```bash
# 기본 변환
pandoc input.md -o output.docx

# 스타일 템플릿 적용
pandoc input.md -o output.docx --reference-doc=templates/docx/business-report.docx

# 복수 파일 + 목차
pandoc 01.md 02.md 03.md -o output.docx \
  --reference-doc=template.docx \
  --toc --toc-depth=3

# 메타데이터 주입
pandoc input.md -o output.docx \
  --metadata title="문서 제목" \
  --metadata author="작성자" \
  --metadata date="2026-02-14"

# 코드 하이라이팅 스타일
pandoc input.md -o output.docx --highlight-style=tango

# PDF (wkhtmltopdf)
pandoc input.md -o output.pdf --pdf-engine=wkhtmltopdf

# HTML (standalone)
pandoc input.md -o output.html --standalone --css=style.css --toc

# PPTX
pandoc input.md -o output.pptx --reference-doc=template.pptx

# 역변환: DOCX → MD
pandoc input.docx -o output.md --extract-media=./media --wrap=none
```

## 부록 B: Node.js Pandoc 래퍼 핵심 구조

```javascript
// core/pandoc-engine.js
const { execFile } = require('child_process');

class PandocEngine {
  convert(inputFiles, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const args = [...inputFiles, '-o', outputPath];

      if (options.template) args.push('--reference-doc', options.template);
      if (options.toc) args.push('--toc', '--toc-depth', String(options.tocDepth || 3));
      if (options.title) args.push('--metadata', `title=${options.title}`);
      if (options.author) args.push('--metadata', `author=${options.author}`);
      if (options.date) args.push('--metadata', `date=${options.date}`);
      if (options.highlightStyle) args.push('--highlight-style', options.highlightStyle);
      if (outputPath.endsWith('.pdf')) args.push('--pdf-engine', options.pdfEngine || 'wkhtmltopdf');
      if (outputPath.endsWith('.html')) {
        args.push('--standalone');
        if (options.css) args.push('--css', options.css);
      }

      execFile('pandoc', args, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          const parsed = this.parsePandocError(stderr);
          if (parsed.recoverable) {
            resolve({ outputPath, warnings: [parsed] });
          } else {
            reject(new LinkMDError(parsed.code, parsed.userMsg, { raw: stderr }));
          }
        } else {
          resolve({ outputPath, warnings: [] });
        }
      });
    });
  }
}
```

---

> **이 문서는 LinkMD의 기초 설계서 v1.1입니다.**
> v1.0 대비 추가된 섹션: §3(템플릿 스펙), §4(병합 로직), §5(에러), §6(UI/UX), §7(DeployMe 연동)
> 모든 Phase별 개발 MD는 이 아키텍처를 기반으로 작성됩니다.
