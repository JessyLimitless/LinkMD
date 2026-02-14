'use strict';

async function showShareDocModal(docId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <h3><i data-lucide="share-2" style="width:18px;height:18px"></i> 문서 공유 링크 생성</h3>
      <select id="share-expires">
        <option value="7d">7일 후 만료</option>
        <option value="30d">30일 후 만료</option>
        <option value="">만료 없음</option>
      </select>
      <div id="share-result"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
        <button class="btn btn-primary" id="share-create-btn" onclick="createShareLink('document','${escapeAttr(docId)}')"><i data-lucide="link" style="width:14px;height:14px"></i> 링크 생성</button>
      </div>
    </div>`;
  modal.classList.add('open');
  lucide.createIcons();
}

async function showShareProjectModal(projectId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <h3><i data-lucide="share-2" style="width:18px;height:18px"></i> 프로젝트 공유 링크 생성</h3>
      <select id="share-expires">
        <option value="7d">7일 후 만료</option>
        <option value="30d">30일 후 만료</option>
        <option value="">만료 없음</option>
      </select>
      <div id="share-result"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
        <button class="btn btn-primary" id="share-create-btn" onclick="createShareLink('project','${escapeAttr(projectId)}')"><i data-lucide="link" style="width:14px;height:14px"></i> 링크 생성</button>
      </div>
    </div>`;
  modal.classList.add('open');
  lucide.createIcons();
}

async function createShareLink(type, id) {
  const expiresIn = document.getElementById('share-expires').value || null;
  try {
    const data = await api(`/share/${type === 'document' ? 'doc' : 'project'}/${id}`, {
      method: 'POST', body: JSON.stringify({ expiresIn })
    });
    const url = data.shareUrl || '';
    document.getElementById('share-result').innerHTML = `
      <div class="share-url-box">
        <input id="share-url" value="${escapeAttr(url)}" readonly onclick="this.select()">
        <button class="btn btn-primary btn-sm" onclick="copyShareUrl()"><i data-lucide="copy" style="width:14px;height:14px"></i> 복사</button>
      </div>`;
    document.getElementById('share-create-btn').style.display = 'none';
    toast('공유 링크가 생성되었습니다', 'success');
    lucide.createIcons();
  } catch {}
}

function copyShareUrl() {
  const input = document.getElementById('share-url');
  if (input) { navigator.clipboard.writeText(input.value); toast('링크가 복사되었습니다', 'success'); }
}
