'use strict';

function openExport() {
  if (AppState.selectedDocIds.size === 0) return toast('내보낼 문서를 선택해주세요', 'error');
  document.getElementById('export-overlay').classList.add('open');
  document.getElementById('export-panel').classList.add('open');
}

function closeExport() {
  document.getElementById('export-overlay').classList.remove('open');
  document.getElementById('export-panel').classList.remove('open');
}

async function doExport() {
  const ids = [...AppState.selectedDocIds];
  const format = document.getElementById('export-format').value;
  const template = document.getElementById('export-template').value;
  const title = document.getElementById('export-title').value || 'LinkMD Document';
  const toc = document.getElementById('export-toc').checked;

  AppState.loading.export = true;
  toast('변환 중...', 'info');
  try {
    const data = await api('/export', {
      method: 'POST',
      body: JSON.stringify({
        documentIds: ids, outputFormat: format, template,
        options: { title, toc, tocDepth: 3, pageBreak: true, headingStrategy: 'filename-first' }
      })
    });
    if (data.downloadUrl) {
      window.open(window.location.origin + data.downloadUrl, '_blank');
      toast('변환이 완료되었습니다', 'success');
    }
    closeExport();
  } catch {} finally { AppState.loading.export = false; }
}
