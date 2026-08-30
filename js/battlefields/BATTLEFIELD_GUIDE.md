# Como construir um Battlefield

Este guia documenta o padrão usado em `prado.js` (o primeiro campo,
já aprovado) para que os próximos — vulcão, Casa Branca, arena
celestial, ruínas na selva — sigam a mesma linguagem visual e não
destoem dos modelos dos personagens.

## Estrutura do arquivo

Cada campo é um arquivo `js/battlefields/<nome>.js` que registra um
builder em `BATTLEFIELD_BUILDERS`:

```js
BATTLEFIELD_BUILDERS.nome_do_campo = function buildNomeDoCampo(scene, renderer) {
  // ... monta tudo (chão, céu, props, luzes) ...
  return { playerLight, enemyLight };
};
```

- O arquivo precisa ser carregado no `index.html` **antes** de
  `js/scene.js` (que chama `buildBattlefield()`), e depois de
  `js/battlefields/index.js` (que declara `BATTLEFIELD_BUILDERS`).
- `js/battlefields/index.js` sorteia um builder aleatório a cada
  partida — não precisa mexer nele ao adicionar um campo novo, só
  registrar a chave e importar o script no `index.html`.
- O builder **sempre** retorna `{ playerLight, enemyLight }` — outros
  arquivos (efeitos de combate) referenciam essas duas luzes pelo
  nome vindo de `scene.js`.

## Por que a primeira versão do prado destoou (e a lição)

A primeira tentativa usou cores muito saturadas (verde puro,
azul-céu puro) e materiais `MeshStandardMaterial` lisos/brilhantes
nas árvores. Os personagens do jogo são modelados com **toon
shading** (sombreamento em degraus, cores mais dessaturadas/terrosas,
formas arredondadas simples). O contraste ficou tipo "cenário de app
mobile genérico" atrás de personagens de "RPG de fantasia pintado à
mão". A correção teve 3 partes, replicáveis em qualquer campo novo:

1. **Dessaturar tudo.** Tons terrosos, nunca cores "de tela cheia"
   (ex: em vez de `#5f9a3e` verde-limão, usar `#4a6b3a`).
2. **Toon shading nos props do cenário**, não só nos personagens —
   ver seção abaixo.
3. **Formas orgânicas/arredondadas**, evitar cones/formas geométricas
   "de asset store". Esferas achatadas (`leaf.scale.set(1.15, 0.85, 1.15)`)
   em vez de esferas perfeitas ou cones pontudos.

## Toon shading local (obrigatório para qualquer prop novo)

`js/animation-engine.js` define um `TOON_GRADIENT` global usado pelos
personagens, mas esse arquivo carrega **depois** de `scene.js` (ver
ordem de scripts no `index.html`). Como os battlefields rodam antes,
**não dá pra depender do `TOON_GRADIENT` global** — cada arquivo de
campo precisa da sua própria função local, copiada de `prado.js`:

```js
function makeLocalToonGradient(baseRgb) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  const steps = [0.35, 0.6, 0.85, 1.0];
  steps.forEach((f, i) => {
    ctx.fillStyle = `rgb(${Math.floor(baseRgb[0] * f)},${Math.floor(baseRgb[1] * f)},${Math.floor(baseRgb[2] * f)})`;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  return tex;
}
```

Uso: `new THREE.MeshToonMaterial({ color: 0x..., gradientMap: makeLocalToonGradient([r, g, b]) })`.
Use isso em qualquer prop 3D "sólido" da cena (árvores, rochas,
estruturas, etc). Chão, céu e washes de time podem continuar em
`MeshStandardMaterial`/`MeshBasicMaterial` normalmente — o choque
visual vem principalmente de objetos verticais/volumosos perto da
câmera.

## Checklist de peças que todo campo precisa ter

Copiando a estrutura do `prado.js`:

1. **`scene.fog`** — `THREE.FogExp2` com cor combinando o tema.
2. **Chão** — `CircleGeometry(16, 48)` com textura procedural via
   `<canvas>` (nunca cor sólida lisa — sempre um ruído/textura sutil
   pra não parecer plástico). Mais o `rim` (anel de borda,
   `RingGeometry(15.5, 16, 64)`) pra marcar o limite da arena.
3. **Céu** — esfera grande (`SphereGeometry(60, 24, 16)`,
   `side: THREE.BackSide`) com gradiente vertical via canvas 2×256.
4. **Props temáticos** nas bordas/cantos (árvores, rochas, etc) —
   sempre com toon shading local (ver acima), sempre dessaturados.
5. **Silhuetas de horizonte** (colinas/montanhas distantes) pra não
   deixar o chão "flutuando" no vazio do fog.
6. **Elementos compartilhados de jogo** (não muda por campo):
   - `centerRing` — anel dourado no meio marcando a divisa dos times.
   - `playerWash` / `enemyWash` — washes de cor semitransparente
     (`0x2dd4bf` ciano / `0xf87171` vermelho) nas metades do chão.
7. **Luzes**:
   - `ambient` — `AmbientLight`, tom levemente colorido pelo tema.
   - `keyLight` — `DirectionalLight`, com `castShadow` condicional a
     `renderer.shadowMap.enabled` (mobile não tem sombra).
   - `playerLight` / `enemyLight` — `PointLight` ciano/vermelho fixos
     (`0x4fd1c5` / `0xff6b6b`), sempre retornados no final.

## Não esquecer ao adicionar um campo novo

1. Registrar `BATTLEFIELD_BUILDERS.<chave> = function build...`.
2. Importar o `<script>` no `index.html`, entre `battlefields/index.js`
   e `scene.js`.
3. Adicionar a entrada em `BATTLEFIELD_LABELS` dentro de
   `js/main-menu.js` (ícone/nome/descrição) — é o que alimenta o
   pop-up "Choose Battlefield" usado para testar cada campo
   isoladamente no modo Vs. AI, sem depender do sorteio aleatório.

## APIs do THREE.js indisponíveis nesta versão (r128)

Este projeto está fixado no three.js **r128**. Algumas geometrias
"óbvias" só existem em versões bem mais novas e vão quebrar o script
inteiro silenciosamente (a exceção interrompe o resto de `initGame`,
o que trava a tela em preto/sem unidades — foi exatamente o bug que
aconteceu na primeira versão do Salão Presidencial):

- **`THREE.CapsuleGeometry`** — só existe a partir do r142. Para
  formas de cápsula/pílula, monte com `CylinderGeometry` + 1-2
  `SphereGeometry` nas pontas (ver `makeCapsule` em
  `js/models/core.js`, ou o padrão inline usado em
  `salao_presidencial.js` para as janelas em arco).
- Ao usar qualquer geometria que não seja `Box`, `Sphere`,
  `Cylinder`, `Cone`, `Torus`, `Ring`, `Circle`, ou `Plane` —
  verificar antes se ela existe no r128, não assumir pela API mais
  recente do three.js.


## Distâncias/escala de referência (do prado)

- Chão jogável: raio 16.
- Pilar/prop de fundo: distância ~12–16 do centro.
- Colinas/horizonte: distância ~24–34 do centro.
- Céu: raio 60.
- Altura de árvore de referência: tronco ~1.7, copa culminando ~3.5
  de altura total (escala 0.7–1.15).

Manter esses números como ponto de partida evita que um campo novo
fique proporcionalmente esquisito perto dos personagens (que têm
escala fixa, independente do campo).
