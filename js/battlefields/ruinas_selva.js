// =============================================================
// BATTLEFIELD: RUÍNAS NA SELVA (overgrown jungle temple ruins, mossy
// stone platform, broken pillars, dense canopy at the edges)
// =============================================================
// See js/battlefields/BATTLEFIELD_GUIDE.md for the shared patterns
// this file follows (toon-shaded props, dessaturated palette, etc).
BATTLEFIELD_BUILDERS.ruinas_selva = function buildRuinasSelva(scene, renderer) {
  scene.fog = new THREE.FogExp2(0x5c6b4a, 0.02);

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

  // ---- Ground: cracked temple flagstones with moss creeping through
  // the seams — not a clean plaza, a ruin reclaimed by the jungle ----
  function makeFlagstoneTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6b6350';
    ctx.fillRect(0, 0, size, size);
    // stone speckle
    for (let i = 0; i < 4500; i++) {
      const shade = 70 + Math.floor(Math.random() * 35);
      ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.94)},${Math.floor(shade * 0.78)})`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 2, 2);
    }
    // flagstone grid seams
    ctx.strokeStyle = 'rgba(40,36,26,0.4)';
    ctx.lineWidth = 2;
    const cell = 56;
    for (let x = 0; x <= size; x += cell) { ctx.beginPath(); ctx.moveTo(x + (Math.random() - 0.5) * 6, 0); ctx.lineTo(x + (Math.random() - 0.5) * 6, size); ctx.stroke(); }
    for (let y = 0; y <= size; y += cell) { ctx.beginPath(); ctx.moveTo(0, y + (Math.random() - 0.5) * 6); ctx.lineTo(size, y + (Math.random() - 0.5) * 6); ctx.stroke(); }
    // moss patches creeping across seams and stone faces
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const r = 8 + Math.random() * 22;
      ctx.fillStyle = `rgba(${70 + Math.random() * 20},${100 + Math.random() * 25},${50 + Math.random() * 15},${0.25 + Math.random() * 0.25})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // scattered cracks
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = 'rgba(30,26,18,0.5)';
      ctx.lineWidth = 1;
      let x = Math.random() * size, y = Math.random() * size;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ map: makeFlagstoneTexture(), color: 0xffffff, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(15.5, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a4432, roughness: 0.9 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  scene.add(rim);

  // ---- Sky: dense humid jungle-canopy gradient, dim and green-tinged
  // rather than open blue, since a ruin deep in the jungle would be
  // lit mostly by diffused light filtering through leaves above ----
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3c4a34');
    grad.addColorStop(0.5, '#5c6a48');
    grad.addColorStop(0.8, '#7c8258');
    grad.addColorStop(1, '#948a5e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    return new THREE.CanvasTexture(c);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Shafts of light filtering down through the canopy, faint and hazy
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xd8dca0, transparent: true, opacity: 0.1, fog: false, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 9;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.6, 16, 8, 1, true), shaftMat);
    shaft.position.set(Math.cos(ang) * dist, 8, Math.sin(ang) * dist);
    shaft.rotation.x = (Math.random() - 0.5) * 0.15;
    shaft.rotation.z = (Math.random() - 0.5) * 0.15;
    scene.add(shaft);
  }

  // ---- Toon-shaded jungle props ----
  const trunkGradient = makeLocalToonGradient([90, 72, 48]);
  const trunkMat = new THREE.MeshToonMaterial({ color: 0x5a4830, gradientMap: trunkGradient });
  const leafGradient = makeLocalToonGradient([70, 96, 52]);
  const leafMats = [0x5c7c40, 0x516e3a, 0x466032].map(c => new THREE.MeshToonMaterial({ color: c, gradientMap: leafGradient }));
  const stoneGradient = makeLocalToonGradient([120, 112, 92]);
  const stoneMat = new THREE.MeshToonMaterial({ color: 0x78705c, gradientMap: stoneGradient });
  const mossGradient = makeLocalToonGradient([88, 108, 62]);
  const mossMat = new THREE.MeshToonMaterial({ color: 0x5c7440, gradientMap: mossGradient });
  const vineGradient = makeLocalToonGradient([80, 100, 54]);
  const vineMat = new THREE.MeshToonMaterial({ color: 0x546e38, gradientMap: vineGradient });

  // Broad jungle canopy trees (wider, lower, denser foliage than the
  // prado's slim meadow trees — a jungle silhouette, not a park tree)
  function makeJungleTree(scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.32 * scale, 2.0 * scale, 7), trunkMat);
    trunk.position.y = 1.0 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    // buttress roots flaring at the base, common on jungle trees
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.16 * scale, 0.7 * scale, 5), trunkMat);
      root.position.set(Math.cos(ang) * 0.22 * scale, 0.3 * scale, Math.sin(ang) * 0.22 * scale);
      root.rotation.z = Math.cos(ang) * 0.3;
      root.rotation.x = Math.sin(ang) * -0.3;
      tree.add(root);
    }
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry((0.95 - i * 0.1) * scale, 8, 6),
        leafMats[i % leafMats.length]
      );
      leaf.scale.set(1.3, 0.7, 1.3);
      leaf.position.set((Math.random() - 0.5) * 0.5 * scale, (2.0 + i * 0.4) * scale, (Math.random() - 0.5) * 0.5 * scale);
      leaf.castShadow = true;
      tree.add(leaf);
    }
    // hanging vine dangling from the canopy
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 1.4 * scale, 4), vineMat);
    vine.position.set(0.5 * scale, 2.1 * scale, 0.2 * scale);
    tree.add(vine);
    return tree;
  }

  const clusterAngles = [Math.PI * 0.2, Math.PI * 0.8, -Math.PI * 0.2, -Math.PI * 0.8, Math.PI];
  clusterAngles.forEach((baseAng, ci) => {
    const clusterSize = ci < 3 ? 4 : 3;
    for (let i = 0; i < clusterSize; i++) {
      const ang = baseAng + (Math.random() - 0.5) * 0.55;
      const dist = 13.5 + Math.random() * 5.5;
      const tree = makeJungleTree(0.75 + Math.random() * 0.5);
      tree.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      tree.rotation.y = Math.random() * Math.PI * 2;
      scene.add(tree);
    }
  });

  // Broken/toppled stone pillars ringing the platform — some standing,
  // some snapped and lying at an angle, all draped with moss/vines
  function makeRuinPillar(scale, broken) {
    const pillar = new THREE.Group();
    const h = broken ? 1.4 * scale : 4.6 * scale;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.5 * scale, h, 10), stoneMat);
    shaft.position.y = h / 2;
    shaft.castShadow = true;
    pillar.add(shaft);
    // jagged broken top cap, only on toppled/snapped pillars
    if (broken) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46 * scale, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.35), stoneMat);
      cap.position.y = h;
      cap.scale.set(1, 0.6, 1);
      pillar.add(cap);
    } else {
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.58 * scale, 0.42 * scale, 0.32 * scale, 10), stoneMat);
      capital.position.y = h + 0.16 * scale;
      pillar.add(capital);
    }
    // moss patches clinging to the shaft
    for (let i = 0; i < 3; i++) {
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 6, 5), mossMat);
      moss.scale.set(1, 0.5, 0.8);
      moss.position.set((Math.random() - 0.5) * 0.5 * scale, Math.random() * h, 0.4 * scale);
      pillar.add(moss);
    }
    // trailing vine down the side
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, h * 0.7, 4), vineMat);
    vine.position.set(0.4 * scale, h * 0.5, 0.25 * scale);
    pillar.add(vine);
    return pillar;
  }

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const dist = 12.5 + Math.random() * 1.5;
    const broken = Math.random() < 0.35;
    const pillar = makeRuinPillar(0.85 + Math.random() * 0.25, broken);
    pillar.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    if (broken) {
      pillar.rotation.z = (Math.random() - 0.5) * 1.1;
      pillar.rotation.x = (Math.random() - 0.5) * 1.1;
    }
    scene.add(pillar);
  }

  // A crumbled stone archway/lintel fragment resting near the edge as
  // a focal ruin piece — two short stumps with a fallen crossbeam
  const archStump1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8), stoneMat);
  archStump1.position.set(-13.5, 0.65, 9.5);
  scene.add(archStump1);
  const archStump2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8), stoneMat);
  archStump2.position.set(-11.7, 0.65, 8.6);
  scene.add(archStump2);
  const fallenBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.6, 8), stoneMat);
  fallenBeam.position.set(-12.6, 0.35, 6.3);
  fallenBeam.rotation.z = Math.PI / 2;
  fallenBeam.rotation.y = 0.4;
  scene.add(fallenBeam);

  // Distant jungle-canopy horizon silhouette (rounded treetop bumps)
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 25 + Math.random() * 9;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), canopyMat);
    bump.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    scene.add(bump);
  }

  // Center divide + team washes (shared visual language across battlefields)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0xc9b06a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.02;
  scene.add(centerRing);

  const playerWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 0.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.06 }));
  playerWash.rotation.x = -Math.PI / 2;
  playerWash.position.y = 0.015;
  scene.add(playerWash);
  const enemyWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 1.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.06 }));
  enemyWash.rotation.x = -Math.PI / 2;
  enemyWash.position.y = 0.015;
  scene.add(enemyWash);

  // ---- Lighting: dim, humid, green-filtered jungle light ----
  const ambient = new THREE.AmbientLight(0x8a9868, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xd8dc9c, 0.85);
  keyLight.position.set(5, 13, 4);
  keyLight.castShadow = renderer.shadowMap.enabled;
  if (keyLight.castShadow) {
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
  }
  scene.add(keyLight);

  const playerLight = new THREE.PointLight(0x4fd1c5, 1.1, 14);
  playerLight.position.set(0, 3, 6);
  scene.add(playerLight);

  const enemyLight = new THREE.PointLight(0xff6b6b, 1.1, 14);
  enemyLight.position.set(0, 3, -6);
  scene.add(enemyLight);

  return { playerLight, enemyLight };
};
