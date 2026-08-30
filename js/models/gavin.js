function buildGavinModel(bodyGroup, mainMat, accentMat, def) {
  // ============================================================
  // GAVIN, MESTRE INSUPERÁVEL - Samurai das montanhas.
  // Totalmente refeito para alinhar com a arte conceitual.
  // Silhueta distinta: capacete kabuto completo, ombreiras em
  // camadas (sode), máscara facial (mempo) e uma capa esvoaçante.
  // Família de brilho: azul gelo (Golpe Gelado), contrastando
  // com as outras cores do elenco.
  // ============================================================

  const steel = mainMat.clone();
  steel.color.set(0x2a2f3a); // Aço escuro e frio

  const steelDark = mainMat.clone();
  steelDark.color.set(0x15181e); // Quase preto para profundidade

  const silverTrim = accentMat.clone();
  silverTrim.color.set(0x8b94a3); // Prata fosco para os detalhes

  const cloth = mainMat.clone();
  cloth.color.set(0x1a1c23); // Tecido escuro da calça e capa

  const skin = mainMat.clone();
  skin.color.set(0x8a7460); // Pele, visível apenas no pescoço/olhos

  const iceGlow = new THREE.MeshToonMaterial({
    color: 0xaad4ff,
    gradientMap: TOON_GRADIENT,
    emissive: 0x3399ff,
    emissiveIntensity: 2.2
  });

  const iceGlowSoft = new THREE.MeshToonMaterial({
    color: 0xcce6ff,
    gradientMap: TOON_GRADIENT,
    emissive: 0x5ab8ff,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.85
  });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function capsule(radius, length, material) {
    return makeCapsule(radius, length, material);
  }

  // ------------------------------------------------------------
  // LOWER BODY (HAKAMA, KUSAZURI & LEGS)
  // ------------------------------------------------------------

  // Base da calça larga (Hakama)
  const hakama = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), cloth);
  hakama.position.set(0, 0.42, 0);
  hakama.scale.set(1.1, 1.3, 0.9);
  hakama.name = "skirt";
  add(hakama);

  // Cinto e corda (Obi)
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 18), silverTrim);
  sash.position.set(0, 0.65, 0);
  sash.rotation.x = Math.PI / 2;
  sash.scale.set(1.05, 0.95, 1);
  add(sash, "sash");

  // Placas de armadura da saia (Kusazuri)
  [-1, 0, 1].forEach(side => {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), steel);
    plate.scale.set(0.9, 1.4, 0.2);
    plate.position.set(side * 0.18, 0.5, 0.25 - Math.abs(side) * 0.05);
    plate.rotation.z = side * -0.15;
    plate.rotation.x = 0.15;
    add(plate, "kusazuri_front_" + side);
  });
  
  // Pernas e Pés (Suneate e Tabi)
  [-1, 1].forEach(side => {
    const leg = capsule(0.08, 0.26, steelDark);
    leg.position.set(side * 0.18, 0.15, 0);
    leg.rotation.z = side * 0.12;
    leg.name = "leg_" + (side < 0 ? "L" : "R");
    add(leg);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), cloth);
    foot.position.set(side * 0.19, -0.05, 0.08);
    foot.scale.set(0.9, 0.6, 1.4);
    foot.rotation.z = side * 0.12;
    foot.name = "foot_" + (side < 0 ? "L" : "R");
    add(foot);
  });

  // Capa/cachecol esvoaçante dramático
  const scarfCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.85, -0.2),
    new THREE.Vector3(0.2, 0.7, -0.4),
    new THREE.Vector3(0.4, 0.4, -0.5),
    new THREE.Vector3(0.5, 0.1, -0.45),
    new THREE.Vector3(0.35, -0.2, -0.3)
  ]);
  const scarf = new THREE.Mesh(new THREE.TubeGeometry(scarfCurve, 16, 0.06, 6, false), cloth);
  add(scarf, "scarf");

  // ------------------------------------------------------------
  // TORSO & ARMOR
  // ------------------------------------------------------------

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), steelDark);
  torso.position.set(0, 0.82, 0);
  torso.scale.set(1.05, 0.9, 0.85);
  torso.name = "torso";
  add(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), steel);
  chest.position.set(0, 1.05, 0.05);
  chest.scale.set(1.2, 1.05, 0.9);
  chest.rotation.x = -0.1;
  add(chest, "chest");

  // Placa peitoral reforçada
  const breastplate = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), steelDark);
  breastplate.scale.set(1.1, 0.95, 0.4);
  breastplate.position.set(0, 1.02, 0.28);
  add(breastplate, "breastplate");

  // Núcleo de poder (Core)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), iceGlow);
  core.position.set(0, 0.98, 0.38);
  core.name = "core";
  add(core);

  // Ombreiras em camadas (Sode) - simétricas para postura robusta
  [-1, 1].forEach(side => {
    const sodeGroup = new THREE.Group();
    sodeGroup.position.set(side * 0.38, 1.1, 0);
    sodeGroup.rotation.z = side * 0.15;
    bodyGroup.add(sodeGroup);

    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), steel);
      plate.scale.set(1.2, 0.6, 1.1);
      plate.position.set(0, -i * 0.1, i * 0.02);
      plate.rotation.x = i * 0.05;
      sodeGroup.add(plate);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 12), silverTrim);
      trim.scale.set(1.2, 1.1, 0.6);
      trim.position.set(0, -i * 0.1, i * 0.02);
      trim.rotation.x = Math.PI / 2 + (i * 0.05);
      sodeGroup.add(trim);
    }
  });

  // ------------------------------------------------------------
  // HEAD, MASK & KABUTO
  // ------------------------------------------------------------

  const neck = capsule(0.08, 0.16, skin);
  neck.position.set(0, 1.25, 0);
  add(neck, "neck");

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.38, 0.04);
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  // Cabeça base invisível sob o capacete
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), skin);
  head.scale.set(0.9, 1.0, 0.9);
  head.name = "head";
  head.castShadow = true;
  headGroup.add(head);

  // Máscara blindada (Mempo)
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), steelDark);
  mask.position.set(0, -0.06, 0.08);
  mask.scale.set(0.95, 0.65, 0.85);
  mask.rotation.x = 0.1;
  add(mask, "mask", headGroup);

  // Olhos brilhantes e estreitos
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), iceGlow);
    eye.position.set(side * 0.07, 0.04, 0.17);
    eye.scale.set(1.4, 0.4, 0.5);
    eye.rotation.z = side * 0.1;
    add(eye, "eye_" + (side < 0 ? "L" : "R"), headGroup);
  });

  // Capacete (Kabuto)
  const kabuto = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
    steel
  );
  kabuto.position.set(0, 0.08, -0.02);
  kabuto.scale.set(1.05, 1.0, 1.1);
  add(kabuto, "kabuto", headGroup);

  // Aba do capacete
  const kabutoBrim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), silverTrim);
  kabutoBrim.position.set(0, 0.02, 0.05);
  kabutoBrim.rotation.x = Math.PI / 2 - 0.15;
  add(kabutoBrim, "kabutoBrim", headGroup);

  // Chifres clássicos de Samurai (Kuwagata)
  [-1, 1].forEach(side => {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.06, 0.22, 0.18),
      new THREE.Vector3(side * 0.15, 0.35, 0.15),
      new THREE.Vector3(side * 0.22, 0.45, 0.1),
      new THREE.Vector3(side * 0.25, 0.55, 0.05)
    ]);
    const hornGeo = new THREE.TubeGeometry(hornCurve, 12, 0.025, 6, false);
    const horn = new THREE.Mesh(hornGeo, silverTrim);
    add(horn, "crestHorn_" + (side < 0 ? "L" : "R"), headGroup);
  });

  // Ornamento central do capacete
  const crestCenter = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), iceGlow);
  crestCenter.scale.set(1, 1.5, 0.5);
  crestCenter.position.set(0, 0.2, 0.21);
  add(crestCenter, "crestCenter", headGroup);

  // ------------------------------------------------------------
  // ARMS & DYNAMIC POSE
  // ------------------------------------------------------------

  function buildArm(side, isRight) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.4, 1.05, 0);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArmor = capsule(0.07, 0.3, steelDark);
    upperArmor.position.set(0, -0.15, 0);
    upperArmor.name = "upperArm_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(upperArmor);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.3, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = capsule(0.06, 0.32, steel);
    forearm.position.set(0, -0.16, 0);
    forearm.name = side < 0 ? "armL" : "armR";
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), cloth);
    hand.position.set(0, -0.36, 0.02);
    hand.scale.set(0.9, 1.1, 0.8);
    hand.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(hand);

    if (isRight) {
      // Braço direito segurando a espada à frente (pronto para o golpe)
      shoulderPivot.rotation.set(0.4, 0.2, 0.3);
      elbowPivot.rotation.set(-0.8, -0.2, 0);
    } else {
      // Braço esquerdo flexionado apoiando a postura
      shoulderPivot.rotation.set(0.2, 0, -0.4);
      elbowPivot.rotation.set(-0.6, 0.3, 0);
    }

    return { shoulderPivot, elbowPivot, hand };
  }

  const leftRig = buildArm(-1, false);
  const rightRig = buildArm(1, true);

  // ------------------------------------------------------------
  // WEAPON (KATANA)
  // ------------------------------------------------------------

  const weaponGroup = new THREE.Group();
  weaponGroup.name = "weapon";
  // Anexado à mão direita para seguir a animação
  weaponGroup.position.set(0, -0.42, 0.08);
  weaponGroup.rotation.set(1.2, 0, 0);
  rightRig.elbowPivot.add(weaponGroup);

  // Cabo (Tsuka)
  const hilt = capsule(0.025, 0.22, steelDark);
  hilt.position.set(0, -0.1, 0);
  add(hilt, "hilt", weaponGroup);

  // Guarda (Tsuba)
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), silverTrim);
  guard.rotation.x = Math.PI / 2;
  guard.position.set(0, 0.02, 0);
  add(guard, "guard", weaponGroup);

  // Lâmina curva (Katana)
  const bladeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(0, 0.3, -0.02),
    new THREE.Vector3(0, 0.6, -0.06),
    new THREE.Vector3(0, 0.9, -0.12)
  ]);
  const bladeGeo = new THREE.TubeGeometry(bladeCurve, 12, 0.02, 5, false);
  const blade = new THREE.Mesh(bladeGeo, iceGlowSoft);
  add(blade, "blade", weaponGroup);

  // Fio da lâmina (Corte brilhante)
  const edgeGeo = new THREE.TubeGeometry(bladeCurve, 12, 0.01, 4, false);
  const edge = new THREE.Mesh(edgeGeo, iceGlow);
  edge.position.set(0, 0, 0.015);
  add(edge, "bladeEdge", weaponGroup);

  return [chest, head, hakama];
}

BESPOKE_BUILDERS.gavin = buildGavinModel;