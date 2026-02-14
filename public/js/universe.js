'use strict';

/* ============================================================
   Universe View — 3D Knowledge Space
   ============================================================ */

let _universeGraph = null;

/**
 * Open Universe view (called from sidebar menu)
 */
function openUniverse() {
  AppState.view = 'universe';
  AppState.universeActive = true;

  // Hide sidebar for fullscreen experience
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = 'none';

  renderMain();
}

/**
 * Render the Universe 3D canvas into the main area
 */
function renderUniverse(main) {
  // Activate fullscreen mode on main
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
          </div>
          <button class="universe-back-btn" onclick="closeUniverse()">
            <i data-lucide="arrow-left"></i>
            Workspace
          </button>
        </div>
      </div>
      <div class="universe-graph" id="universe-graph"></div>
      <div class="universe-loading" id="universe-loading">Loading universe data...</div>
    </div>
  `;

  // Re-render Lucide icons in the new DOM
  if (window.lucide) lucide.createIcons();

  // Initialize 3D Force Graph then load data
  initUniverseGraph();
  loadUniverseData();
}

/**
 * Fetch projects, documents, and tags → build graph nodes & links
 */
async function loadUniverseData() {
  const loadingEl = document.getElementById('universe-loading');
  try {
    // Fetch projects and tags in parallel
    const [projData, tagData] = await Promise.all([
      api('/projects'),
      api('/tags')
    ]);

    const projects = projData.projects || [];
    const tags = tagData.tags || [];

    // Fetch documents for all projects in parallel
    const docResults = await Promise.all(
      projects.map(p => api(`/projects/${p.id}/docs?limit=500`).catch(() => ({ documents: [] })))
    );

    // Build nodes and links
    const nodes = [];
    const links = [];
    const tagNodeMap = new Map(); // tagId → nodeId

    // 1) Project nodes (stars)
    projects.forEach(p => {
      nodes.push({
        id: `proj-${p.id}`,
        label: p.name,
        type: 'project',
        color: p.color || '#ffaa00',
        val: 30 // large node
      });
    });

    // 2) Tag nodes (satellites)
    tags.forEach(t => {
      const nodeId = `tag-${t.id}`;
      tagNodeMap.set(t.id, nodeId);
      nodes.push({
        id: nodeId,
        label: t.name,
        type: 'tag',
        color: t.color || '#c77dff',
        val: 6 + Math.min((t.usage_count || 0) * 2, 20)
      });
    });

    // 3) Document nodes (planets) + links
    projects.forEach((p, idx) => {
      const docs = docResults[idx].documents || [];
      docs.forEach(doc => {
        const docNodeId = `doc-${doc.id}`;
        nodes.push({
          id: docNodeId,
          label: doc.title || doc.filename,
          type: 'document',
          color: '#00b4d8',
          val: 10
        });

        // Link doc → project
        links.push({
          source: docNodeId,
          target: `proj-${p.id}`,
          type: 'doc-project'
        });

        // Link doc → tags
        if (doc.tags && doc.tags.length) {
          doc.tags.forEach(t => {
            const tagNodeId = tagNodeMap.get(t.id);
            if (tagNodeId) {
              links.push({
                source: docNodeId,
                target: tagNodeId,
                type: 'doc-tag'
              });
            }
          });
        }
      });
    });

    // Update graph
    if (_universeGraph) {
      _universeGraph.graphData({ nodes, links });

      // Zoom to fit after layout settles
      setTimeout(() => {
        if (_universeGraph) _universeGraph.zoomToFit(800, 60);
      }, 1500);
    }

    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';

    // Show empty hint if no data
    if (nodes.length === 0) {
      const hint = document.querySelector('.universe-empty-hint');
      if (hint) hint.textContent = 'No data yet — upload documents to see your universe';
    }

  } catch (e) {
    console.error('[Universe] Failed to load data:', e);
    if (loadingEl) loadingEl.textContent = 'Failed to load data';
  }
}

/**
 * Initialize the ForceGraph3D instance
 */
function initUniverseGraph() {
  const container = document.getElementById('universe-graph');
  if (!container) return;

  // Clean up previous instance
  if (_universeGraph) {
    _universeGraph._destructor && _universeGraph._destructor();
    _universeGraph = null;
  }

  _universeGraph = ForceGraph3D()(container)
    .graphData({ nodes: [], links: [] })
    .backgroundColor('#050505')
    .width(container.clientWidth)
    .height(container.clientHeight)
    .showNavInfo(false)
    // Node appearance
    .nodeVal(n => n.val || 10)
    .nodeColor(n => n.color || '#ffffff')
    .nodeOpacity(0.9)
    .nodeLabel(n => {
      const icon = n.type === 'project' ? '⭐' : n.type === 'tag' ? '🏷️' : '📄';
      return `${icon} ${n.label}`;
    })
    // Link appearance
    .linkWidth(l => l.type === 'doc-project' ? 1.2 : 0.6)
    .linkColor(l => l.type === 'doc-project' ? 'rgba(255,170,0,0.2)' : 'rgba(199,125,255,0.15)')
    .linkOpacity(0.6)
    // Force configuration
    .d3Force('charge').strength(-120);

  // Adjust link distance
  _universeGraph.d3Force('link').distance(l => l.type === 'doc-project' ? 60 : 90);

  // Handle resize
  const onResize = () => {
    if (_universeGraph && container.clientWidth > 0) {
      _universeGraph.width(container.clientWidth).height(container.clientHeight);
    }
  };
  window.addEventListener('resize', onResize);
  container._resizeHandler = onResize;
}

/**
 * Close Universe and return to workspace
 */
function closeUniverse() {
  // Clean up graph instance
  if (_universeGraph) {
    const container = document.getElementById('universe-graph');
    if (container && container._resizeHandler) {
      window.removeEventListener('resize', container._resizeHandler);
    }
    _universeGraph._destructor && _universeGraph._destructor();
    _universeGraph = null;
  }

  AppState.view = 'workspace';
  AppState.universeActive = false;

  // Restore sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = '';

  const main = document.getElementById('main');
  if (main) main.classList.remove('universe-active');

  renderMain();
}
