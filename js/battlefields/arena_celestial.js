// =============================================================
// BATTLEFIELD: ARENA CELESTIAL (floating cloud platform in the sky,
// pastel dawn/dusk gradient, drifting cloud islands at the edges)
// =============================================================
// See js/battlefields/BATTLEFIELD_GUIDE.md for the shared patterns
// this file follows (toon-shaded props, dessaturated palette, etc).
BATTLEFIELD_BUILDERS.arena_celestial = function buildArenaCelestial(scene, renderer) {
  scene.fog = new THREE.FogExp2(0xb8b0c8, 0.012);

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

  // ---- Ground: pale weathered stone platform with veins of cloud-mist
  // wisping across it, like an ancient floating shrine floor ----
  function makeFloorTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8f8aa0';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4500; i++) {
      const shade = 110 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${shade},${shade - 4},${shade + 12},0.5)`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 2, 2);
    }
    // soft wispy mist streaks
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = `rgba(230,228,240,${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 4 + Math.random() * 8;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 60, size * 0.7, y + (Math.random() - 0.5) * 60, size, y);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), color: 0xffffff, roughness: 0.9, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Glowing pale-gold rim marking the platform edge — beyond it is
  // open sky, reinforcing that this is a floating island
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(15.5, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0xcbb98e, roughness: 0.6, metalness: 0.3, emissive: 0x6a5a3a, emissiveIntensity: 0.15 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  scene.add(rim);

  // Low mist skirting the platform's underside edge, hiding the hard
  // stone lip and selling the "floating in clouds" read
  const skirtMat = new THREE.MeshBasicMaterial({ color: 0xf4f2fa, transparent: true, opacity: 0.35, fog: false, side: THREE.DoubleSide });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 0.8, 8, 6), skirtMat);
    puff.position.set(Math.cos(ang) * 16, -0.6 - Math.random() * 0.5, Math.sin(ang) * 16);
    puff.scale.set(1.3, 0.6, 1.3);
    scene.add(puff);
  }

  // ---- Sky: dawn/dusk pastel gradient — dessaturated lavender to
  // warm peach, never a saturated "cartoon blue" sky ----
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7c7a9e');
    grad.addColorStop(0.4, '#a89cb0');
    grad.addColorStop(0.7, '#c9aa9c');
    grad.addColorStop(1, '#dcc6a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    return new THREE.CanvasTexture(c);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Distant sun/moon glow disc low on the horizon
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xf4dcae, transparent: true, opacity: 0.55, fog: false });
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(6, 32), glowMat);
  sunGlow.position.set(-30, 10, -38);
  sunGlow.lookAt(0, 10, 0);
  scene.add(sunGlow);

  // Layered puffy clouds drifting at various distances/heights —
  // denser and larger than a ground battlefield's decorative clouds,
  // since here they ARE the horizon/terrain feature
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf2eef8, transparent: true, opacity: 0.88, fog: false });
  const cloudMatDusk = new THREE.MeshBasicMaterial({ color: 0xe8c8b0, transparent: true, opacity: 0.7, fog: false });
  function makeCloud(matChoice) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.3 + Math.random() * 1.1, 8, 8), matChoice);
      puff.position.set(p * 1.5 - puffs * 0.75, Math.random() * 0.5, Math.random() * 0.7);
      puff.scale.set(1.1, 0.75, 1.1);
      cloud.add(puff);
    }
    return cloud;
  }
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 28 + Math.random() * 14;
    const cloud = makeCloud(i % 3 === 0 ? cloudMatDusk : cloudMat);
    cloud.scale.setScalar(1.2 + Math.random() * 1.4);
    cloud.position.set(Math.cos(ang) * dist, 4 + Math.random() * 14, Math.sin(ang) * dist);
    scene.add(cloud);
  }

  // ---- Floating rock islets ringing the arena edge (this field's
  // "trees") — toon-shaded chunks of stone with grass tufts, each
  // drifting at a different height with small orbiting cloud puffs ----
  const rockGradient = makeLocalToonGradient([120, 112, 128]);
  const rockMat = new THREE.MeshToonMaterial({ color: 0x847c94, gradientMap: rockGradient });
  const rockMatAlt = new THREE.MeshToonMaterial({ color: 0x746c86, gradientMap: makeLocalToonGradient([110, 104, 118]) });
  const grassGradient = makeLocalToonGradient([120, 132, 96]);
  const grassMat = new THREE.MeshToonMaterial({ color: 0x7c8a62, gradientMap: grassGradient });
  const crystalGradient = makeLocalToonGradient([150, 190, 200]);
  const crystalMat = new THREE.MeshToonMaterial({ color: 0x9cc8ce, gradientMap: crystalGradient, emissive: 0x3a5a5e, emissiveIntensity: 0.2 });

  function makeIslet(scale) {
    const islet = new THREE.Group();
    // Irregular rounded rock body: a squashed sphere as the core, with
    // 2-3 smaller lumps fused on to break up the silhouette instead of
    // a single geometric cone/rock.
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.1 * scale, 10, 8), rockMat);
    core.scale.set(1.3, 0.7, 1.2);
    core.castShadow = true;
    islet.add(core);
    for (let i = 0; i < 2; i++) {
      const lump = new THREE.Mesh(new THREE.SphereGeometry(0.55 * scale, 8, 6), i === 0 ? rockMatAlt : rockMat);
      lump.scale.set(1.1, 0.7, 1.1);
      lump.position.set((Math.random() - 0.5) * 1.4 * scale, -0.25 * scale - Math.random() * 0.3 * scale, (Math.random() - 0.5) * 1.2 * scale);
      lump.castShadow = true;
      islet.add(lump);
    }
    // grass tuft cap on top
    const grassCap = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), grassMat);
    grassCap.position.y = 0.35 * scale;
    grassCap.scale.set(1.25, 0.5, 1.15);
    islet.add(grassCap);
    // occasional small glowing crystal jutting from the rock, tying
    // into the "celestial" theme without being a sharp asset-store spike
    if (Math.random() < 0.5) {
      const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.14 * scale, 0.7 * scale, 6), crystalMat);
      crystal.position.set((Math.random() - 0.5) * 0.6 * scale, 0.6 * scale, (Math.random() - 0.5) * 0.6 * scale);
      crystal.rotation.z = (Math.random() - 0.5) * 0.4;
      islet.add(crystal);
    }
    // tiny cloud puff drifting just beneath, as if the islet trails mist
    const trail = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 6, 6), cloudMat);
    trail.position.y = -0.65 * scale;
    trail.scale.set(1.4, 0.5, 1.4);
    islet.add(trail);
    return islet;
  }

  const isletAngles = [Math.PI * 0.15, Math.PI * 0.5, Math.PI * 0.85, -Math.PI * 0.15, -Math.PI * 0.5, -Math.PI * 0.85, Math.PI];
  isletAngles.forEach((ang, i) => {
    const dist = 15 + Math.random() * 4;
    const islet = makeIslet(0.8 + Math.random() * 0.7);
    islet.position.set(Math.cos(ang) * dist, 1.5 + Math.random() * 2.5, Math.sin(ang) * dist);
    islet.rotation.y = Math.random() * Math.PI * 2;
    scene.add(islet);
  });

  // Distant floating landmasses on the horizon, softly silhouetted
  // through fog, so the arena doesn't feel like it's alone in a void
  const distantMat = new THREE.MeshStandardMaterial({ color: 0x8a84a0, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.25;
    const dist = 30 + Math.random() * 10;
    const land = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2.5, 10, 6), distantMat);
    land.scale.set(1.4, 0.5, 1.2);
    land.position.set(Math.cos(ang) * dist, 6 + Math.random() * 10, Math.sin(ang) * dist);
    scene.add(land);
  }

  // Center divide + team washes (shared visual language across battlefields)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8d9a8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
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

  // ---- Lighting: soft dawn/dusk light, lavender-tinted ambient ----
  const ambient = new THREE.AmbientLight(0xa8a0c0, 0.6);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xf4dcae, 0.9);
  keyLight.position.set(-6, 10, -8);
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
