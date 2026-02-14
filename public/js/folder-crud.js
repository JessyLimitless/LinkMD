'use strict';

// ── Create Folder ──
function showCreateFolderModal(parentId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <h3>새 폴더</h3>
      <input id="new-folder-name" type="text" placeholder="폴더 이름" autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="createFolder('${parentId || ''}')">생성</button>
      </div>
    </div>`;
  overlay.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('new-folder-name');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') createFolder(parentId || ''); });
    }
  }, 100);
}

async function createFolder(parentId) {
  const name = document.getElementById('new-folder-name')?.value?.trim();
  if (!name) return toast('폴더 이름을 입력하세요', 'error');

  try {
    await api(`/projects/${AppState.currentProjectId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name, parentId: parentId || null })
    });
    closeModal();
    toast('폴더가 생성되었습니다', 'success');
    if (parentId) AppState.expandedFolders.add(parentId);
    await loadProjectTree(AppState.currentProjectId);
  } catch {}
}

// ── Rename Folder ──
function showRenameFolderModal(folderId) {
  const folderName = findInTree(AppState.folderTree, folderId, 'folder')?.name || '';

  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <h3>폴더 이름 변경</h3>
      <input id="rename-folder-name" type="text" value="${escapeAttr(folderName)}" autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="renameFolder('${folderId}')">변경</button>
      </div>
    </div>`;
  overlay.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('rename-folder-name');
    if (input) { input.focus(); input.select(); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameFolder(folderId); }); }
  }, 100);
}

async function renameFolder(folderId) {
  const name = document.getElementById('rename-folder-name')?.value?.trim();
  if (!name) return toast('폴더 이름을 입력하세요', 'error');

  try {
    await api(`/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
    closeModal();
    toast('폴더 이름이 변경되었습니다', 'success');
    await loadProjectTree(AppState.currentProjectId);
  } catch {}
}

// ── Move Folder ──
function showMoveFolderModal(folderId) {
  showMoveModal('folder', folderId);
}

// ── Create Document ──
function showCreateDocModal(folderId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <h3>새 파일</h3>
      <input id="new-doc-name" type="text" placeholder="파일명 (예: README.md)" autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="createDocument('${folderId || ''}')">생성</button>
      </div>
    </div>`;
  overlay.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('new-doc-name');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') createDocument(folderId || ''); });
    }
  }, 100);
}

async function createDocument(folderId) {
  const filename = document.getElementById('new-doc-name')?.value?.trim();
  if (!filename) return toast('파일명을 입력하세요', 'error');

  try {
    const data = await api(`/projects/${AppState.currentProjectId}/docs`, {
      method: 'POST',
      body: JSON.stringify({ filename, folderId: folderId || null })
    });
    closeModal();
    toast('파일이 생성되었습니다', 'success');
    if (folderId) AppState.expandedFolders.add(folderId);
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
    if (data.document?.id) openEditor(data.document.id);
  } catch {}
}

// ── Rename Document ──
function showRenameDocModal(docId) {
  const file = findInTree(AppState.folderTree, docId, 'file');
  const filename = file?.filename || '';

  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <h3>파일명 변경</h3>
      <input id="rename-doc-name" type="text" value="${escapeAttr(filename)}" autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="renameDoc('${docId}')">변경</button>
      </div>
    </div>`;
  overlay.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('rename-doc-name');
    if (input) { input.focus(); input.select(); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameDoc(docId); }); }
  }, 100);
}

async function renameDoc(docId) {
  const filename = document.getElementById('rename-doc-name')?.value?.trim();
  if (!filename) return toast('파일명을 입력하세요', 'error');

  try {
    await api(`/docs/${docId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ filename })
    });
    closeModal();
    toast('파일명이 변경되었습니다', 'success');
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
  } catch {}
}

// ── Move Document / Folder ──
function showMoveDocModal(docId) {
  showMoveModal('file', docId);
}

function showMoveModal(type, targetId) {
  const overlay = document.getElementById('modal-overlay');

  function renderMoveTree(items, depth) {
    return items
      .filter(i => i.type === 'folder' && i.id !== targetId)
      .map(item => {
        const indent = (depth || 0) * 20;
        const children = item.children ? renderMoveTree(item.children, (depth || 0) + 1) : '';
        return `<div class="move-tree-item" style="padding-left:${8 + indent}px" onclick="selectMoveTarget(this, '${escapeAttr(item.id)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
          ${escapeHtml(item.name)}
        </div>${children}`;
      }).join('');
  }

  const treeHtml = renderMoveTree(AppState.folderTree, 0);

  overlay.innerHTML = `
    <div class="modal">
      <h3>이동할 위치 선택</h3>
      <div class="move-tree">
        <div class="move-tree-item selected" onclick="selectMoveTarget(this, '')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          프로젝트 루트
        </div>
        ${treeHtml}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="confirmMove('${type}', '${targetId}')">이동</button>
      </div>
    </div>`;
  overlay.classList.add('open');

  window._moveSelectedFolderId = null;
}

function selectMoveTarget(el, folderId) {
  document.querySelectorAll('.move-tree-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  window._moveSelectedFolderId = folderId || null;
}

async function confirmMove(type, targetId) {
  const folderId = window._moveSelectedFolderId;

  try {
    if (type === 'file') {
      await api(`/docs/${targetId}/move`, {
        method: 'PUT',
        body: JSON.stringify({ folderId })
      });
    } else if (type === 'folder') {
      await api(`/folders/${targetId}/move`, {
        method: 'PUT',
        body: JSON.stringify({ parentId: folderId })
      });
    }
    closeModal();
    toast('이동되었습니다', 'success');
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
  } catch {}
}

// ── Utility ──
function findInTree(tree, id, type) {
  for (const item of tree) {
    if (item.type === type && item.id === id) return item;
    if (item.children) {
      const found = findInTree(item.children, id, type);
      if (found) return found;
    }
  }
  return null;
}
