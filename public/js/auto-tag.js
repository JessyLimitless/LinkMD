'use strict';

async function showAutoTagModal(docId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal" style="min-width:420px;max-height:80vh;overflow-y:auto">
      <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5z"/></svg> 태그 자동 추출</h3>
      <div id="autotag-loading" style="padding:16px 0;color:var(--gray-400);font-size:0.85rem">태그 분석 중...</div>
      <div id="autotag-content" style="display:none"></div>
    </div>`;
  overlay.classList.add('open');

  try {
    const data = await api(`/docs/${docId}/suggest-tags`);
    const suggestions = data.suggestions || [];

    if (suggestions.length === 0) {
      document.getElementById('autotag-loading').innerHTML =
        '<span style="color:var(--gray-400)">추출할 태그가 없습니다.</span>';
      return;
    }

    const sourceLabels = {
      'code-language': '코드 언어',
      'keyword': '기술 키워드',
      'frontmatter': 'Frontmatter',
      'doc-type': '문서 유형'
    };

    const tagItems = suggestions.map((s, i) => {
      const disabled = s.alreadyApplied ? 'disabled' : '';
      const checked = !s.alreadyApplied && s.confidence >= 0.7 ? 'checked' : '';
      const opacity = s.alreadyApplied ? 'opacity:0.5' : '';
      const badge = s.alreadyApplied ? '<span style="font-size:0.7rem;color:var(--gray-500);margin-left:4px">적용됨</span>' : '';
      return `
        <label class="autotag-item" style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;${opacity}">
          <input type="checkbox" data-index="${i}" ${checked} ${disabled}>
          <span class="tag-badge" style="background:${escapeAttr(s.color)};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.8rem;white-space:nowrap">${escapeHtml(s.name)}</span>
          <span style="font-size:0.75rem;color:var(--gray-500)">${sourceLabels[s.source] || s.source}</span>
          <span style="font-size:0.7rem;color:var(--gray-600)">${Math.round(s.confidence * 100)}%</span>
          ${badge}
        </label>`;
    }).join('');

    document.getElementById('autotag-loading').style.display = 'none';
    const content = document.getElementById('autotag-content');
    content.style.display = 'block';
    content.innerHTML = `
      <p style="font-size:0.85rem;color:var(--gray-300);margin-bottom:8px">적용할 태그를 선택하세요:</p>
      <div style="margin-bottom:4px;display:flex;gap:8px">
        <button class="btn btn-sm" onclick="autotagSelectAll()" style="font-size:0.75rem;padding:2px 8px">전체 선택</button>
        <button class="btn btn-sm" onclick="autotagDeselectAll()" style="font-size:0.75rem;padding:2px 8px">전체 해제</button>
      </div>
      <div style="max-height:300px;overflow-y:auto;margin-bottom:12px">${tagItems}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" id="autotag-apply-btn" onclick="applyAutoTags('${docId}')">선택 태그 적용</button>
      </div>`;

    // Store suggestions for apply
    window._autotagSuggestions = suggestions;
  } catch {
    document.getElementById('autotag-loading').innerHTML =
      '<span style="color:var(--danger)">태그 분석에 실패했습니다.</span>';
  }
}

function autotagSelectAll() {
  document.querySelectorAll('#autotag-content input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
}

function autotagDeselectAll() {
  document.querySelectorAll('#autotag-content input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = false);
}

async function applyAutoTags(docId) {
  const btn = document.getElementById('autotag-apply-btn');
  if (btn) { btn.disabled = true; btn.textContent = '적용 중...'; }

  const suggestions = window._autotagSuggestions || [];
  const selected = [];

  document.querySelectorAll('#autotag-content input[type="checkbox"]:checked:not(:disabled)').forEach(cb => {
    const idx = parseInt(cb.dataset.index);
    if (suggestions[idx]) {
      selected.push({ name: suggestions[idx].name, color: suggestions[idx].color });
    }
  });

  if (selected.length === 0) {
    toast('적용할 태그를 선택하세요', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '선택 태그 적용'; }
    return;
  }

  try {
    const result = await api(`/docs/${docId}/apply-tags`, {
      method: 'POST',
      body: JSON.stringify({ tags: selected })
    });
    closeModal();
    toast(`${result.applied.length}개 태그가 적용되었습니다`, 'success');

    if (AppState.universeActive && typeof loadUniverseData === 'function') {
      await loadUniverseData();
      if (_universeDetailDoc && String(_universeDetailDoc.id) === String(docId)) {
        try {
          const freshDoc = await api(`/docs/${docId}`);
          _universeDetailDoc = freshDoc;
          _renderDetailContent(freshDoc);
        } catch {}
      }
    } else {
      await loadTags();
      await loadDocuments(AppState.currentProjectId);
      await loadStats();
    }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = '선택 태그 적용'; }
  }
}
