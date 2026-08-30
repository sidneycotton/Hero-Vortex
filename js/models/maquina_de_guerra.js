function buildMaquinaDeGuerraModel(bodyGroup, mainMat, accentMat, def) {
  // Máquina de Guerra — Yvrel-Chibi art style applied to the quadruped
  // mech: a stubby rounded chassis instead of a wedge box, a rounded
  // front "face" plate, rounded spikes (scaled spheres, not cones), and
  // a rounded cannon barrel. The 4-leg joint-group structure was already
  // a real hip -> upper -> lower -> foot chain, so that rig is kept as-is
  // and just re-skinned with rounded capsule segments.
  const darkMat = mainMat.clone();
  darkMat.color.multiplyScalar(0.6);
  const rustMat = mainMat.clone();
  rustMat.color.set(0x9a5a30);
  const metalMat = mainMat.clone();
  metalMat.color.set(0x6a6a6a);
  const spikeMat = mainMat.clone();
  spikeMat.color.set(0xd8d0c0);

  // rounded stubby chassis
  const chassis = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), mainMat);
  chassis.scale.set(1, 0.65, 1.35);
  chassis.position.y = 0.5;
  chassis.castShadow = true;
  chassis.name = "torso";
  bodyGroup.add(chassis);

  // rounded angled front plate — the "face" of the machine
  const frontPlate = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), darkMat);
  frontPlate.scale.set(1.15, 0.75, 0.4);
  frontPlate.position.set(0, 0.54, 0.62);
  frontPlate.rotation.x = -0.25;
  frontPlate.castShadow = true;
  frontPlate.name = "head";
  bodyGroup.add(frontPlate);

  // rounded spikes across the top/front ridge — scaled spheres, not cones
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), spikeMat);
    spike.scale.set(1, 3.2, 1);
    spike.position.set(-0.26 + i * 0.13, 0.76, 0.4 - i * 0.06);
    spike.rotation.x = -0.2;
    spike.name = "spike_" + i;
    bodyGroup.add(spike);
  }
  [-1, 1].forEach(side => {
    const hornSpike = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), spikeMat);
    hornSpike.scale.set(1, 4, 1);
    hornSpike.position.set(side * 0.24, 0.82, 0.6);
    hornSpike.rotation.x = -0.35;
    hornSpike.rotation.z = side * 0.2;
    hornSpike.name = "hornSpike_" + (side < 0 ? "L" : "R");
    bodyGroup.add(hornSpike);
  });

  // rounded rear cannon barrel (capsule instead of a plain cylinder)
  const weapon = makeCapsule(0.08, 0.36, metalMat);
  weapon.rotation.x = Math.PI / 2;
  weapon.position.set(0, 0.56, -0.66);
  weapon.name = "weapon";
  bodyGroup.add(weapon);

  // rounded rivets scattered on the chassis
  for (let i = 0; i < 6; i++) {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), metalMat);
    bolt.scale.set(1, 0.6, 1);
    bolt.position.set((i % 2 === 0 ? -1 : 1) * 0.3, 0.4 + (i % 3) * 0.1, -0.3 + i * 0.12);
    bolt.name = "bolt_" + i;
    bodyGroup.add(bolt);
  }

  // FOUR insect-like articulated legs — already a real hip -> upper ->
  // lower -> foot joint chain per leg (legGroup pivots at the hip, upper/
  // lower/foot are children in sequence), kept unchanged structurally and
  // just re-skinned with rounded capsule/sphere parts.
  const legConfigs = [
    { x: -0.4, z: 0.4, bend: 1, id: "frontL" },
    { x: 0.4, z: 0.4, bend: 1, id: "frontR" },
    { x: -0.4, z: -0.4, bend: -1, id: "backL" },
    { x: 0.4, z: -0.4, bend: -1, id: "backR" }
  ];
  legConfigs.forEach(cfg => {
    const legGroup = new THREE.Group();
    legGroup.position.set(cfg.x, 0.45, cfg.z);
    legGroup.name = "leg_" + cfg.id;
    const upper = makeCapsule(0.055, 0.34, darkMat);
    upper.position.set(0, -0.08, cfg.bend * 0.06);
    upper.rotation.x = cfg.bend * 0.5;
    upper.name = "legUpper_" + cfg.id;
    legGroup.add(upper);
    const lower = makeCapsule(0.045, 0.36, rustMat);
    lower.position.set(0, -0.36, cfg.bend * 0.28);
    lower.rotation.x = cfg.bend * -0.9;
    lower.name = "legLower_" + cfg.id;
    legGroup.add(lower);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), metalMat);
    foot.scale.set(1, 1, 1.8);
    foot.position.set(0, -0.53, cfg.bend * 0.36);
    foot.rotation.x = Math.PI + cfg.bend * -0.9;
    foot.name = "foot_" + cfg.id;
    legGroup.add(foot);
    bodyGroup.add(legGroup);
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), accentMat);
  core.position.set(0, 0.54, 0.26);
  core.name = "core";
  bodyGroup.add(core);

  return [chassis, frontPlate];
}

BESPOKE_BUILDERS.maquina_de_guerra = buildMaquinaDeGuerraModel;
