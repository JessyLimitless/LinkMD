'use strict';

async function openEditor(docId) {
  console.log('[openEditor] docId:', docId);
  try {
    const doc = await api(`/docs/${docId}`);
    console.log('[openEditor] doc loaded:', doc.id, doc.filename, 'content length:', (doc.content || '').length);
    AppState.editingDoc = doc;
    AppState.editorDirty = false;
    AppState.view = 'editor';
    renderMain();
    console.log('[openEditor] renderMain done, view:', AppState.view);
  } catch (e) {
    console.error('[openEditor] error:', e);
  }
}

function renderEditor(main) {
  console.log('[renderEditor] called, editingDoc:', AppState.editingDoc?.id);
  const doc = AppState.editingDoc;
  if (!doc) { console.warn('[renderEditor] no editingDoc'); return; }

  main.innerHTML = `
    <div class="editor-container fade-in">
      <div class="editor-toolbar">
        <button class="btn btn-secondary btn-sm" onclick="closeEditor()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          돌아가기
        </button>
        <span class="editor-filename">${escapeHtml(doc.filename)}</span>
        <span class="editor-dirty" id="editor-dirty-indicator" style="display:none">수정됨</span>
        <button class="btn btn-secondary btn-sm" id="editor-preview-btn" onclick="toggleEditorPreview()">미리보기</button>
        <button class="btn btn-primary btn-sm" onclick="saveDocument()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
          저장
        </button>
      </div>
      <div class="editor-body">
        <div class="editor-pane">
          <textarea id="editor-textarea" spellcheck="false">${escapeHtml(doc.content || '')}</textarea>
        </div>
        <div class="editor-preview" id="editor-preview" style="display:none">
          <div class="md-render" id="editor-preview-content"></div>
        </div>
      </div>
    </div>`;

  const textarea = document.getElementById('editor-textarea');
  if (textarea) {
    textarea.addEventListener('input', onEditorInput);
    textarea.addEventListener('keydown', onEditorKeydown);
    textarea.focus();
    console.log('[renderEditor] textarea ready, content length:', textarea.value.length);
  } else {
    console.error('[renderEditor] textarea not found after innerHTML set');
  }
}

function onEditorInput() {
  AppState.editorDirty = true;
  const indicator = document.getElementById('editor-dirty-indicator');
  if (indicator) indicator.style.display = '';

  // Update preview if visible
  const previewEl = document.getElementById('editor-preview');
  if (previewEl && previewEl.style.display !== 'none') {
    updateEditorPreview();
  }
}

function onEditorKeydown(e) {
  // Ctrl+S save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveDocument();
    return;
  }
  // Tab inserts spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    onEditorInput();
  }
}

function toggleEditorPreview() {
  const previewEl = document.getElementById('editor-preview');
  const btn = document.getElementById('editor-preview-btn');
  if (!previewEl) return;

  if (previewEl.style.display === 'none') {
    previewEl.style.display = '';
    if (btn) btn.textContent = '미리보기 끄기';
    updateEditorPreview();
  } else {
    previewEl.style.display = 'none';
    if (btn) btn.textContent = '미리보기';
  }
}

function updateEditorPreview() {
  const textarea = document.getElementById('editor-textarea');
  const content = document.getElementById('editor-preview-content');
  if (!textarea || !content) return;

  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(textarea.value || '');
  } else {
    content.textContent = textarea.value || '';
  }
}

async function saveDocument() {
  const doc = AppState.editingDoc;
  if (!doc) return;

  const textarea = document.getElementById('editor-textarea');
  if (!textarea) return;

  try {
    const content = textarea.value;
    const updated = await api(`/docs/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    AppState.editingDoc = updated;
    AppState.editorDirty = false;
    const indicator = document.getElementById('editor-dirty-indicator');
    if (indicator) indicator.style.display = 'none';
    toast('저장되었습니다', 'success');
  } catch (e) { console.error('[saveDocument] error:', e); }
}

function closeEditor() {
  if (AppState.editorDirty) {
    if (!confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) return;
  }
  AppState.editingDoc = null;
  AppState.editorDirty = false;
  AppState.view = 'workspace';
  renderMain();
}
