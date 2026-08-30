// =============================================================
// ============ I18N — system UI language (PT / EN) ============
// =============================================================
// Covers the SYSTEM/UI chrome only (menus, buttons, hints, labels) — not
// gameplay content (character names, ability text, campaign items/events),
// which is handled separately since Portuguese is that content's native
// language already (see handoff.md's i18n plan for the staged approach).
//
// Usage from any module loaded after this one:
//   I18n.t('mm.title')                    -> current-language string
//   I18n.t('mm.subtitle')
//   I18n.setLang('en' | 'pt')             -> switches + persists + re-renders
//   I18n.getLang()                        -> 'pt' | 'en'
//   I18n.onChange(fn)                     -> fn() called after every setLang,
//                                             so open screens can re-render
//                                             their text without a reload
//
// Keys are namespaced by screen/module prefix (mm.=main menu, ts.=team
// select, ss.=starter select, pv.=planning/battle UI, cn.=campaign nodes,
// net.=networking/PVP) so two screens can each own a key like
// "title" without collision.
//
// Adding a new string: add the SAME key to both `pt` and `en` below. If a
// key is missing from the active language, t() falls back to the other
// language's copy (so a half-translated addition never renders blank),
// and if it's missing from both, t() returns the key itself so the gap is
// visible in the UI instead of silently swallowed.

const I18n = (() => {
  const STORAGE_KEY = 'hv-lang';
  const changeListeners = [];

  // ---- Dictionaries -----------------------------------------------------
  // Step 1 seeds the infra with no real keys yet — screens are converted
  // one at a time in later steps, each adding its own keys here.
  const dict = {
    pt: {},
    en: {}
  };

  function detectDefault() {
    try {
      const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (nav.startsWith('pt')) return 'pt';
    } catch (e) { /* navigator unavailable, fall through */ }
    return 'en';
  }

  let currentLang = null;

  function ensureLoaded() {
    if (currentLang) return;
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    currentLang = (stored === 'pt' || stored === 'en') ? stored : detectDefault();
  }

  function getLang() {
    ensureLoaded();
    return currentLang;
  }

  function setLang(lang) {
    if (lang !== 'pt' && lang !== 'en') return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    changeListeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  function onChange(fn) {
    changeListeners.push(fn);
  }

  // t(key, vars?) — vars is an optional { name: value } map for simple
  // {name}-style interpolation inside a string, e.g.
  //   dict.en['ss.subtitle'] = 'Choose who starts as {role}'
  //   I18n.t('ss.subtitle', { role: 'Defender' })
  function t(key, vars) {
    ensureLoaded();
    let str = dict[currentLang] && dict[currentLang][key];
    if (str == null) {
      const other = currentLang === 'pt' ? 'en' : 'pt';
      str = dict[other] && dict[other][key];
    }
    if (str == null) return key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return str;
  }

  // Lets later steps register a whole batch of keys for both languages at
  // once, e.g. I18n.addDict({ pt: {'mm.title': '...'}, en: {'mm.title': '...'} }).
  // Keeps main-menu.js etc. free to define their own strings close to
  // where they're used instead of this file growing into one giant blob.
  function addDict(partial) {
    if (partial.pt) Object.assign(dict.pt, partial.pt);
    if (partial.en) Object.assign(dict.en, partial.en);
  }

  // ---- Language toggle widget --------------------------------------
  // Small fixed corner control (PT/EN), self-contained (own inline
  // style, own DOM), mounted once on boot. Not tied to any single
  // screen — stays visible across main menu, team select, battle, etc.
  // so language can be switched at any point, not just before the game
  // starts. Screens that have converted their text to t() should call
  // I18n.onChange(...) to re-render themselves; screens that haven't
  // been converted yet (steps 2+) simply won't visibly change yet.
  function mountToggle() {
    if (document.getElementById('i18n-toggle-mount')) return;

    const style = document.createElement('style');
    style.id = 'i18n-toggle-style';
    style.textContent = `
      #i18n-toggle-mount {
        position: fixed; top: 8px; right: 8px; z-index: 999;
        display: flex; gap: 2px;
        background: rgba(3,4,8,0.75); border: 1px solid rgba(255,255,255,0.18);
        border-radius: 8px; padding: 2px; font-family: inherit;
      }
      .i18n-toggle-btn {
        border: none; background: transparent; color: #7f8db3;
        font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
        padding: 5px 9px; border-radius: 6px; cursor: pointer;
      }
      .i18n-toggle-btn.i18n-toggle-active { background: rgba(110,231,255,0.18); color: #6ee7ff; }
    `;
    document.head.appendChild(style);

    const mount = document.createElement('div');
    mount.id = 'i18n-toggle-mount';
    mount.style.display = 'none'; // hidden by default — only the main
                                   // menu's mode picker turns this on
                                   // via setToggleVisible(true); every
                                   // other screen (team-select, battle,
                                   // campaign, PVP flow...) never touches
                                   // it, so it stays off there instead of
                                   // relying on each of those screens to
                                   // remember to hide it.
    document.body.appendChild(mount);

    function render() {
      const lang = getLang();
      mount.innerHTML = `
        <button class="i18n-toggle-btn${lang === 'pt' ? ' i18n-toggle-active' : ''}" data-lang="pt">PT</button>
        <button class="i18n-toggle-btn${lang === 'en' ? ' i18n-toggle-active' : ''}" data-lang="en">EN</button>
      `;
      mount.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
      });
    }

    render();
    onChange(render);
  }

  // Lets a screen hide/show the toggle without tearing down its DOM —
  // used so the PT/EN switch only appears on the main menu's first
  // screen (mode picker) and disappears once the player moves into any
  // other screen (battlefield picker, PVP flow, team select, battle...).
  function setToggleVisible(visible) {
    const mount = document.getElementById('i18n-toggle-mount');
    if (mount) mount.style.display = visible ? '' : 'none';
  }

  // ---- Role labels ----------------------------------------------------
  // Role ids themselves (defender/attacker/support) stay in English in
  // the data layer (unit defs' `role` field, TeamSelect.ROLE_ORDER, etc.)
  // — only their on-screen label is translated. Centralized here since
  // team-select.js, starter-select.js, and campaign/draft.js each used
  // to have their own copy of this.
  addDict({
    pt: { 'role.defender': 'Defensor', 'role.attacker': 'Atacante', 'role.support': 'Suporte' },
    en: { 'role.defender': 'Defender', 'role.attacker': 'Attacker', 'role.support': 'Support' }
  });

  function roleLabel(role) {
    return t('role.' + role);
  }

  // ---- Planning UI / battle HUD (pv.=planning/battle UI) ---------------
  // Ability names/descriptions (`ability.name`, `ability.desc`) stay as
  // gameplay content (step 4) and are interpolated as-is into these
  // strings — only the surrounding chrome words are translated here.
  addDict({
    pt: {
      'pv.turn.plan': 'PLANEJE SEU TURNO',
      'pv.turn.resolving': 'RESOLVENDO\u2026',
      'pv.log.open': 'Log \u25b4',
      'pv.log.closed': 'Log \u25be',
      'pv.fight': '\u2694 LUTAR!',
      'pv.ability.passive': 'Passiva',
      'pv.status.chooseAbilityForEach': 'Escolha uma habilidade para cada uma das suas unidades',
      'pv.status.selectUnitDefault': 'Selecione uma das suas unidades',
      'pv.status.unitSetTo': '{unit} \u2014 atualmente definido para {ability}. Escolha de novo para trocar.',
      'pv.status.unitSelected': '{unit} selecionado \u2014 escolha uma habilidade',
      'pv.status.chooseAllyFor': 'Escolha um aliado para {ability}',
      'pv.status.chooseEnemyFor': 'Escolha um alvo inimigo para {ability}',
      'pv.status.echoChooseAbility': 'Agora escolha outra habilidade de {unit} para ecoar.',
      'pv.status.echoChooseTargetAlly': 'Agora escolha um aliado para {ability}.',
      'pv.status.echoChooseTargetEnemy': 'Agora escolha um inimigo para {ability}.',
      'pv.status.willHitEchoChoose': '{ability} vai acertar. Agora escolha outra habilidade de {unit} para ecoar.',
      'pv.status.queuedNextUnit': '{ability} na fila. Escolha uma habilidade para sua pr\u00f3xima unidade.',
      'pv.status.allReadyFight': 'Todas as unidades prontas \u2014 toque em LUTAR! para resolver a rodada',
      'pv.status.noEchoQueuedWithout': '{unit} n\u00e3o tem outra habilidade para ecoar agora \u2014 {ability} na fila sem eco.',
      'pv.status.echoComboQueued': '{ability} + {ability2} na fila. Escolha uma habilidade para sua pr\u00f3xima unidade.',
      'pv.status.mirrorNoTarget': '{ability} na fila \u2014 nenhum alvo v\u00e1lido para copiar agora.',
      'pv.status.mirrorWillCopy': '{ability} vai copiar {mirroredAbility} de {mirroredUnit}. Escolha o alvo.',
      'pv.status.chooseAllyEchoed': 'Escolha um aliado para a {ability} ecoada',
      'pv.status.chooseEnemyEchoed': 'Escolha um inimigo para a {ability} ecoada',
      'pv.overlay.victory': 'VIT\u00d3RIA',
      'pv.overlay.defeat': 'DERROTA',
      'pv.overlay.campaign.won': 'Voc\u00ea venceu esta luta.',
      'pv.overlay.campaign.lost': 'Seu grupo caiu.',
      'pv.overlay.campaign.continue': 'Continuar',
      'pv.overlay.campaign.returnToMenu': 'Voltar ao Menu',
      'pv.overlay.pvp.won': 'Voc\u00ea venceu a partida!',
      'pv.overlay.pvp.lost': 'Seu oponente venceu esta partida.',
      'pv.overlay.ai.won': 'Seu esquadr\u00e3o dominou o campo de batalha.',
      'pv.overlay.ai.lost': 'Seu esquadr\u00e3o caiu.',
      'pv.overlay.backToMenu': 'Voltar ao Menu',
      'pv.overlay.restartBattle': 'Reiniciar Batalha',
      'pv.hud.approval': 'Aprova\u00e7\u00e3o: {rating}',
      'pv.hud.loadingBattlefield': 'Carregando campo de batalha\u2026',
      'pv.hud.reinforcementFell': '{side} {role} caiu \u2014 {unit} entra em campo!',
      'pv.side.your': 'Seu(sua)',
      'pv.side.enemy': 'Inimigo(a)',
      'net.status.waitingOpponentMove': 'Aguardando a jogada do oponente\u2026',
      'net.status.waitingYourOpponent': 'Aguardando seu oponente\u2026',
      'net.status.connected': 'Conectado',
      'net.status.connectedDrafting': 'Conectado \u2014 escalando time\u2026',
      'net.status.waitingOpponentDraft': 'Aguardando o oponente terminar de escalar o time\u2026',
      'log.roundBegins': '\u2014 Rodada come\u00e7a ({count} a\u00e7\u00f5es na fila) \u2014',
      'log.abilityFizzled': '{ability} de {unit} n\u00e3o teve alvo v\u00e1lido e falhou.',
      'log.rewriteBonusFires': '{ability} de {unit} dispara {count}x extra por Reescrever!',
      'log.actorUsesAbility': '\u26a1{speed} \u2014 {unit} usa {ability}...',
      'log.bleedTick': '{target} sofre {amount} de {label}.',
      'log.bleedLabel': 'Sangramento',
      'log.followupLabel': 'seguimento de {unit}',
      'log.passiveTriggersOff': '{unit} passiva ativa com {actorAbility} de {actor}: {amount} de dano em todos os inimigos!',
      'log.slowCopyAttack': '{unit} est\u00e1 Lento e ataca \u2014 {granter} usa uma c\u00f3pia de {ability}!',
      'log.forcedImmediate': '{unit} age imediatamente!',
      'log.roleSwap': '{actor} troca de posi\u00e7\u00e3o com {ally}!',
      'log.moveLastNow': '{unit} agora age por \u00faltimo!',
      'log.nowSlowed': '{unit} fica Lento e agora age mais tarde!',
      'log.becomesPartner': '{partner} se torna Parceiro(a) de {unit}!',
      'log.sharesHeal': '{unit} repassa {amount} de cura para {partner}.',
      'log.choosePartner': '{unit} escolhe um Parceiro',
      'log.actorUsesAbilityShort': '{unit} usa {ability}',
      'log.takesDamage': '  \u2192 {target} sofre {amount} de dano',
      'log.absorbedByShield': ' ({amount} bloqueado)',
      'log.defeated': ' \u2014 derrotado(a)!',
      'log.healedFor': '  \u2192 {target} curado(a) em {amount}',
      'log.shieldedFor': '  \u2192 {target} escudado(a) em {amount}',
      'log.gainsStatus': '  \u2192 {target} ganha {status}',
      'log.gainsCounter': '  \u2192 {target} ganha {amount} {counter} ({total} no total)',
      'log.spendsCounter': '  \u2192 {target} gasta {amount} {counter}',
      'log.purified': '  \u2192 {target} \u00e9 purificado(a) (todos os efeitos ganhos removidos)',
      'log.nothingToPurify': '  \u2192 {target} n\u00e3o tinha nada para purificar',
      'log.note': '  \u2192 {text}',
      'fx.purified': 'Purificado'
    },
    en: {
      'pv.turn.plan': 'PLAN YOUR TURN',
      'pv.turn.resolving': 'RESOLVING\u2026',
      'pv.log.open': 'Log \u25b4',
      'pv.log.closed': 'Log \u25be',
      'pv.fight': '\u2694 FIGHT!',
      'pv.ability.passive': 'Passive',
      'pv.status.chooseAbilityForEach': 'Choose an ability for each of your units',
      'pv.status.selectUnitDefault': 'Select one of your units',
      'pv.status.unitSetTo': '{unit} \u2014 currently set to {ability}. Pick again to change.',
      'pv.status.unitSelected': '{unit} selected \u2014 choose an ability',
      'pv.status.chooseAllyFor': 'Choose an ally for {ability}',
      'pv.status.chooseEnemyFor': 'Choose an enemy target for {ability}',
      'pv.status.echoChooseAbility': 'Now choose another ability from {unit} to echo.',
      'pv.status.echoChooseTargetAlly': 'Now choose an ally for {ability}.',
      'pv.status.echoChooseTargetEnemy': 'Now choose an enemy for {ability}.',
      'pv.status.willHitEchoChoose': '{ability} will hit. Now choose another ability from {unit} to echo.',
      'pv.status.queuedNextUnit': '{ability} queued. Choose an ability for your next unit.',
      'pv.status.allReadyFight': 'All units ready \u2014 tap FIGHT! to resolve the round',
      'pv.status.noEchoQueuedWithout': '{unit} has no other ability to echo right now \u2014 {ability} queued without an echo.',
      'pv.status.echoComboQueued': '{ability} + {ability2} queued. Choose an ability for your next unit.',
      'pv.status.mirrorNoTarget': '{ability} queued \u2014 no valid target to mirror right now.',
      'pv.status.mirrorWillCopy': '{ability} will copy {mirroredAbility} from {mirroredUnit}. Choose the target.',
      'pv.status.chooseAllyEchoed': 'Choose an ally for the echoed {ability}',
      'pv.status.chooseEnemyEchoed': 'Choose an enemy for the echoed {ability}',
      'pv.overlay.victory': 'VICTORY',
      'pv.overlay.defeat': 'DEFEAT',
      'pv.overlay.campaign.won': 'You won this fight.',
      'pv.overlay.campaign.lost': 'Your party has fallen.',
      'pv.overlay.campaign.continue': 'Continue',
      'pv.overlay.campaign.returnToMenu': 'Return to Menu',
      'pv.overlay.pvp.won': 'You won the match!',
      'pv.overlay.pvp.lost': 'Your opponent won this match.',
      'pv.overlay.ai.won': 'Your squad held the battlefield.',
      'pv.overlay.ai.lost': 'Your squad has fallen.',
      'pv.overlay.backToMenu': 'Back to Menu',
      'pv.overlay.restartBattle': 'Restart Battle',
      'pv.hud.approval': 'Approval: {rating}',
      'pv.hud.loadingBattlefield': 'Loading battlefield\u2026',
      'pv.hud.reinforcementFell': '{side} {role} fell \u2014 {unit} takes the field!',
      'pv.side.your': 'Your',
      'pv.side.enemy': 'Enemy',
      'net.status.waitingOpponentMove': 'Waiting for opponent\u2019s move\u2026',
      'net.status.waitingYourOpponent': 'Waiting for your opponent\u2026',
      'net.status.connected': 'Connected',
      'net.status.connectedDrafting': 'Connected \u2014 drafting\u2026',
      'net.status.waitingOpponentDraft': 'Waiting for opponent to finish drafting\u2026',
      'log.roundBegins': '\u2014 Round begins ({count} actions queued) \u2014',
      'log.abilityFizzled': '{unit}\u2019s {ability} had no valid target and fizzled.',
      'log.rewriteBonusFires': '{unit}\u2019s {ability} fires {count}x extra from Rewrite!',
      'log.actorUsesAbility': '\u26a1{speed} \u2014 {unit} uses {ability}...',
      'log.bleedTick': '{target} takes {amount} from {label}.',
      'log.bleedLabel': 'Bleed',
      'log.followupLabel': '{unit}\u2019s followup',
      'log.passiveTriggersOff': '{unit}\u2019s passive triggers off {actor}\u2019s {actorAbility}: {amount} damage to all enemies!',
      'log.slowCopyAttack': '{unit} is Slowed and attacks \u2014 {granter} uses a copy of {ability}!',
      'log.forcedImmediate': '{unit} acts immediately!',
      'log.roleSwap': '{actor} swaps positions with {ally}!',
      'log.moveLastNow': '{unit} now acts last!',
      'log.nowSlowed': '{unit} is now Slowed and will act later!',
      'log.becomesPartner': '{partner} becomes {unit}\u2019s Partner!',
      'log.sharesHeal': '{unit} shares {amount} healing with {partner}.',
      'log.choosePartner': '{unit} chooses a Partner',
      'log.actorUsesAbilityShort': '{unit} uses {ability}',
      'log.takesDamage': '  \u2192 {target} takes {amount} dmg',
      'log.absorbedByShield': ' ({amount} blocked)',
      'log.defeated': ' \u2014 defeated!',
      'log.healedFor': '  \u2192 {target} healed for {amount}',
      'log.shieldedFor': '  \u2192 {target} shielded for {amount}',
      'log.gainsStatus': '  \u2192 {target} gains {status}',
      'log.gainsCounter': '  \u2192 {target} gains {amount} {counter} ({total} total)',
      'log.spendsCounter': '  \u2192 {target} spends {amount} {counter}',
      'log.purified': '  \u2192 {target} is purified (all gained effects removed)',
      'log.nothingToPurify': '  \u2192 {target} had nothing to purify',
      'log.note': '  \u2192 {text}',
      'fx.purified': 'Purified'
    }
  });

  return { t, getLang, setLang, onChange, addDict, mountToggle, setToggleVisible, roleLabel };
})();
