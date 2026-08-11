/* Concise, player-facing summaries for the deckbuilder.
   These are intentionally shorter than the full passive/ability text and are
   derived from the card's actual rules so the summary stays useful as cards change. */
(function(){
  const summaries = {
    kanth: 'Cria múltiplas cópias e transforma a presença de Kanth em pressão crescente.',
    ajax: 'Luta junto de um inimigo e aplica Sangramento para manter a pressão.',
    grath: 'Atacante agressivo que aumenta o dano contra alvos com muita vida.',
    reuben: 'Espalha dano por classes inimigas e provoca o Defensor para controlar o combate.',
    mulanna: 'Ganha proteção em marcos de vida, tornando-se difícil de derrubar.',
  };

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function genericSummary(card){
    const text = [card.passive || '', ...(card.abilities || []).map(a=>a.text || '')].join(' ').toLowerCase();
    const parts = [];
    if (/c[oó]pia|c[oó]pias|cria|invoca|construto|token/.test(text)) parts.push('cria unidades adicionais');
    if (/escudo/.test(text)) parts.push('gera ou aproveita Escudo');
    if (/cura|recupere|recupera/.test(text)) parts.push('mantém aliados vivos com cura');
    if (/sangra|sangramento/.test(text)) parts.push('aplica Sangramento');
    if (/silenci/.test(text)) parts.push('nega habilidades com Silêncio');
    if (/provoco|provoca/.test(text)) parts.push('controla o alvo com Provocação');
    if (/dano/.test(text)) parts.push('converte ações em dano');
    if (/buff|fortale|mais \d+ de dano|pr[oó]x.*dano/.test(text)) parts.push('fortalece ataques futuros');
    if (/campo|chuva|tempestade/.test(text)) parts.push('altera o campo de batalha');
    if (/reviv|retorna.*vida/.test(text)) parts.push('pode trazer uma unidade de volta');
    if (!parts.length) return 'Uma carta com efeitos próprios para criar oportunidades durante a partida.';
    return parts.slice(0,2).join(' e ').replace(/^./,m=>m.toUpperCase()) + '.';
  }

  function enhanceDeckCards(){
    document.querySelectorAll('.hv-deck-card[data-deck-card]').forEach(el=>{
      if (el.querySelector('.hv-deck-card-summary')) return;
      const id=el.dataset.deckCard;
      const card=typeof CARD_DB!=='undefined' ? CARD_DB[id] : null;
      if (!card) return;
      const summary=summaries[id] || genericSummary(card);
      const rule=el.querySelector('.hv-deck-card-rule');
      const summaryEl=document.createElement('span');
      summaryEl.className='hv-deck-card-summary';
      summaryEl.textContent=summary;
      if(rule) rule.insertAdjacentElement('afterend',summaryEl);
      else el.appendChild(summaryEl);
    });
  }

  enhanceDeckCards();
  new MutationObserver(enhanceDeckCards).observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
})();
