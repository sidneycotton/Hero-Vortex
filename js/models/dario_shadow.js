// =============================================================
// ============ DÁRIO'S SHADOW — BOSS MODEL =======================
// =============================================================
// The supplied "President Shadow" bespoke build (CAMPAIGN_DESIGN.md
// §6.4's noted scope delta — this IS the asset that section flagged as
// coming from the project owner rather than being derived fresh from
// js/models/dario.js's Sombra half). Renamed to match this project's
// dario_shadow id scheme per that section's stated intent, registered
// under BESPOKE_BUILDERS.dario_shadow, and wired to js/units/
// dario_shadow.js via def.shape === "dario_shadow" (was previously
// falling back to the generic "caster" shape with no bespoke geometry
// at all).
//
// One fix made to the originally-supplied file: the "fissure" detail
// meshes used THREE.BoxGeometry, which handoff.md's Step 3 hard rules
// explicitly disallow for bespoke builders ("no BoxGeometry, no sharp
// ConeGeometry") — swapped for makeCapsule() (this project's own
// cylinder+sphere-cap stand-in for a capsule shape, since r128 has no
// native THREE.CapsuleGeometry) laid flat, which reads the same as a
// thin crack in the ground. Everything else is unchanged from the
// supplied build — silhouette, palette, and joint-chain arm rig are
// the project owner's design, kept as authored.
function buildDarioShadowModel(bodyGroup, mainMat, accentMat, def) {
  bodyGroup.scale.setScalar(1.2);

  const suitMat = new THREE.MeshToonMaterial({ color: 0x0f0f12, gradientMap: TOON_GRADIENT });
  const darkPlateMat = new THREE.MeshToonMaterial({ color: 0x16161b, gradientMap: TOON_GRADIENT });
  const veilMat = new THREE.MeshToonMaterial({ color: 0xf2eee9, gradientMap: TOON_GRADIENT });
  const boneMat = new THREE.MeshToonMaterial({ color: 0xc8c2b5, gradientMap: TOON_GRADIENT });

  const bloodRedMat = new THREE.MeshToonMaterial({
    color: 0x7a0000,
    gradientMap: TOON_GRADIENT,
    emissive: 0x550000,
    emissiveIntensity: 1.2
  });
  const sashMat = new THREE.MeshToonMaterial({
    color: 0x4a0008,
    gradientMap: TOON_GRADIENT,
    emissive: 0x330005,
    emissiveIntensity: 0.8
  });

  function add(mesh, name, parent = bodyGroup) {
    if (name) mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ---- 1. THE MOUNTAIN TORSO ----
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 18), suitMat);
  torso.position.set(0, 0.9, -1.2);
  torso.scale.set(1.45, 0.85, 1.25);
  torso.rotation.x = 0.15;
  add(torso, "torso");

  const sash = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 12, 32), sashMat);
  sash.position.set(0, 1.0, -1.2);
  sash.rotation.x = Math.PI / 2;
  sash.rotation.y = 0.25;
  sash.scale.set(1, 1.1, 1.2);
  add(sash, "presidential_sash");

  // Dorsal Spikes
  for (let s = 0; s < 5; s++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35 - s * 0.05, 1.4 - s * 0.2, 6), darkPlateMat);
    spike.position.set(0, 2.0 - s * 0.25, -1.8 - s * 0.35);
    spike.rotation.x = -0.4 + s * 0.15;
    add(spike, "dorsalSpike_" + s);
  }

  // Shattered Arena Crater
  for (let r = 0; r < 14; r++) {
    const angle = (r / 14) * Math.PI * 2;
    const rad = 1.7 + Math.random() * 0.3;

    const rock = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), darkPlateMat);
    rock.position.set(Math.cos(angle) * rad, 0.1, -1.2 + Math.sin(angle) * rad * 0.8);
    rock.rotation.set(Math.random(), Math.random(), 0);
    rock.scale.set(1.5, 0.5, 1.2);
    add(rock, "crater_rock_" + r);

    if (r % 2 === 0) {
      // Thin ground-crack detail — originally a flattened BoxGeometry,
      // swapped for a flattened makeCapsule() per handoff.md's "no
      // BoxGeometry" bespoke-builder rule (see file header note).
      const fissure = makeCapsule(0.025, 0.4, bloodRedMat);
      fissure.rotation.z = Math.PI / 2;
      fissure.scale.set(1, 1, 2);
      fissure.position.set(Math.cos(angle) * (rad - 0.2), 0.02, -1.2 + Math.sin(angle) * (rad - 0.2));
      fissure.rotation.y = -angle;
      fissure.name = "fissure_" + r;
      bodyGroup.add(fissure);
    }
  }

  // ---- 2. THE GIANT LOOMING HEAD ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.1, -0.3);
  headGroup.rotation.x = 0.3;
  headGroup.name = "headGroup";
  bodyGroup.add(headGroup);

  const veilFace = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 20), veilMat);
  veilFace.scale.set(0.85, 1.3, 0.85);
  add(veilFace, "head", headGroup);

  for (let i = -4; i <= 4; i++) {
    const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.5, 6), veilMat);
    wisp.position.set(i * 0.06, -0.3 + Math.abs(i) * 0.04, 0.25);
    wisp.rotation.x = -0.15;
    wisp.rotation.z = i * 0.08;
    add(wisp, "veilWisp_" + i, headGroup);
  }

  // ---- 3. CONNECTED COLOSSAL CLAW ARMS ----
  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 1.15, 1.2, -1.1);
    shoulderPivot.name = "shoulderPivot_" + (side < 0 ? "L" : "R");
    bodyGroup.add(shoulderPivot);

    const upperArm = makeCapsule(0.28, 1.2, suitMat);
    upperArm.position.set(0, -0.6, 0);
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -1.2, 0);
    elbowPivot.name = "elbowPivot_" + (side < 0 ? "L" : "R");
    shoulderPivot.add(elbowPivot);

    const forearm = makeCapsule(0.22, 1.2, boneMat);
    forearm.position.set(0, -0.6, 0.05);
    forearm.name = side < 0 ? "armL" : "armR";
    elbowPivot.add(forearm);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -1.2, 0.1);
    handGroup.name = "hand_" + (side < 0 ? "L" : "R");
    elbowPivot.add(handGroup);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), boneMat);
    palm.scale.set(1.4, 0.4, 1.4);
    handGroup.add(palm);

    for (let f = -1; f <= 1; f++) {
      const finger = makeCapsule(0.07, 0.7, boneMat);
      finger.position.set(f * 0.2, -0.1, 0.3);
      finger.rotation.x = -1.57;
      finger.rotation.z = f * 0.15;
      handGroup.add(finger);
    }

    return { shoulderPivot, elbowPivot, hand: handGroup };
  }

  const rigL = buildArm(-1);
  const rigR = buildArm(1);

  rigL.shoulderPivot.rotation.set(0.4, 0.5, -0.8);
  rigL.elbowPivot.rotation.set(-1.2, 0, 0.5);

  rigR.shoulderPivot.rotation.set(0.5, -0.5, 0.8);
  rigR.elbowPivot.rotation.set(-1.2, 0, -0.5);

  rigR.hand.name = "weapon";

  // ---- 4. GIGANTIC ECLIPSE HALO ----
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 2.5, -1.6);
  bodyGroup.add(haloGroup);

  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 12, 36), bloodRedMat);
  haloGroup.add(haloRing);

  for (let h = 0; h < 12; h++) {
    const angle = (h / 12) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), bloodRedMat);
    spike.position.set(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, 0);
    spike.rotation.z = angle - Math.PI / 2;
    haloGroup.add(spike);
  }

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bloodRedMat);
  core.position.set(0, 1.2, -1.0);
  add(core, "core");

  const head_ = headGroup.getObjectByName("head");
  return [torso, head_];
}

BESPOKE_BUILDERS.dario_shadow = buildDarioShadowModel;
