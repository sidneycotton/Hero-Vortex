// Garante que os novos Defensores também entrem no CARD_DB mesmo quando o fetch de cards.json já tiver começado.
(() => {
  const CARDS = [
    { id:'benicio', name:'Benício, Herói em Treinamento', life:81, role:'defensor', passive:'Sempre que você criar um aliado, conceda 5 de Escudo a ele. Habilidades aliadas que criam aliados, aceleram em 2.', deckDescription:'Protege unidades recém-criadas e prepara aliados para contra-atacar golpes pesados.', abilities:[
      {speed:1,cooldown:0,text:'Escolha um aliado, o próximo ataque dele causa 5 de dano a mais. Ele não pode ser provocado até o final do próximo turno.',effects:[{type:'applyStatus',status:'benicioNextAttack',value:5,duration:2,target:'chooseAlly'},{type:'applyStatus',status:'benicioUntaggable',value:1,duration:2,target:'chooseAlly'}]},
      {speed:2,cooldown:0,text:'Neste turno, se um aliado for tomar 15 de dano, ele ataca imediatamente primeiro. Se ele já tiver agido, ele ganha um Escudo de 10 de vida invés.',effects:[{type:'armBenicioEmergency'}]}
    ]},
    { id:'rahdan', name:'Rahdan, Rei das Almas', life:81, role:'defensor', passive:'Quando um aliado for atacar um inimigo, eu roubo 2 de vida do aliado e aumento o dano do ataque em 4.', deckDescription:'Rouba vida para fortalecer ataques aliados e converte a própria vida em Escudo.', abilities:[
      {speed:4,cooldown:0,text:'Roube 4 de vida de um inimigo e 2 dos outros. Eles causam 2 de dano a menos neste turno.',effects:[{type:'rahdanDrainEnemies'}]},
      {speed:1,cooldown:0,text:'Cause 8 de dano em mim. Me dê um escudo com 16 de vida.',effects:[{type:'dealDamage',base:8,target:'self'},{type:'applyShield',value:16,duration:1,target:'self'}]}
    ]},
    { id:'zengrath', name:'Zengrath, Ódio Encarnado', life:70, role:'defensor', passive:'Quando eu for Jogado, eu ganho +2 de vida máxima para cada unidade que já morreu neste jogo.', deckDescription:'Fica mais resistente com as mortes do jogo e transforma vida máxima em dano.', abilities:[
      {speed:9,cooldown:0,text:'Cause dano igual a 10% da minha vida máxima em um inimigo. (Arredondado para cima.)',effects:[{type:'zengrathMaxLifeDamage',target:'chooseEnemy'}]},
      {speed:2,cooldown:0,text:'Cause 2 de dano em todos os inimigos. Eu ganho +2 de vida máxima para cada inimigo atingido.',effects:[{type:'zengrathMassAttack'}]}
    ]},
    { id:'predador_labirinto', name:'O Predador do Labirinto', life:60, role:'defensor', passive:'Quando eu for danificado, crie uma cópia idêntica a mim. (Até um máximo de 15 podem existir ao mesmo tempo.)', deckDescription:'Cria cópias ao ser danificado e escala quando sua horda chega ao limite.', abilities:[
      {speed:6,cooldown:0,text:'Cause 1 de dano em um inimigo. Se 15 cópias existem, cause 1 de dano a mais.',effects:[{type:'predadorAttack'}]},
      {speed:2,cooldown:0,text:'Conceda 1 de Escudo para todos os aliados neste turno. Se 15 cópias existem, conceda 1 a mais.',effects:[{type:'predadorShield'}]}
    ]},
    { id:'arborzilla', name:'Arborzilla, Forte para Carvalho', life:86, role:'defensor', passive:'Quando eu atacar um inimigo, ataque também um inimigo que foi criado.', deckDescription:'Ataca inimigos criados, melhora seu golpe com abates e redistribui efeitos purificados.', abilities:[
      {speed:4,cooldown:0,text:'Cause 5 de dano em um inimigo e ganhe 5 de Escudo neste turno. Se essa Habilidade matou um inimigo, melhore ela em 1 permanentemente.',effects:[{type:'arborzillaAttack'}]},
      {speed:7,cooldown:0,text:'Purifique um aliado. Coloque os efeitos removidos dele em um inimigo.',effects:[{type:'purifyTransfer',target:'chooseAlly'}]}
    ]},
    { id:'porteiro', name:'O Porteiro', life:84, role:'defensor', passive:null, deckDescription:'Provoca aliados, transforma seus golpes em cura e pune quem não o enfrenta.', abilities:[
      {speed:5,cooldown:0,text:'Eu causo 8 de dano em um inimigo. Se ele não me atacar neste turno, cause mais 8. Bom dia.',effects:[{type:'porteiroMark',target:'chooseEnemy'},{type:'dealDamage',base:8,target:'chooseEnemy'}]},
      {speed:2,cooldown:0,text:'Purifique uma unidade.',effects:[{type:'purify',target:'chooseAlly'}]},
      {speed:3,cooldown:1,text:'Eu Provoco um aliado. Ao invés de me danificar, o dano dele me cura neste turno.',effects:[{type:'porteiroTauntAlly',target:'chooseAlly'}]}
    ]},
    { id:'varghul', name:'Varghul, Ressurreto Insano', life:84, role:'defensor', passive:'Quando um aliado morrer, cause 6 de dano em um inimigo.', deckDescription:'Cria cópias descartáveis e transforma mortes de aliados em dano imediato.', abilities:[
      {speed:4,cooldown:0,text:'Crie uma cópia minha. Ela ataca um inimigo causando 6 de dano e depois morre.',effects:[{type:'varghulStrikeCopy',target:'chooseEnemy'}]},
      {speed:1,cooldown:0,text:'Crie uma Cópia minha. Ela Provoca um Inimigo e morre após a Habilidade do inimigo ser usada.',effects:[{type:'varghulTauntCopy',target:'chooseEnemy'}]}
    ]},
    { id:'cm9', name:'CM-9, O Sistema de Segurança', life:88, role:'defensor', passive:null, deckDescription:'Premia ações rápidas, converte dano recente em Escudo e retalia quando entra em alerta.', abilities:[
      {speed:2,cooldown:0,text:'Neste turno, sempre que um aliado utilizar uma habilidade antes do inimigo da mesma classe, cause 10 de dano no inimigo.',effects:[{type:'armCM9Strike'}]},
      {speed:2,cooldown:2,text:'Me dê um escudo com vida igual a quantidade de vida que eu perdi desde o último turno.',effects:[{type:'cm9Shield'}]},
      {speed:3,cooldown:1,text:'Eu entro em alerta neste turno. Quando eu for danificado, cause 2 de dano em todos os inimigos e aumente esse dano em 1.',effects:[{type:'armCM9Alert'}]}
    ]},
    { id:'boi', name:'Boi, o Saparrudo', life:86, role:'defensor', passive:'Uma vez por jogo, enquanto eu estiver na sua mão, você pode me revelar. Se você fizer isso, eu absorvo uma Habilidade inimiga. (Cancele todos os Efeitos dela.)', deckDescription:'Absorve uma Habilidade inimiga da mão e pode reutilizá-la como se fosse sua.', abilities:[
      {speed:0,cooldown:0,icon:'frog',text:'Essa Habilidade se Torna a Habilidade Absorvida.',effects:[{type:'boiUseAbsorbed'}]},
      {speed:4,cooldown:0,text:'Eu ganho X de Escudo e causo X de Dano em um inimigo. Onde X é o dobro da quantidade de turnos em que eu estou no campo.',effects:[{type:'boiScalingAttack',target:'chooseEnemy'}]}
    ]},
    { id:'zeth', name:'Zeth, Túmulo Vivo', life:99, role:'defensor', passive:null, deckDescription:'Aplica Decaimento crescente e usa seu Escudo para espalhar o efeito aos inimigos.', abilities:[
      {speed:1,cooldown:0,text:'Cause 9 de dano em mim.',effects:[{type:'dealDamage',base:9,target:'self'}]},
      {speed:6,cooldown:2,text:'Coloque Decaimento 4 no inimigo.',effects:[{type:'applyDecay',value:4,target:'chooseEnemy'}]},
      {speed:1,cooldown:2,text:'Eu ganho um escudo de 18 de vida. No final do turno, se eu tiver esse escudo, aplique Decaimento 3 em todos os inimigos.',effects:[{type:'zethShieldDecay'}]}
    ]}
  ];

  function inject() {
    if (typeof CARD_DB === 'undefined' || !Object.keys(CARD_DB).length) return false;
    for (const card of CARDS) CARD_DB[card.id] = card;
    if (typeof renderTeamSelect === 'function') renderTeamSelect();
    return true;
  }
  const timer = setInterval(() => { if (inject()) clearInterval(timer); }, 100);
})();
