'use strict';

const path = require('path');
const fs = require('fs');
const { createError } = require('./errors');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

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

function getTemplates() {
  return Object.entries(TEMPLATES).map(([id, tmpl]) => ({
    id,
    name: tmpl.name,
    description: tmpl.description,
    formats: tmpl.formats
  }));
}

function getTemplatePath(templateId, format = 'docx') {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl) {
    throw createError('CONVERT_TEMPLATE_404', { templateId });
  }
  if (!tmpl.formats.includes(format)) {
    throw createError('CONVERT_TEMPLATE_404', { templateId, format });
  }

  const filePath = path.join(TEMPLATES_DIR, format, `${templateId}.${format}`);
  if (!fs.existsSync(filePath)) {
    throw createError('CONVERT_TEMPLATE_404', { templateId, path: filePath });
  }
  return filePath;
}

function exists(templateId, format = 'docx') {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl || !tmpl.formats.includes(format)) return false;
  const filePath = path.join(TEMPLATES_DIR, format, `${templateId}.${format}`);
  return fs.existsSync(filePath);
}

function getCssPath() {
  return path.join(TEMPLATES_DIR, 'css', 'html-export.css');
}

module.exports = { getTemplates, getTemplatePath, exists, getCssPath, TEMPLATES };
