/* Ajax: playable white-shark humanoid. No GLB, no external assets. */
function createAjaxPS3Model(THREE) {
  const root = new THREE.Group();
  root.name = 'Ajax_White_Shark';

  const mat = (color, roughness = 0.62, metalness = 0.0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const sharkTop = mat(0x8f9ca5, 0.72);
  const sharkWhite = mat(0xe8edf0, 0.66);
  const sharkDark = mat(0x26323a, 0.78);
  const mouth = mat(0x20242a, 0.9);
  const teeth = mat(0xfaf7e8, 0.38);
  const pants = mat(0x263d68, 0.82);
  const pantsLight = mat(0x3e5f92, 0.72);
  const eye = mat(0x080b0d, 0.18, 0.05);
  const iris = mat(0xc9d7df, 0.22, 0.1);

  function add(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh; }
  function box(x,y,z,m,px=0,py=0,pz=0) {
    const o = add(new THREE.Mesh(new THREE.BoxGeometry(x,y,z),m));
    o.position.set(px,py,pz); return o;
  }
  function sphere(sx,sy,sz,m,px=0,py=0,pz=0) {
    const o = add(new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m));
    o.scale.set(sx,sy,sz); o.position.set(px,py,pz); return o;
  }
  function cyl(r,h,m,px=0,py=0,pz=0) {
    const o = add(new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m));
    o.position.set(px,py,pz); return o;
  }
  function cone(r,h,m,px=0,py=0,pz=0,rx=0,ry=0,rz=0) {
    const o = add(new THREE.Mesh(new THREE.ConeGeometry(r,h,20),m));
    o.position.set(px,py,pz); o.rotation.set(rx,ry,rz); return o;
  }

  // Legs: human proportions, shark feet, and blue pants.
  cyl(.23,.72,sharkWhite,-.24,0,.42);
  cyl(.23,.72,sharkWhite,.24,0,.42);
  box(.44,.68,.42,pants,-.24,0,1.02);
  box(.44,.68,.42,pants,.24,0,1.02);
  box(.56,.22,.78,sharkDark,-.24,-.02,.02);
  box(.56,.22,.78,sharkDark,.24,-.02,.02);

  // Waist and pants belt.
  box(.88,.42,.52,pants,0,0,1.43);
  box(.94,.12,.56,pantsLight,0,-.02,1.68);

  // Broad shark torso with white belly and grey back.
  sphere(.72,.46,.96,sharkTop,0,0,2.27);
  sphere(.54,.47,.70,sharkWhite,0,-.37,2.22);

  // Arms, fins/hands.
  cyl(.24,.72,sharkTop,-.78,0,2.20);
  cyl(.24,.72,sharkTop,.78,0,2.20);
  sphere(.27,.23,.30,sharkWhite,-.78,0,1.77);
  sphere(.27,.23,.30,sharkWhite,.78,0,1.77);
  cone(.30,.75,sharkTop,-1.02,0,2.48,0,0,-Math.PI/2);
  cone(.30,.75,sharkTop,1.02,0,2.48,0,0,Math.PI/2);

  // Shark head and long snout.
  sphere(.56,.48,.54,sharkTop,0,0,3.38);
  sphere(.43,.36,.28,sharkWhite,0,-.30,3.34);
  sphere(.46,.33,.32,mouth,0,-.42,3.27);

  // Snout: unmistakably shark-like from the front/side.
  sphere(.40,.34,.22,sharkTop,0,-.45,3.34);

  // Teeth along the mouth.
  for (let i=-2;i<=2;i++) {
    const x=i*.13;
    cone(.065,.18,teeth,x,-.49,3.25,0,0,0);
  }

  // Eyes and small pupils.
  [-1,1].forEach(side => {
    sphere(.105,.09,.105,iris,side*.37,-.39,3.52);
    sphere(.045,.04,.045,eye,side*.39,-.45,3.53);
  });

  // Dorsal fin and tail fin.
  cone(.42,.90,sharkDark,0,.10,3.96,0,0,0);
  cone(.52,.95,sharkTop,0,.12,1.62,Math.PI/2,0,0);

  // Side gill marks.
  for (let i=0;i<3;i++) {
    const g = box(.045,.18,.34,sharkDark,-.49,-.38,3.12-i*.11);
    g.rotation.z = -0.18;
    const h = box(.045,.18,.34,sharkDark,.49,-.38,3.12-i*.11);
    h.rotation.z = 0.18;
  }

  root.userData.hero = 'ajax';
  root.userData.pipeline = 'ajax-dedicated-white-shark';
  return root;
}
window.createAjaxPS3Model = createAjaxPS3Model;
