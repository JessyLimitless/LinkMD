'use strict';

let _treeEventsInitialized = false;

async function loadProjectTree(projectId) {
  try {
    const data = await api(`/projects/${projectId}/tree`);
    AppState.folderTree = data.tree || [];
    renderTreeView();
  } catch (e) {
    const c = document.getElementById('tree-view');
    if (c) c.innerHTML = '<div style="padding:8px;color:var(--red);font-size:0.8rem">트리 로딩 실패</div>';
  }
}

function renderTreeView() {
  const container = document.getElementById('tree-view');
  if (!container) return;

  if (AppState.folderTree.length === 0) {
    container.innerHTML = '<div style="padding:8px;color:var(--gray-400);font-size:0.8rem">파일이 없습니다</div>';
    return;
  }

  container.innerHTML = AppState.folderTree.map(item => renderTreeNodeHTML(item, 0)).join('');

  if (!_treeEventsInitialized) {
    initTreeEvents(container);
    _treeEventsInitialized = true;
  }
}

function renderTreeNodeHTML(item, depth) {
  if (item.type === 'folder') return renderTreeFolderHTML(item, depth);
  return renderTreeFileHTML(item, depth);
}

function renderTreeFolderHTML(folder, depth) {
  const isExpanded = AppState.expandedFolders.has(folder.id);
  const pad = 8 + depth * 16;

  let childrenHTML = '';
  if (folder.children && folder.children.length > 0) {
    childrenHTML = folder.children.map(c => renderTreeNodeHTML(c, depth + 1)).join('');
  }

  return `<div class="tree-node">
    <div class="tree-item" style="padding-left:${pad}px" draggable="true" data-type="folder" data-id="${escapeAttr(folder.id)}">
      <span class="tree-chevron ${isExpanded ? 'expanded' : ''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></span>
      <span class="tree-icon folder-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg></span>
      <span class="tree-label">${escapeHtml(folder.name)}</span>
    </div>
    <div class="${isExpanded ? 'tree-children expanded' : 'tree-children'}">${childrenHTML}</div>
  </div>`;
}

function renderTreeFileHTML(file, depth) {
  const pad = 8 + depth * 16 + 16;
  return `<div class="tree-item" style="padding-left:${pad}px" draggable="true" data-type="file" data-id="${escapeAttr(file.id)}">
    <span class="tree-icon file-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg></span>
    <span class="tree-label">${escapeHtml(file.title || file.filename)}</span>
  </div>`;
}

function initTreeEvents(container) {
  // Click — delegation (survives innerHTML changes)
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.tree-item');
    if (!item) return;
    const type = item.dataset.type;
    const id = item.dataset.id;
    if (type === 'folder') toggleFolder(id);
    else if (type === 'file') openViewer(id);
  });

  // Context menu — delegation
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const item = e.target.closest('.tree-item');
    if (item) {
      showContextMenu(e, item.dataset.type, item.dataset.id);
    } else if (AppState.currentProjectId) {
      showContextMenu(e, 'root', null);
    }
  });

  // Drag & drop — delegation
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.tree-item');
    if (!item) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: item.dataset.type, id: item.dataset.id
    }));
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.tree-item[data-type="folder"]');
    // Remove old highlights
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (item) item.classList.add('drag-over');
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const targetItem = e.target.closest('.tree-item[data-type="folder"]');
      const targetFolderId = targetItem ? targetItem.dataset.id : null;

      if (data.type === 'file') {
        await api(`/docs/${data.id}/move`, {
          method: 'PUT', body: JSON.stringify({ folderId: targetFolderId })
        });
        toast(targetFolderId ? '파일을 이동했습니다' : '파일을 루트로 이동했습니다', 'success');
      } else if (data.type === 'folder' && data.id !== targetFolderId) {
        await api(`/folders/${data.id}/move`, {
          method: 'PUT', body: JSON.stringify({ parentId: targetFolderId })
        });
        toast(targetFolderId ? '폴더를 이동했습니다' : '폴더를 루트로 이동했습니다', 'success');
      }
      await loadProjectTree(AppState.currentProjectId);
      await loadDocuments(AppState.currentProjectId);
    } catch {}
  });
}

function toggleFolder(folderId) {
  if (AppState.expandedFolders.has(folderId)) {
    AppState.expandedFolders.delete(folderId);
  } else {
    AppState.expandedFolders.add(folderId);
  }
  renderTreeView();
}
