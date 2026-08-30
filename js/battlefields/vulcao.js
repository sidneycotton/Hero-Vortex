// =============================================================
// BATTLEFIELD: VULCÃO (red volcanic rock arena ringed by lava)
// =============================================================
// See js/battlefields/BATTLEFIELD_GUIDE.md for the shared patterns
// this file follows (toon-shaded props, dessaturated palette, etc).
BATTLEFIELD_BUILDERS.vulcao = function buildVulcao(scene, renderer) {
  scene.fog = new THREE.FogExp2(0x3a1f18, 0.022);

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

  // ---- Ground: cracked red volcanic rock texture ----
  function makeRockTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6b3226';
    ctx.fillRect(0, 0, size, size);
    // mottled rock shading
    for (let i = 0; i < 4000; i++) {
      const shade = 35 + Math.floor(Math.random() * 45);
      ctx.fillStyle = `rgb(${shade + 55},${Math.floor(shade * 0.45)},${Math.floor(shade * 0.3)})`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    // dark cracks
    ctx.strokeStyle = 'rgba(20,8,6,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      let x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // faint glowing cracks (emissive look baked into the texture)
    ctx.strokeStyle = 'rgba(255,110,40,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      let x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ map: makeRockTexture(), color: 0xffffff, roughness: 0.9, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(15.5, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a1712, roughness: 0.9 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  scene.add(rim);

  // ---- Lava moat ringing the playable rock island ----
  function makeLavaTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a1a08';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const r = 8 + Math.random() * 20;
      const x = Math.random() * size, y = Math.random() * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,200,60,0.9)');
      grad.addColorStop(0.5, 'rgba(255,110,20,0.6)');
      grad.addColorStop(1, 'rgba(255,110,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    return tex;
  }
  const lavaMat = new THREE.MeshBasicMaterial({ map: makeLavaTexture(), fog: false });
  const lavaMoat = new THREE.Mesh(new THREE.RingGeometry(16.05, 22, 64), lavaMat);
  lavaMoat.rotation.x = -Math.PI / 2;
  lavaMoat.position.y = -0.15;
  scene.add(lavaMoat);

  // Lava glow light so the rim reads as an actual heat source
  const lavaGlow = new THREE.PointLight(0xff5a1a, 1.4, 26);
  lavaGlow.position.set(0, 1.5, 0);
  scene.add(lavaGlow);

  // ---- Sky: dark smoky gradient with a warm horizon glow ----
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#241512');
    grad.addColorStop(0.55, '#4a2418');
    grad.addColorStop(0.85, '#9a4c22');
    grad.addColorStop(1, '#d98a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    return new THREE.CanvasTexture(c);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Drifting ash/smoke clouds (dark, not white puffy ones)
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a201c, transparent: true, opacity: 0.55, fog: false });
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.0, 8, 8), smokeMat);
      puff.position.set(p * 1.6 - puffs * 0.8, Math.random() * 0.5, Math.random() * 0.6);
      cloud.add(puff);
    }
    const ang = (i / 6) * Math.PI * 2;
    cloud.position.set(Math.cos(ang) * 34, 16 + Math.random() * 6, Math.sin(ang) * 34);
    scene.add(cloud);
  }

  // ---- Central volcano silhouette behind the arena ----
  const volcanoGradient = makeLocalToonGradient([110, 55, 40]);
  const volcanoMat = new THREE.MeshToonMaterial({ color: 0x6e372a, gradientMap: volcanoGradient });
  const volcano = new THREE.Mesh(new THREE.ConeGeometry(9, 13, 8), volcanoMat);
  volcano.position.set(0, 3, -30);
  scene.add(volcano);
  // glowing crater cap
  const craterMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, fog: false });
  const crater = new THREE.Mesh(new THREE.CircleGeometry(2.2, 16), craterMat);
  crater.position.set(0, 9.4, -30);
  crater.rotation.x = -Math.PI / 2;
  scene.add(crater);

  // ---- Jagged obsidian rock formations ringing the edge ----
  const rockGradient = makeLocalToonGradient([95, 60, 50]);
  const rockMats = [0x5a3830, 0x4a2e28, 0x3e2620].map(c => new THREE.MeshToonMaterial({ color: c, gradientMap: rockGradient }));

  function makeRockSpire(scale) {
    const group = new THREE.Group();
    const spikes = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < spikes; i++) {
      const h = (1.4 + Math.random() * 1.3) * scale;
      const rock = new THREE.Mesh(new THREE.ConeGeometry((0.35 + Math.random() * 0.25) * scale, h, 5), rockMats[i % rockMats.length]);
      rock.position.set((Math.random() - 0.5) * 0.8 * scale, h / 2, (Math.random() - 0.5) * 0.8 * scale);
      rock.rotation.y = Math.random() * Math.PI;
      rock.rotation.z = (Math.random() - 0.5) * 0.15;
      rock.castShadow = true;
      group.add(rock);
    }
    return group;
  }

  const clusterAngles = [Math.PI * 0.15, Math.PI * 0.85, -Math.PI * 0.15, -Math.PI * 0.85, Math.PI];
  clusterAngles.forEach((baseAng, ci) => {
    const clusterSize = ci < 2 ? 4 : 2;
    for (let i = 0; i < clusterSize; i++) {
      const ang = baseAng + (Math.random() - 0.5) * 0.4;
      const dist = 13.5 + Math.random() * 3;
      const spire = makeRockSpire(0.9 + Math.random() * 0.7);
      spire.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      scene.add(spire);
    }
  });

  // Center divide + team washes (shared visual language across battlefields)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.02;
  scene.add(centerRing);

  const playerWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 0.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.07 }));
  playerWash.rotation.x = -Math.PI / 2;
  playerWash.position.y = 0.015;
  scene.add(playerWash);
  const enemyWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 1.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.07 }));
  enemyWash.rotation.x = -Math.PI / 2;
  enemyWash.position.y = 0.015;
  scene.add(enemyWash);

  // ---- Lighting: warm, low-key, lava-lit ----
  const ambient = new THREE.AmbientLight(0x6e3a28, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffb070, 0.9);
  keyLight.position.set(4, 11, 6);
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
