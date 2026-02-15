'use strict';

const matter = require('gray-matter');
const mdProcessor = require('./md-processor');

// Language → color mapping for code-language tags
const LANG_COLORS = {
  javascript: '#F7DF1E', typescript: '#3178C6', python: '#3776AB',
  java: '#ED8B00', go: '#00ADD8', rust: '#DEA584', ruby: '#CC342D',
  php: '#777BB4', swift: '#F05138', kotlin: '#7F52FF', c: '#A8B9CC',
  cpp: '#00599C', csharp: '#239120', html: '#E34F26', css: '#1572B6',
  sql: '#4479A1', bash: '#4EAA25', shell: '#4EAA25', powershell: '#5391FE',
  yaml: '#CB171E', json: '#000000', xml: '#F16529', markdown: '#083FA1',
  dockerfile: '#2496ED', r: '#276DC3', scala: '#DC322F', lua: '#2C2D72',
  dart: '#0175C2', elixir: '#6E4A7E', haskell: '#5D4F85', perl: '#39457E',
};

// Tech keyword dictionary: regex → { name, color }
const TECH_KEYWORDS = [
  // Frameworks & Libraries
  { pattern: /\breact\b/i, name: 'React', color: '#61DAFB' },
  { pattern: /\bvue(?:\.js)?\b/i, name: 'Vue', color: '#4FC08D' },
  { pattern: /\bangular\b/i, name: 'Angular', color: '#DD0031' },
  { pattern: /\bnext\.?js\b/i, name: 'Next.js', color: '#000000' },
  { pattern: /\bsvelte\b/i, name: 'Svelte', color: '#FF3E00' },
  { pattern: /\bexpress\b/i, name: 'Express', color: '#000000' },
  { pattern: /\bdjango\b/i, name: 'Django', color: '#092E20' },
  { pattern: /\bflask\b/i, name: 'Flask', color: '#000000' },
  { pattern: /\bspring\b/i, name: 'Spring', color: '#6DB33F' },
  { pattern: /\brails\b/i, name: 'Rails', color: '#CC0000' },
  { pattern: /\blaravel\b/i, name: 'Laravel', color: '#FF2D20' },
  { pattern: /\bfastapi\b/i, name: 'FastAPI', color: '#009688' },
  { pattern: /\btailwind\b/i, name: 'Tailwind', color: '#06B6D4' },
  { pattern: /\bbootstrap\b/i, name: 'Bootstrap', color: '#7952B3' },

  // Databases
  { pattern: /\bpostgres(?:ql)?\b/i, name: 'PostgreSQL', color: '#4169E1' },
  { pattern: /\bmysql\b/i, name: 'MySQL', color: '#4479A1' },
  { pattern: /\bsqlite\b/i, name: 'SQLite', color: '#003B57' },
  { pattern: /\bmongo(?:db)?\b/i, name: 'MongoDB', color: '#47A248' },
  { pattern: /\bredis\b/i, name: 'Redis', color: '#DC382D' },
  { pattern: /\belasticsearch\b/i, name: 'Elasticsearch', color: '#005571' },

  // Cloud & DevOps
  { pattern: /\baws\b/, name: 'AWS', color: '#FF9900' },
  { pattern: /\bgcp\b|google cloud/i, name: 'GCP', color: '#4285F4' },
  { pattern: /\bazure\b/i, name: 'Azure', color: '#0078D4' },
  { pattern: /\bdocker\b/i, name: 'Docker', color: '#2496ED' },
  { pattern: /\bkubernetes\b|\bk8s\b/i, name: 'Kubernetes', color: '#326CE5' },
  { pattern: /\bterraform\b/i, name: 'Terraform', color: '#7B42BC' },
  { pattern: /\bci\/cd\b|github actions|jenkins/i, name: 'CI/CD', color: '#2088FF' },
  { pattern: /\bnginx\b/i, name: 'Nginx', color: '#009639' },
  { pattern: /\bgraphql\b/i, name: 'GraphQL', color: '#E10098' },
  { pattern: /\brest\s?api\b/i, name: 'REST API', color: '#009688' },
  { pattern: /\bwebsocket\b/i, name: 'WebSocket', color: '#4A90D9' },

  // AI/ML
  { pattern: /\bclaude\b/i, name: 'Claude', color: '#D97757' },
  { pattern: /\bgpt[-\s]?\d|openai/i, name: 'OpenAI', color: '#412991' },
  { pattern: /\bllm\b/i, name: 'LLM', color: '#8B5CF6' },
  { pattern: /\btransformer\b/i, name: 'Transformer', color: '#FF6F00' },
  { pattern: /\bpytorch\b/i, name: 'PyTorch', color: '#EE4C2C' },
  { pattern: /\btensorflow\b/i, name: 'TensorFlow', color: '#FF6F00' },
  { pattern: /\blangchain\b/i, name: 'LangChain', color: '#1C3C3C' },
  { pattern: /\brag\b/, name: 'RAG', color: '#6366F1' },

  // Tools & Concepts
  { pattern: /\bgit\b(?!hub)/i, name: 'Git', color: '#F05032' },
  { pattern: /\bgithub\b/i, name: 'GitHub', color: '#181717' },
  { pattern: /\bnode\.?js\b/i, name: 'Node.js', color: '#339933' },
  { pattern: /\bdeno\b/i, name: 'Deno', color: '#000000' },
  { pattern: /\bbun\b/i, name: 'Bun', color: '#FBF0DF' },
  { pattern: /\bwebpack\b/i, name: 'Webpack', color: '#8DD6F9' },
  { pattern: /\bvite\b/i, name: 'Vite', color: '#646CFF' },
  { pattern: /\bjest\b/i, name: 'Jest', color: '#C21325' },
  { pattern: /\bpandoc\b/i, name: 'Pandoc', color: '#4A90D9' },
  { pattern: /\blinux\b/i, name: 'Linux', color: '#FCC624' },
  { pattern: /\bmicroservices?\b/i, name: 'Microservice', color: '#FF6B6B' },
  { pattern: /\boauth\b/i, name: 'OAuth', color: '#EB5424' },
  { pattern: /\bjwt\b/i, name: 'JWT', color: '#000000' },
];

// Document type patterns
const DOC_TYPE_PATTERNS = [
  {
    name: '튜토리얼',
    color: '#10B981',
    patterns: [/tutorial/i, /how[ -]to/i, /step[ -]\d/i, /단계/,
               /따라하기/, /실습/, /getting started/i, /quickstart/i]
  },
  {
    name: 'API 문서',
    color: '#3B82F6',
    patterns: [/api\s+(reference|doc|문서)/i, /endpoint/i,
               /request\s*\/\s*response/i, /\bGET\b.*\bPOST\b/,
               /swagger/i, /openapi/i]
  },
  {
    name: '트러블슈팅',
    color: '#EF4444',
    patterns: [/troubleshoot/i, /debug/i, /error/i, /fix/i,
               /오류/, /해결/, /문제/, /issue/i, /bug/i]
  },
  {
    name: '설계 문서',
    color: '#8B5CF6',
    patterns: [/architect/i, /design\s+doc/i, /설계/, /아키텍처/,
               /rfc/i, /proposal/i, /spec(?:ification)?/i]
  },
  {
    name: '회의록',
    color: '#F59E0B',
    patterns: [/meeting\s+note/i, /회의록/, /미팅/, /논의/,
               /agenda/i, /minutes/i]
  },
  {
    name: '릴리즈 노트',
    color: '#06B6D4',
    patterns: [/release\s+note/i, /changelog/i, /릴리즈/, /변경\s*이력/,
               /what'?s\s+new/i, /version\s+\d/i]
  },
  {
    name: '치트시트',
    color: '#EC4899',
    patterns: [/cheat\s*sheet/i, /치트시트/, /quick\s+ref/i, /요약/, /정리/]
  },
];

/**
 * Extract tag suggestions from markdown content
 * @param {string} content - raw markdown content
 * @param {string} filename - document filename
 * @returns {Array<{name, color, source, confidence}>} sorted by confidence desc
 */
function extractTags(content, filename) {
  const tags = new Map(); // name → { color, source, confidence }

  // Strategy 1: Code languages
  const langs = mdProcessor.extractCodeLanguages(content);
  for (const lang of langs) {
    const color = LANG_COLORS[lang] || '#6B7280';
    addTag(tags, lang, color, 'code-language', 0.9);
  }

  // Strategy 2: Tech keyword dictionary
  const { content: body } = matter(content);
  const textLower = body.toLowerCase();
  for (const kw of TECH_KEYWORDS) {
    const matches = body.match(new RegExp(kw.pattern, 'gi'));
    if (matches) {
      const freq = matches.length;
      const confidence = Math.min(0.5 + freq * 0.1, 0.95);
      addTag(tags, kw.name, kw.color, 'keyword', confidence);
    }
  }

  // Strategy 3: Frontmatter
  try {
    const { data } = matter(content);
    const fmTags = [
      ...(Array.isArray(data.tags) ? data.tags : []),
      ...(Array.isArray(data.keywords) ? data.keywords : []),
      ...(Array.isArray(data.categories) ? data.categories : []),
    ];
    for (const t of fmTags) {
      if (typeof t === 'string' && t.trim()) {
        addTag(tags, t.trim(), '#6366F1', 'frontmatter', 0.95);
      }
    }
  } catch {}

  // Strategy 4: Document type classification
  const fullText = filename + ' ' + body;
  for (const docType of DOC_TYPE_PATTERNS) {
    let matchCount = 0;
    for (const p of docType.patterns) {
      if (p.test(fullText)) matchCount++;
    }
    if (matchCount >= 2) {
      addTag(tags, docType.name, docType.color, 'doc-type', Math.min(0.6 + matchCount * 0.1, 0.9));
    }
  }

  // Convert to array, sorted by confidence descending
  return Array.from(tags.entries())
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.confidence - a.confidence);
}

function addTag(map, name, color, source, confidence) {
  const key = name.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    // Keep higher confidence, prefer more specific source
    if (confidence > existing.confidence) {
      map.set(key, { color, source, confidence, name: existing.name });
    }
  } else {
    map.set(key, { color, source, confidence, name });
  }
}

module.exports = { extractTags };
