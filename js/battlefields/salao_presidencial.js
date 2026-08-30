// =============================================================
// BATTLEFIELD: SALÃO PRESIDENCIAL (grand indoor hall, White-House-
// interior styled — pale walls, blue carpet, columns, chandelier)
// =============================================================
// See js/battlefields/BATTLEFIELD_GUIDE.md for the shared patterns
// this file follows (toon-shaded props, dessaturated palette, etc).
BATTLEFIELD_BUILDERS.salao_presidencial = function buildSalaoPresidencial(scene, renderer) {
  scene.fog = new THREE.FogExp2(0xd8d2c0, 0.014);

  function makeLocalToonGradient(baseRgb) {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 1;
    const ctx = c.getContext('2d');
    const steps = [0.4, 0.65, 0.85, 1.0];
    steps.forEach((f, i) => {
      ctx.fillStyle = `rgb(${Math.floor(baseRgb[0] * f)},${Math.floor(baseRgb[1] * f)},${Math.floor(baseRgb[2] * f)})`;
      ctx.fillRect(i, 0, 1, 1);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // ---- Ground: deep blue carpet with a richer woven medallion pattern
  // (diamond lattice + corner fleurons, not just a bare border) plus a
  // pale stone border ring (marble floor showing at the room's edge) ----
  function makeCarpetTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#28406b';
    ctx.fillRect(0, 0, size, size);
    // woven fiber speckle
    for (let i = 0; i < 4500; i++) {
      const shade = 30 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${Math.floor(shade * 0.6)},${Math.floor(shade * 0.85)},${shade + 45})`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 2, 2);
    }
    // subtle darker damask diamond lattice across the whole field, so
    // the carpet reads as a woven pattern even far from the border
    ctx.strokeStyle = 'rgba(18,28,50,0.35)';
    ctx.lineWidth = 1.5;
    const cell = 42;
    for (let y = -cell; y < size + cell; y += cell) {
      ctx.beginPath();
      for (let x = -cell; x <= size + cell; x += cell) {
        ctx.moveTo(x, y + cell / 2);
        ctx.lineTo(x + cell / 2, y);
        ctx.lineTo(x + cell, y + cell / 2);
        ctx.lineTo(x + cell / 2, y + cell);
        ctx.closePath();
      }
      ctx.stroke();
    }
    // small gold fleuron dot at each lattice intersection
    ctx.fillStyle = 'rgba(196,166,90,0.4)';
    for (let y = 0; y <= size; y += cell) {
      for (let x = 0; x <= size; x += cell) {
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // gold damask double border pattern ring, with corner tick marks
    ctx.strokeStyle = 'rgba(196,166,90,0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, size - 60, size - 60);
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, size - 96, size - 96);
    ctx.strokeStyle = 'rgba(196,166,90,0.4)';
    ctx.lineWidth = 3;
    const inset = 30, tick = 22;
    [[inset, inset], [size - inset, inset], [inset, size - inset], [size - inset, size - inset]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx - tick * Math.sign(cx - size / 2), cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - tick * Math.sign(cy - size / 2));
      ctx.stroke();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), color: 0xffffff, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Pale marble floor ring outside the carpet, before the walls
  function makeMarbleTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cfc7ae';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 600; i++) {
      const shade = 190 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${shade},${shade - 6},${shade - 24},0.5)`;
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // faint checkerboard seams between marble tiles
    ctx.strokeStyle = 'rgba(150,140,110,0.3)';
    ctx.lineWidth = 1;
    const tile = 32;
    for (let x = 0; x <= size; x += tile) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
    for (let y = 0; y <= size; y += tile) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }
  const marbleRing = new THREE.Mesh(
    new THREE.RingGeometry(16, 19.5, 64),
    new THREE.MeshStandardMaterial({ map: makeMarbleTexture(), color: 0xffffff, roughness: 0.5, metalness: 0.1 })
  );
  marbleRing.rotation.x = -Math.PI / 2;
  marbleRing.position.y = 0.005;
  scene.add(marbleRing);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(15.85, 16.05, 64),
    new THREE.MeshStandardMaterial({ color: 0xc4a65a, roughness: 0.5, metalness: 0.4 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.008;
  scene.add(rim);

  // ---- "Sky": actually a coffered ceiling, viewed through the same
  // dome mesh other battlefields use for sky, since the camera never
  // tilts far enough up to break the illusion of an indoor room ----
  function makeCeilingTexture() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#efe8d2');
    grad.addColorStop(0.4, '#e0d8c0');
    grad.addColorStop(0.75, '#c0b28c');
    grad.addColorStop(1, '#9c8a5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    return new THREE.CanvasTexture(c);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeCeilingTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Curved wall band with tall arched window shapes, ringing the room
  // just inside the sky dome so there's a readable "indoor" horizon
  // instead of the floor vanishing straight into the ceiling gradient.
  const wallGradient = makeLocalToonGradient([222, 212, 188]);
  const wallMat = new THREE.MeshToonMaterial({ color: 0xdcd3b4, gradientMap: wallGradient });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(32, 32, 16, 32, 1, true),
    wallMat
  );
  wall.position.y = 8;
  wall.material.side = THREE.BackSide;
  scene.add(wall);

  // Tall arched windows around the wall, warm light glowing through.
  // Alternating scale/tone breaks the "identical row of pill shapes"
  // repetition — every 3rd window is a taller, slightly narrower state
  // window with a deeper gold surround, echoing real hall elevations
  // where flanking windows differ subtly from the main ones.
  // Built from a cylinder + a flattened sphere cap (r128, the three.js
  // build this project pins, has no THREE.CapsuleGeometry — that was
  // only added upstream in r142; see js/models/core.js's makeCapsule
  // comment for the same constraint on character models).
  const windowGradient = makeLocalToonGradient([255, 245, 210]);
  const windowMat = new THREE.MeshToonMaterial({ color: 0xfff3cf, gradientMap: windowGradient, emissive: 0xfff0c0, emissiveIntensity: 0.25 });
  const windowMatTall = new THREE.MeshToonMaterial({ color: 0xffe9b8, gradientMap: windowGradient, emissive: 0xffdca0, emissiveIntensity: 0.3 });
  const surroundGradient = makeLocalToonGradient([196, 166, 90]);
  const surroundMat = new THREE.MeshToonMaterial({ color: 0xc4a65a, gradientMap: surroundGradient });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const tall = i % 3 === 0;
    const mat = tall ? windowMatTall : windowMat;
    const rWin = tall ? 1.25 : 1.4;
    const bodyH = tall ? 6.2 : 5;
    const win = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rWin, rWin, bodyH, 12), mat);
    win.add(body);
    const arch = new THREE.Mesh(new THREE.SphereGeometry(rWin, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
    arch.position.y = bodyH / 2;
    win.add(arch);
    // thin gold surround/frame tracing the arch, tying windows back
    // into the same gold accent used on columns and the seal
    const frame = new THREE.Mesh(new THREE.TorusGeometry(rWin + 0.08, 0.05, 6, 16, Math.PI), surroundMat);
    frame.rotation.z = Math.PI;
    frame.position.y = bodyH / 2;
    win.add(frame);
    win.position.set(Math.cos(ang) * 31.5, tall ? 8.6 : 8, Math.sin(ang) * 31.5);
    win.lookAt(0, tall ? 8.6 : 8, 0);
    scene.add(win);
  }

  // ---- Grand columns ringing the arena (this room's "trees") ----
  // Taller and slightly more slender than the first pass (7.8x vs 7x
  // height-to-base) so they read as soaring hall columns rather than
  // stubby porch posts, with a fuller entablature band and visible
  // fluting grooves for richer silhouette up close.
  const columnGradient = makeLocalToonGradient([232, 226, 208]);
  const columnMat = new THREE.MeshToonMaterial({ color: 0xe8e2d0, gradientMap: columnGradient });
  const columnCapGradient = makeLocalToonGradient([196, 166, 90]);
  const columnCapMat = new THREE.MeshToonMaterial({ color: 0xc4a65a, gradientMap: columnCapGradient });
  const flutingGradient = makeLocalToonGradient([206, 198, 176]);
  const flutingMat = new THREE.MeshToonMaterial({ color: 0xd4cab0, gradientMap: flutingGradient });

  function makeColumn(scale) {
    const col = new THREE.Group();
    const shaftH = 7.8 * scale;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * scale, 0.48 * scale, shaftH, 14), columnMat);
    shaft.position.y = shaftH / 2;
    shaft.castShadow = true;
    col.add(shaft);
    // fluting hint via slim vertical grooves around the shaft
    const fluteCount = 8;
    for (let f = 0; f < fluteCount; f++) {
      const fAng = (f / fluteCount) * Math.PI * 2;
      const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.06 * scale, shaftH * 0.94, 5), flutingMat);
      flute.position.set(Math.cos(fAng) * 0.4 * scale, shaftH / 2, Math.sin(fAng) * 0.4 * scale);
      col.add(flute);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * scale, 0.62 * scale, 0.35 * scale, 14), columnCapMat);
    base.position.y = 0.18 * scale;
    col.add(base);
    // secondary base plinth, wider and shorter, for a grounded footing
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.74 * scale, 0.78 * scale, 0.16 * scale, 14), columnCapMat);
    plinth.position.y = 0.08 * scale;
    col.add(plinth);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.66 * scale, 0.48 * scale, 0.42 * scale, 14), columnCapMat);
    capital.position.y = shaftH + 0.21 * scale;
    col.add(capital);
    // abacus slab crowning the capital, wider than the shaft, giving
    // the column top a proper entablature-supporting silhouette
    const abacus = new THREE.Mesh(new THREE.CylinderGeometry(0.82 * scale, 0.7 * scale, 0.18 * scale, 14), columnCapMat);
    abacus.position.y = shaftH + 0.5 * scale;
    col.add(abacus);
    return col;
  }

  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const dist = 14.5;
    const col = makeColumn(0.9 + Math.random() * 0.12);
    col.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    scene.add(col);
  }

  // ---- Central chandelier hanging above the arena ----
  // Two-tier design (larger lower ring + smaller upper ring) with more
  // bulbs and a decorative finial, reading as a grander fixture than a
  // single thin hoop with bulbs pinned around it.
  const chandelierGradient = makeLocalToonGradient([214, 178, 100]);
  const chandelierMat = new THREE.MeshToonMaterial({ color: 0xd6b264, gradientMap: chandelierGradient });
  const chandelierGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false });
  const chandelier = new THREE.Group();

  const chandRingLower = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.11, 8, 24), chandelierMat);
  chandelier.add(chandRingLower);
  const chandRingUpper = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 20), chandelierMat);
  chandRingUpper.position.y = 0.75;
  chandelier.add(chandRingUpper);
  // spokes connecting the two rings
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5), chandelierMat);
    const x0 = Math.cos(ang) * 1.7, z0 = Math.sin(ang) * 1.7;
    const x1 = Math.cos(ang) * 1.0, z1 = Math.sin(ang) * 1.0;
    spoke.position.set((x0 + x1) / 2, 0.37, (z0 + z1) / 2);
    spoke.lookAt(x1, 0.75, z1);
    spoke.rotation.x += Math.PI / 2;
    chandelier.add(spoke);
  }
  // lower-ring bulbs (bright) + upper-ring bulbs (smaller accent)
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), chandelierGlowMat);
    bulb.position.set(Math.cos(ang) * 1.7, -0.16, Math.sin(ang) * 1.7);
    chandelier.add(bulb);
  }
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), chandelierGlowMat);
    bulb.position.set(Math.cos(ang) * 1.0, 0.62, Math.sin(ang) * 1.0);
    chandelier.add(bulb);
  }
  // finial cap on top
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), chandelierMat);
  finial.position.y = 1.05;
  finial.scale.set(1, 1.3, 1);
  chandelier.add(finial);

  const chandChain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.5, 6), chandelierMat);
  chandChain.position.y = 1.9;
  chandelier.add(chandChain);
  chandelier.position.set(0, 10, 0);
  scene.add(chandelier);

  const chandelierLight = new THREE.PointLight(0xfff0c0, 0.95, 20);
  chandelierLight.position.set(0, 9.5, 0);
  scene.add(chandelierLight);

  // Presidential seal medallion inlaid at the arena's exact center, now
  // with a subtle radiating star pattern instead of a flat gold disc
  const sealMat = new THREE.MeshToonMaterial({ color: 0xc4a65a, gradientMap: chandelierGradient });
  const sealCenterMat = new THREE.MeshToonMaterial({ color: 0x28406b, gradientMap: makeLocalToonGradient([40, 64, 107]) });
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), sealMat);
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = 0.02;
  scene.add(seal);
  const sealInner = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), sealCenterMat);
  sealInner.rotation.x = -Math.PI / 2;
  sealInner.position.y = 0.021;
  scene.add(sealInner);
  // radiating star spokes over the inner disc, echoing a seal's rays
  for (let i = 0; i < 13; i++) {
    const ang = (i / 13) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), sealMat);
    ray.rotation.x = -Math.PI / 2;
    ray.position.set(Math.cos(ang) * 0.5, 0.022, Math.sin(ang) * 0.5);
    ray.scale.set(1, 1.8, 1);
    scene.add(ray);
  }
  const sealRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 24), sealMat);
  sealRing.rotation.x = -Math.PI / 2;
  sealRing.position.y = 0.022;
  scene.add(sealRing);

  // Center divide + team washes (shared visual language across battlefields)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0xc4a65a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.025;
  scene.add(centerRing);

  const playerWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 0.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.07 }));
  playerWash.rotation.x = -Math.PI / 2;
  playerWash.position.y = 0.015;
  scene.add(playerWash);
  const enemyWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 1.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.07 }));
  enemyWash.rotation.x = -Math.PI / 2;
  enemyWash.position.y = 0.015;
  scene.add(enemyWash);

  // ---- Lighting: warm indoor light, no harsh shadows ----
  const ambient = new THREE.AmbientLight(0xe8dcc0, 0.78);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff3d8, 0.72);
  keyLight.position.set(4, 11, 6);
  keyLight.castShadow = renderer.shadowMap.enabled;
  if (keyLight.castShadow) {
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
  }
  scene.add(keyLight);

  // Secondary warm fill from the opposite side so column shadows don't
  // all fall the same direction and the room feels lit by more than one
  // window — subtle, low intensity, no shadow casting of its own.
  const fillLight = new THREE.DirectionalLight(0xf0e2c0, 0.28);
  fillLight.position.set(-6, 7, -5);
  scene.add(fillLight);

  const playerLight = new THREE.PointLight(0x4fd1c5, 1.1, 14);
  playerLight.position.set(0, 3, 6);
  scene.add(playerLight);

  const enemyLight = new THREE.PointLight(0xff6b6b, 1.1, 14);
  enemyLight.position.set(0, 3, -6);
  scene.add(enemyLight);

  return { playerLight, enemyLight };
};
