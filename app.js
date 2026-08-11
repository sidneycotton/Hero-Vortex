// Hero Vortex application bootstrap and shared runtime globals.

let CARD_DB = {};
let state = null;
const ROLES = ['defensor', 'atacante', 'suporte'];

async function boot() {
  try {
    const res = await fetch('cards.json');
    if (!res.ok) throw new Error(`cards.json HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.cards)) throw new Error('cards.json.cards must be an array');
    CARD_DB = Object.fromEntries(data.cards.map(card => [card.id, card]));
    if (typeof renderTeamSelect !== 'function') throw new Error('renderTeamSelect is not available');
    renderTeamSelect();
  } catch (error) {
    console.error('[Hero Vortex] Boot failed:', error);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="pass-screen"><h1 class="game-title">Hero Vortex</h1><p class="setup-sub">Não foi possível carregar as cartas. Recarregue a página.</p></div>`;
  }
}

window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
