'use strict';

function showContextMenu(event, type, targetId) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'context-menu';

  let items = [];

  if (type === 'folder') {
    items = [
      { label: '새 파일', icon: 'file-plus', action: () => showCreateDocModal(targetId) },
      { label: '새 폴더', icon: 'folder-plus', action: () => showCreateFolderModal(targetId) },
      { divider: true },
      { label: '이름 변경', icon: 'pencil', action: () => showRenameFolderModal(targetId) },
      { label: '이동', icon: 'move', action: () => showMoveFolderModal(targetId) },
      { divider: true },
      { label: '삭제', icon: 'trash-2', action: () => deleteFolderAction(targetId), danger: true },
    ];
  } else if (type === 'file') {
    items = [
      { label: '열기', icon: 'eye', action: () => openViewer(targetId) },
      { label: '편집', icon: 'edit-3', action: () => openEditor(targetId) },
      { divider: true },
      { label: '이름 변경', icon: 'pencil', action: () => showRenameDocModal(targetId) },
      { label: '이동', icon: 'move', action: () => showMoveDocModal(targetId) },
      { label: '복제', icon: 'copy', action: () => copyDocumentAction(targetId) },
      { divider: true },
      { label: '문서 분할', icon: 'scissors', action: () => showSplitDocModal(targetId) },
      { label: '태그 자동 추출', icon: 'sparkles', action: () => showAutoTagModal(targetId) },
      { divider: true },
      { label: '삭제', icon: 'trash-2', action: () => deleteDoc(targetId), danger: true },
    ];
  } else if (type === 'root') {
    items = [
      { label: '새 파일', icon: 'file-plus', action: () => showCreateDocModal(null) },
      { label: '새 폴더', icon: 'folder-plus', action: () => showCreateFolderModal(null) },
    ];
  }

  items.forEach(item => {
    if (item.divider) {
      const div = document.createElement('div');
      div.className = 'context-menu-divider';
      menu.appendChild(div);
      return;
    }
    const el = document.createElement('div');
    el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
    el.innerHTML = `<svg width="14" height="14" style="flex-shrink:0"><use href="#"/></svg> ${escapeHtml(item.label)}`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContextMenu();
      item.action();
    });
    menu.appendChild(el);
  });

  // Position
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  let x = event.clientX;
  let y = event.clientY;
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 0);
}

function closeContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.remove();
}

async function copyDocumentAction(docId) {
  try {
    await api(`/docs/${docId}/copy`, { method: 'POST', body: JSON.stringify({}) });
    toast('문서를 복제했습니다', 'success');
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
  } catch {}
}

async function deleteFolderAction(folderId) {
  if (!confirm('폴더와 하위 내용을 모두 삭제하시겠습니까?')) return;
  try {
    await api(`/folders/${folderId}`, { method: 'DELETE' });
    toast('폴더가 삭제되었습니다', 'success');
    await loadProjectTree(AppState.currentProjectId);
    await loadDocuments(AppState.currentProjectId);
    await loadProjects();
    renderProjectList();
  } catch {}
}
