// ===================== NOVOS ATACANTES II =====================
// Amelia, Anuben, Letícia, Lou, Sirius, Victor Hans, Vitor, Yvrel e Bork são ATACANTES.
// Soldado também é Atacante (token).
// O conteúdo das cartas permanece igual; somente a classe foi corrigida.
(() => {
const C=[
{id:'amelia',name:'Amelia, Ascendente Incômoda',life:74,role:'atacante'},
{id:'anuben',name:'Anuben, Perdido no Tempo',life:74,role:'atacante'},
{id:'leticia',name:'Letícia, Sacrifício Pela Ciência',life:70,role:'atacante'},
{id:'lou',name:'Lou, Fashion Fatal',life:70,role:'atacante'},
{id:'sirius',name:'Sirius, Escritor do Próprio Futuro',life:77,role:'atacante'},
{id:'victor_hans',name:'Victor Hans, O Último General',life:70,role:'atacante'},
{id:'soldado',name:'Soldado',life:12,role:'atacante',isToken:true},
{id:'vitor',name:'Vitor, Salvação de Kerythnar',life:78,role:'atacante'},
{id:'yvrel',name:'Yvrel, a Luz que se Apagou',life:74,role:'atacante'},
{id:'bork',name:'Bork, a Lâmina Podre',life:75,role:'atacante'}
];
function inject(){if(typeof CARD_DB==='undefined'||!Object.keys(CARD_DB).length)return false;for(const c of C){if(CARD_DB[c.id]) CARD_DB[c.id].role='atacante'; else CARD_DB[c.id]=c;}return true}
const t=setInterval(()=>{if(inject())clearInterval(t)},100);
})();
