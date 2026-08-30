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

  I18n.addDict({
    pt: {
      'mm.gameTitle': 'HERO VORTEX',
      'mm.chooseMode': 'Escolha um modo',
      'mm.mode.ai.name': 'Vs. IA',
      'mm.mode.ai.desc': 'Monte um time e enfrente o computador.',
      'mm.mode.pvp.name': 'PVP',
      'mm.mode.pvp.desc': 'Enfrente outro jogador na sua wifi ou pela internet.',
      'mm.mode.campaign.name': 'Campanha',
      'mm.mode.campaign.desc': 'A campanha eleitoral do Presidente Dário.',
      'mm.battlefield.title': 'Escolha o Campo de Batalha',
      'mm.battlefield.subtitle': 'Ferramenta de teste — normalmente é sorteado a cada partida',
      'mm.battlefield.random.name': 'Aleatório',
      'mm.battlefield.random.desc': 'Padrão — um campo de batalha aleatório é escolhido a cada partida.',
      'mm.back': 'Voltar',
      'mm.pvp.title': 'PVP',
      'mm.pvp.subtitle': 'Jogue com um amigo na mesma wifi, ou de qualquer lugar',
      'mm.pvp.host.name': 'Hospedar uma partida',
      'mm.pvp.host.desc': 'Receba um código de sala para compartilhar com seu oponente.',
      'mm.pvp.join.name': 'Entrar em uma partida',
      'mm.pvp.join.desc': 'Digite um código de sala do seu oponente.',
      'mm.host.title': 'Hospedando\u2026',
      'mm.host.cancel': 'Cancelar',
      'mm.host.roomHint': 'Compartilhe este código com seu oponente. Aguardando ele entrar\u2026',
      'mm.host.openFailed': 'Não foi possível abrir uma sala: {msg}',
      'mm.join.title': 'Entrar em uma Partida',
      'mm.join.subtitle': 'Digite o código de sala que seu oponente compartilhou',
      'mm.join.connect': 'Conectar',
      'mm.join.cancel': 'Cancelar',
      'mm.join.emptyCode': 'Digite um código de sala primeiro.',
      'mm.join.connectFailed': 'Não foi possível conectar. Confira o código e tente de novo.',
      'mm.disconnectNotice': 'Seu oponente se desconectou.',
      'net.status.openingRoom': 'Abrindo sala\u2026',
      'net.status.roomOpen': 'Sala aberta',
      'net.status.connecting': 'Conectando\u2026',
      'net.err.libLoadFailed': 'Não foi possível carregar a biblioteca de rede (verifique sua conexão com a internet).',
      'net.err.noResponse': 'Sem resposta desse código de sala. Confira o código e se o anfitrião ainda está esperando.'
    },
    en: {
      'mm.gameTitle': 'HERO VORTEX',
      'mm.chooseMode': 'Choose a mode',
      'mm.mode.ai.name': 'Vs. AI',
      'mm.mode.ai.desc': 'Draft a team and battle the computer.',
      'mm.mode.pvp.name': 'PVP',
      'mm.mode.pvp.desc': 'Battle another player on your wifi or over the internet.',
      'mm.mode.campaign.name': 'Campaign',
      'mm.mode.campaign.desc': "President Dário's campaign trail.",
      'mm.battlefield.title': 'Choose Battlefield',
      'mm.battlefield.subtitle': 'Testing tool — normally picked at random each match',
      'mm.battlefield.random.name': 'Random',
      'mm.battlefield.random.desc': 'Default — a random battlefield is picked each match.',
      'mm.back': 'Back',
      'mm.pvp.title': 'PVP',
      'mm.pvp.subtitle': 'Play a friend on the same wifi, or anywhere',
      'mm.pvp.host.name': 'Host a game',
      'mm.pvp.host.desc': 'Get a room code to share with your opponent.',
      'mm.pvp.join.name': 'Join a game',
      'mm.pvp.join.desc': 'Enter a room code from your opponent.',
      'mm.host.title': 'Hosting\u2026',
      'mm.host.cancel': 'Cancel',
      'mm.host.roomHint': 'Share this code with your opponent. Waiting for them to join\u2026',
      'mm.host.openFailed': 'Could not open a room: {msg}',
      'mm.join.title': 'Join a Game',
      'mm.join.subtitle': 'Enter the room code your opponent shared',
      'mm.join.connect': 'Connect',
      'mm.join.cancel': 'Cancel',
      'mm.join.emptyCode': 'Enter a room code first.',
      'mm.join.connectFailed': 'Could not connect. Check the code and try again.',
      'mm.disconnectNotice': 'Your opponent disconnected.',
      'net.status.openingRoom': 'Opening room\u2026',
      'net.status.roomOpen': 'Room open \u2014 waiting for opponent\u2026',
      'net.status.connecting': 'Connecting\u2026',
      'net.err.libLoadFailed': 'Could not load networking library (check internet connection).',
      'net.err.noResponse': 'No response from that room code. Double-check it and that the host is still waiting.'
    }
  });

  // Any string that only ever crosses a network boundary as an i18n KEY
  // (net.js's onStatus callback, and the two Error.message values it
  // throws) needs translating at the point it's displayed — never
  // assume the raw value is already human-readable text.
  function statusText(keyOrText) {
    return I18n.t(keyOrText);
  }

  const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 5L7.5 12L14.5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Shared back/cancel button markup so every screen's "go back" control
  // uses the same chevron glyph instead of a plain text arrow character.
  function backBtnHtml(id, label) {
    return `<button class="mm-back-btn" id="${id}"><span class="mm-back-icon">${BACK_ICON}</span>${label}</button>`;
  }

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
    I18n.setToggleVisible(true);
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>${I18n.t('mm.gameTitle')}</h1>
          <div class="mm-subtitle">${I18n.t('mm.chooseMode')}</div>
        </div>
        <div class="mm-modes">
          <button class="mm-mode-btn mm-accent-ai" id="mm-mode-ai">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('ai')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.mode.ai.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.mode.ai.desc')}</div>
            </div>
          </button>
          <button class="mm-mode-btn mm-accent-pvp" id="mm-mode-pvp">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('pvp')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.mode.pvp.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.mode.pvp.desc')}</div>
            </div>
          </button>
          <button class="mm-mode-btn mm-accent-campaign" id="mm-mode-campaign">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('campaign')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.mode.campaign.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.mode.campaign.desc')}</div>
            </div>
          </button>
        </div>
      </div>
    `);

    document.getElementById('mm-mode-ai').addEventListener('click', () => {
      // Battlefield picker temporarily disabled for Vs. AI matches —
      // straight to team-select, same as picking "Random" used to do.
      // See openBattlefieldPicker() below, left intact to re-enable later.
      window.FORCED_BATTLEFIELD = null;
      hide();
      openTeamSelect();
    });

    document.getElementById('mm-mode-pvp').addEventListener('click', () => {
      openPvpPicker();
    });

    document.getElementById('mm-mode-campaign').addEventListener('click', () => {
      hide();
      openCampaignDraft();
    });
  }

  // ---- Battlefield picker (Vs. AI only) ---------------------------------
  // Testing convenience so battlefields can be checked one at a time
  // instead of relying on the random draw in js/battlefields/index.js.
  // "Random" (the default/top option) leaves window.FORCED_BATTLEFIELD
  // unset, which keeps the normal random-per-match behavior.
  // Battlefield names/descriptions are gameplay/world content (like
  // character names), not system chrome — left in Portuguese here
  // rather than added to the system i18n dict; see handoff.md's staged
  // i18n plan for where world content translation is handled.
  const BATTLEFIELD_LABELS = {
    prado: { icon: 'prado', name: 'Prado', desc: 'Grassy meadow with trees at the corners.' },
    vulcao: { icon: 'vulcao', name: 'Vulcão', desc: 'Red volcanic rock island ringed by lava.' },
    salao_presidencial: { icon: 'salao_presidencial', name: 'Salão Presidencial', desc: 'Grand indoor hall — blue carpet, columns, chandelier.' },
    arena_celestial: { icon: 'arena_celestial', name: 'Arena Celestial', desc: 'Floating cloud platform high in a pastel sky.' },
    ruinas_selva: { icon: 'ruinas_selva', name: 'Ruínas na Selva', desc: 'Overgrown jungle temple, broken pillars and vines.' }
  };

  function openBattlefieldPicker() {
    I18n.setToggleVisible(false);
    const keys = Object.keys(BATTLEFIELD_BUILDERS || {});
    const optionsHtml = keys.map(key => {
      const label = BATTLEFIELD_LABELS[key] || { icon: 'unknown', name: key, desc: '' };
      return `
        <button class="mm-mode-btn mm-accent-field" data-battlefield="${escapeHtml(key)}">
          <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get(label.icon)}</div></div>
          <div class="mm-mode-text">
            <div class="mm-mode-name">${escapeHtml(label.name)}</div>
            <div class="mm-mode-desc">${escapeHtml(label.desc)}</div>
          </div>
        </button>
      `;
    }).join('');

    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>${I18n.t('mm.battlefield.title')}</h1>
          <div class="mm-subtitle">${I18n.t('mm.battlefield.subtitle')}</div>
        </div>
        <div class="mm-modes">
          <button class="mm-mode-btn mm-accent-field" data-battlefield="">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('random')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.battlefield.random.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.battlefield.random.desc')}</div>
            </div>
          </button>
          ${optionsHtml}
        </div>
        ${backBtnHtml('mm-battlefield-back', I18n.t('mm.back'))}
      </div>
    `);

    root.querySelectorAll('[data-battlefield]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-battlefield');
        window.FORCED_BATTLEFIELD = key || null;
        hide();
        openTeamSelect(); // existing Vs. AI flow, unchanged
      });
    });
    document.getElementById('mm-battlefield-back').addEventListener('click', openModePicker);
  }

  // ---- Campaign entry: 2-candidates-per-role draft, then start the run --
  // Uses CampaignDraft (js/campaign/draft.js), NOT TeamSelect — the
  // campaign draft rolls exactly 2 random candidates per role and the
  // player picks 1 of the 2, rather than browsing the whole roster.
  // CampaignDraft.run() already resolves to the flat { role: id } shape
  // Campaign.startRun() expects.
  async function openCampaignDraft() {
    I18n.setToggleVisible(false);
    const draft = await CampaignDraft.run(UNIT_DEFS, TeamSelect.ROLE_ORDER);
    const run = Campaign.startRun(draft);
    run.mapGraph = CampaignMap.generate(run.seed);
    CampaignMap.show(run);
  }

  // ---- Screen 2: PVP host-or-join choice --------------------------------
  function openPvpPicker() {
    I18n.setToggleVisible(false);
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>${I18n.t('mm.pvp.title')}</h1>
          <div class="mm-subtitle">${I18n.t('mm.pvp.subtitle')}</div>
        </div>
        <div class="mm-pvp-choice">
          <button class="mm-mode-btn mm-accent-pvp" id="mm-pvp-host">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('host')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.pvp.host.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.pvp.host.desc')}</div>
            </div>
          </button>
          <button class="mm-mode-btn mm-accent-pvp" id="mm-pvp-join">
            <div class="mm-mode-badge"><div class="mm-mode-icon">${MainMenuIcons.get('join')}</div></div>
            <div class="mm-mode-text">
              <div class="mm-mode-name">${I18n.t('mm.pvp.join.name')}</div>
              <div class="mm-mode-desc">${I18n.t('mm.pvp.join.desc')}</div>
            </div>
          </button>
        </div>
        ${backBtnHtml('mm-pvp-back', I18n.t('mm.back'))}
      </div>
    `);

    document.getElementById('mm-pvp-back').addEventListener('click', openModePicker);
    document.getElementById('mm-pvp-host').addEventListener('click', openHostScreen);
    document.getElementById('mm-pvp-join').addEventListener('click', openJoinScreen);
  }

  // ---- Screen 3a: hosting -------------------------------------------------
  function openHostScreen() {
    I18n.setToggleVisible(false);
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>${I18n.t('mm.host.title')}</h1>
          <div class="mm-subtitle" id="mm-host-status">${statusText('net.status.openingRoom')}</div>
        </div>
        <div class="mm-room-code" id="mm-room-code" style="display:none;"></div>
        <div class="mm-hint" id="mm-room-hint" style="display:none;">${I18n.t('mm.host.roomHint')}</div>
        ${backBtnHtml('mm-host-back', I18n.t('mm.host.cancel'))}
      </div>
    `);

    document.getElementById('mm-host-back').addEventListener('click', () => {
      Net.disconnect();
      openPvpPicker();
    });

    const statusEl = document.getElementById('mm-host-status');
    Net.hostGame({ onStatus: (s) => { statusEl.textContent = statusText(s); } })
      .then(({ code }) => {
        const codeEl = document.getElementById('mm-room-code');
        const hintEl = document.getElementById('mm-room-hint');
        if (!codeEl) return; // user navigated away already
        codeEl.textContent = code;
        codeEl.style.display = '';
        hintEl.style.display = '';
        statusEl.textContent = statusText('net.status.roomOpen');

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
        const msg = err && err.message ? statusText(err.message) : statusText('net.err.libLoadFailed');
        statusEl.textContent = I18n.t('mm.host.openFailed', { msg });
      });
  }

  // ---- Screen 3b: joining -------------------------------------------------
  function openJoinScreen() {
    I18n.setToggleVisible(false);
    show(`
      <div class="mm-wrap">
        <div class="mm-title">
          <h1>${I18n.t('mm.join.title')}</h1>
          <div class="mm-subtitle">${I18n.t('mm.join.subtitle')}</div>
        </div>
        <input class="mm-code-input" id="mm-join-input" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="ABCDE" />
        <button class="mm-mode-btn mm-join-btn" id="mm-join-go">
          <div class="mm-mode-name">${I18n.t('mm.join.connect')}</div>
        </button>
        <div class="mm-hint" id="mm-join-status"></div>
        ${backBtnHtml('mm-join-back', I18n.t('mm.join.cancel'))}
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
      if (!code) { statusEl.textContent = I18n.t('mm.join.emptyCode'); return; }
      statusEl.textContent = statusText('net.status.connecting');
      Net.joinGame(code, { onStatus: (s) => { statusEl.textContent = statusText(s); } })
        .then(() => {
          if (!root || !root.classList.contains('show')) return;
          hide();
          // See the matching comment on the host side above.
          PVP.startMatch().catch(() => {});
        })
        .catch((err) => {
          if (!statusEl) return;
          statusEl.textContent = err && err.message ? statusText(err.message) : I18n.t('mm.join.connectFailed');
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
    toast.textContent = I18n.t('mm.disconnectNotice');
    wrap.insertBefore(toast, wrap.firstChild.nextSibling);
  }

  I18n.onChange(() => {
    // Re-render whichever menu screen is currently showing, in its
    // current language, without losing menu state (there's no in-flight
    // form data on this screen worth preserving — host/join screens
    // re-running their network calls on a language switch mid-connect
    // would be worse than just not re-rendering those two specific
    // screens; only re-render the picker screens that are pure display).
    if (!root || !root.classList.contains('show')) return;
    const wrap = root.querySelector('.mm-wrap');
    if (!wrap) return;
    // Heuristic: only re-render screens with no live async operation
    // tied to their DOM (mode picker, battlefield picker, pvp picker).
    // Host/join screens are mid-flow by nature and skip re-render here.
    if (root.querySelector('#mm-mode-ai')) openModePicker();
    else if (root.querySelector('#mm-battlefield-back')) openBattlefieldPicker();
    else if (root.querySelector('#mm-pvp-host')) openPvpPicker();
  });

  return { openModePicker, showDisconnectNotice };
})();
