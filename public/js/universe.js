'use strict';

/* ============================================================
   Universe View — 3D Knowledge Space (Enhanced)
   ============================================================ */

let _universeGraph = null;
let _universeHighlight = {
  hoveredNode: null,
  connectedNodes: new Set(),
  connectedLinks: new Set()
};
let _universeFilter = { type: null, id: null, activeNodeIds: null, activeLinks: null };
let _universeData = { projects: [], tags: [], graphData: null };
let _universeDetailDoc = null;
let _universeSidebarOpen = true;

/* ── Open / Close ── */

function openUniverse() {
  AppState.view = 'universe';
  AppState.universeActive = true;
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = 'none';
  renderMain();
}

function renderUniverse(main) {
  main.classList.add('universe-active');
  main.innerHTML = `
    <div class="universe-container">
      <div class="universe-header">
        <div class="universe-title">
          <i data-lucide="orbit" class="title-icon"></i>
          LinkMD Universe
        </div>
        <div class="universe-header-right">
          <div class="universe-legend">
            <span class="legend-item"><span class="legend-dot" style="background:#ffaa00"></span>Project</span>
            <span class="legend-item"><span class="legend-dot" style="background:#00b4d8"></span>Document</span>
            <span class="legend-item"><span class="legend-dot" style="background:#c77dff"></span>Tag</span>
            <span class="legend-item"><span class="legend-dot" style="background:#00e5ff"></span>Shared</span>
          </div>
          <button class="universe-back-btn" onclick="closeUniverse()">
            <i data-lucide="arrow-left"></i>
            Workspace
          </button>
        </div>
      </div>
      <div class="universe-graph" id="universe-graph"></div>
      <div class="universe-loading" id="universe-loading">Loading universe data...</div>

      <!-- Cockpit Sidebar -->
      <div class="ucockpit open" id="ucockpit">
        <div class="ucockpit-header">
          <span class="ucockpit-title">COCKPIT</span>
          <button class="ucockpit-toggle" onclick="_toggleCockpit()">◀</button>
        </div>
        <div class="ucockpit-body" id="ucockpit-body"></div>
      </div>
      <button class="ucockpit-float-btn" id="ucockpit-float-btn" style="display:none" onclick="_toggleCockpit()">▶</button>

      <!-- Document Detail Panel -->
      <div class="udetail-overlay" id="udetail-overlay" onclick="_closeDetail()"></div>
      <div class="udetail" id="udetail">
        <div class="udetail-header">
          <span class="udetail-title">Document Detail</span>
          <button class="udetail-close" onclick="_closeDetail()">&times;</button>
        </div>
        <div class="udetail-body" id="udetail-body"></div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  initUniverseGraph();
  loadUniverseData();
}

/* ── Data Loading (uses graph-builder.js) ── */

async function loadUniverseData() {
  const loadingEl = document.getElementById('universe-loading');
  try {
    const [projData, tagData] = await Promise.all([
      api('/projects'),
      api('/tags')
    ]);
    const projects = projData.projects || [];
    const tags = tagData.tags || [];

    const docResults = await Promise.all(
      projects.map(p => api(`/projects/${p.id}/docs?limit=500`).catch(() => ({ documents: [] })))
    );

    // Use graph-builder
    const graphData = buildGraphData(projects, tags, docResults);

    // Cache data for cockpit
    _universeData.projects = projects;
    _universeData.tags = tags;
    _universeData.graphData = graphData;
    // Flatten all docs for cockpit usage
    _universeData.allDocs = [];
    projects.forEach((p, idx) => {
      const docs = (docResults[idx] && docResults[idx].documents) || [];
      docs.forEach(d => { d._projectId = p.id; d._projectName = p.name; });
      _universeData.allDocs.push(...docs);
    });

    if (_universeGraph) {
      _universeGraph.graphData(graphData);
      setTimeout(() => {
        if (_universeGraph) _universeGraph.zoomToFit(800, 60);
      }, 1500);
    }

    if (loadingEl) loadingEl.style.display = 'none';

    // Render cockpit with cached data
    _renderCockpitContent();

    if (graphData.nodes.length === 0) {
      const hint = document.querySelector('.universe-empty-hint');
      if (hint) hint.textContent = 'No data yet — upload documents to see your universe';
    }
  } catch (e) {
    console.error('[Universe] Failed to load data:', e);
    if (loadingEl) loadingEl.textContent = 'Failed to load data';
  }
}

/* ── Create Starfield Background ── */

function _createStarfield() {
  const THREE = window.THREE;
  const count = 5000;
  const positions = new Float32Array(count * 3);
  const spread = 4000;

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

/* ── Label Sprite (Canvas → Texture → Sprite) ── */

function _createLabelSprite(text, fontSize, yOffset) {
  const THREE = window.THREE;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Truncate long labels
  const label = text.length > 15 ? text.slice(0, 14) + '…' : text;

  const font = `bold ${fontSize}px sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(label);
  const textWidth = metrics.width;

  const padding = fontSize * 0.5;
  const cw = textWidth + padding * 2;
  const ch = fontSize * 1.6;
  canvas.width = cw;
  canvas.height = ch;

  // Background rounded rect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  const r = fontSize * 0.3;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(cw - r, 0);
  ctx.quadraticCurveTo(cw, 0, cw, r);
  ctx.lineTo(cw, ch - r);
  ctx.quadraticCurveTo(cw, ch, cw - r, ch);
  ctx.lineTo(r, ch);
  ctx.quadraticCurveTo(0, ch, 0, ch - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cw / 2, ch / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);

  // Scale: maintain aspect ratio
  const aspect = cw / ch;
  const baseScale = fontSize === 40 ? 12 : fontSize === 32 ? 8 : 6;
  sprite.scale.set(baseScale * aspect, baseScale, 1);
  sprite.position.set(0, yOffset, 0);

  return sprite;
}

/* ── Custom Node Three Object (Glow Effect) ── */

function _createNodeObject(node) {
  const THREE = window.THREE;
  const group = new THREE.Group();

  // Size & glow config per type
  let radius, glowScale, emissiveIntensity;
  if (node.type === 'project') {
    radius = 5;
    glowScale = 2.8;
    emissiveIntensity = 0.8;
  } else if (node.type === 'document') {
    radius = 3;
    glowScale = 2.4;
    emissiveIntensity = 0.5;
  } else {
    // tag
    radius = 2;
    glowScale = 2.0;
    emissiveIntensity = 0.3;
  }

  const color = new THREE.Color(node.color || '#ffffff');

  // Inner core sphere (solid, emissive)
  const coreMat = new THREE.MeshPhongMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    transparent: true,
    opacity: 0.95
  });
  const coreGeo = new THREE.SphereGeometry(radius, 20, 20);
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // Outer glow sphere (translucent, larger)
  const glowMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide
  });
  const glowGeo = new THREE.SphereGeometry(radius * glowScale, 16, 16);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  // Store references for hover dimming
  group.__coreMat = coreMat;
  group.__glowMat = glowMat;
  group.__origOpacity = 0.95;
  group.__origGlowOpacity = 0.12;

  // Text label sprite
  let labelFontSize, labelYOffset;
  if (node.type === 'project') {
    labelFontSize = 40; labelYOffset = radius + 6;
  } else if (node.type === 'document') {
    labelFontSize = 32; labelYOffset = radius + 4;
  } else {
    labelFontSize = 28; labelYOffset = radius + 3;
  }
  const labelSprite = _createLabelSprite(node.label || '', labelFontSize, labelYOffset);
  group.add(labelSprite);
  group.__labelSprite = labelSprite;

  return group;
}

/* ── Link Colors ── */

const _linkColors = {
  'doc-project': 'rgba(255, 170, 0, 0.25)',
  'doc-tag':     'rgba(199, 125, 255, 0.2)',
  'doc-doc':     'rgba(0, 229, 255, 0.35)'
};

function _linkColor(link) {
  if (link.type === 'doc-doc') {
    const w = Math.min(link.weight || 1, 5);
    const alpha = 0.15 + w * 0.1;
    return `rgba(0, 229, 255, ${alpha})`;
  }
  return _linkColors[link.type] || 'rgba(255,255,255,0.1)';
}

function _linkWidth(link) {
  if (link.type === 'doc-project') return 1.2;
  if (link.type === 'doc-doc') return 0.6 + Math.min((link.weight || 1) * 0.4, 2);
  return 0.6;
}

/* ── Hover Highlight Logic ── */

function _onNodeHover(node) {
  const container = document.getElementById('universe-graph');
  if (container) container.style.cursor = node ? 'pointer' : 'default';

  const hl = _universeHighlight;
  hl.hoveredNode = node || null;
  hl.connectedNodes.clear();
  hl.connectedLinks.clear();

  if (node && _universeGraph) {
    const data = _universeGraph.graphData();
    data.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === node.id || tgtId === node.id) {
        hl.connectedNodes.add(srcId);
        hl.connectedNodes.add(tgtId);
        hl.connectedLinks.add(link);
      }
    });
  }

  // Refresh appearance immediately (tick loop may have stopped)
  _applyNodeVisuals();
  if (_universeGraph) {
    _universeGraph.linkColor(_universeGraph.linkColor());
  }
}

/* ── Click → Context-Aware Action ── */

function _onNodeClick(node) {
  if (!node || !_universeGraph) return;

  if (node.type === 'document') {
    // Zoom in + open detail panel
    const distance = 80;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    _universeGraph.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      { x: node.x, y: node.y, z: node.z },
      2000
    );
    _openDetail(node);
  } else if (node.type === 'project') {
    const rawId = parseInt(node.id.replace('proj-', ''), 10);
    _filterByProject(rawId);
  } else if (node.type === 'tag') {
    const rawId = parseInt(node.id.replace('tag-', ''), 10);
    _filterByTag(rawId);
  }
}

/* ── Cockpit Toggle ── */

function _toggleCockpit() {
  _universeSidebarOpen = !_universeSidebarOpen;
  const el = document.getElementById('ucockpit');
  const floatBtn = document.getElementById('ucockpit-float-btn');
  if (el) {
    el.classList.toggle('open', _universeSidebarOpen);
    el.classList.toggle('closed', !_universeSidebarOpen);
  }
  if (floatBtn) {
    floatBtn.style.display = _universeSidebarOpen ? 'none' : 'flex';
  }
}

/* ── Cockpit Rendering ── */

function _renderCockpitContent() {
  const body = document.getElementById('ucockpit-body');
  if (!body) return;

  body.innerHTML =
    _renderCockpitStats() +
    _renderCockpitFilterBadge() +
    _renderCockpitProjects() +
    _renderCockpitTags() +
    _renderCockpitRecent();
}

function _renderCockpitStats() {
  const d = _universeData;
  const docCount = d.allDocs ? d.allDocs.length : 0;
  const linkCount = d.graphData ? d.graphData.links.length : 0;
  const projCount = d.projects.length;
  const tagCount = d.tags.length;

  return `<div class="ucockpit-section">
    <div class="ucockpit-section-title">Stats</div>
    <div class="ucockpit-stats">
      <div class="ucockpit-stat"><span class="stat-num">${docCount}</span><span class="stat-label">Docs</span></div>
      <div class="ucockpit-stat"><span class="stat-num">${linkCount}</span><span class="stat-label">Links</span></div>
      <div class="ucockpit-stat"><span class="stat-num">${projCount}</span><span class="stat-label">Projects</span></div>
      <div class="ucockpit-stat"><span class="stat-num">${tagCount}</span><span class="stat-label">Tags</span></div>
    </div>
  </div>`;
}

function _renderCockpitFilterBadge() {
  const f = _universeFilter;
  if (!f.type) return '';
  const label = f.type === 'project'
    ? (_universeData.projects.find(p => p.id === f.id) || {}).name || 'Project'
    : (_universeData.tags.find(t => t.id === f.id) || {}).name || 'Tag';
  const icon = f.type === 'project' ? '⭐' : '🏷️';
  return `<div class="ucockpit-filter-badge">
    <span>${icon} ${label}</span>
    <button class="ucockpit-reset-btn" onclick="_resetFilter()">✕ 전체보기</button>
  </div>`;
}

function _renderCockpitProjects() {
  const projects = _universeData.projects;
  if (!projects.length) return '';
  const f = _universeFilter;

  // Count docs per project
  const docCountMap = {};
  (_universeData.allDocs || []).forEach(d => {
    docCountMap[d._projectId] = (docCountMap[d._projectId] || 0) + 1;
  });

  const items = projects.map(p => {
    const active = f.type === 'project' && f.id === p.id ? ' active' : '';
    const count = docCountMap[p.id] || 0;
    return `<div class="ucockpit-list-item${active}" onclick="_filterByProject(${p.id})">
      <span class="ucockpit-item-dot" style="background:${p.color || '#ffaa00'}"></span>
      <span class="ucockpit-item-label">${p.name}</span>
      <span class="ucockpit-item-badge">${count}</span>
    </div>`;
  }).join('');

  return `<div class="ucockpit-section">
    <div class="ucockpit-section-title">Projects</div>
    ${items}
  </div>`;
}

function _renderCockpitTags() {
  const tags = _universeData.tags;
  if (!tags.length) return '';
  const f = _universeFilter;

  const items = tags.map(t => {
    const active = f.type === 'tag' && f.id === t.id ? ' active' : '';
    return `<div class="ucockpit-list-item${active}" onclick="_filterByTag(${t.id})">
      <span class="ucockpit-item-dot" style="background:${t.color || '#c77dff'}"></span>
      <span class="ucockpit-item-label">${t.name}</span>
      <span class="ucockpit-item-badge">${t.usage_count || 0}</span>
    </div>`;
  }).join('');

  return `<div class="ucockpit-section">
    <div class="ucockpit-section-title">Tags</div>
    ${items}
  </div>`;
}

function _renderCockpitRecent() {
  const docs = _universeData.allDocs || [];
  if (!docs.length) return '';
  const sorted = [...docs].sort((a, b) => {
    const da = a.created_at || a.uploaded_at || '';
    const db = b.created_at || b.uploaded_at || '';
    return db.localeCompare(da);
  });
  const recent = sorted.slice(0, 5);

  const items = recent.map(d => {
    return `<div class="ucockpit-list-item" onclick="_openDetailById(${d.id})">
      <span class="ucockpit-item-icon">📄</span>
      <span class="ucockpit-item-label">${d.title || d.filename}</span>
    </div>`;
  }).join('');

  return `<div class="ucockpit-section">
    <div class="ucockpit-section-title">Recent</div>
    ${items}
  </div>`;
}

/* ── Filter Logic ── */

function _filterByProject(projectId) {
  if (!_universeData.graphData) return;
  const data = _universeData.graphData;

  // Toggle off if same filter
  if (_universeFilter.type === 'project' && _universeFilter.id === projectId) {
    _resetFilter();
    return;
  }

  const projNodeId = `proj-${projectId}`;
  const activeNodeIds = new Set([projNodeId]);

  // Find doc nodes belonging to this project
  data.nodes.forEach(n => {
    if (n.type === 'document' && n.projectId === projectId) {
      activeNodeIds.add(n.id);
      // Also add their tag nodes
      (n.tagIds || []).forEach(tid => activeNodeIds.add(`tag-${tid}`));
    }
  });

  // Active links: both ends in activeNodeIds
  const activeLinks = new Set();
  data.links.forEach(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    if (activeNodeIds.has(srcId) && activeNodeIds.has(tgtId)) {
      activeLinks.add(l);
    }
  });

  _universeFilter = { type: 'project', id: projectId, activeNodeIds, activeLinks };

  _zoomToCluster(activeNodeIds);
  _renderCockpitContent();
  _applyNodeVisuals();
  if (_universeGraph) _universeGraph.linkColor(_universeGraph.linkColor());
}

function _filterByTag(tagId) {
  if (!_universeData.graphData) return;
  const data = _universeData.graphData;

  // Toggle off if same filter
  if (_universeFilter.type === 'tag' && _universeFilter.id === tagId) {
    _resetFilter();
    return;
  }

  const tagNodeId = `tag-${tagId}`;
  const activeNodeIds = new Set([tagNodeId]);

  // Find doc nodes that have this tag
  data.nodes.forEach(n => {
    if (n.type === 'document' && (n.tagIds || []).includes(tagId)) {
      activeNodeIds.add(n.id);
      // Also add their project node
      if (n.projectId) activeNodeIds.add(`proj-${n.projectId}`);
    }
  });

  const activeLinks = new Set();
  data.links.forEach(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    if (activeNodeIds.has(srcId) && activeNodeIds.has(tgtId)) {
      activeLinks.add(l);
    }
  });

  _universeFilter = { type: 'tag', id: tagId, activeNodeIds, activeLinks };

  _zoomToCluster(activeNodeIds);
  _renderCockpitContent();
  _applyNodeVisuals();
  if (_universeGraph) _universeGraph.linkColor(_universeGraph.linkColor());
}

function _filterByConnected(nodeId) {
  if (!_universeData.graphData) return;
  const data = _universeData.graphData;

  const activeNodeIds = new Set([nodeId]);
  const activeLinks = new Set();

  data.links.forEach(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    if (srcId === nodeId || tgtId === nodeId) {
      activeNodeIds.add(srcId);
      activeNodeIds.add(tgtId);
      activeLinks.add(l);
    }
  });

  _universeFilter = { type: 'connected', id: nodeId, activeNodeIds, activeLinks };

  _zoomToCluster(activeNodeIds);
  _renderCockpitContent();
  _applyNodeVisuals();
  if (_universeGraph) _universeGraph.linkColor(_universeGraph.linkColor());
}

function _resetFilter() {
  _universeFilter = { type: null, id: null, activeNodeIds: null, activeLinks: null };
  _renderCockpitContent();
  _applyNodeVisuals();
  if (_universeGraph) {
    _universeGraph.zoomToFit(800, 60);
    _universeGraph.linkColor(_universeGraph.linkColor());
  }
}

function _zoomToCluster(activeNodeIds) {
  if (!_universeGraph) return;
  const data = _universeGraph.graphData();
  let sumX = 0, sumY = 0, sumZ = 0, count = 0;

  data.nodes.forEach(n => {
    if (activeNodeIds.has(n.id) && n.x != null) {
      sumX += n.x; sumY += n.y; sumZ += n.z;
      count++;
    }
  });

  if (count === 0) return;
  const cx = sumX / count, cy = sumY / count, cz = sumZ / count;
  const distance = Math.max(120, count * 15);
  const distRatio = 1 + distance / (Math.hypot(cx, cy, cz) || 1);

  _universeGraph.cameraPosition(
    { x: cx * distRatio, y: cy * distRatio, z: cz * distRatio },
    { x: cx, y: cy, z: cz },
    2000
  );
}

/* ── Document Detail Panel ── */

async function _openDetail(node) {
  const docId = parseInt(node.id.replace('doc-', ''), 10);
  if (!docId) return;

  try {
    const doc = await api(`/docs/${docId}`);
    _universeDetailDoc = doc;
    _renderDetailContent(doc);
    document.getElementById('udetail').classList.add('open');
    document.getElementById('udetail-overlay').classList.add('open');
  } catch (e) {
    console.error('[Universe] Failed to fetch doc detail:', e);
  }
}

async function _openDetailById(docId) {
  if (!docId) return;
  // Find the node to zoom to
  if (_universeGraph) {
    const data = _universeGraph.graphData();
    const node = data.nodes.find(n => n.id === `doc-${docId}`);
    if (node && node.x != null) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      _universeGraph.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        { x: node.x, y: node.y, z: node.z },
        2000
      );
    }
  }
  try {
    const doc = await api(`/docs/${docId}`);
    _universeDetailDoc = doc;
    _renderDetailContent(doc);
    document.getElementById('udetail').classList.add('open');
    document.getElementById('udetail-overlay').classList.add('open');
  } catch (e) {
    console.error('[Universe] Failed to fetch doc detail:', e);
  }
}

function _renderDetailContent(doc) {
  const body = document.getElementById('udetail-body');
  if (!body) return;

  const title = doc.title || doc.filename || 'Untitled';
  const projName = doc._projectName || (_universeData.projects.find(p => p.id === doc.project_id) || {}).name || '-';

  // Tags
  const tagChips = (doc.tags || []).map(t =>
    `<span class="udetail-tag" onclick="_filterByTag(${t.id})" style="border-color:${t.color || '#c77dff'}">${t.name}</span>`
  ).join('');

  // MD preview (truncated to 500 chars)
  let mdPreview = '';
  if (doc.md_content) {
    const truncated = doc.md_content.length > 500 ? doc.md_content.slice(0, 500) + '...' : doc.md_content;
    mdPreview = window.marked ? marked.parse(truncated) : `<pre>${truncated}</pre>`;
  }

  // Connection count
  let connCount = 0;
  if (_universeData.graphData) {
    const nodeId = `doc-${doc.id}`;
    _universeData.graphData.links.forEach(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (srcId === nodeId || tgtId === nodeId) connCount++;
    });
  }

  body.innerHTML = `
    <div class="udetail-doc-title">${title}</div>
    <div class="udetail-meta">
      <span class="udetail-meta-item">⭐ ${projName}</span>
      <span class="udetail-meta-item">🔗 ${connCount} connections</span>
    </div>
    ${tagChips ? `<div class="udetail-tags">${tagChips}</div>` : ''}
    ${mdPreview ? `<div class="udetail-preview">${mdPreview}</div>` : '<div class="udetail-preview udetail-empty">No content preview</div>'}
    <div class="udetail-actions">
      <button class="udetail-action-btn primary" onclick="_goToViewer(${doc.id})">📄 문서 열기</button>
      <button class="udetail-action-btn" onclick="_universeAutoTag(${doc.id})">✨ 태그 자동 추출</button>
      <button class="udetail-action-btn" onclick="_filterByConnected('doc-${doc.id}')">🔗 연결 문서 보기</button>
    </div>
  `;
}

function _closeDetail() {
  document.getElementById('udetail').classList.remove('open');
  document.getElementById('udetail-overlay').classList.remove('open');
  _universeDetailDoc = null;
}

function _goToViewer(docId) {
  closeUniverse();
  setTimeout(() => openViewer(docId), 200);
}

function _universeAutoTag(docId) {
  showAutoTagModal(docId);
}

/* ── Apply Node Visuals (hover + filter opacity) ── */

function _applyNodeVisuals() {
  if (!_universeGraph) return;
  const hl = _universeHighlight;
  const f = _universeFilter;
  const data = _universeGraph.graphData();

  data.nodes.forEach(n => {
    const obj = n.__threeObj;
    if (!obj || !obj.__coreMat) return;

    let coreOpacity, glowOpacity;
    if (hl.hoveredNode) {
      if (n.id === hl.hoveredNode.id || hl.connectedNodes.has(n.id)) {
        coreOpacity = 1.0;
        glowOpacity = 0.2;
      } else {
        coreOpacity = 0.08;
        glowOpacity = 0.01;
      }
    } else if (f.activeNodeIds) {
      if (f.activeNodeIds.has(n.id)) {
        coreOpacity = obj.__origOpacity;
        glowOpacity = obj.__origGlowOpacity;
      } else {
        coreOpacity = 0.08;
        glowOpacity = 0.01;
      }
    } else {
      coreOpacity = obj.__origOpacity;
      glowOpacity = obj.__origGlowOpacity;
    }

    obj.__coreMat.opacity = coreOpacity;
    obj.__glowMat.opacity = glowOpacity;
    if (obj.__labelSprite) {
      obj.__labelSprite.material.opacity = coreOpacity;
    }
  });
}

/* ── Node Tooltip ── */

function _nodeTooltip(node) {
  const icon = node.type === 'project' ? '⭐' : node.type === 'tag' ? '🏷️' : '📄';
  const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
  return `<div class="universe-tooltip">
    <div class="tooltip-type">${icon} ${typeLabel}</div>
    <div class="tooltip-label">${node.label}</div>
  </div>`;
}

/* ── Link Tooltip ── */

function _linkTooltip(link) {
  if (link.type === 'doc-doc' && link.sharedTags) {
    return `<div class="universe-tooltip">
      <div class="tooltip-type">🔗 Shared Tags</div>
      <div class="tooltip-label">${link.sharedTags.join(', ')}</div>
    </div>`;
  }
  return '';
}

/* ── Initialize ForceGraph3D ── */

function initUniverseGraph() {
  const container = document.getElementById('universe-graph');
  if (!container) return;

  if (_universeGraph) {
    _universeGraph._destructor && _universeGraph._destructor();
    _universeGraph = null;
  }

  _universeHighlight = { hoveredNode: null, connectedNodes: new Set(), connectedLinks: new Set() };

  const Graph = ForceGraph3D()(container)
    .graphData({ nodes: [], links: [] })
    .backgroundColor('#050505')
    .width(container.clientWidth)
    .height(container.clientHeight)
    .showNavInfo(false)

    // ── Node rendering ──
    .nodeThreeObject(node => _createNodeObject(node))
    .nodeThreeObjectExtend(false)
    .nodeVal(n => n.val || 10)
    .nodeLabel(n => _nodeTooltip(n))

    // ── Link rendering ──
    .linkWidth(l => _linkWidth(l))
    .linkColor(l => {
      const hl = _universeHighlight;
      const f = _universeFilter;
      // Hover takes priority
      if (hl.hoveredNode) {
        return hl.connectedLinks.has(l) ? _linkColor(l) : 'rgba(255,255,255,0.02)';
      }
      // Filter dimming
      if (f.activeLinks) {
        return f.activeLinks.has(l) ? _linkColor(l) : 'rgba(255,255,255,0.02)';
      }
      return _linkColor(l);
    })
    .linkOpacity(0.8)
    .linkLabel(l => _linkTooltip(l))

    // ── Link particles ──
    .linkDirectionalParticles(l => l.type === 'doc-doc' ? 3 : 2)
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth(l => l.type === 'doc-doc' ? 2 : 1.5)
    .linkDirectionalParticleColor(l => {
      if (l.type === 'doc-project') return '#ffaa00';
      if (l.type === 'doc-tag') return '#c77dff';
      return '#00e5ff';
    })

    // ── Interaction ──
    .onNodeHover(node => _onNodeHover(node))
    .onNodeClick(node => _onNodeClick(node));

  // Force configuration
  Graph.d3Force('charge').strength(-120);
  Graph.d3Force('link').distance(l => {
    if (l.type === 'doc-project') return 60;
    if (l.type === 'doc-doc') return 40 + (1 / (l.weight || 1)) * 30;
    return 90;
  });

  // ── Add starfield to scene ──
  try {
    const scene = Graph.scene();
    if (scene) {
      scene.add(_createStarfield());

      // Add ambient + point lights for Phong material
      const THREE = window.THREE;
      if (THREE) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 0.8, 0);
        pointLight.position.set(200, 200, 200);
        scene.add(pointLight);
      }
    }
  } catch (e) {
    console.warn('[Universe] Starfield/lights setup:', e.message);
  }

  // ── Engine tick — keep visuals in sync during simulation ──
  Graph.onEngineTick(() => _applyNodeVisuals());

  _universeGraph = Graph;

  // Handle resize
  const onResize = () => {
    if (_universeGraph && container.clientWidth > 0) {
      _universeGraph.width(container.clientWidth).height(container.clientHeight);
    }
  };
  window.addEventListener('resize', onResize);
  container._resizeHandler = onResize;
}

/* ── Close Universe ── */

function closeUniverse() {
  if (_universeGraph) {
    const container = document.getElementById('universe-graph');
    if (container && container._resizeHandler) {
      window.removeEventListener('resize', container._resizeHandler);
    }
    _universeGraph._destructor && _universeGraph._destructor();
    _universeGraph = null;
  }

  _universeHighlight = { hoveredNode: null, connectedNodes: new Set(), connectedLinks: new Set() };
  _universeFilter = { type: null, id: null, activeNodeIds: null, activeLinks: null };
  _universeData = { projects: [], tags: [], graphData: null };
  _universeDetailDoc = null;
  _universeSidebarOpen = true;

  AppState.view = 'workspace';
  AppState.universeActive = false;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = '';

  const main = document.getElementById('main');
  if (main) main.classList.remove('universe-active');

  renderMain();
}
