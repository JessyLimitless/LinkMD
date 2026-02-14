'use strict';

async function openViewer(docId) {
  try {
    const doc = await api(`/docs/${docId}`);
    AppState.viewingDoc = doc;
    AppState.view = 'viewer';
    renderMain();
  } catch {}
}

function renderViewer(main) {
  const doc = AppState.viewingDoc;
  if (!doc) return;

  const proj = AppState.projects.find(p => p.id === doc.project_id);
  const tags = (doc.tags || []).map(t =>
    `<span class="viewer-tag" style="background:${escapeAttr(t.color)}20;color:${escapeAttr(t.color)}">#${escapeHtml(t.name)} <span class="remove-tag" onclick="event.stopPropagation();removeDocTag('${escapeAttr(doc.id)}',${t.id})"><i data-lucide="x" style="width:10px;height:10px"></i></span></span>`
  ).join('');

  const rendered = typeof marked !== 'undefined' ? marked.parse(doc.content || '') : escapeHtml(doc.content);

  main.innerHTML = `
    <div class="viewer fade-in">
      <div class="viewer-sidebar">
        <div class="viewer-back" onclick="goBackToWorkspace()"><span class="back-icon"><i data-lucide="arrow-left" style="width:16px;height:16px"></i></span> 돌아가기</div>
        <div class="viewer-meta-title">프로젝트</div>
        <div class="viewer-meta-value">${proj ? escapeHtml(proj.name) : ''}</div>
        <div class="viewer-meta-title">파일명</div>
        <div class="viewer-meta-value" style="font-family:var(--font-mono);font-size:0.8rem">${escapeHtml(doc.filename)}</div>
        <div class="viewer-meta-title">태그</div>
        <div class="viewer-tags">${tags}
          <button class="viewer-add-tag" onclick="showAddTagModal('${escapeAttr(doc.id)}')"><i data-lucide="plus" style="width:12px;height:12px"></i> 태그</button>
        </div>
        <div class="viewer-meta-title">통계</div>
        <div class="viewer-stats">
          <span>헤딩: ${doc.heading_count || 0}</span>
          <span>코드블록: ${doc.code_block_count || 0}</span>
          <span>테이블: ${doc.table_count || 0}</span>
          <span>줄 수: ${doc.line_count || 0}</span>
          <span>크기: ${formatSize(doc.file_size)}</span>
        </div>
        <div class="viewer-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditor('${escapeAttr(doc.id)}')"><i data-lucide="edit-3" style="width:14px;height:14px"></i> 편집</button>
          <button class="btn btn-secondary btn-sm" onclick="showShareDocModal('${escapeAttr(doc.id)}')"><i data-lucide="share-2" style="width:14px;height:14px"></i> 공유</button>
          <button class="btn btn-primary btn-sm" onclick="AppState.selectedDocIds=new Set(['${escapeAttr(doc.id)}']);openExport()"><i data-lucide="download" style="width:14px;height:14px"></i> 내보내기</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDoc('${escapeAttr(doc.id)}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i> 삭제</button>
        </div>
      </div>
      <div class="viewer-content">
        <div class="md-render">${rendered}</div>
      </div>
    </div>`;
  lucide.createIcons();
}

function goBackToWorkspace() {
  AppState.view = 'workspace';
  AppState.viewingDoc = null;
  renderMain();
}

async function deleteDoc(id) {
  if (!confirm('문서를 삭제하시겠습니까?')) return;
  try {
    await api(`/docs/${id}`, { method: 'DELETE' });
    toast('문서가 삭제되었습니다', 'success');
    AppState.view = 'workspace';
    AppState.viewingDoc = null;
    await loadDocuments(AppState.currentProjectId);
    await loadProjects();
    renderProjectList();
  } catch {}
}
