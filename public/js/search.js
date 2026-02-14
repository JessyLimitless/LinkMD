'use strict';

function renderSearchResults(main) {
  const r = AppState.searchResults;
  main.innerHTML = `
    <div class="search-results fade-in">
      <div class="search-results-header">
        <h2>"${escapeHtml(AppState.searchQuery)}" 검색 결과</h2>
        <span class="result-count">${r.length}건</span>
      </div>
      ${r.length === 0 ? '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="search-x" style="width:48px;height:48px"></i></div><div class="empty-state-text">검색 결과가 없습니다</div></div>' :
        r.map(item => `
          <div class="search-result-item" onclick="openViewer('${escapeAttr(item.id)}')">
            <div class="result-header">
              <span class="result-icon"><i data-lucide="file-text" style="width:14px;height:14px"></i></span>
              <span class="result-project">${escapeHtml(item.projectName)}</span>
              <span class="result-filename">${escapeHtml(item.filename)}</span>
            </div>
            <div class="result-snippet">${item.snippet || ''}</div>
            <div class="result-meta">
              ${(item.tags||[]).map(t => `<span class="tag">#${escapeHtml(t.name)}</span>`).join('')}
              <span class="date">${item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : ''}</span>
            </div>
          </div>
        `).join('')
      }
    </div>`;
  lucide.createIcons();
}

function renderSearchHistory() {
  const el = document.getElementById('search-history-list');
  if (!el) return;
  el.innerHTML = AppState.searchHistory.map(h => `
    <div class="search-history-item" onclick="document.getElementById('search-input').value='${escapeAttr(h.query)}';doSearch('${escapeAttr(h.query)}')">
      <span class="history-icon"><i data-lucide="clock" style="width:13px;height:13px"></i></span>
      ${escapeHtml(h.query)}
    </div>
  `).join('');
  lucide.createIcons();
}
