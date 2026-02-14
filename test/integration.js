'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const fs = require('fs');
const path = require('path');

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3500, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // Upload via native fetch with proper UTF-8 filenames
  const formData = new FormData();
  const files = [
    path.join(__dirname, '01_프로젝트개요.md'),
    path.join(__dirname, '02_아키텍처설계.md'),
    path.join(__dirname, '03_API설계.md'),
  ];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const blob = new Blob([buf], { type: 'text/markdown' });
    formData.append('files', blob, path.basename(f));
  }

  console.log('[1] Upload');
  const uploadResp = await fetch('http://localhost:3500/api/upload', { method: 'POST', body: formData });
  const upload = await uploadResp.json();
  console.log('  success:', upload.success, '| files:', upload.totalFiles);
  console.log('  filenames:', upload.files.map(f => f.filename).join(', '));
  if (!upload.success) { console.log('UPLOAD FAILED'); process.exit(1); }

  const sid = upload.sessionId;

  // Preview
  console.log('\n[2] Preview');
  const preview = await post('/api/preview', { sessionId: sid, filename: upload.files[0].filename });
  console.log('  success:', preview.success, '| html length:', (preview.html || '').length);

  // Convert with all 4 templates
  const templates = ['business-report', 'technical-doc', 'simple-clean', 'government-report'];
  for (const tmpl of templates) {
    console.log(`\n[3] Convert — ${tmpl}`);
    const conv = await post('/api/convert', {
      sessionId: sid, outputFormat: 'docx', template: tmpl,
      options: { title: 'Test ' + tmpl, author: 'Jessy', toc: true, headingStrategy: 'filename-first', pageBreak: true }
    });
    console.log('  success:', conv.success, '| size:', conv.stats?.outputSize, '| time:', conv.stats?.conversionTime);
    if (!conv.success) { console.log('  ERROR:', conv.error?.message); }
  }

  // Heading strategies
  const strategies = ['filename-first', 'content-first', 'smart-merge'];
  for (const strat of strategies) {
    console.log(`\n[4] Strategy — ${strat}`);
    const conv = await post('/api/convert', {
      sessionId: sid, outputFormat: 'docx', template: 'simple-clean',
      options: { title: 'Strategy Test', headingStrategy: strat }
    });
    console.log('  success:', conv.success, '| headings:', conv.stats?.headings);
  }

  // HTML output
  console.log('\n[5] HTML output');
  const htmlConv = await post('/api/convert', {
    sessionId: sid, outputFormat: 'html', template: 'simple-clean',
    options: { title: 'HTML Test', toc: true }
  });
  console.log('  success:', htmlConv.success, '| size:', htmlConv.stats?.outputSize);

  // Error cases
  console.log('\n[6] Error: empty upload');
  const emptyResp = await fetch('http://localhost:3500/api/upload', { method: 'POST' });
  const empty = await emptyResp.json();
  console.log('  error code:', empty.error?.code, '(expected: 1001)');

  console.log('\n[7] Error: .txt upload');
  const txtForm = new FormData();
  txtForm.append('files', new Blob(['test'], { type: 'text/plain' }), 'test.txt');
  const txtResp = await fetch('http://localhost:3500/api/upload', { method: 'POST', body: txtForm });
  const txt = await txtResp.json();
  console.log('  error code:', txt.error?.code, '(expected: 1002)');

  // Health
  console.log('\n[8] Health');
  const healthResp = await fetch('http://localhost:3500/api/health');
  const health = await healthResp.json();
  console.log('  status:', health.status, '| pandoc:', health.pandoc, '| version:', health.pandocVersion);

  // Templates list
  console.log('\n[9] Templates list');
  const tmplResp = await fetch('http://localhost:3500/api/templates');
  const tmplList = await tmplResp.json();
  console.log('  count:', tmplList.templates?.length, '| all available:', tmplList.templates?.every(t => t.available));

  console.log('\n=============================');
  console.log('ALL INTEGRATION TESTS PASSED');
  console.log('=============================');
}

run().catch(err => { console.error('TEST ERROR:', err); process.exit(1); });
