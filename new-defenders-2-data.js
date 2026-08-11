// ===================== NOVOS DEFENSORES II =====================
(() => {
const C=[
{id:'amelia',name:'Amelia, Ascendente Incômoda',life:74,role:'defensor',deckDescription:'Pune inimigos que já agiram, altera a velocidade do próximo turno e força um alvo a agir imediatamente.',abilities:[
{speed:3,cooldown:0,text:'Cause 15 de dano em todos os inimigos que já utilizaram uma habilidade neste turno.',effects:[{type:'ameliaPunishActed'}]},
{speed:3,cooldown:0,text:'Seus outros aliados são mais rápidos em 5 no próximo turno. Inimigos são mais rápidos em 3 no próximo turno.',effects:[{type:'ameliaTempo'}]},
{speed:3,cooldown:0,text:'Cause 18 de dano em um inimigo. O alvo age imediatamente.',effects:[{type:'dealDamage',base:18,target:'chooseEnemy'},{type:'moveNow',target:'lastTarget'}]}]},
{id:'anuben',name:'Anuben, Perdido no Tempo',life:74,role:'defensor',deckDescription:'Manipula a ordem do turno, causa dano em área e marca um inimigo para uma explosão quando o atingir.',abilities:[
{speed:1,cooldown:4,text:'Cause 6 de dano em um inimigo. No próximo turno, apenas eu posso usar Habilidades.',effects:[{type:'anubenSoloTurn'},{type:'dealDamage',base:6,target:'chooseEnemy'}]},
{speed:6,cooldown:0,text:'Cause 6 de dano em todos os inimigos.',effects:[{type:'dealDamage',base:6,target:'allEnemies'}]},
{speed:3,cooldown:0,text:'Marque um inimigo, quando eu danificar ele, remova essa marca, causando 15 de dano.',effects:[{type:'anubenMark',target:'chooseEnemy'}]}]},
{id:'leticia',name:'Letícia, Sacrifício Pela Ciência',life:70,role:'defensor',deckDescription:'Sacrifica a própria vida para pressionar todos os inimigos e fica mais forte ou mais fraca conforme foi curada.',passive:'No final do turno, cause 20 de dano em mim mesma.',abilities:[
{speed:0,cooldown:0,text:'Cause 18 de dano em todos os inimigos. Se eu fui curada no turno passado, cause 10 de dano a menos.',effects:[{type:'leticiaMassAttack'}]},
{speed:0,cooldown:0,text:'Cause 15 de dano em em um inimigo. Se eu fui curada no turno passado, cause 10 de dano a mais.',effects:[{type:'leticiaSingleAttack',target:'chooseEnemy'}]}]},
{id:'lou',name:'Lou, Fashion Fatal',life:70,role:'defensor',deckDescription:'Veste os inimigos com itens incômodos e transforma cada peça em uma forma diferente de controle.',passive:'Quando eu for jogada, coloque um Boné Feio ou uma Jeans Cafona em cada um dos inimigos.',abilities:[
{speed:3,cooldown:0,text:'Cause 8 de dano em um inimigo e 6 em outro. Se eles estiverem usando um Boné Feio, eles não podem ser curados até o próximo turno',effects:[{type:'louAttackHat',target:'chooseEnemy'}]},
{speed:3,cooldown:0,text:'Cause 8 de dano em um inimigo e 6 em outro. Se eles estiverem usando uma Jeans Cafona, coloque a Habilidades deles em Recarga 1.',effects:[{type:'louAttackJeans',target:'chooseEnemy'}]}]},
{id:'sirius',name:'Sirius, Escritor do Próprio Futuro',life:77,role:'defensor',deckDescription:'Duplica uma habilidade futura, troca de posição com o Defensor e fortalece os Heróis.',abilities:[
{speed:1,cooldown:0,text:'Na próxima vez que eu utilizar uma outra habilidade, use ela uma vez a mais.',effects:[{type:'siriusDoubleNext'}]},
{speed:5,cooldown:0,text:'Me troque com o seu Defensor neste turno. Me conceda +15 de vida.',effects:[{type:'siriusSwapDefender'}]},
{speed:5,cooldown:0,text:'As habilidades de seus Heróis causam +2 de dano neste turno. Cause 8 de dano em um inimigo.',effects:[{type:'siriusHeroBoost'},{type:'dealDamage',base:8,target:'chooseEnemy'}]}]},
{id:'victor_hans',name:'Victor Hans, O Último General',life:70,role:'defensor',deckDescription:'Forma um exército de Soldados e aumenta permanentemente o dano deles.',abilities:[
{speed:9,cooldown:0,text:'Cause 10 de dano em um inimigo. Crie um Soldado.',effects:[{type:'dealDamage',base:10,target:'chooseEnemy'},{type:'createToken',tokenId:'soldado'}]},
{speed:4,cooldown:0,text:'Cause 8 de dano em um inimigo. Cada Soldado aliado ataca ele causando 8 de dano.',effects:[{type:'victorSoldierAttack',target:'chooseEnemy'}]},
{speed:6,cooldown:0,text:'Crie um Soldado. Pelo resto do jogo, Soldados aliados causam 2 de dano a mais ao atacar.',effects:[{type:'createToken',tokenId:'soldado'},{type:'victorSoldierBuff'}]}]},
{id:'soldado',name:'Soldado',life:12,role:'atacante',isToken:true,deckDescription:'Token criado por Victor Hans que ataca diretamente.',abilities:[{speed:5,cooldown:0,text:'Cause 8 de dano.',effects:[{type:'dealDamage',base:8,target:'chooseEnemy'}]}]},
{id:'vitor',name:'Vitor, Salvação de Kerythnar',life:78,role:'defensor',deckDescription:'Acumula Cristais de Sangue para aumentar dano próprio e Escudos.',abilities:[
{speed:4,cooldown:0,text:'Cause 12 de dano. Ganhe um Cristal de Sangue.',effects:[{type:'dealDamage',base:12,target:'chooseEnemy'},{type:'gainCounter',counter:'cristalSangue',value:1}]},
{speed:7,cooldown:0,text:'Cause 3 de dano em mim e 3 de dano em um inimigo. Dobre esse dano para cada Cristal de Sangue que eu tiver.',effects:[{type:'vitorBloodDamage',target:'chooseEnemy'}]},
{speed:5,cooldown:0,text:'Dê um escudo de 6 de vida para um aliado até o final do próximo turno. Com mais 3 de vida para cada Cristal de Sangue que eu tiver.',effects:[{type:'vitorBloodShield',target:'chooseAlly'}]}]},
{id:'yvrel',name:'Yvrel, a Luz que se Apagou',life:74,role:'defensor',deckDescription:'Bloqueia alvos, controla a ordem do turno e reutiliza uma habilidade em um aliado.',abilities:[
{speed:3,cooldown:0,text:'Cause 13 de dano. O alvo não pode ser Alvejado por outras Habilidades neste turno.',effects:[{type:'dealDamage',base:13,target:'chooseEnemy'},{type:'yvrelUntargetable',target:'lastTarget'}]},
{speed:3,cooldown:0,text:'Cause 10 de dano. O alvo se move por último neste turno.',effects:[{type:'dealDamage',base:10,target:'chooseEnemy'},{type:'yvrelLast',target:'lastTarget'}]},
{speed:4,cooldown:0,text:'Cause 23 de dano. Use uma das minhas outras Habilidades em um aliado. Use uma Habilidade diferente da utilizada na última vez.',effects:[{type:'yvrelCopyAbility',target:'chooseAlly'}]}]},
{id:'bork',name:'Bork, a Lâmina Podre',life:75,role:'defensor',deckDescription:'Seus golpes causam dano extra proporcional à vida atual do alvo e podem virar Escudo.',passive:'Quando eu causar dano em um inimigo, cause 10% da vida atual dele como dano extra.',abilities:[
{speed:7,cooldown:0,text:'Cause 1 de dano em um inimigo. Depois, cause 1 de dano em um inimigo.',effects:[{type:'borkDoubleHit',target:'chooseEnemy'}]},
{speed:4,cooldown:0,text:'Cause 7 de dano em um inimigo. Eu ganho um escudo com vida igual ao dano total causado.',effects:[{type:'borkShieldHit',target:'chooseEnemy'}]}]}
];
function inject(){if(typeof CARD_DB==='undefined'||!Object.keys(CARD_DB).length)return false;for(const c of C)CARD_DB[c.id]=c;if(typeof renderTeamSelect==='function')renderTeamSelect();return true}const t=setInterval(()=>{if(inject())clearInterval(t)},100);
})();
