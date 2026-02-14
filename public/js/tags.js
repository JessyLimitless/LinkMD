'use strict';

function renderTagList() {
  const list = document.getElementById('tag-list');
  if (!list) return;
  list.innerHTML = AppState.tags.map(t => `
    <div class="sidebar-item" onclick="filterByTagGlobal('${escapeAttr(t.name)}')">
      <span class="item-icon"><i data-lucide="hash" style="width:14px;height:14px;color:${escapeAttr(t.color)}"></i></span>
      <span>${escapeHtml(t.name)}</span>
      <span class="count">${t.usage_count || 0}</span>
    </div>
  `).join('');
  lucide.createIcons();
}

function filterByTagGlobal(tagName) {
  AppState.filterTag = tagName;
  if (AppState.currentProjectId) loadDocuments(AppState.currentProjectId);
  else toast('프로젝트를 먼저 선택해주세요', 'info');
}

async function showAddTagModal(docId) {
  const modal = document.getElementById('modal-overlay');
  const existing = AppState.tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  modal.innerHTML = `
    <div class="modal">
      <h3>태그 추가</h3>
      <select id="tag-select"><option value="">기존 태그 선택...</option>${existing}</select>
      <div style="text-align:center;color:var(--gray-400);font-size:0.8rem;margin:4px 0">또는</div>
      <input id="new-tag-name" placeholder="새 태그 이름">
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="addTagToDoc('${escapeAttr(docId)}')">추가</button>
      </div>
    </div>`;
  modal.classList.add('open');
}

async function addTagToDoc(docId) {
  const selectVal = document.getElementById('tag-select').value;
  const newName = document.getElementById('new-tag-name').value.trim();

  let tagId = selectVal ? parseInt(selectVal) : null;
  if (!tagId && newName) {
    const tag = await api('/tags', { method: 'POST', body: JSON.stringify({ name: newName }) });
    tagId = tag.id;
    await loadTags();
    renderTagList();
  }
  if (!tagId) return toast('태그를 선택하거나 입력해주세요', 'error');

  try {
    await api(`/docs/${docId}/tags`, { method: 'POST', body: JSON.stringify({ tagId }) });
    closeModal();
    toast('태그가 추가되었습니다', 'success');
    await openViewer(docId);
  } catch {}
}

async function removeDocTag(docId, tagId) {
  try {
    await api(`/docs/${docId}/tags/${tagId}`, { method: 'DELETE' });
    toast('태그가 제거되었습니다', 'success');
    await loadTags();
    renderTagList();
    await openViewer(docId);
  } catch {}
}
