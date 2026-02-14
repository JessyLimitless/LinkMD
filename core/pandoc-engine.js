'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const { LinkMDError, createError } = require('./errors');
const AdmZip = require('adm-zip');

function getPandocPath() {
  return process.env.PANDOC_PATH || 'pandoc';
}

function parsePandocError(stderr) {
  const errorMap = [
    {
      pattern: /Could not find image/i,
      code: 'CONVERT_IMAGE_BROKEN',
      recoverable: true,
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
      pattern: /pdflatex not found|wkhtmltopdf not found|wkhtmltopdf/i,
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

async function checkPandoc() {
  return new Promise((resolve) => {
    execFile(getPandocPath(), ['--version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ installed: false, version: null });
      } else {
        const match = stdout.match(/pandoc\s+([\d.]+)/);
        resolve({ installed: true, version: match ? match[1] : 'unknown' });
      }
    });
  });
}

function convert(inputFiles, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const args = [...inputFiles, '-o', outputPath];

    if (options.template) {
      args.push('--reference-doc', options.template);
    }
    if (options.toc) {
      args.push('--toc', '--toc-depth', String(options.tocDepth || 3));
    }
    if (options.title) {
      args.push('--metadata', `title=${options.title}`);
    }
    if (options.author) {
      args.push('--metadata', `author=${options.author}`);
    }
    if (options.date) {
      args.push('--metadata', `date=${options.date}`);
    }
    if (options.highlightStyle) {
      args.push('--highlight-style', options.highlightStyle);
    }
    if (outputPath.endsWith('.pdf')) {
      args.push('--pdf-engine', options.pdfEngine || 'wkhtmltopdf');
    }
    if (outputPath.endsWith('.html')) {
      args.push('--standalone');
      if (options.css) {
        args.push('--css', options.css);
      }
    }

    execFile(getPandocPath(), args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          return reject(createError('CONVERT_TIMEOUT'));
        }
        const parsed = parsePandocError(stderr || error.message);
        if (parsed.recoverable) {
          resolve({ outputPath, warnings: [parsed] });
        } else {
          reject(createError(parsed.code, { raw: parsed.raw, userMsg: parsed.userMsg }));
        }
      } else {
        const warnings = [];
        if (stderr) {
          const parsed = parsePandocError(stderr);
          if (parsed.recoverable) {
            warnings.push(parsed);
          }
        }
        resolve({ outputPath, warnings });
      }
    });
  });
}

async function reverse(inputFile, outputDir) {
  const basename = path.basename(inputFile, path.extname(inputFile));
  const mdPath = path.join(outputDir, `${basename}.md`);
  const mediaDir = path.join(outputDir, 'media');

  await fs.mkdir(mediaDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const args = [
      inputFile,
      '-o', mdPath,
      '--extract-media', mediaDir,
      '--wrap', 'none'
    ];

    execFile(getPandocPath(), args, { timeout: 30000 }, async (error, stdout, stderr) => {
      if (error) {
        return reject(createError('REVERSE_PANDOC_FAIL', { raw: stderr || error.message }));
      }

      // Bundle into ZIP
      const zip = new AdmZip();
      zip.addLocalFile(mdPath);

      // Check if media directory has files
      try {
        const mediaFiles = await fs.readdir(mediaDir, { recursive: true });
        for (const mf of mediaFiles) {
          const fullPath = path.join(mediaDir, mf);
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            zip.addLocalFile(fullPath, `media/${path.dirname(mf)}`);
          }
        }
      } catch { /* no media files */ }

      const zipPath = path.join(outputDir, `${basename}.zip`);
      zip.writeZip(zipPath);

      resolve({
        mdPath,
        zipPath,
        filename: `${basename}.zip`
      });
    });
  });
}

module.exports = { convert, reverse, parsePandocError, checkPandoc, getPandocPath };
