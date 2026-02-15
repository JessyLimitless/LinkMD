'use strict';

async function showSplitDocModal(docId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal" style="min-width:380px">
      <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="1"/><path d="M5 12H3m18 0h-2M12 5V3m0 18v-2"/></svg> 문서 분할</h3>
      <div id="split-loading" style="padding:16px 0;color:var(--gray-400);font-size:0.85rem">헤딩 분석 중...</div>
      <div id="split-content" style="display:none"></div>
    </div>`;
  overlay.classList.add('open');

  try {
    const data = await api(`/docs/${docId}/headings`);
    const stats = data.stats;
    const levels = Object.keys(stats).sort();

    if (levels.length === 0) {
      document.getElementById('split-loading').innerHTML =
        '<span style="color:var(--danger)">이 문서에는 헤딩이 없어 분할할 수 없습니다.</span>';
      return;
    }

    const levelLabels = { 1: 'H1', 2: 'H2', 3: 'H3', 4: 'H4', 5: 'H5', 6: 'H6' };
    const radioItems = levels.map(lv => {
      const count = stats[lv];
      const checked = lv === levels[0] ? 'checked' : '';
      return `
        <label class="split-level-option" style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
          <input type="radio" name="split-level" value="${lv}" ${checked}>
          <span style="font-weight:600;min-width:28px">${levelLabels[lv] || 'H' + lv}</span>
          <span style="color:var(--gray-400)">${count}개 헤딩 → ${count}개 문서로 분할</span>
        </label>`;
    }).join('');

    document.getElementById('split-loading').style.display = 'none';
    const content = document.getElementById('split-content');
    content.style.display = 'block';
    content.innerHTML = `
      <p style="font-size:0.85rem;color:var(--gray-300);margin-bottom:12px">"${escapeHtml(data.title)}" 문서를 헤딩 기준으로 분할합니다.</p>
      <div style="margin-bottom:12px">${radioItems}</div>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:var(--gray-300)">
        <input type="checkbox" id="split-keep-original" checked> 원본 문서 유지
      </label>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="split-exec-btn" onclick="executeSplit('${docId}')">분할 실행</button>
      </div>`;
  } catch {
    document.getElementById('split-loading').innerHTML =
      '<span style="color:var(--danger)">헤딩 정보를 불러올 수 없습니다.</span>';
  }
}

async function executeSplit(docId) {
  const btn = document.getElementById('split-exec-btn');
  if (btn) { btn.disabled = true; btn.textContent = '분할 중...'; }

  const level = document.querySelector('input[name="split-level"]:checked')?.value;
  const keepOriginal = document.getElementById('split-keep-original')?.checked !== false;

  try {
    const result = await api(`/docs/${docId}/split`, {
      method: 'POST',
      body: JSON.stringify({ level: parseInt(level), keepOriginal })
    });
    closeModal();
    toast(`${result.created.length}개 문서로 분할되었습니다`, 'success');
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
    await loadStats();
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = '분할 실행'; }
  }
}
