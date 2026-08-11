// ===================== SUPORTES 1 =====================
(() => {
const C=[
{id:'andressa',name:'Andressa, Pequena Escudeira',life:50,role:'suporte',deckDescription:'Protege um parceiro, transforma dano recebido em cura e converte cura em Vida Máxima enquanto estiver protegida.',passive:'Quando eu for Jogada, um aliado se torna meu Parceiro, sempre que eu for danificada, metade do dano vira cura para ele.',abilities:[
{speed:3,cooldown:0,text:'Recupere 5 de vida de um aliado e o conceda um escudo de 5 de vida. Se o aliado for o meu parceiro, faça o mesmo em mim.',effects:[{type:'andressaHealShield',target:'chooseAlly'}]},
{speed:5,cooldown:3,text:'Conceda um escudo de 10 de vida para mim. Enquanto eu tiver um escudo, cura aliada se transforma em vida máxima para o alvo.',effects:[{type:'andressaGuard'}]}]},
{id:'donna',name:'Donna, Viúva da Praga',life:69,role:'suporte',deckDescription:'Espalha Contadores da Praga que causam dano no fim dos turnos e pode trocar parte da Praga por Vida para seus aliados.',abilities:[
{speed:3,cooldown:0,text:'Coloque 5 Contadores da Praga em um inimigo. No final de cada turno, inimigos recebem dano igual a quantidade de Contadores da Praga neles.',effects:[{type:'donnaPlague',target:'chooseEnemy',value:5}]},
{speed:6,cooldown:0,text:'Coloque 2 Contadores da Praga em todos os inimigos.',effects:[{type:'donnaPlagueAll',value:2}]},
{speed:2,cooldown:0,text:'Remova 3 Contadores da Praga de um alvo. Conceda +10 de vida para os seus aliados.',effects:[{type:'donnaCleanPlague',target:'chooseUnit'}]}]},
{id:'neon',name:'NEON',life:60,role:'suporte',deckDescription:'Acelera aliados e cria pressão contínua sempre que eles atacam.',abilities:[
{speed:1,cooldown:0,text:'Cure 4 de vida de todos os aliados. Acelere em 3 as habilidades deles neste turno.',effects:[{type:'neonHealHaste'}]},
{speed:2,cooldown:0,text:'Até o próximo turno, sempre que um aliado atacar um inimigo, cause 2 de dano no alvo.',effects:[{type:'neonAttackEcho'}]},
{speed:3,cooldown:0,text:'Nos próximos 2 turnos, no final do turno, aliados atacam um inimigo causando 2 de dano cada.',effects:[{type:'neonEndTurnAttacks'}]}]},
{id:'vanessa',name:'Vanessa, Diversão sem Limites',life:65,role:'suporte',deckDescription:'Recompensa o primeiro inimigo que a danifica e pode provocar o Atacante enquanto cura sua equipe.',passive:'A primeira unidade que me danificar todo turno, ganha um escudo de 10 de vida por 2 turnos.',abilities:[
{speed:4,cooldown:0,text:'Um aliado me ataca causando 3 de dano, depois ataca cada inimigo causando 6 de dano.',effects:[{type:'vanessaAllyAttack'}]},
{speed:1,cooldown:1,text:'Eu provoco o Atacante inimigo. Sempre que eu for danificada neste turno, cure 4 de vida de todos os meus aliados.',effects:[{type:'vanessaTaunt'}]}]},
{id:'romulo',name:'Rômulo, Preletor Experiente',life:67,role:'suporte',deckDescription:'Coordena ataques da equipe, fortalece o próximo golpe dos aliados e recupera vida de quem sofreu dano.',abilities:[
{speed:6,cooldown:0,text:'Eu, o Atacante e o Defensor aliado atacamos um único inimigo, cada ataque causa 3 de dano.',effects:[{type:'romuloTripleAttack',target:'chooseEnemy'}]},
{speed:7,cooldown:0,text:'Cause 3 de dano em cada aliado. O próximo ataque de cada um deles causa 3 de dano a mais em cada alvo.',effects:[{type:'romuloBuffAttack'}]},
{speed:8,cooldown:0,text:'Recupere 6 de vida de cada aliado. Recupere 6 de vida adicional em alvos que foram danificados no turno anterior.',effects:[{type:'romuloHeal'}]}]},
{id:'dario',name:'Dário, o Senador e a Sombra',life:66,role:'suporte',deckDescription:'Muda de forma conforme é curado ou danificado, alternando entre suporte defensivo e ofensivo.',passive:'Quando um aliado me curar, eu me torno o Senador. Quando um aliado me danificar, eu me torno a Sombra.',abilities:[
{speed:7,cooldown:0,text:'Cause 7 de dano em um inimigo. Se eu for o Senador, cure 7 de vida de um alvo. Se eu for a Sombra, cause 7 de dano a mais.',effects:[{type:'darioAttack',target:'chooseEnemy'}]},
{speed:5,cooldown:0,text:'Conceda 5 de Escudo para um aliado. Se eu for o Senador, dobre o Escudo que ele tem. Se eu for a Sombra, roube o Escudo de um inimigo.',effects:[{type:'darioShield',target:'chooseAlly'}]}]},
{id:'zeev',name:"Ze'ev, Praga e Perigo",life:64,role:'suporte',deckDescription:'Usa Decaimento como cura para aliados e manipula sua duração.',passive:'Decaimento que eu coloco em aliados cura ao invés de Danificar.',abilities:[
{speed:3,cooldown:0,text:'Conceda 8 de Escudo e coloque 4 de Decaimento em um alvo.',effects:[{type:'zeevDecayShield',target:'chooseUnit'}]},
{speed:5,cooldown:0,text:'Acelere o Decaimento de um alvo em 2.',effects:[{type:'zeevAccelerateDecay',target:'chooseUnit'}]}]},
{id:'brenda',name:'Brenda, Mecânica de Combate',life:68,role:'suporte',deckDescription:'Protege a equipe e impede criação de unidades, ficando cada vez mais forte quando Escudos são quebrados.',abilities:[
{speed:2,cooldown:2,text:'Unidades não podem ser criadas neste turno. Conceda 7 de Escudo a todos os seus aliados.',effects:[{type:'brendaNoCreate'},{type:'brendaTeamShield'}]},
{speed:7,cooldown:0,text:'Cause 1 de dano em um inimigo. Sempre que um Escudo aliado for danificado, melhore essa Habilidade em 1 Permanentemente.',effects:[{type:'brendaAttack',target:'chooseEnemy'}]},
{speed:1,cooldown:0,text:'Conceda 15 de escudo para um aliado neste turno. Cause 5 de dano em um aliado.',effects:[{type:'brendaShieldDamage',target:'chooseAlly'}]}]},
{id:'jairo',name:'Jairo, o Glorioso Pacifista',life:58,role:'suporte',deckDescription:'Cria uma janela de paz sem dano, reduz Vida Máxima e cura aliados conforme inimigos permanecem intocados.',abilities:[
{speed:6,cooldown:2,text:'No Próximo turno, nenhuma unidade pode ser danificada. Recupere 5 de vida dos seus aliados.',effects:[{type:'jairoPeace'}]},
{speed:8,cooldown:0,text:'Um inimigo perde 8 de vida máxima.',effects:[{type:'jairoMaxLife',target:'chooseEnemy'}]},
{speed:8,cooldown:0,text:'Para cada inimigo que ainda não foi danificado neste turno, recupere 6 de vida de um aliado.',effects:[{type:'jairoUntouchedHeal',target:'chooseAlly'}]}]},
{id:'barao_chemio',name:'Barão Químio III',life:65,role:'suporte',deckDescription:'Manipula uma Toxina que pode ser melhorada ao passar o turno e usada repetidamente.',passive:'Eu posso passar o meu turno; se eu fizer isso, melhore o efeito do próximo uso da minha Toxina para Doze.',abilities:[
{speed:0,cooldown:0,text:'Aplique a minha Toxina em um alvo neste turno. Se a Toxina não estiver melhorada, aplique-a em quantos alvos quiser.',effects:[{type:'baraoToxina',target:'chooseEnemy'}]},
{speed:5,cooldown:3,text:'Use a Toxina melhorada em mim. Eu perco 0 de vida máxima e causo 0 de dano em um inimigo no final do turno. [Desativável mesmo em recarga]',effects:[{type:'baraoImprovedToxina'}]}]}
];
function inject(){if(typeof CARD_DB==='undefined'||!Object.keys(CARD_DB).length)return false;for(const c of C)CARD_DB[c.id]=c;return true}const t=setInterval(()=>{if(inject())clearInterval(t)},100);
})();
