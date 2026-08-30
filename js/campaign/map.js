// =============================================================
// ============ CAMPAIGN MAP ======================================
// =============================================================
// Map generation (a DAG of nodes laid out in floors, Slay-the-Spire
// style) + the scrollable map screen UI. Self-contained module, same
// pattern as js/team-select.js — owns its own DOM (#campaign-map-mount)
// and a small seeded RNG so a run's layout is reproducible from
// CampaignRun.seed (see CAMPAIGN_DESIGN.md §5.2).
//
// This module only builds/renders the graph and lets the player walk
// it — it does NOT resolve what happens at a node (see
// js/campaign/nodes.js for that); clicking a reachable node hands off
// to Campaign.Nodes.enter(node).

const CampaignMap = (() => {
  let root = null;
  let mapGraph = null; // { floors: [ [node,...], ... ], byId: {id:node} }

  // `accent` keys into the --cm-accent-* CSS custom properties (see
  // css/campaign-map.css) so each node type reads as its own "party"
  // on the trail rather than one uniform button style. Icons are SVG
  // (js/campaign/map-icons.js), not emoji — see that file for why.
  const NODE_TYPES = {
    battle: { label: "Battle", accent: "battle" },
    elite: { label: "Elite", accent: "elite" },
    chest: { label: "Chest", accent: "chest" },
    heal: { label: "Rest", accent: "heal" },
    charPick: { label: "Recruit", accent: "charPick" },
    event: { label: "Event", accent: "event" },
    shop: { label: "Shop", accent: "shop" },
    training: { label: "Training", accent: "training" },
    revival: { label: "Revive", accent: "revival" },
    boss: { label: "Boss", accent: "boss" },
  };

  function ensureRoot() {
    if (root) return root;
    root = document.getElementById('campaign-map-mount');
    return root;
  }

  // ---- Small seeded RNG (mulberry32) so a run's map is reproducible ----
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ---- Generation (CAMPAIGN_DESIGN.md §5.2) ------------------------------
  // Floors 0..N-1 of 2-4 nodes each, node 0 is a fixed single Battle
  // (a clean start, no elite/event right out of the gate), the last
  // floor is a single fixed Boss node. Every node has 1-3 edges forward
  // into the next floor; every node in the next floor is guaranteed at
  // least one incoming edge so nothing is unreachable.
  function generate(seed, floorCount = 8) {
    const rng = mulberry32(seed);
    let nodeIdCounter = 0;
    const floors = [];
    const byId = {};

    function makeNode(type, floorIndex) {
      const node = {
        id: "n" + (nodeIdCounter++),
        type, floorIndex,
        edges: [],       // ids of nodes in the next floor this connects to
      };
      byId[node.id] = node;
      return node;
    }

    // Floor 0: single guaranteed Battle (safe opener).
    floors.push([makeNode('battle', 0)]);

    // Middle floors.
    for (let f = 1; f < floorCount - 1; f++) {
      const floorSize = 2 + Math.floor(rng() * 3); // 2-4 nodes
      const isNearBoss = f >= floorCount - 3;
      const prevFloorTypes = floors[f - 1].map(n => n.type);
      const nodes = [];
      for (let i = 0; i < floorSize; i++) {
        nodes.push(makeNode(chooseNodeType(rng, f, floorCount, prevFloorTypes, isNearBoss), f));
      }
      // Guarantee a Healing Station within 2 floors of the boss if none
      // has appeared yet on this or the previous floor (§5.2's rule).
      if (isNearBoss && !nodes.some(n => n.type === 'heal') && !prevFloorTypes.includes('heal')) {
        nodes[Math.floor(rng() * nodes.length)].type = 'heal';
      }
      floors.push(nodes);
    }

    // Final floor: single fixed Boss node.
    floors.push([makeNode('boss', floorCount - 1)]);

    // Wire edges floor-by-floor: each node gets 1-3 forward edges; every
    // node in the next floor gets at least one incoming edge.
    for (let f = 0; f < floors.length - 1; f++) {
      const thisFloor = floors[f];
      const nextFloor = floors[f + 1];
      const incoming = new Set();
      thisFloor.forEach(node => {
        const edgeCount = Math.min(nextFloor.length, 1 + Math.floor(rng() * 3));
        const targets = new Set();
        while (targets.size < edgeCount) {
          targets.add(pick(rng, nextFloor).id);
        }
        node.edges = Array.from(targets);
        node.edges.forEach(id => incoming.add(id));
      });
      // Any next-floor node with no incoming edge yet gets connected from
      // a random node in this floor, so the map never has an orphan.
      nextFloor.forEach(nn => {
        if (!incoming.has(nn.id)) {
          const source = pick(rng, thisFloor);
          source.edges.push(nn.id);
        }
      });
    }

    return { floors, byId };
  }

  // No two Elites adjacent (checked against the previous floor's mix),
  // Boss/Battle-0 excluded (handled separately above).
  function chooseNodeType(rng, floorIndex, floorCount, prevFloorTypes, isNearBoss) {
    const weights = [
      ['battle', 40],
      ['elite', prevFloorTypes.includes('elite') ? 0 : 16],
      ['chest', 12],
      ['heal', 10],
      ['charPick', 8],
      ['event', 16],
      ['shop', 10],
      ['training', 8],
      // Revival only ever rolled by CampaignMap.rerollRevivalNodes() once
      // deaths exist (§5.3: "only appears if deadUnits.length > 0") — not
      // part of the base weighted table.
    ];
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [type, w] of weights) {
      if (r < w) return type;
      r -= w;
    }
    return 'battle';
  }

  // ---- Traversal state ---------------------------------------------------
  // A node is reachable if it's in the very first floor and unvisited, or
  // it's targeted by an edge from the currently-visited node.
  function getReachableIds(run) {
    if (!run.currentNodeId) {
      return new Set(mapGraph.floors[0].map(n => n.id));
    }
    const current = mapGraph.byId[run.currentNodeId];
    return new Set(current.edges.filter(id => !run.visitedNodeIds.has(id)));
  }

  // ---- Layout ---------------------------------------------------------
  // Each node gets a horizontal "lane" position (0..laneCount-1) within
  // its floor, deterministically spread and jittered by node id so the
  // path reads as a winding trail (Slay the Spire / Path of Champions
  // style) instead of a rigid grid of evenly-spaced columns. Purely
  // presentational — traversal logic still only cares about `edges`.
  const LANES = 5; // odd count so a single node can sit dead-center
  function laneFor(node, floorSize, indexInFloor) {
    // Spread indexInFloor across the lane range, then nudge with a
    // small hash-based jitter so repeated runs don't all look
    // identical for a given floor size, while staying reproducible
    // for a given seed (no Math.random here — mapGraph is generated
    // once with the seeded RNG and this just derives a display lane
    // from the already-fixed node id).
    const span = LANES - 1;
    const base = floorSize === 1 ? span / 2 : (indexInFloor / (floorSize - 1)) * span;
    let hash = 0;
    for (const ch of node.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const jitter = ((hash % 100) / 100 - 0.5) * 0.6;
    return Math.max(0, Math.min(span, base + jitter));
  }

  // Shared lane->left% conversion, used by both node positioning and
  // the connector SVGs so they can never drift out of sync. Inset
  // (see call sites) keeps a node's center away from the container
  // edge so its badge (sized in px, positioned in %) doesn't clip.
  function laneToPct(lane) {
    return 8 + (lane / (LANES - 1)) * 84;
  }

  // ---- Screen -------------------------------------------------------------
  function render(run) {
    ensureRoot();
    mapGraph = run.mapGraph;
    const reachable = getReachableIds(run);
    const floors = mapGraph.floors;

    // Precompute each node's lane (x position within its floor) so both
    // the node buttons and the SVG connector layer agree on where every
    // node sits, without duplicating the jitter math in two places.
    const laneOf = {};
    floors.forEach(floor => {
      floor.forEach((node, i) => { laneOf[node.id] = laneFor(node, floor.length, i); });
    });

    const floorsHtml = floors.map((floor, floorIndex) => {
      const nodesHtml = floor.map(node => {
        const meta = NODE_TYPES[node.type];
        const visited = run.visitedNodeIds.has(node.id);
        const isCurrent = run.currentNodeId === node.id;
        const isReachable = reachable.has(node.id);
        const cls = [
          'cm-node',
          `cm-accent-${meta.accent}`,
          visited ? 'cm-visited' : '',
          isCurrent ? 'cm-current' : '',
          isReachable ? 'cm-reachable' : '',
          !isReachable && !visited ? 'cm-locked' : '',
        ].filter(Boolean).join(' ');
        const lane = laneOf[node.id];
        const leftPct = laneToPct(lane);
        const icon = CampaignMapIcons.get(visited ? 'visited' : node.type);
        return `
          <button class="${cls}" data-node-id="${node.id}" style="left:${leftPct}%"
                   ${isReachable ? '' : 'disabled'} aria-label="${meta.label}">
            <span class="cm-node-badge">
              <span class="cm-node-icon">${icon}</span>
            </span>
            <span class="cm-node-label">${meta.label}</span>
          </button>
        `;
      }).join('');
      return `<div class="cm-floor" data-floor-index="${floorIndex}">${nodesHtml}</div>`;
    }).join('');

    // Connector layer: one SVG per floor gap, drawn as a curved path.
    // Unlike a full graph-view, we only draw edges that are part of
    // the player's actual story so far — the trail behind them
    // (visited -> visited) and the live step(s) forward from wherever
    // they're currently standing — plus a faint hint of what a
    // reachable node connects onward to once it's been walked. Every
    // *other* edge in the (much denser) generated graph is left
    // undrawn rather than rendered as dim fog, since drawing all of
    // them at once (every node's every edge, all floors) produced a
    // tangle with no readable "this is my path" line (see prior
    // screenshot feedback). Nodes still show through fog via their
    // own locked styling; the connectors only need to answer "how did
    // I get here" and "where can I go next".
    const connectorsHtml = floors.slice(0, -1).map((floor, f) => {
      const segs = floor.flatMap(node => {
        const fromWalked = run.visitedNodeIds.has(node.id);
        const fromCurrent = run.currentNodeId === node.id;
        if (!fromWalked && !fromCurrent) return [];
        return node.edges.flatMap(targetId => {
          const toWalked = run.visitedNodeIds.has(targetId);
          const isLive = fromCurrent && reachable.has(targetId);
          if (!toWalked && !isLive) return [];
          const cls = (fromWalked && toWalked) ? 'cm-edge-walked' : 'cm-edge-live';
          const x1 = laneToPct(laneOf[node.id]);
          const x2 = laneToPct(laneOf[targetId]);
          // Simple S-curve between the two x positions (in %, y fixed
          // 0->100 across the connector's own box).
          return [`<path class="${cls}" d="M${x1},2 C${x1},40 ${x2},60 ${x2},98" />`];
        });
      }).join('');
      return `<svg class="cm-connector" data-gap-index="${f}" viewBox="0 0 100 100" preserveAspectRatio="none">${segs}</svg>`;
    }).join('');

    root.innerHTML = `
      <div class="cm-wrap">
        <div class="cm-header">
          <div class="cm-title-wrap">
            <div class="cm-title">Dário's Campaign Trail</div>
            <div class="cm-title-rule"></div>
          </div>
          <div class="cm-substats">
            <span class="cm-stat cm-stat-gold">${ICON_GOLD}<span>${run.gold}</span></span>
            <span class="cm-stat cm-stat-party">${ICON_PARTY}<span>${run.party.filter(u => u.alive).length}/3</span></span>
          </div>
        </div>
        <div class="cm-scroll">
          <div class="cm-path">${floorsHtml}${connectorsHtml}</div>
        </div>
      </div>
    `;
    root.classList.add('show');

    // Position each connector SVG over its floor gap and give every
    // floor row a matching height so lane math lines up visually;
    // done post-insert (needs layout) rather than precomputed in the
    // template string above.
    positionConnectors(run);

    root.querySelectorAll('.cm-node[data-node-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nodeId = btn.getAttribute('data-node-id');
        const node = mapGraph.byId[nodeId];
        if (!reachable.has(nodeId)) return;
        run.visitedNodeIds.add(nodeId);
        run.currentNodeId = nodeId;
        hide();
        CampaignNodes.enter(node, run);
      });
    });
  }

  // Small inline glyphs for the header stat row (gold / living party
  // count) — same "no emoji" rule as the node icons.
  const ICON_GOLD = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cm-stat-icon">
    <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/>
    <path d="M12 7.8V16.2M9.6 9.4C9.6 8.3 10.6 7.6 12 7.6C13.4 7.6 14.4 8.4 14.4 9.4C14.4 11.6 9.6 10.6 9.6 13C9.6 14 10.6 14.8 12 14.8C13.4 14.8 14.4 14.1 14.4 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;
  const ICON_PARTY = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cm-stat-icon">
    <circle cx="8.5" cy="8" r="2.6" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="16" cy="9.5" r="2.1" stroke="currentColor" stroke-width="1.4"/>
    <path d="M3.5 19C3.9 15.6 6 13.6 8.5 13.6C11 13.6 13.1 15.6 13.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M14.3 14C16.6 14.1 18.3 15.7 18.7 19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

  // Sizes/positions each .cm-connector to exactly span the pixel gap
  // between its two adjacent .cm-floor rows (floor[f] bottom edge to
  // floor[f+1] top edge), so the SVG curves visually meet the node
  // badges above/below rather than floating at a fixed CSS length —
  // floor heights vary slightly (label wrapping, etc.) so this reads
  // from the live layout instead of hardcoding a gap height.
  function positionConnectors(run) {
    const pathEl = root.querySelector('.cm-path');
    if (!pathEl) return;
    const floorEls = Array.from(root.querySelectorAll('.cm-floor'));
    const pathRect = pathEl.getBoundingClientRect();
    root.querySelectorAll('.cm-connector').forEach(svg => {
      const f = Number(svg.getAttribute('data-gap-index'));
      const topFloor = floorEls[f + 1]; // floors render bottom-up (column-reverse)
      const bottomFloor = floorEls[f];
      if (!topFloor || !bottomFloor) return;
      const topRect = topFloor.getBoundingClientRect();
      const bottomRect = bottomFloor.getBoundingClientRect();
      const top = topRect.bottom - pathRect.top;
      const bottom = bottomRect.top - pathRect.top;
      svg.style.top = `${top}px`;
      svg.style.height = `${Math.max(1, bottom - top)}px`;
    });
  }

  function hide() {
    if (root) root.classList.remove('show');
  }

  function show(run) {
    // Node modals (Chest/Shop/Heal/item-equip/etc., see js/campaign/
    // node-ui.js) are only ever dismissed by returning to the map, so
    // hide any lingering one here rather than requiring every call site
    // in js/campaign/nodes.js to remember to do it — otherwise the
    // modal (#campaign-node-mount, z-index 30) stays on top of the
    // freshly rendered map underneath it.
    if (typeof CampaignNodeUI !== 'undefined') CampaignNodeUI.hide();
    render(run);
  }

  return { generate, render, show, hide, getReachableIds, NODE_TYPES };
})();
