'use strict';

function renderProjectList() {
  const list = document.getElementById('project-list');
  if (!list) return;
  list.innerHTML = AppState.projects.map(p => `
    <div class="sidebar-item ${AppState.currentProjectId === p.id ? 'active' : ''}" onclick="loadDocuments('${escapeAttr(p.id)}')">
      <span class="item-icon"><i data-lucide="folder" style="width:16px;height:16px"></i></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</span>
      <span class="count">${p.doc_count || 0}</span>
    </div>
  `).join('');
  lucide.createIcons();
}

function highlightActiveProject() {
  renderProjectList();
}

async function showCreateProjectModal() {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <h3>새 프로젝트</h3>
      <input id="project-name" placeholder="프로젝트 이름" autofocus>
      <input id="project-desc" placeholder="설명 (선택)">
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="createProject()">생성</button>
      </div>
    </div>`;
  modal.classList.add('open');
  setTimeout(() => document.getElementById('project-name')?.focus(), 100);
}

async function createProject() {
  const name = document.getElementById('project-name').value.trim();
  const description = document.getElementById('project-desc').value.trim();
  if (!name) return toast('프로젝트 이름을 입력해주세요', 'error');
  try {
    await api('/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
    closeModal();
    await loadProjects();
    renderProjectList();
    toast('프로젝트가 생성되었습니다', 'success');
  } catch {}
}

async function deleteProject(id) {
  if (!confirm('프로젝트를 삭제하시겠습니까? 모든 문서가 함께 삭제됩니다.')) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    AppState.currentProjectId = null;
    AppState.documents = [];
    await loadProjects();
    renderSidebar();
    renderMain();
    toast('프로젝트가 삭제되었습니다', 'success');
  } catch {}
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-overlay').innerHTML = '';
}
