/* Convert — §6.12 */
'use strict';

async function startConvert() {
  const state = store.getState();
  if (!state.sessionId) return;

  const selectedFiles = [...state.selectedFiles];
  if (selectedFiles.length === 0) {
    store.setState('error', 'Select at least one file to convert.');
    return;
  }

  store.setState('loading.convert', true);
  store.setState('error', null);
  store.setState('result', null);
  closeSettings();

  try {
    const cs = state.convertSettings;
    const resp = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        outputFormat: cs.outputFormat,
        template: cs.template,
        options: {
          title: cs.title || undefined,
          author: cs.author || undefined,
          date: cs.date,
          toc: cs.toc,
          tocDepth: 3,
          pageBreak: cs.pageBreak,
          headingStrategy: cs.headingStrategy,
          highlightStyle: cs.highlight ? 'tango' : undefined,
          coverPage: cs.coverPage,
          sortOrder: state.sortOrder,
          fileOrder: state.sortOrder === 'custom' ? state.customOrder : null,
          selectedFiles
        }
      })
    });

    const data = await resp.json();
    if (data.success) {
      store.setState('result', data);
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(w => showToast(w.message, 'warning'));
      }
      showToast('Conversion complete!', 'success');
    } else {
      store.setState('error', data.error?.message || 'Conversion failed');
    }
  } catch (err) {
    store.setState('error', err.message);
  } finally {
    store.setState('loading.convert', false);
  }
}

function renderResult(state) {
  const zone = document.getElementById('result-zone');
  if (!zone) return;

  if (!state.result) {
    zone.classList.remove('visible');
    return;
  }

  const r = state.result;
  const s = r.stats || {};
  zone.classList.add('visible');

  zone.innerHTML = `
    <div class="result-title">Conversion Complete</div>
    <div class="result-stats">
      <div class="stat-item"><div class="stat-value">${s.inputFiles || 0}</div><div class="stat-label">Input Files</div></div>
      <div class="stat-item"><div class="stat-value">${s.headings || 0}</div><div class="stat-label">Headings</div></div>
      <div class="stat-item"><div class="stat-value">${s.codeBlocks || 0}</div><div class="stat-label">Code Blocks</div></div>
      <div class="stat-item"><div class="stat-value">${s.tables || 0}</div><div class="stat-label">Tables</div></div>
      <div class="stat-item"><div class="stat-value">${s.estimatedPages || 0}</div><div class="stat-label">Est. Pages</div></div>
      <div class="stat-item"><div class="stat-value">${s.conversionTime || '-'}</div><div class="stat-label">Time</div></div>
      <div class="stat-item"><div class="stat-value">${formatSize(s.outputSize || 0)}</div><div class="stat-label">File Size</div></div>
    </div>
    <div style="text-align:center">
      <a href="${r.downloadUrl}" class="btn-download" download="${r.filename}">
        Download ${r.filename || 'file'}
      </a>
    </div>
  `;
}
