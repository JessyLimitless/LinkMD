'use strict';

/* ============================================================
   Graph Builder — Raw API data → ForceGraph3D { nodes, links }
   ============================================================ */

/**
 * Build graph data from API responses.
 * @param {Array} projects  - projects from GET /projects
 * @param {Array} tags      - tags from GET /tags
 * @param {Array} docsByProject - array parallel to projects, each { documents: [...] }
 * @returns {{ nodes: Array, links: Array }}
 */
function buildGraphData(projects, tags, docsByProject) {
  const nodes = [];
  const links = [];
  const tagNodeMap = new Map(); // tagId → tag node id string

  // ── 1) Project nodes ──
  projects.forEach(p => {
    nodes.push({
      id: `proj-${p.id}`,
      label: p.name,
      type: 'project',
      color: p.color || '#ffaa00',
      val: 25
    });
  });

  // ── 2) Tag nodes ──
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

  // ── 3) Document nodes + doc→project / doc→tag links ──
  // Also collect per-tag document lists for doc↔doc linking
  const tagToDocIds = new Map(); // tagId → Set<docNodeId>
  const docTagSets = new Map();  // docNodeId → Set<tagId>

  projects.forEach((p, idx) => {
    const docs = (docsByProject[idx] && docsByProject[idx].documents) || [];
    docs.forEach(doc => {
      const docNodeId = `doc-${doc.id}`;
      const docTagIds = [];

      nodes.push({
        id: docNodeId,
        label: doc.title || doc.filename,
        type: 'document',
        color: '#00b4d8',
        val: 10,
        projectId: p.id,
        tagIds: []
      });

      // Doc → Project link
      links.push({
        source: docNodeId,
        target: `proj-${p.id}`,
        type: 'doc-project'
      });

      // Doc → Tag links
      if (doc.tags && doc.tags.length) {
        doc.tags.forEach(t => {
          const tagNodeId = tagNodeMap.get(t.id);
          if (tagNodeId) {
            links.push({
              source: docNodeId,
              target: tagNodeId,
              type: 'doc-tag'
            });
            docTagIds.push(t.id);

            // Track tag→docs mapping
            if (!tagToDocIds.has(t.id)) tagToDocIds.set(t.id, new Set());
            tagToDocIds.get(t.id).add(docNodeId);
          }
        });
      }

      // Store this doc's tag set for weight calculation
      docTagSets.set(docNodeId, new Set(docTagIds));

      // Backfill tagIds on the node
      const node = nodes[nodes.length - 1];
      node.tagIds = docTagIds;
    });
  });

  // ── 4) Doc↔Doc links (shared tag based) ──
  const docDocSet = new Set(); // "docA||docB" dedup key
  const tagNameMap = new Map();
  tags.forEach(t => tagNameMap.set(t.id, t.name));

  tagToDocIds.forEach((docSet, tagId) => {
    const docArr = Array.from(docSet);
    for (let i = 0; i < docArr.length; i++) {
      for (let j = i + 1; j < docArr.length; j++) {
        const a = docArr[i];
        const b = docArr[j];
        const key = a < b ? `${a}||${b}` : `${b}||${a}`;

        if (docDocSet.has(key)) continue;
        docDocSet.add(key);

        // Calculate shared tags
        const tagsA = docTagSets.get(a) || new Set();
        const tagsB = docTagSets.get(b) || new Set();
        const shared = [];
        tagsA.forEach(tid => {
          if (tagsB.has(tid)) shared.push(tagNameMap.get(tid) || `tag-${tid}`);
        });

        if (shared.length > 0) {
          links.push({
            source: a,
            target: b,
            type: 'doc-doc',
            weight: shared.length,
            sharedTags: shared
          });
        }
      }
    }
  });

  return { nodes, links };
}
