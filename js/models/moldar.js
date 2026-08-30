function buildMoldarModel(bodyGroup, mainMat, accentMat, def) {
  // Aplicando escala diretamente no bodyGroup para aumentar o tamanho dele na arena
  bodyGroup.scale.setScalar(1.28);

  // Moldar, Paciência Solar
  const armorMat = mainMat.clone();
  armorMat.color.set(0x9ca5b8); 
  const armorShadowMat = mainMat.clone();
  armorShadowMat.color.set(0x6b7485); 
  const clothMat = accentMat.clone();
  clothMat.color.set(0x52445e); 
  const goldMat = accentMat.clone();
  goldMat.color.set(0xd4af37);
  goldMat.emissiveIntensity = 0.25;
  const skinMat = new THREE.MeshToonMaterial({ color: 0x0a0a0c, gradientMap: TOON_GRADIENT }); 
  const glowMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: TOON_GRADIENT, emissive: 0xffa43a, emissiveIntensity: 1.2 }); 

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ---- Pernas e Base ----
  [-1, 1].forEach(side => {
    const thigh = makeCapsule(0.09, 0.2, armorShadowMat);
    thigh.position.set(side * 0.18, 0.35, 0);
    thigh.rotation.z = side * 0.15;
    add(thigh, "thigh_" + (side < 0 ? "L" : "R"));

    const calf = makeCapsule(0.1, 0.25, armorMat);
    calf.position.set(side * 0.22, 0.15, 0.05);
    add(calf, "calf_" + (side < 0 ? "L" : "R"));

    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), armorShadowMat);
    boot.scale.set(1, 0.6, 1.4);
    boot.position.set(side * 0.22, 0.02, 0.12);
    add(boot, "boot_" + (side < 0 ? "L" : "R"));
  });

  // ---- Cintura, Capa em Camadas e Escarcelas ----
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), armorShadowMat);
  pelvis.position.set(0, 0.52, 0);
  pelvis.scale.set(1.1, 0.9, 0.95);
  add(pelvis, "pelvis");

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 10, 20), goldMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.65;
  add(belt, "belt");

  const capeBack = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 12, 0, Math.PI * 1.3, 0, Math.PI * 0.6), clothMat);
  capeBack.position.set(0, 0.55, -0.02);
  capeBack.scale.set(1.1, 1.45, 1.15);
  capeBack.rotation.y = Math.PI * 0.85; 
  add(capeBack, "capeBack");

  const capeBackTrim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 20, Math.PI * 1.3), goldMat);
  capeBackTrim.rotation.x = Math.PI / 2;
  capeBackTrim.rotation.z = Math.PI * 0.85;
  capeBackTrim.position.set(0, 0.12, -0.02);
  capeBackTrim.scale.set(1.1, 1.15, 1);
  add(capeBackTrim, "capeBackTrim");

  const tabardFront = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 0.45, 0, Math.PI * 0.55), clothMat);
  tabardFront.position.set(0, 0.55, 0.04);
  tabardFront.scale.set(0.65, 1.4, 1.05);
  tabardFront.rotation.y = Math.PI * 1.775; 
  add(tabardFront, "tabardFront");

  const tabardTrim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 16, Math.PI * 0.45), goldMat);
  tabardTrim.rotation.x = Math.PI / 2;
  tabardTrim.rotation.z = Math.PI * 1.775;
  tabardTrim.position.set(0, 0.17, 0.04);
  tabardTrim.scale.set(0.65, 1.05, 1);
  add(tabardTrim, "tabardTrim");

  [-1, 1].forEach(side => {
    const tasset = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), armorMat);
    tasset.scale.set(0.8, 1.5, 1.1);
    tasset.position.set(side * 0.22, 0.60, 0.02);
    tasset.rotation.z = side * 0.25;
    tasset.rotation.x = -0.1;
    add(tasset, "tasset_" + (side < 0 ? "L" : "R"));

    const tassetTrim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 14), goldMat);
    tassetTrim.rotation.x = Math.PI / 2;
    tassetTrim.position.set(side * 0.27, 0.43, 0.04);
    tassetTrim.rotation.z = side * 0.25;
    tassetTrim.rotation.y = side * 0.1;
    add(tassetTrim, "tassetTrim_" + (side < 0 ? "L" : "R"));
  });

  // ---- Tronco e Armadura ----
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), armorMat);
  chest.position.set(0, 0.9, 0);
  chest.scale.set(1.1, 1.15, 0.9);
  add(chest, "torso");

  const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glowMat);
  chestCore.position.set(0, 0.95, 0.28);
  add(chestCore, "core");

  const chestRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 16), goldMat);
  chestRing.position.set(0, 0.95, 0.27);
  add(chestRing, "chestRing");

  [-1, 1].forEach(side => {
    const pauldronMain = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), armorMat);
    pauldronMain.scale.set(1.1, 0.8, 1.1);
    pauldronMain.position.set(side * 0.38, 1.1, 0);
    pauldronMain.rotation.z = side * 0.2;
    add(pauldronMain, "pauldron_" + (side < 0 ? "L" : "R"));

    const pauldronTrim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 16), goldMat);
    pauldronTrim.rotation.x = Math.PI / 2;
    pauldronTrim.position.set(side * 0.4, 1.05, 0);
    pauldronTrim.rotation.y = side * 0.2;
    add(pauldronTrim, "pauldronTrim_" + (side < 0 ? "L" : "R"));
  });

  // ---- Cabeça e Elmo ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.32, 0.05);
  add(headGroup, "headGroup");

  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 16), armorMat);
  helm.scale.set(0.85, 1.1, 0.95);
  headGroup.add(helm);
  helm.name = "head"; 

  const centerCrest = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), goldMat);
  centerCrest.scale.set(0.5, 3.5, 1.2);
  centerCrest.position.set(0, 0.25, -0.05);
  centerCrest.rotation.x = -0.3;
  headGroup.add(centerCrest);

  [-1, 1].forEach(side => {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), armorMat);
    fin.scale.set(0.4, 2.0, 1.2);
    fin.position.set(side * 0.13, 0.12, -0.08);
    fin.rotation.x = -0.4; 
    fin.rotation.z = side * 0.4;
    headGroup.add(fin);
  });

  const visorRecess = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 6), skinMat);
  visorRecess.scale.set(0.9, 0.2, 0.4);
  visorRecess.position.set(0, 0, 0.16);
  headGroup.add(visorRecess);

  const visorGlow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 6), glowMat);
  visorGlow.scale.set(0.9, 0.08, 0.2);
  visorGlow.position.set(0, 0, 0.18);
  headGroup.add(visorGlow);

  // ---- Braços e Armas ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.36, 1.05, 0);
    add(shoulderPivot, "shoulderPivot_" + (side < 0 ? "L" : "R"));

    const upperArm = makeCapsule(0.08, 0.25, armorShadowMat);
    upperArm.position.set(0, -0.15, 0);
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.3, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.085, 0.28, armorMat);
    forearm.position.set(0, -0.12, 0);
    forearm.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), armorShadowMat);
    hand.position.set(0, -0.28, 0);
    elbowPivot.add(hand);

    return { shoulderPivot, elbowPivot };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  // Braço Esquerdo (Escudo)
  rigL.shoulderPivot.rotation.set(-0.1, 0.1, -0.5); 
  rigL.elbowPivot.rotation.set(-0.4, 0, 0);

  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.18, -0.22, 0.20);
  shieldGroup.rotation.set(-0.2, 0.2, 0);
  rigL.elbowPivot.add(shieldGroup);

  const shieldBase = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 12), armorMat);
  shieldBase.scale.set(1, 1.15, 0.15);
  shieldBase.castShadow = true;
  shieldBase.name = "shield";
  shieldGroup.add(shieldBase);

  const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 12, 24), goldMat);
  shieldRim.scale.set(1, 1.15, 1);
  shieldGroup.add(shieldRim);

  const shieldCore = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glowMat);
  shieldCore.position.z = 0.05;
  shieldGroup.add(shieldCore);

  [-1, 1].forEach(dir => {
    const starBar = makeCapsule(0.015, 0.4, glowMat);
    starBar.position.z = 0.04;
    starBar.rotation.z = dir * (Math.PI / 4);
    shieldGroup.add(starBar);
  });

  // Braço Direito (Lança)
  rigR.shoulderPivot.rotation.set(-0.1, -0.1, 0.35);
  rigR.elbowPivot.rotation.set(-0.4, 0.1, 0);

  const spearGroup = new THREE.Group();
  spearGroup.position.set(0, -0.28, 0.08);
  spearGroup.rotation.set(2.8, 0, 0); 
  rigR.elbowPivot.add(spearGroup);

  const spearShaft = makeCapsule(0.025, 1.6, armorShadowMat);
  spearShaft.position.y = 0.2;
  spearGroup.add(spearShaft);

  const spearGuard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 12), goldMat);
  spearGuard.rotation.x = Math.PI / 2;
  spearGuard.position.y = 0.75;
  spearGroup.add(spearGuard);

  const spearBlade = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glowMat);
  spearBlade.scale.set(0.6, 5.0, 0.2);
  spearBlade.position.y = 1.0;
  spearBlade.name = "weapon";
  spearGroup.add(spearBlade);

  const head_ = headGroup.getObjectByName("head");
  return [chest, head_, shieldBase, capeBack];
}

BESPOKE_BUILDERS.moldar = buildMoldarModel;
