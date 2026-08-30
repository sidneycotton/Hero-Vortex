// =============================================================
// ============ MAIN MENU — mode picker =========================
// =============================================================
// First screen shown on boot (see index.html's window.load handler).
// Owns its own DOM (mounted into #main-menu-mount), same self-contained
// pattern as js/team-select.js / js/starter-select.js. Three modes:
//   1. Vs. AI       — existing single-player flow, untouched.
//   2. LAN PVP      — host/join over WebRTC (js/net/net.js + pvp.js),
//                      then the normal team-select/starter-select/battle
//                      flow runs per-player, mirrored.
//   3. Campaign     — not built yet; button is present but disabled.

const MainMenu = (() => {
  let root = null;

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function ensureRoot() {
    if (root) return root;
    root = document.getElementById('main-menu-mount');
    return root;
  }

  function show(html) {
    ensureRoot();
    root.innerHTML = html;
    root.classList.add('show');
  }

  function hide() {
    if (root) root.classList.remove('show');
  }

  // ---- Screen 1: mode picker -------------------------------------------
  function openModePicker() {
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>HERO VORTEX</h1>
          <div class="mm-subtitle">Choose a mode</div>
        </div>
        <div class="mm-modes">
          <button class="mm-mode-btn" id="mm-mode-ai">
            <div class="mm-mode-icon">⚔️</div>
            <div class="mm-mode-name">Vs. AI</div>
            <div class="mm-mode-desc">Draft a team and battle the computer.</div>
          </button>
          <button class="mm-mode-btn" id="mm-mode-pvp">
            <div class="mm-mode-icon">🌐</div>
            <div class="mm-mode-name">LAN PVP</div>
            <div class="mm-mode-desc">Battle another player on your wifi or over the internet.</div>
          </button>
          <button class="mm-mode-btn" id="mm-mode-campaign">
            <div class="mm-mode-icon">🗺️</div>
            <div class="mm-mode-name">Campaign</div>
            <div class="mm-mode-desc">President Dário's campaign trail.</div>
          </button>
        </div>
      </div>
    `);

    document.getElementById('mm-mode-ai').addEventListener('click', () => {
      hide();
      openTeamSelect(); // existing Vs. AI flow, unchanged
    });

    document.getElementById('mm-mode-pvp').addEventListener('click', () => {
      openPvpPicker();
    });

    document.getElementById('mm-mode-campaign').addEventListener('click', () => {
      hide();
      openCampaignDraft();
    });
  }

  // ---- Campaign entry: 2-candidates-per-role draft, then start the run --
  // Uses CampaignDraft (js/campaign/draft.js), NOT TeamSelect — the
  // campaign draft rolls exactly 2 random candidates per role and the
  // player picks 1 of the 2, rather than browsing the whole roster.
  // CampaignDraft.run() already resolves to the flat { role: id } shape
  // Campaign.startRun() expects.
  async function openCampaignDraft() {
    const draft = await CampaignDraft.run(UNIT_DEFS, TeamSelect.ROLE_ORDER);
    const run = Campaign.startRun(draft);
    run.mapGraph = CampaignMap.generate(run.seed);
    CampaignMap.show(run);
  }

  // ---- Screen 2: PVP host-or-join choice --------------------------------
  function openPvpPicker() {
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>LAN PVP</h1>
          <div class="mm-subtitle">Play a friend on the same wifi, or anywhere</div>
        </div>
        <div class="mm-pvp-choice">
          <button class="mm-mode-btn" id="mm-pvp-host">
            <div class="mm-mode-icon">🏠</div>
            <div class="mm-mode-name">Host a game</div>
            <div class="mm-mode-desc">Get a room code to share with your opponent.</div>
          </button>
          <button class="mm-mode-btn" id="mm-pvp-join">
            <div class="mm-mode-icon">🔑</div>
            <div class="mm-mode-name">Join a game</div>
            <div class="mm-mode-desc">Enter a room code from your opponent.</div>
          </button>
        </div>
        <button class="mm-back-btn" id="mm-pvp-back">← Back</button>
      </div>
    `);

    document.getElementById('mm-pvp-back').addEventListener('click', openModePicker);
    document.getElementById('mm-pvp-host').addEventListener('click', openHostScreen);
    document.getElementById('mm-pvp-join').addEventListener('click', openJoinScreen);
  }

  // ---- Screen 3a: hosting -------------------------------------------------
  function openHostScreen() {
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>Hosting…</h1>
          <div class="mm-subtitle" id="mm-host-status">Opening room…</div>
        </div>
        <div class="mm-room-code" id="mm-room-code" style="display:none;"></div>
        <div class="mm-hint" id="mm-room-hint" style="display:none;">Share this code with your opponent. Waiting for them to join…</div>
        <button class="mm-back-btn" id="mm-host-back">← Cancel</button>
      </div>
    `);

    document.getElementById('mm-host-back').addEventListener('click', () => {
      Net.disconnect();
      openPvpPicker();
    });

    const statusEl = document.getElementById('mm-host-status');
    Net.hostGame({ onStatus: (s) => { statusEl.textContent = s; } })
      .then(({ code }) => {
        const codeEl = document.getElementById('mm-room-code');
        const hintEl = document.getElementById('mm-room-hint');
        if (!codeEl) return; // user navigated away already
        codeEl.textContent = code;
        codeEl.style.display = '';
        hintEl.style.display = '';
        statusEl.textContent = 'Room open';

        Net.on('_guestJoined', () => {
          if (!root || !root.classList.contains('show')) return;
          hide();
          // PVP.startMatch()'s promise rejects if the opponent disconnects
          // before the battle actually starts (mid team-select/starter-
          // select) — PVP.js itself already handles bouncing back to the
          // menu with a notice in that case (onOpponentDisconnected), so
          // this catch only needs to swallow the rejection quietly and
          // avoid an unhandled-promise-rejection console warning.
          PVP.startMatch().catch(() => {});
        });
      })
      .catch((err) => {
        if (!statusEl) return;
        statusEl.textContent = 'Could not open a room: ' + (err && err.message ? err.message : 'unknown error');
      });
  }

  // ---- Screen 3b: joining -------------------------------------------------
  function openJoinScreen() {
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>Join a Game</h1>
          <div class="mm-subtitle">Enter the room code your opponent shared</div>
        </div>
        <input class="mm-code-input" id="mm-join-input" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="ABCDE" />
        <button class="mm-mode-btn mm-join-btn" id="mm-join-go">
          <div class="mm-mode-name">Connect</div>
        </button>
        <div class="mm-hint" id="mm-join-status"></div>
        <button class="mm-back-btn" id="mm-join-back">← Cancel</button>
      </div>
    `);

    const input = document.getElementById('mm-join-input');
    const statusEl = document.getElementById('mm-join-status');
    input.focus();

    document.getElementById('mm-join-back').addEventListener('click', () => {
      Net.disconnect();
      openPvpPicker();
    });

    document.getElementById('mm-join-go').addEventListener('click', () => {
      const code = input.value.trim();
      if (!code) { statusEl.textContent = 'Enter a room code first.'; return; }
      statusEl.textContent = 'Connecting…';
      Net.joinGame(code, { onStatus: (s) => { statusEl.textContent = s; } })
        .then(() => {
          if (!root || !root.classList.contains('show')) return;
          hide();
          // See the matching comment on the host side above.
          PVP.startMatch().catch(() => {});
        })
        .catch((err) => {
          if (!statusEl) return;
          statusEl.textContent = err && err.message ? err.message : 'Could not connect. Check the code and try again.';
        });
    });
  }

  // Shown after bouncing back to the menu because the opponent disconnected
  // mid-match (see js/net/pvp.js's onOpponentDisconnected). Purely a toast
  // — doesn't change which menu screen is showing.
  function showDisconnectNotice() {
    if (!root) return;
    const wrap = root.querySelector('.mm-wrap');
    if (!wrap || wrap.querySelector('.mm-disconnect-toast')) return;
    const toast = document.createElement('div');
    toast.className = 'mm-hint mm-disconnect-toast';
    toast.style.color = '#ff9d9d';
    toast.textContent = 'Your opponent disconnected.';
    wrap.insertBefore(toast, wrap.firstChild.nextSibling);
  }

  return { openModePicker, showDisconnectNotice };
})();
