// =============================================================
// BATTLEFIELD: PRADO (grassy meadow, trees clustered at the edges)
// =============================================================
BATTLEFIELD_BUILDERS.prado = function buildPrado(scene, renderer) {
  scene.fog = new THREE.FogExp2(0x8fae5e, 0.016);

  // ---- Ground: procedural grass-tuft texture ----
  function makeGrassTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4a6b3a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5000; i++) {
      const shade = 45 + Math.floor(Math.random() * 35);
      ctx.fillStyle = `rgb(${Math.floor(shade * 0.55)},${shade + 30},${Math.floor(shade * 0.4)})`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 2, 6 + Math.random() * 6);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.1})`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.beginPath(); ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), color: 0xffffff, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(15.5, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a3d24, roughness: 0.9 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  scene.add(rim);

  // Scattered wildflowers dotting the field
  const flowerColors = [0xd8c05a, 0xc98a9e, 0xd8d0c0, 0x9e84ae];
  for (let i = 0; i < 25; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * 10.5;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.8 })
    );
    petal.position.set(Math.cos(ang) * dist, 0.06, Math.sin(ang) * dist);
    scene.add(petal);
  }

  // ---- Sky: bright pastoral gradient ----
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#6f88a0');
    grad.addColorStop(0.55, '#b0ab8e');
    grad.addColorStop(1, '#d8c48e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    return new THREE.CanvasTexture(c);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Soft puffy clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 8, 8), cloudMat);
      puff.position.set(p * 1.4 - puffs * 0.7, Math.random() * 0.4, Math.random() * 0.6);
      cloud.add(puff);
    }
    const ang = (i / 8) * Math.PI * 2;
    cloud.position.set(Math.cos(ang) * 35, 14 + Math.random() * 6, Math.sin(ang) * 35);
    scene.add(cloud);
  }

  // ---- Trees clustered at the corners/edges of the field ----
  // Toon-shaded (own local gradient map, since js/animation-engine.js's
  // global TOON_GRADIENT loads after battlefields — see index.html order)
  // so foliage reads with the same flat-shaded, outlined look as the unit
  // models instead of clashing as smooth glossy blobs.
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
  const trunkGradient = makeLocalToonGradient([110, 85, 55]);
  const leafGradient = makeLocalToonGradient([95, 118, 78]);

  const trunkMat = new THREE.MeshToonMaterial({ color: 0x604733, gradientMap: trunkGradient });
  const leafMats = [0x6a8c5e, 0x5f7f54, 0x546e4a].map(c => new THREE.MeshToonMaterial({ color: c, gradientMap: leafGradient }));

  function makeTree(scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, 1.7 * scale, 7), trunkMat);
    trunk.position.y = 0.85 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    // Rounded, slightly lumpy canopy (flattened spheres, not a sharp
    // conifer cone) to read as a stylized fantasy tree matching the
    // softer, rounded prop language of the units instead of a pine.
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry((0.75 - i * 0.1) * scale, 8, 6),
        leafMats[i % leafMats.length]
      );
      leaf.scale.set(1.15, 0.85, 1.15);
      leaf.position.set((Math.random() - 0.5) * 0.3 * scale, (1.7 + i * 0.55) * scale, (Math.random() - 0.5) * 0.3 * scale);
      leaf.castShadow = true;
      tree.add(leaf);
    }
    return tree;
  }

  // Two corner clusters so the silhouette reads as "trees in the corner"
  const clusterAngles = [Math.PI * 0.22, Math.PI * 0.78, -Math.PI * 0.22, -Math.PI * 0.78];
  clusterAngles.forEach((baseAng, ci) => {
    const clusterSize = ci < 2 ? 5 : 3; // two dense corners, two light corners
    for (let i = 0; i < clusterSize; i++) {
      const ang = baseAng + (Math.random() - 0.5) * 0.5;
      const dist = 14 + Math.random() * 5;
      const tree = makeTree(0.7 + Math.random() * 0.45);
      tree.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      tree.rotation.y = Math.random() * Math.PI * 2;
      scene.add(tree);
    }
  });

  // Distant hill silhouettes for horizon continuity
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6e7a58, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 26 + Math.random() * 8;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hillMat);
    hill.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    scene.add(hill);
  }

  // Center divide + team washes (shared visual language across battlefields)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
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

  // ---- Lighting: bright daylight ----
  const ambient = new THREE.AmbientLight(0x9caf88, 0.65);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.0);
  keyLight.position.set(4, 12, 6);
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
