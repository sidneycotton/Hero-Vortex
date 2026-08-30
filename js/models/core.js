// ============ SECTION 5: STYLIZED PRIMITIVE MODELS ============
// =============================================================
// Named model components, matching the Babawibby MVP pattern of
// building characters from labeled primitive parts so animations
// can target specific named pieces (e.g. "core", "weaponArm").

// ---- Bespoke per-card archetype builders -----------------------------
// Each takes (bodyGroup, mainMat, accentMat, def) and returns the outline
// candidates for that build (parts that should get the toon-outline
// backface pass). They add their own named parts directly to bodyGroup,
// including a "core" and (optionally) a "weapon" — those two names are
// read elsewhere (combat-engine pulse/bob animation, attack recoil), so
// any bespoke build should include a mesh named "core" at minimum.
// Keep these fully custom (not calling into the shared brute/caster
// helpers) — that's the point of a bespoke archetype. Register new ones
// in BESPOKE_BUILDERS below and set `shape: "<key>"` on the unit def.

// r128 has no THREE.CapsuleGeometry (added upstream in r142), so this
// helper builds a capsule-like shape from a cylinder + two sphere caps
// combined in a Group. A Group supports .position/.rotation/.scale/.name/
// .castShadow the same way a Mesh does, so it's a drop-in replacement
// anywhere the bespoke builders below want a rounded limb/torso.
function makeCapsule(radius, length, mat) {
  const group = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), mat);
  cyl.castShadow = true;
  group.add(cyl);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat);
  capTop.position.y = length / 2;
  capTop.castShadow = true;
  group.add(capTop);
  const capBottom = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat);
  capBottom.position.y = -length / 2;
  capBottom.castShadow = true;
  group.add(capBottom);
  group.castShadow = true;
  return group;
}


const BESPOKE_BUILDERS = {};
