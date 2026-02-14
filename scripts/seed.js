'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const DB = require('../core/database');
const ArchiveEngine = require('../core/archive-engine');

const PROJECTS = [
  { name: 'Cloud5', description: 'Dokploy 기반 자동 배포 시스템', color: '#3B82F6', icon: '☁️' },
  { name: 'LinkMD', description: 'MD 지식 아카이브 서비스', color: '#6366F1', icon: '🔗' },
  { name: 'KDCA 챗봇', description: '질병관리청 AI 챗봇', color: '#10B981', icon: '🤖' },
];

const DOCS = {
  'Cloud5': [
    { filename: '01_프로젝트개요.md', content: `# Cloud5 프로젝트 개요

## 프로젝트 목적

Cloud5는 Dokploy 기반의 자동 배포 시스템입니다.
GitHub 리포지토리를 연결하면 push 시 자동으로 빌드하고 배포합니다.

## 기술 스택

| 구분 | 기술 | 역할 |
|------|------|------|
| 호스팅 | Hetzner | 서버 인프라 |
| 배포 | Dokploy | 자동 배포 |
| 프록시 | Nginx | 리버스 프록시 |
| SSL | Let's Encrypt | 인증서 |

## 주요 기능

- 자동 배포 파이프라인
- SSL 자동 발급
- 도메인 관리
- 모니터링 대시보드

\`\`\`bash
git push origin main
# → Dokploy 자동 감지 → 빌드 → 배포
\`\`\`
` },
    { filename: '02_아키텍처설계.md', content: `# 시스템 아키텍처

## 전체 구조

Cloud5는 마이크로서비스 아키텍처를 따릅니다.

### 서비스 구성

\`\`\`
┌─────────┐  ┌─────────┐  ┌─────────┐
│  Web UI │  │   API   │  │  Worker │
└────┬────┘  └────┬────┘  └────┬────┘
     └──────── Gateway ──────────┘
\`\`\`

## 배포 프로세스

\`\`\`javascript
const deploy = async (repo) => {
  await build(repo);
  await test(repo);
  await push(repo);
  console.log('Deployed successfully');
};
\`\`\`

## 모니터링

| 메트릭 | 도구 |
|--------|------|
| CPU/Memory | Grafana |
| Logs | Loki |
| Alerts | Alertmanager |

### 알림 설정

배포 실패 시 Slack으로 알림이 전송됩니다.
` },
    { filename: '03_API설계.md', content: `# API 설계

## REST API 엔드포인트

### 인증

\`\`\`javascript
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
  res.json({ token, user });
});
\`\`\`

### 프로젝트 관리

\`\`\`
GET    /api/projects        — 프로젝트 목록
POST   /api/projects        — 프로젝트 생성
PUT    /api/projects/:id    — 프로젝트 수정
DELETE /api/projects/:id    — 프로젝트 삭제
\`\`\`

## 에러 처리

| 코드 | 의미 |
|------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

## 배포 API

배포 관련 API는 WebSocket을 통해 실시간 로그를 전송합니다.

\`\`\`javascript
ws.on('deploy-log', (data) => {
  console.log(data.message);
});
\`\`\`
` },
    { filename: '04_배포가이드.md', content: `# 배포 가이드

## 사전 준비

1. Docker 설치
2. Dokploy 계정 생성
3. GitHub 리포지토리 연결

## 배포 절차

### 1단계: 환경 설정

\`\`\`bash
# .env 파일 설정
cp .env.example .env
nano .env
\`\`\`

### 2단계: 빌드

\`\`\`bash
docker build -t cloud5-app .
docker push registry/cloud5-app:latest
\`\`\`

### 3단계: 배포 실행

\`\`\`bash
dokploy deploy --project cloud5 --branch main
\`\`\`

## 롤백

문제 발생 시 이전 버전으로 롤백:

\`\`\`bash
dokploy rollback --project cloud5 --version v1.2.3
\`\`\`

## 모니터링 확인

배포 후 반드시 확인할 사항:
- 헬스체크 응답
- 에러 로그
- CPU/Memory 사용량
` },
    { filename: '05_테스트전략.md', content: `# 테스트 전략

## 테스트 피라미드

### 단위 테스트

\`\`\`javascript
describe('DeployService', () => {
  test('should build project', async () => {
    const result = await deployService.build('project-id');
    expect(result.status).toBe('success');
  });
});
\`\`\`

### 통합 테스트

\`\`\`javascript
describe('API Integration', () => {
  test('POST /api/projects', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project' });
    expect(res.status).toBe(201);
  });
});
\`\`\`

## CI/CD 파이프라인

| 단계 | 도구 | 시간 |
|------|------|------|
| Lint | ESLint | 30초 |
| Unit Test | Jest | 2분 |
| Build | Docker | 3분 |
| Deploy | Dokploy | 1분 |

## 테스트 커버리지 목표

- 단위 테스트: 80% 이상
- 통합 테스트: 주요 API 100%
- E2E 테스트: 핵심 플로우
` }
  ],
  'LinkMD': [
    { filename: '01_설계문서.md', content: `# LinkMD 설계 문서

## 프로젝트 정의

LinkMD는 MD 파일을 프로젝트별로 아카이빙하고, 검색하고, 공유하고, 내보내는 지식 허브입니다.

## 핵심 기능

1. **Smart Archive** — 프로젝트별 분류 + 태깅
2. **Power Search** — FTS5 전문 검색
3. **Share & Export** — 공유 링크 + DOCX/PDF 변환

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Express + SQLite |
| Frontend | Vanilla JS |
| 검색 | FTS5 + BM25 |
| 변환 | Pandoc |

\`\`\`sql
CREATE VIRTUAL TABLE documents_fts USING fts5(title, content);
\`\`\`
` },
    { filename: '02_프론트엔드.md', content: `# 프론트엔드 설계

## UI/UX 원칙

- HackMD 스타일 카드 그리드
- 인디고 브랜드 컬러 (#6366F1)
- Pretendard + JetBrains Mono 폰트

## 컴포넌트 구조

\`\`\`javascript
// app-state.js — 전역 상태
const AppState = {
  view: 'workspace',
  currentProjectId: null,
  documents: [],
  searchResults: []
};
\`\`\`

## 반응형 디자인

- 데스크톱: 사이드바 + 메인
- 모바일 (768px 이하): 사이드바 숨김
` },
    { filename: '03_DB설계.md', content: `# 데이터베이스 설계

## SQLite 스키마

### projects 테이블

\`\`\`sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  doc_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### documents 테이블

\`\`\`sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
\`\`\`

## FTS5 전문 검색

\`\`\`sql
SELECT snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30)
FROM documents_fts
WHERE documents_fts MATCH '검색어';
\`\`\`

| 인덱스 | 용도 |
|--------|------|
| documents_fts | 전문 검색 |
| idx_documents_project | 프로젝트 필터 |
| idx_documents_created | 날짜 정렬 |
` }
  ],
  'KDCA 챗봇': [
    { filename: '01_요구사항.md', content: `# KDCA 챗봇 요구사항

## 프로젝트 개요

질병관리청(KDCA) 공식 AI 챗봇 개발 프로젝트입니다.

## 기능 요구사항

### 기본 기능
- 질병 정보 검색
- 예방접종 일정 안내
- 감염병 신고 안내

### AI 기능
- 자연어 질의응답
- 의도 분류
- 개체명 인식

\`\`\`javascript
const classify = async (query) => {
  const intent = await nlp.classify(query);
  return { intent, confidence: intent.score };
};
\`\`\`

## 비기능 요구사항

| 항목 | 기준 |
|------|------|
| 응답 시간 | 3초 이내 |
| 가용성 | 99.9% |
| 동시 사용자 | 1000명 |
` },
    { filename: '02_시나리오.md', content: `# 챗봇 시나리오

## 대화 시나리오

### 시나리오 1: 질병 검색

\`\`\`
사용자: 코로나 증상이 뭐예요?
봇: COVID-19의 주요 증상은 다음과 같습니다:
    - 발열 (37.5도 이상)
    - 기침
    - 인후통
    - 호흡곤란
\`\`\`

### 시나리오 2: 예방접종

\`\`\`
사용자: 독감 예방접종 언제 맞아야 해요?
봇: 인플루엔자 예방접종은 매년 10-11월에 권장됩니다.
    65세 이상은 무료 접종이 가능합니다.
\`\`\`

## 폴백 처리

\`\`\`javascript
if (confidence < 0.5) {
  return '죄송합니다. 질문을 이해하지 못했습니다. 다시 말씀해주세요.';
}
\`\`\`

## 대화 흐름도

| 단계 | 처리 |
|------|------|
| 입력 | 자연어 전처리 |
| 분류 | 의도 분류 (NLU) |
| 응답 | 템플릿 매칭 |
| 출력 | 응답 생성 |
` },
    { filename: '03_테스트계획.md', content: `# 테스트 계획

## 테스트 범위

### 기능 테스트
- 질병 검색 정확도
- 시나리오별 응답 적절성
- 폴백 처리

### 성능 테스트

\`\`\`bash
# k6 부하 테스트
k6 run --vus 100 --duration 30s load-test.js
\`\`\`

## 테스트 케이스

| ID | 입력 | 예상 결과 |
|----|------|-----------|
| TC-001 | "코로나 증상" | 증상 목록 |
| TC-002 | "예방접종 일정" | 접종 안내 |
| TC-003 | "asdfgh" | 폴백 응답 |

\`\`\`javascript
describe('ChatBot', () => {
  test('질병 검색', async () => {
    const res = await bot.query('코로나 증상');
    expect(res.intent).toBe('disease_info');
  });
});
\`\`\`

## 품질 기준

- 의도 분류 정확도: 90% 이상
- 응답 시간: P95 < 3초
- 사용자 만족도: 4.0/5.0 이상
` }
  ]
};

const TAGS = [
  { name: '배포', color: '#EF4444' },
  { name: 'API', color: '#3B82F6' },
  { name: '설계', color: '#10B981' },
  { name: '아키텍처', color: '#F59E0B' },
  { name: '테스트', color: '#8B5CF6' },
  { name: '운영', color: '#EC4899' },
  { name: '프론트엔드', color: '#06B6D4' },
  { name: 'DB', color: '#F97316' },
];

const DOC_TAGS = {
  '01_프로젝트개요.md': ['설계'],
  '02_아키텍처설계.md': ['아키텍처', '배포'],
  '03_API설계.md': ['API', '설계'],
  '04_배포가이드.md': ['배포', '운영'],
  '05_테스트전략.md': ['테스트'],
  '01_설계문서.md': ['설계', '아키텍처'],
  '02_프론트엔드.md': ['프론트엔드', '설계'],
  '03_DB설계.md': ['DB', '설계'],
  '01_요구사항.md': ['설계'],
  '02_시나리오.md': ['설계', '테스트'],
  '03_테스트계획.md': ['테스트'],
};

async function seed() {
  const dbPath = process.env.DB_PATH || './data/linkmd.db';

  // Clean existing DB
  const fs = require('fs');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new DB(dbPath);
  await db.init();
  const archive = new ArchiveEngine(db, process.env.STORAGE_PATH || './storage');

  console.log('Creating tags...');
  const tagMap = {};
  for (const t of TAGS) {
    const tag = await archive.createTag(t.name, t.color);
    tagMap[t.name] = tag.id;
    console.log(`  Tag: ${t.name} (id=${tag.id})`);
  }

  for (const proj of PROJECTS) {
    console.log(`\nCreating project: ${proj.name}`);
    const project = await archive.createProject(proj.name, proj.description, proj.color, proj.icon);

    const docs = DOCS[proj.name] || [];
    for (const doc of docs) {
      const buffer = Buffer.from(doc.content, 'utf-8');
      const file = { originalname: doc.filename, buffer };
      const result = await archive.archiveDocuments(project.id, [file]);
      const archived = result.archived[0];
      console.log(`  Doc: ${doc.filename} (id=${archived.id})`);

      // Add tags
      const docTags = DOC_TAGS[doc.filename] || [];
      for (const tName of docTags) {
        if (tagMap[tName]) {
          await archive.addTagToDocument(archived.id, tagMap[tName]);
        }
      }
    }
  }

  const stats = await archive.getStats();
  console.log(`\nSeed complete!`);
  console.log(`  Projects: ${stats.totalProjects}`);
  console.log(`  Documents: ${stats.totalDocuments}`);
  console.log(`  Tags: ${stats.totalTags}`);

  await db.close();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
