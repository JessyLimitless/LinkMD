/* Preview — §6.10 */
'use strict';

async function openPreview(filename) {
  const sessionId = store.getState('sessionId');
  if (!sessionId) return;

  store.setState('loading.preview', true);
  try {
    const resp = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, filename })
    });
    const data = await resp.json();
    if (data.success) {
      const modal = document.getElementById('preview-modal');
      const title = document.getElementById('preview-title');
      const body = document.getElementById('preview-body');
      title.textContent = filename;
      body.innerHTML = data.html;
      modal.classList.add('open');
    } else {
      store.setState('error', data.error?.message || 'Preview failed');
    }
  } catch (err) {
    store.setState('error', err.message);
  } finally {
    store.setState('loading.preview', false);
  }
}

function closePreview() {
  document.getElementById('preview-modal')?.classList.remove('open');
}
