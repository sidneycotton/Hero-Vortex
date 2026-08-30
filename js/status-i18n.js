// =============================================================
// ============ STATUS/COUNTER I18N — gameplay content (EN layer) ==
// =============================================================
// Same pattern as js/units-i18n.js, extended to the small amount of
// Portuguese content that leaks into the combat log / floating-text UI
// via StatusLib (js/effects.js) status names, ability-defined counter
// keys (js/units/*.js's `counter:` fields), and `verb:'note'` free text.
// The StatusLib/def objects themselves stay untouched — this is an
// English-only overlay, keyed by the status's own stable `.id` (for
// statuses), by counter key (for counters), and by "unitId:abilityId"
// (for notes, since note text isn't otherwise identified by anything
// stable — see js/units/babawibby.js's Montagem de Sucata note).
//
// Scope: every StatusLib.* status defined in js/effects.js as of this
// pass (17 total), the one counter key in use (Mariana's "protecao"),
// and the one note text in use (Babawibby's "Montagem de Sucata."). If a
// future card adds a new status/counter/note, it needs an entry added
// here too or it'll silently fall back to the PT original in English mode
// — same fallback behavior as UnitText.
//
// Usage (js/animation-engine.js's logResult/renderFloatingNumbers):
//   StatusText.name(status)          // status = the applied status object (has .id, .name)
//   StatusText.counter(counterKey)   // counterKey = the raw string, e.g. "protecao"
//   StatusText.note(unitId, abilityId, text)  // text = the PT original, for fallback

const STATUS_TEXT_EN = {
  bleed: "Bleeding",
  untargetable: "Untargetable",
  nullifyNext: "Nullify Next",
  moveLast: "Moves Last",
  speedMod_up: "Hastened",
  speedMod_down: "Slowed",
  tempRoleTag: "Role Swapped",
  teamDamageBonus: "Amplified Power",
  guardAllies: "Solar Vigil",
  gavinFollowup: "Threatening Presence",
  slow: "Slowed",
  marquese_mark: "Marquese's Mark",
  dario_form: "Reactive Form",
  provoke: "Provoked",
  punishIfIgnored: "If Left Unanswered...",
  redirectDamageAsHeal: "Comforting Protection",
  heal_growth_field: "Protected Vigil",
  partner_bond: "Partner",
  rewrite: "Rewrite Counter" // Sirius's stackingBuff('rewrite', ...)
};

// speedMod's name depends on the sign of its delta ('Acelerado' when
// delta >= 0, 'Desacelerado' otherwise — see StatusLib.speedMod in
// effects.js) rather than being a fixed string per id, so it needs its
// own branch instead of a flat id lookup like every other status.
function speedModKey(status) {
  return (status.data && status.data.delta < 0) ? 'speedMod_down' : 'speedMod_up';
}

const COUNTER_TEXT_EN = {
  protecao: "Protection"
};

// Keyed "unitId:abilityId" since note text has no other stable
// identifier of its own (it's just a free string on the ability step).
const NOTE_TEXT_EN = {
  "babawibby:crie_maquina": "Scrap Assembly."
};

const StatusText = (() => {
  function name(status) {
    if (!status) return '';
    if (I18n.getLang() === 'en') {
      const key = status.id === 'speedMod' ? speedModKey(status) : status.id;
      const entry = STATUS_TEXT_EN[key];
      if (entry) return entry;
    }
    return status.name;
  }

  function counter(counterKey) {
    if (I18n.getLang() === 'en') {
      const entry = COUNTER_TEXT_EN[counterKey];
      if (entry) return entry;
    }
    return counterKey;
  }

  // `unitId`/`abilityId` identify the note (see NOTE_TEXT_EN); `text` is
  // the PT original, returned as-is if no EN entry or not in EN mode.
  function note(unitId, abilityId, text) {
    if (I18n.getLang() === 'en') {
      const entry = NOTE_TEXT_EN[`${unitId}:${abilityId}`];
      if (entry) return entry;
    }
    return text;
  }

  return { name, counter, note };
})();
