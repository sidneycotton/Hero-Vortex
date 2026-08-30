// Metade Senador: o diplomata humano da arte
function buildDarioSenadorBody(parentGroup, def) {
  const group = new THREE.Group();
  group.name = "dario_senador_body";
  parentGroup.add(group);

  const suitMat = new THREE.MeshToonMaterial({ color: 0x2c2c30, gradientMap: TOON_GRADIENT });
  const shirtMat = new THREE.MeshToonMaterial({ color: 0xe4e4e8, gradientMap: TOON_GRADIENT });
  const skinMat = new THREE.MeshToonMaterial({ color: 0xd9b894, gradientMap: TOON_GRADIENT });
  const hairMat = new THREE.MeshToonMaterial({ color: 0x3a3a3c, gradientMap: TOON_GRADIENT }); 
  const shoeMat = new THREE.MeshToonMaterial({ color: 0x111111, gradientMap: TOON_GRADIENT });
  const glowMat = new THREE.MeshToonMaterial({ color: 0xdff5ef, gradientMap: TOON_GRADIENT, emissive: 0x8fd9c9, emissiveIntensity: 0.7 });

  function add(mesh, name, parent = group) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Parte Inferior: Calças e Sapatos
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), suitMat);
  pelvis.position.set(0, 0.45, 0);
  // Escala X reduzida para emagrecer os quadris
  pelvis.scale.set(0.85, 1.1, 0.65);
  add(pelvis, "pelvis_senador");

  [-1, 1].forEach(side => {
    const leg = makeCapsule(0.075, 0.3, suitMat);
    leg.position.set(side * 0.12, 0.2, 0);
    leg.rotation.z = side * 0.03;
    add(leg, "leg_senador_" + (side < 0 ? "L" : "R"));

    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), shoeMat);
    shoe.position.set(side * 0.12, -0.05, 0.08);
    shoe.scale.set(0.9, 0.65, 1.5);
    add(shoe, "shoe_senador_" + (side < 0 ? "L" : "R"));
  });

  // Torso: Paletó Formal Ajustado
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), suitMat);
  torso.position.set(0, 0.85, 0.02);
  // Escala X severamente reduzida para afinar o peito
  torso.scale.set(0.85, 1.2, 0.65); 
  torso.rotation.x = 0.05; 
  add(torso, "torso_senador");

  const shirtSliver = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 3), shirtMat);
  shirtSliver.position.set(0, 0.98, 0.17);
  shirtSliver.rotation.x = Math.PI - 0.15;
  shirtSliver.scale.set(1, 1, 0.3);
  add(shirtSliver, "shirtSliver");

  const tie = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 3), shoeMat);
  tie.position.set(0, 0.95, 0.18);
  tie.rotation.x = Math.PI - 0.18;
  tie.scale.set(1, 1, 0.4);
  add(tie, "tie");

  const collarL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.16, 6), suitMat);
  collarL.position.set(-0.07, 1.04, 0.14);
  collarL.rotation.z = 0.5;
  add(collarL, "collarL");
  
  const collarR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.16, 6), suitMat);
  collarR.position.set(0.07, 1.04, 0.14);
  collarR.rotation.z = -0.5;
  add(collarR, "collarR");

  // Cabeça e Cabelo
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.22, 0.05);
  headGroup.name = "headGroup_senador";
  group.add(headGroup);

  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
  neck.scale.set(1, 0.5, 1);
  add(neck, "neck", headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skinMat);
  head.position.y = 0.18;
  head.scale.set(0.8, 1.1, 0.85);
  add(head, "head_senador", headGroup);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
  hairCap.position.set(0, 0.21, -0.02);
  hairCap.scale.set(0.85, 1.05, 0.9);
  hairCap.rotation.x = -0.15;
  add(hairCap, "hairCap", headGroup);

  [-1, 1].forEach(side => {
    const eyebrow = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hairMat);
    eyebrow.scale.set(2.2, 0.8, 0.5);
    eyebrow.position.set(side * 0.06, 0.24, 0.17);
    eyebrow.rotation.z = side * 0.15;
    add(eyebrow, "eyebrow_" + (side < 0 ? "L" : "R"), headGroup);
  });

  // Braços e Postura
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    // Trazido de 0.31 para 0.24 para conectar diretamente ao torso esguio
    shoulderPivot.position.set(side * 0.24, 1.02, 0.02);
    shoulderPivot.name = "shoulderPivot_senador_" + (side < 0 ? "L" : "R");
    group.add(shoulderPivot);

    const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), suitMat);
    shoulderPad.scale.set(0.85, 1.0, 0.85);
    add(shoulderPad, "shoulderPad_" + (side < 0 ? "L" : "R"), shoulderPivot);

    const upperArm = makeCapsule(0.055, 0.28, suitMat);
    upperArm.position.set(0, -0.14, 0);
    add(upperArm, "upperArm_senador_" + (side < 0 ? "L" : "R"), shoulderPivot);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.28, 0);
    elbowPivot.name = "elbowPivot_senador_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.05, 0.24, suitMat);
    forearm.position.set(0, -0.12, 0);
    add(forearm, "forearm_senador_" + (side < 0 ? "L" : "R"), elbowPivot);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMat);
    hand.position.set(0, -0.26, 0.02);
    hand.name = "hand_senador_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    if (side < 0) {
      // Braço esquerdo ajustado para evitar clipping na pelve
      shoulderPivot.rotation.set(0.15, 0, side * -0.05); 
      elbowPivot.rotation.set(-0.35, 0, 0);
    } else {
      // Braço direito
      shoulderPivot.rotation.set(-0.15, 0, side * -0.05);
      elbowPivot.rotation.set(-0.6, -0.2, 0);
    }

    return { shoulderPivot, elbowPivot, hand };
  }
  buildArm(-1);
  const rigR = buildArm(1);

  const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), glowMat);
  pin.position.set(0.11, 0.95, 0.18);
  pin.name = "weapon_senador";
  group.add(pin);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), glowMat);
  core.position.set(0, 0.88, 0.25);
  core.name = "core_senador";
  group.add(core);

  return { group, torso, head, core, weapon: pin };
}

// Metade Sombra: a entidade pálida da direita da arte
function buildDarioSombraBody(parentGroup, def) {
  const group = new THREE.Group();
  group.name = "dario_sombra_body";
  parentGroup.add(group);

  const suitMat = new THREE.MeshToonMaterial({ color: 0x1f1f24, gradientMap: TOON_GRADIENT }); 
  const shoeMat = new THREE.MeshToonMaterial({ color: 0x0a0a0c, gradientMap: TOON_GRADIENT });
  const veilMat = new THREE.MeshToonMaterial({ color: 0xf2f0ec, gradientMap: TOON_GRADIENT }); 
  const boneMat = new THREE.MeshToonMaterial({ color: 0xd8d2c4, gradientMap: TOON_GRADIENT });
  const glowMat = new THREE.MeshToonMaterial({ color: 0x0a0a0c, gradientMap: TOON_GRADIENT, emissive: 0xff2e3d, emissiveIntensity: 1.6 });

  function add(mesh, name, parent = group) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), suitMat);
  pelvis.position.set(0, 0.42, 0);
  pelvis.scale.set(0.9, 1.1, 0.85); // Estreitado
  add(pelvis, "pelvis_sombra");

  [-1, 1].forEach(side => {
    const leg = makeCapsule(0.075, 0.28, suitMat);
    leg.position.set(side * 0.12, 0.18, 0);
    leg.rotation.z = side * 0.08;
    leg.rotation.x = -0.1; 
    add(leg, "leg_sombra_" + (side < 0 ? "L" : "R"));

    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), shoeMat);
    shoe.position.set(side * 0.12, -0.05, 0.1);
    shoe.scale.set(0.8, 0.6, 1.6);
    add(shoe, "shoe_sombra_" + (side < 0 ? "L" : "R"));
  });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), suitMat);
  torso.position.set(0, 0.82, 0.1);
  torso.scale.set(0.9, 1.1, 0.8); // Estreitado
  torso.rotation.x = 0.2; 
  add(torso, "torso_sombra");

  [-1, 1].forEach(side => {
    const sharpShoulder = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), suitMat);
    sharpShoulder.position.set(side * 0.2, 1.05, 0.05);
    sharpShoulder.rotation.z = side * 0.35;
    sharpShoulder.rotation.x = 0.2;
    add(sharpShoulder, "sharpShoulder_" + (side < 0 ? "L" : "R"));
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.15, 0.2); 
  headGroup.rotation.x = 0.15;
  headGroup.name = "headGroup_sombra";
  group.add(headGroup);

  const veilFace = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), veilMat);
  veilFace.position.set(0, 0.05, 0.06);
  veilFace.scale.set(0.85, 1.25, 0.85); 
  add(veilFace, "head_sombra", headGroup);

  for (let i = -3; i <= 3; i++) {
    const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.25, 6), veilMat);
    wisp.position.set(i * 0.04, -0.15 + Math.abs(i) * 0.02, 0.18);
    wisp.rotation.x = -0.15;
    wisp.rotation.z = i * 0.05;
    add(wisp, "veilWisp_" + i, headGroup);
  }

  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.25, 0.98, 0.1); // Aproximado do torso esguio
    shoulderPivot.name = "shoulderPivot_sombra_" + (side < 0 ? "L" : "R");
    group.add(shoulderPivot);

    const upperArm = makeCapsule(0.05, 0.32, suitMat); 
    upperArm.position.set(0, -0.16, 0);
    add(upperArm, "upperArm_sombra_" + (side < 0 ? "L" : "R"), shoulderPivot);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.32, 0);
    elbowPivot.name = "elbowPivot_sombra_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.04, 0.28, boneMat);
    forearm.position.set(0, -0.14, 0.05);
    forearm.rotation.x = -0.4;
    add(forearm, "forearm_sombra_" + (side < 0 ? "L" : "R"), elbowPivot);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.28, 0.15);
    handGroup.name = "hand_sombra_" + (side < 0 ? "L" : "R");
    elbowPivot.add(handGroup);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), boneMat);
    add(palm, "palm", handGroup);

    for (let f = -1; f <= 1; f++) {
      const finger = makeCapsule(0.012, 0.18, boneMat);
      finger.position.set(f * 0.035, -0.08, 0.04);
      finger.rotation.x = -0.4 - Math.abs(f) * 0.1;
      finger.rotation.z = f * 0.15;
      add(finger, "finger_" + (side < 0 ? "L" : "R") + "_" + f, handGroup);
    }

    shoulderPivot.rotation.set(0.5, side * -0.15, side * 0.2);
    elbowPivot.rotation.set(-0.6, side * 0.1, 0);

    return { shoulderPivot, elbowPivot, hand: handGroup };
  }
  buildArm(-1);
  const rigR = buildArm(1);

  rigR.hand.name = "weapon_sombra";

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), glowMat);
  core.position.set(0, 0.86, 0.28);
  core.name = "core_sombra";
  group.add(core);

  return { group, torso, head: headGroup.getObjectByName("head_sombra"), core, weapon: rigR.hand };
}

function buildDarioModel(bodyGroup, mainMat, accentMat, def, initialForm) {
  const senador = buildDarioSenadorBody(bodyGroup, def);
  const sombra = buildDarioSombraBody(bodyGroup, def);

  bodyGroup.userData.darioForms = { senador, sombra };

  applyDarioFormVisibility(bodyGroup, initialForm || 'senador');

  const outlineParts = [senador.torso, senador.head, sombra.torso, sombra.head];
  return outlineParts;
}

function applyDarioFormVisibility(bodyGroup, form) {
  const forms = bodyGroup.userData.darioForms;
  if (!forms) return;
  const active = form === 'sombra' ? forms.sombra : forms.senador;
  const inactive = form === 'sombra' ? forms.senador : forms.sombra;
  
  active.group.visible = true;
  inactive.group.visible = false;
  
  active.torso.name = "torso";
  active.head.name = "head";
  active.core.name = "core";
  active.weapon.name = "weapon";
  
  inactive.torso.name = inactive.torso.name.startsWith("torso_") ? inactive.torso.name : "torso_" + form;
}

BESPOKE_BUILDERS.dario = buildDarioModel;