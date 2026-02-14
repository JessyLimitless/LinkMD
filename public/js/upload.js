'use strict';

function setupUploadZone() {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;
  const input = zone.querySelector('input[type="file"]');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
}

async function handleFiles(fileList) {
  if (!AppState.currentProjectId) return toast('프로젝트를 먼저 선택해주세요', 'error');
  if (!fileList.length) return;

  const formData = new FormData();
  for (const f of fileList) formData.append('files', f);

  AppState.loading.upload = true;
  toast('업로드 중...', 'info');
  try {
    const data = await apiUpload(`/projects/${AppState.currentProjectId}/upload`, formData);
    toast(`${data.totalFiles}개 파일이 아카이빙되었습니다`, 'success');
    await loadDocuments(AppState.currentProjectId);
    await loadProjects();
    renderProjectList();
  } catch (e) {
    toast(e.message, 'error');
  } finally { AppState.loading.upload = false; }
}
