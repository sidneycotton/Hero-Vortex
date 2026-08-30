// =============================================================
// ============ MAIN MENU ICONS ===================================
// =============================================================
// Hand-rolled SVG glyphs for the main menu's mode picker, PVP host/
// join choice, and the battlefield test picker — the same pattern as
// js/campaign/map-icons.js: single-color line art, sized in a 24x24
// viewBox, colored via `currentColor` so CSS drives the actual tint
// (see .mm-mode-icon svg in css/main-menu.css). Kept as its own
// module (not reusing CampaignMapIcons) since main-menu.js is a
// fully self-contained screen per the project's per-screen-module
// convention (see handoff.md) — it shouldn't reach into the campaign
// module just to draw a badge.

const MainMenuIcons = (() => {
  const ICONS = {
    // Vs. AI: crossed swords — plain duel, no other flavor needed.
    ai: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L11 11M11 11L4 18M11 11L20 20M20 4L13 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M4 4L6.5 4.5L4.5 6.5L4 4Z" fill="currentColor"/>
      <path d="M20 4L17.5 4.5L19.5 6.5L20 4Z" fill="currentColor"/>
      <path d="M4 18L6.5 17.5L4.5 15.5L4 18Z" fill="currentColor"/>
      <path d="M20 20L17.5 19.5L19.5 17.5L20 20Z" fill="currentColor"/>
    </svg>`,
    // PVP: two linked nodes over a signal arc — "connect to another
    // player", reads as networking rather than a generic globe.
    pvp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="7.5" r="2.6" stroke="currentColor" stroke-width="1.7"/>
      <circle cx="18" cy="16.5" r="2.6" stroke="currentColor" stroke-width="1.7"/>
      <path d="M8.2 9.2L15.8 14.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M14 5.2C16.6 6 18.4 8.3 18.6 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M10 18.8C7.4 18 5.6 15.7 5.4 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
    // Campaign: capitol dome — matches the campaign map's own "boss"
    // glyph, since this button leads into that same political-trail
    // campaign, not a generic "map" icon.
    campaign: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.8C13.8 4.4 14.9 6.3 15.1 8.2H8.9C9.1 6.3 10.2 4.4 12 2.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 8.2V10.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 20.5V11.6L12 8.7L19 11.6V20.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M3.5 20.5H20.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8 20.5V14.3M12 20.5V14.3M16 20.5V14.3" stroke="currentColor" stroke-width="1.4"/>
    </svg>`,
    // PVP host: a broadcast dish sending out a signal — "open a room
    // for someone to find".
    host: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 15.5C5 11 8.4 7.5 12.8 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M8.3 15.5C8.3 12.8 10.4 10.6 13.1 10.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="15.8" cy="13.3" r="1.9" fill="currentColor"/>
      <path d="M4.5 19.5L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    // PVP join: a key — "enter a code someone else generated".
    join: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="9" r="3.4" stroke="currentColor" stroke-width="1.7"/>
      <path d="M10.3 11.3L18.5 19.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M15.3 16.5L17.6 14.2M17.6 18.8L19.9 16.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
    // Battlefield: random pick — a die face.
    random: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/>
      <circle cx="8.3" cy="8.3" r="1.3" fill="currentColor"/>
      <circle cx="15.7" cy="8.3" r="1.3" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
      <circle cx="8.3" cy="15.7" r="1.3" fill="currentColor"/>
      <circle cx="15.7" cy="15.7" r="1.3" fill="currentColor"/>
    </svg>`,
    // Battlefield: Prado — a tree, for the grassy-meadow map.
    prado: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L16.5 10H13.8L17.5 15.5H6.5L10.2 10H7.5L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 15.5V21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
    // Battlefield: Vulcão — a peak with a lava spark above the crater.
    vulcao: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 19.5L9 8L11.2 12L13 9L20.5 19.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M9 8L7.7 5.6L9.4 6.4L9 3.2L11 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.16"/>
    </svg>`,
    // Battlefield: Salão Presidencial — a chandelier over columns.
    salao_presidencial: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3V5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 6.8H17L15.4 9.4H8.6L7 6.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8.6 9.4L7.5 11.6M15.4 9.4L16.5 11.6M12 9.4V11.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M4.5 21V13.5M9 21V13.5M15 21V13.5M19.5 21V13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M3.5 21H20.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
    // Battlefield: Arena Celestial — a cloud platform floating in sky.
    arena_celestial: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 14.5C4.6 14.5 3.2 13 3.2 11.3C3.2 9.6 4.6 8.2 6.3 8.2C6.7 6.1 8.6 4.5 10.9 4.5C13.3 4.5 15.3 6.3 15.5 8.6C17.6 8.8 19.2 10.4 19.2 12.3C19.2 14.2 17.6 15.6 15.6 15.6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M5 18.5H19M7.5 21H16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    // Battlefield: Ruínas na Selva — a broken pillar with a vine leaf.
    ruinas_selva: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 21V10.5L10 9L8.5 7.5V5.5H15.5V7.5L14 9L15.5 10.5V15" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M6.5 21H12.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M15.5 15C17.2 14.6 18.6 15.5 18.9 17.2C17.1 17.7 15.7 16.8 15.5 15Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>`,
    // Fallback for any battlefield without a dedicated glyph yet.
    unknown: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>
      <path d="M9.6 9.6C9.8 8.2 10.8 7.3 12.1 7.3C13.5 7.3 14.6 8.2 14.6 9.5C14.6 10.6 14 11.1 13.1 11.7C12.3 12.2 12 12.6 12 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="16.3" r="1" fill="currentColor"/>
    </svg>`,
  };

  function get(id) {
    return ICONS[id] || ICONS.unknown;
  }

  return { get };
})();
