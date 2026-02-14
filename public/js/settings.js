/* Settings Panel — §6.11 */
'use strict';

function openSettings() {
  store.setState('settingsOpen', true);
}

function closeSettings() {
  store.setState('settingsOpen', false);
}

function renderSettingsPanel(state) {
  const overlay = document.getElementById('settings-overlay');
  const panel = document.getElementById('settings-panel');
  if (!overlay || !panel) return;

  if (state.settingsOpen) {
    overlay.classList.add('open');
    panel.classList.add('open');
  } else {
    overlay.classList.remove('open');
    panel.classList.remove('open');
  }
}

function initSettings() {
  // Format buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      store.setState('convertSettings.outputFormat', btn.dataset.format);
    });
  });

  // Template options
  document.querySelectorAll('.template-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.template-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      store.setState('convertSettings.template', opt.dataset.template);
    });
  });

  // Strategy buttons
  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      store.setState('convertSettings.headingStrategy', btn.dataset.strategy);
    });
  });

  // Detail toggle
  const detailToggle = document.getElementById('detail-toggle');
  const detailContent = document.getElementById('detail-content');
  if (detailToggle && detailContent) {
    detailToggle.addEventListener('click', () => {
      detailContent.classList.toggle('open');
      detailToggle.querySelector('.toggle-icon').textContent =
        detailContent.classList.contains('open') ? '\u25B2' : '\u25BC';
    });
  }

  // Form inputs
  const inputMap = {
    'input-title': 'convertSettings.title',
    'input-author': 'convertSettings.author',
    'input-date': 'convertSettings.date',
  };
  for (const [id, path] of Object.entries(inputMap)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => store.setState(path, el.value));
  }

  // Checkboxes
  const checkMap = {
    'check-toc': 'convertSettings.toc',
    'check-pagebreak': 'convertSettings.pageBreak',
    'check-highlight': 'convertSettings.highlight',
    'check-cover': 'convertSettings.coverPage',
  };
  for (const [id, path] of Object.entries(checkMap)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => store.setState(path, el.checked));
  }

  // Close
  document.getElementById('settings-overlay')?.addEventListener('click', closeSettings);
  document.getElementById('settings-close')?.addEventListener('click', closeSettings);
}
