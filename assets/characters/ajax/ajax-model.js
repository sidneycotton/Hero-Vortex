/* Ajax: first-pass PS3-era-inspired character model.
 * Deliberately separate from the legacy bespoke hero renderer.
 * This is the visual prototype that will be replaced by ajax.glb once the
 * final authored asset is available.
 */
function createAjaxPS3Model(THREE) {
  const root = new THREE.Group();
  root.name = 'Ajax_PS3_Model';

  const mat = (color, roughness = 0.58, metalness = 0.15) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const armor = mat(0x36698c, 0.46, 0.35);
  const armorLight = mat(0x69b4d7, 0.38, 0.42);
  const dark = mat(0x192630, 0.72, 0.22);
  const steel = mat(0x737d87, 0.38, 0.72);
  const gold = mat(0xbe9141, 0.32, 0.78);
  const skin = mat(0xa0694e, 0.7, 0.0);
  const cloth = mat(0x822828, 0.82, 0.0);

  const box = (x,y,z,material,px=0,py=0,pz=0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x,y,z), material);
    m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true; root.add(m); return m;
  };
  const sphere = (x,y,z,material,px=0,py=0,pz=0) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1,18,12), material);
    m.scale.set(x,y,z); m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true; root.add(m); return m;
  };
  const cyl = (r,h,material,px=0,py=0,pz=0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12), material);
    m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true; root.add(m); return m;
  };

  // Boots, legs and pelvis.
  box(.48,.72,.28,dark,-.23,0,.14); box(.48,.72,.28,dark,.23,0,.14);
  cyl(.21,.65,armor,-.23,0,.62); cyl(.21,.65,armor,.23,0,.62);
  cyl(.27,.65,dark,-.23,0,1.25); cyl(.27,.65,dark,.23,0,1.25);
  box(.76,.52,.38,dark,0,0,1.66); box(.58,.55,.18,gold,0,-.02,1.84);

  // Layered chest armor for a readable console-game silhouette.
  box(1.16,.60,1.05,armor,0,0,2.36);
  box(.86,.70,.55,armorLight,0,-.05,2.56);
  box(.44,.72,.18,steel,0,-.08,2.83);
  box(.12,.72,.14,gold,-.40,0,2.91); box(.12,.72,.14,gold,.40,0,2.91);
  sphere(.34,.38,.31,armorLight,-.72,0,2.62); sphere(.34,.38,.31,armorLight,.72,0,2.62);

  // Arms and plated forearms.
  cyl(.21,.56,armor,-.83,0,2.12); cyl(.21,.56,armor,.83,0,2.12);
  cyl(.18,.58,steel,-.83,0,1.56); cyl(.18,.58,steel,.83,0,1.56);
  sphere(.18,.18,.18,skin,-.83,0,1.22); sphere(.18,.18,.18,skin,.83,0,1.22);

  // Head, helmet, visor and cheek guards.
  cyl(.16,.22,skin,0,0,3.02);
  sphere(.43,.40,.48,skin,0,0,3.42);
  sphere(.47,.43,.28,armor,0,0,3.62);
  box(.62,.14,.18,dark,0,-.40,3.45);
  box(.18,.25,.30,steel,-.38,-.02,3.40); box(.18,.25,.30,steel,.38,-.02,3.40);
  box(.12,.30,.30,armorLight,0,0,3.88);

  // Distinctive red back tabard and weapon.
  box(.78,.10,.95,cloth,0,.38,2.18);
  const sword = box(.10,.12,1.15,steel,.98,.02,2.0); sword.rotation.y=-0.21;
  box(.18,.20,.12,gold,.83,.02,1.42);
  const grip = box(.10,.12,.40,dark,.75,.02,1.18); grip.rotation.y=-0.21;

  root.userData.hero = 'ajax';
  root.userData.pipeline = 'ajax-dedicated';
  return root;
}
