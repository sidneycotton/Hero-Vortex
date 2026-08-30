// O Porteiro — Permanent bespoke build.
// Pillars rebuilt using an interlocking gray brick pattern (running bond).
// Chains correctly stretch from the pillar shackles to the outer wrists.
function buildPorteiroModel(bodyGroup, mainMat, accentMat, def) {
  bodyGroup.scale.setScalar(1.25);

  const stoneMat = mainMat.clone();
  stoneMat.color.set(0x767a6f); 
  const stoneDarkMat = mainMat.clone();
  stoneDarkMat.color.set(0x4a4d45);
  
  const fenceMat = mainMat.clone();
  fenceMat.color.set(0x6b6356); 

  const chainMat = new THREE.MeshToonMaterial({ color: 0x222421, gradientMap: TOON_GRADIENT });
  const shadowMat = new THREE.MeshToonMaterial({ color: 0x111210, gradientMap: TOON_GRADIENT });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ---- Legs / Base ----
  [-1, 1].forEach(side => {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), stoneDarkMat);
    leg.scale.set(1.2, 0.9, 1.2);
    leg.position.set(side * 0.28, 0.15, 0.05);
    add(leg, "leg_" + (side < 0 ? "L" : "R"));

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), stoneMat);
    knee.scale.set(1.1, 1.1, 1.1);
    knee.position.set(side * 0.32, 0.25, 0.22);
    add(knee, "knee_" + (side < 0 ? "L" : "R"));

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), stoneMat);
    foot.scale.set(1.3, 0.5, 1.4);
    foot.position.set(side * 0.3, 0.06, 0.2);
    add(foot, "foot_" + (side < 0 ? "L" : "R"));
  });

  // ---- Torso (Cobblestone Plating) ----
  const torsoBase = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), stoneDarkMat);
  torsoBase.position.set(0, 0.65, 0.05);
  torsoBase.scale.set(1.3, 1.0, 1.0);
  add(torsoBase, "torso");

  const chestBoulders = [
    { x: -0.22, y: 0.78, z: 0.38, r: 0.18, s: [1.2, 0.9, 0.5] },
    { x: 0.22, y: 0.78, z: 0.38, r: 0.18, s: [1.2, 0.9, 0.5] },
    { x: -0.15, y: 0.52, z: 0.42, r: 0.14, s: [1.1, 0.8, 0.5] },
    { x: 0.15, y: 0.52, z: 0.42, r: 0.14, s: [1.1, 0.8, 0.5] },
    { x: 0, y: 0.40, z: 0.45, r: 0.12, s: [1.4, 0.8, 0.5] },
    { x: -0.35, y: 1.05, z: 0.15, r: 0.22, s: [1.1, 1.2, 1.0] },
    { x: 0.35, y: 1.05, z: 0.15, r: 0.22, s: [1.1, 1.2, 1.0] },
    { x: 0, y: 0.98, z: -0.1, r: 0.25, s: [1.6, 1.1, 1.2] } 
  ];

  chestBoulders.forEach((b, i) => {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(b.r, 14, 12), stoneMat);
    stone.position.set(b.x, b.y, b.z);
    stone.scale.set(b.s[0], b.s[1], b.s[2]);
    add(stone, "chestBoulder_" + i);
  });

  // Invisible core hook prevents animation script crashes 
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), mainMat);
  core.position.set(0, 0.65, 0.44);
  core.visible = false; 
  add(core, "core");

  // ---- Head (Thickened for extra distinction) ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.98, 0.28);
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.25), stoneMat);
  headGroup.add(face);

  // Heavy side-slabs framing the face
  [-1, 1].forEach(side => {
    const sideSlab = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.3), stoneDarkMat);
    sideSlab.position.set(side * 0.24, 0, -0.02);
    sideSlab.rotation.z = side * 0.15;
    headGroup.add(sideSlab);
  });

  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.16), stoneMat);
  brow.position.set(0, 0.1, 0.16);
  brow.rotation.x = 0.1;
  headGroup.add(brow);

  const eyeShadow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.1), shadowMat);
  eyeShadow.position.set(0, 0.02, 0.16);
  headGroup.add(eyeShadow);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.14), stoneMat);
  nose.position.set(0, -0.02, 0.18);
  nose.rotation.x = -0.15;
  headGroup.add(nose);

  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.14), stoneMat);
  chin.position.set(0, -0.12, 0.15);
  headGroup.add(chin);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.1), shadowMat);
  mouth.position.set(0, -0.07, 0.16);
  headGroup.add(mouth);

  // ---- Arms (Hanging Wide) ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.52, 0.88, 0.1);
    add(shoulderPivot, "shoulderPivot_" + (side < 0 ? "L" : "R"));

    const shoulderStone = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), stoneMat);
    shoulderStone.scale.set(1.1, 1.2, 1.1);
    shoulderPivot.add(shoulderStone);

    const bicep = makeCapsule(0.14, 0.28, stoneDarkMat);
    bicep.position.set(0, -0.18, 0);
    shoulderPivot.add(bicep);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.32, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.15, 0.42, stoneMat);
    forearm.position.set(0, -0.18, 0);
    forearm.name = (side < 0 ? "armL" : "armR");
    elbowPivot.add(forearm);
    
    const elbowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), stoneMat);
    elbowKnot.position.set(0, 0, -0.08);
    elbowPivot.add(elbowKnot);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), stoneDarkMat);
    fist.position.set(0, -0.42, 0);
    elbowPivot.add(fist);

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 16), chainMat);
    shackle.position.set(0, -0.35, 0);
    shackle.rotation.x = Math.PI / 2;
    elbowPivot.add(shackle);

    return { shoulderPivot, elbowPivot, forearm };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  // Aggressive wide stance
  rigL.shoulderPivot.rotation.set(0.1, 0.35, -0.6);
  rigL.elbowPivot.rotation.set(-1.6, -0.2, 0);
  
  rigR.shoulderPivot.rotation.set(0.25, -0.35, 0.6);
  rigR.elbowPivot.rotation.set(-1.6, 0.2, 0);

  // ---- Stacked Gray Brick Fence & Taut Chains ----
  [-1, 1].forEach(side => {
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(side * 0.95, 0, 0.15); // Anchor to ground
    bodyGroup.add(pillarGroup);

    // Build the brick pillar manually using a running bond pattern
    const brickH = 0.075;
    const brickW = 0.22;
    const brickD = 0.105;
    const rows = 14; // ~1.1 total height

    for (let r = 0; r < rows; r++) {
      const y = (r * 0.08) + (brickH / 2); // Calculate height per row
      
      // Two interlocking bricks per row
      for (let b = 0; b < 2; b++) {
        // Alternate materials slightly to make the brick joints visible
        const mat = (r + b) % 3 === 0 ? stoneDarkMat : fenceMat;
        
        let geo, bx, bz;
        if (r % 2 === 0) {
          // Row A: Bricks laid along the Z axis
          geo = new THREE.BoxGeometry(brickW, brickH, brickD);
          bx = 0;
          bz = b === 0 ? -0.055 : 0.055;
        } else {
          // Row B: Bricks laid along the X axis
          geo = new THREE.BoxGeometry(brickD, brickH, brickW);
          bx = b === 0 ? -0.055 : 0.055;
          bz = 0;
        }

        const brick = new THREE.Mesh(geo, mat);
        
        // Add slight deterministic offsets so they don't look perfectly machine-made
        const jitterX = (r % 3 === 0) ? 0.005 : ((r + b) % 3 === 1 ? -0.005 : 0);
        const jitterZ = (b % 2 === 0) ? 0.005 : -0.005;
        
        brick.position.set(bx + jitterX, y, bz + jitterZ);
        pillarGroup.add(brick);
      }
    }

    // Pillar Cap (One solid slab on top)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.26), stoneDarkMat);
    cap.position.set(0, 1.16, 0); 
    pillarGroup.add(cap);

    // Pillar Shackle attached securely to the side of the pillar
    const pShackle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), chainMat);
    pShackle.position.set(side * -0.11, 0.7, 0);
    pShackle.rotation.y = Math.PI / 2;
    pillarGroup.add(pShackle);

    // Calculate chains pointing outwards and forwards
    const startPos = new THREE.Vector3(side * 0.84, 0.7, 0.15); // World pos of pillar shackle
    const endPos = new THREE.Vector3(side * 0.68, 0.48, 0.41);  // World pos of wrist shackle
    
    const numLinks = 6;
    for(let i = 0; i < numLinks; i++) {
      const t = i / (numLinks - 1);
      const linkPos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      const sag = Math.sin(t * Math.PI) * 0.05;
      linkPos.y -= sag;
      
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.015, 6, 12), chainMat);
      link.position.copy(linkPos);
      
      link.lookAt(endPos);
      link.rotation.y += Math.PI / 2;
      
      // Interlocking twists
      if (i % 2 === 0) {
        link.rotation.x += Math.PI / 2;
      }
      
      bodyGroup.add(link);
    }
  });

  return [torsoBase, face, rigR.forearm];
}

BESPOKE_BUILDERS.porteiro = buildPorteiroModel;