// =============================================================
// ============ CAMPAIGN MAP ICONS ================================
// =============================================================
// Hand-rolled SVG glyphs for each map node type (js/campaign/map.js's
// NODE_TYPES) and for the "visited" checkmark, so nothing on the map
// depends on emoji font rendering (which varies across OS/browser and
// reads as a placeholder-y default, not a considered design). Every
// icon is a single-color line-art mark meant to sit inside a circular
// badge and take its color from `currentColor`, so the same markup
// re-colors per node state (locked/reachable/current/visited) purely
// via CSS — see .cm-node-icon svg in css/campaign-map.css.
//
// Kept as its own tiny module (rather than inline strings in map.js)
// so the glyphs are easy to scan/tweak as a set and map.js's render()
// stays about layout, not path data.

const CampaignMapIcons = (() => {
  const ICONS = {
    // Battle: crossed swords — the base "fight" node.
    battle: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L11 11M11 11L4 18M11 11L20 20M20 4L13 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M4 4L6.5 4.5L4.5 6.5L4 4Z" fill="currentColor"/>
      <path d="M20 4L17.5 4.5L19.5 6.5L20 4Z" fill="currentColor"/>
      <path d="M4 18L6.5 17.5L4.5 15.5L4 18Z" fill="currentColor"/>
      <path d="M20 20L17.5 19.5L19.5 17.5L20 20Z" fill="currentColor"/>
    </svg>`,
    // Elite: a skull mark — tougher fight, campaign-attack-ad flavor.
    // Kept bold/blocky (few strokes, solid eye sockets) since at a
    // 24px badge size fine linework (the previous version's dotted
    // "teeth") reads as noise instead of a skull.
    elite: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4C8 4 5.2 6.9 5.2 10.6C5.2 12.7 6.1 14.2 7.5 15.4L7.6 17.7C7.6 18.3 8.1 18.7 8.6 18.7H9.6V16.8H10.6V18.7H13.4V16.8H14.4V18.7H15.4C15.9 18.7 16.4 18.3 16.4 17.7L16.5 15.4C17.9 14.2 18.8 12.7 18.8 10.6C18.8 6.9 16 4 12 4Z" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="9.1" cy="10.4" rx="1.7" ry="2.1" fill="currentColor"/>
      <ellipse cx="14.9" cy="10.4" rx="1.7" ry="2.1" fill="currentColor"/>
      <path d="M12 11.6L11.2 14.2H12.8L12 11.6Z" fill="currentColor"/>
    </svg>`,
    // Chest: a ballot box with a slotted lid — "reward" node.
    chest: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="16" height="9.5" rx="1.4" stroke="currentColor" stroke-width="1.7"/>
      <path d="M4 10L6.5 4.8H17.5L20 10" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <rect x="10" y="9.2" width="4" height="1.6" rx="0.5" fill="currentColor"/>
      <path d="M9.5 14.5H14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
    // Heal: a medical-tent cross on a shield — "rest station".
    heal: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.2L19.5 6.1V11.4C19.5 16 16.3 19.6 12 20.8C7.7 19.6 4.5 16 4.5 11.4V6.1L12 3.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M12 8.6V15.4M8.6 12H15.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    // charPick (Recruit): a person-plus mark — new ally joins the bench.
    charPick: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="8.3" r="3.1" stroke="currentColor" stroke-width="1.6"/>
      <path d="M4.3 19.5C4.7 15.9 7 13.7 10 13.7C13 13.7 15.3 15.9 15.7 19.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M18.3 8.3V13.3M15.8 10.8H20.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
    // Event: a megaphone — campaign-trail happenstance / stump speech.
    event: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 10.2V13.8C3.5 14.5 4.1 15 4.7 15H6.3L8 20.3C8.2 20.9 8.7 21.2 9.3 21C9.9 20.8 10.2 20.2 10 19.7L8.6 15H10.5L17.5 18.6C18.2 18.9 19 18.4 19 17.6V6.4C19 5.6 18.2 5.1 17.5 5.4L10.5 9H4.7C4.1 9 3.5 9.5 3.5 10.2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M10.5 9V15" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    // Shop: a briefcase — campaign-fund purchases.
    shop: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="8.2" width="17" height="11" rx="1.6" stroke="currentColor" stroke-width="1.6"/>
      <path d="M8.5 8.2V6.4C8.5 5.5 9.2 4.8 10.1 4.8H13.9C14.8 4.8 15.5 5.5 15.5 6.4V8.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M3.5 13.2H20.5" stroke="currentColor" stroke-width="1.4"/>
      <rect x="10.5" y="12" width="3" height="2.6" rx="0.4" fill="currentColor"/>
    </svg>`,
    // Training: a dumbbell — permanent stat upgrades.
    training: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 9V15M17.5 9V15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M3.5 10.5V13.5M20.5 10.5V13.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M6.5 12H17.5" stroke="currentColor" stroke-width="1.8"/>
    </svg>`,
    // Revival: a phoenix-ish rising spark — bring back a fallen ally.
    revival: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L13.6 8.4L19 10L13.6 11.6L12 17L10.4 11.6L5 10L10.4 8.4L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 17V21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M9 20H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
    // Boss: a capitol dome — the final showdown.
    boss: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.8C13.8 4.4 14.9 6.3 15.1 8.2H8.9C9.1 6.3 10.2 4.4 12 2.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 8.2V10.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 20.5V11.6L12 8.7L19 11.6V20.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M3.5 20.5H20.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8 20.5V14.3M12 20.5V14.3M16 20.5V14.3" stroke="currentColor" stroke-width="1.4"/>
    </svg>`,
    // Visited: a check mark, replacing the node's normal icon once cleared.
    visited: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 12.5L9.5 17.5L19.5 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  };

  function get(id) {
    return ICONS[id] || ICONS.event;
  }

  return { get };
})();
