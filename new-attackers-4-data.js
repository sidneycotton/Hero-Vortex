// ===================== LOTE DE ATACANTES 4 =====================
(() => {
  const C = [
    {id:'l_kyriel',name:'L. Kyriel, a Primavera Vingadora',life:68,role:'atacante',deckDescription:'Ataca quem já agiu, limita habilidades inimigas e cura aliados enquanto pune quem já foi danificado.',abilities:[
      {speed:3,cooldown:0,text:'Cause 12 de dano em um inimigo. Se um aliado já foi danificado neste turno, cause 6 a mais.',effects:[{type:'dealDamage',base:12,target:'chooseEnemy'},{type:'kyrielBonusIfAllyDamaged'}]},
      {speed:3,cooldown:2,text:'No próximo turno, inimigos só podem utilizar suas habilidades mais rápidas.',effects:[{type:'kyrielFastestOnly'}]},
      {speed:3,cooldown:1,text:'Cause 4 de dano em todos os inimigos e recupere 4 de vida de todos os aliados. Se um aliado já foi danificado neste turno, repita isso.',effects:[{type:'kyrielPulse'}]}
    ]},
    {id:'gus',name:'Gus, o Ganso',life:3,role:'atacante',deckDescription:'Um ganso absurdamente resistente à morte que volta mais forte cada vez que é revivido.',passive:'Quando eu morrer, me reviva com o dobro de vida máxima e dobre o dano que eu causo. Faça isso um máximo de 4 vezes.',abilities:[
      {speed:5,cooldown:0,text:'Cause 2 de dano em um inimigo. Se ele não me atacar neste turno, reduza a vida máxima dele em 10%.',effects:[{type:'dealDamage',base:2,target:'chooseEnemy'},{type:'gusMaxLifeIfNotAttacked'}]},
      {speed:4,cooldown:0,text:'Cause 1 de dano em todos os inimigos. Para cada vida que eu ainda tiver, repita essa habilidade.',effects:[{type:'gusRepeatByLife'}]}
    ]},
    {id:'deadric',name:'Deadric, a Aberração',life:75,role:'atacante',deckDescription:'Manipula velocidades e ganha um ataque extra quando o turno acumula três habilidades na mesma velocidade.',passive:'Quando 3 Habilidades com a mesma Velocidade acontecerem em um único turno, eu uso um ataque extra.',abilities:[
      {speed:3,cooldown:0,text:'Cause 9 de dano. Cause 3 a mais para cada aliado que tiver sido danificado neste turno.',effects:[{type:'deadricAttack',base:9,bonusPerDamagedAlly:3}]},
      {speed:7,cooldown:0,text:'Cause até X de dano. Onde X é a Velocidade Original da última Habilidade usada pelo alvo. Mude a velocidade da Habilidade para ser o dano.',effects:[{type:'deadricSpeedAttack',target:'chooseEnemy'}]}
    ]},
    {id:'gavin',name:'Gavin, Mestre Insuperável',life:62,role:'atacante',deckDescription:'Encadeia habilidades dos aliados e transforma inimigos Lentos em oportunidades para repetir seus golpes.',passive:'Sempre que um aliado utilizar uma Habilidade logo em seguida da minha, cause 2 de dano em todos os inimigos.',abilities:[
      {speed:4,cooldown:0,text:'Cause 4 de dano em um inimigo, cure 4 de vida de um aliado. Essa Habilidade ocorre novamente neste turno, com 8 de Velocidade, Dano e Cura.',effects:[{type:'gavinDouble',target:'chooseEnemy'}]},
      {speed:2,cooldown:0,text:'Cause 2 de dano em um inimigo, ele fica Lento 2. Quando um inimigo Lento atacar neste turno, eu uso uma cópia desta minha Habilidade.',effects:[{type:'gavinSlow',target:'chooseEnemy'}]}
    ]},
    {id:'rot',name:'Rot, Deus-Gevi',life:79,role:'atacante',deckDescription:'Espalha Veneno entre inimigos e pode sacrificar unidades Criadas para finalizar ameaças.',passive:'Quando eu matar uma unidade Criada, Envenene um alvo. O meu Veneno pode ser acumulado.',abilities:[
      {speed:7,cooldown:0,text:'Cause 15 de dano em um inimigo. Para cada Acúmulo de Veneno no alvo cause 3 de dano em todos os outros inimigos.',effects:[{type:'rotPoisonAttack',target:'chooseEnemy'}]},
      {speed:9,cooldown:0,text:'Mate uma unidade Criada aliada ou cause 10 em uma unidade Criada inimiga.',effects:[{type:'rotCreatedChoice'}]}
    ]}
  ];
  function inject(){
    if(typeof CARD_DB==='undefined'||!Object.keys(CARD_DB).length)return false;
    for(const c of C) CARD_DB[c.id]=c;
    return true;
  }
  const timer=setInterval(()=>{if(inject())clearInterval(timer)},100);
})();
