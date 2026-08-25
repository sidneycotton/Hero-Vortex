/* Ajax GLB runtime
 * Real Ajax character replacement for Hero Vortex.
 * Handles rigged/skinned GLBs, orientation, stable battlefield scale and
 * embedded animations. If the GLB has no clips, a lightweight bone-based
 * idle animation is generated from common humanoid bone names.
 */
(function () {
  'use strict';

  const MODEL_URL = 'assets/characters/ajax/ajax.glb';
  const TARGET_HEIGHT = 2.25;
  // The imported Ajax mesh is authored facing the battlefield direction already.
  // Do not add the old 180° correction: that made him face the viewer.
  const MODEL_Y_ROTATION = 0;
  let sourceScene = null;
  let sourceAnimations = [];
  let loaderReady = false;
  const mixers = [];
  const replaced = new WeakSet();
  const idleControllers = [];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLoaders() {
    if (loaderReady) return;
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js');
    loaderReady = true;
  }

  function loadGLB() {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      loader.load(MODEL_URL, resolve, undefined, err => reject(err || new Error('Ajax GLB failed to load')));
    });
  }

  function findNamed(root, names) {
    let found = null;
    root.traverse(o => { if (!found && names.includes(o.name)) found = o; });
    return found;
  }

  function disposeObject(root) {
    if (!root) return;
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (m.map) m.map.dispose();
          if (m.normalMap) m.normalMap.dispose();
          if (m.roughnessMap) m.roughnessMap.dispose();
          if (m.metalnessMap) m.metalnessMap.dispose();
          m.dispose();
        });
      }
    });
  }

  function boneByRegex(root, regex) {
    let found = null;
    root.traverse(o => { if (!found && o.isBone && regex.test(o.name)) found = o; });
    return found;
  }

  function makeProceduralIdle(root) {
    const bones = {
      hips: boneByRegex(root, /hips|pelvis|root/i),
      spine: boneByRegex(root, /spine|chest|torso/i),
      neck: boneByRegex(root, /neck/i),
      head: boneByRegex(root, /head/i),
      armL: boneByRegex(root, /(upperarm|arm|shoulder).*(l|left)|(^|[_ .-])l.*(arm|shoulder)/i),
      armR: boneByRegex(root, /(upperarm|arm|shoulder).*(r|right)|(^|[_ .-])r.*(arm|shoulder)/i),
      forearmL: boneByRegex(root, /(forearm|lowerarm).*(l|left)|(^|[_ .-])l.*forearm/i),
      forearmR: boneByRegex(root, /(forearm|lowerarm).*(r|right)|(^|[_ .-])r.*forearm/i),
      thighL: boneByRegex(root, /(thigh|upleg|upperleg).*(l|left)|(^|[_ .-])l.*(thigh|upleg)/i),
      thighR: boneByRegex(root, /(thigh|upleg|upperleg).*(r|right)|(^|[_ .-])r.*(thigh|upleg)/i)
    };
    const all = Object.values(bones).filter(Boolean);
    if (!all.length) return null;
    all.forEach(b => { b.userData.ajaxBaseRotation = b.rotation.clone(); });
    return { bones, time: Math.random() * 10 };
  }

  function updateProceduralIdle(ctrl, dt) {
    ctrl.time += dt;
    const t = ctrl.time;
    const b = ctrl.bones;
    const breath = Math.sin(t * 2.0) * 0.025;
    const sway = Math.sin(t * 0.9) * 0.035;
    const armSwing = Math.sin(t * 1.4) * 0.055;
    const legSwing = Math.sin(t * 1.4) * 0.025;
    const apply = (bone, x, y, z) => {
      if (!bone) return;
      const r = bone.userData.ajaxBaseRotation;
      bone.rotation.set(r.x + x, r.y + y, r.z + z);
    };
    apply(b.hips, breath * 0.25, sway * 0.2, sway);
    apply(b.spine, -breath * 0.35, 0, sway * 0.35);
    apply(b.neck, 0, 0, sway * 0.15);
    apply(b.head, 0, sway * 0.25, 0);
    apply(b.armL, armSwing, 0, -armSwing * 0.45);
    apply(b.armR, -armSwing, 0, armSwing * 0.45);
    apply(b.forearmL, -armSwing * 0.35, 0, 0);
    apply(b.forearmR, armSwing * 0.35, 0, 0);
    apply(b.thighL, legSwing, 0, 0);
    apply(b.thighR, -legSwing, 0, 0);
  }

  function replaceAjaxModel(unit) {
    if (!unit || unit.defId !== 'ajax' || !sourceScene || replaced.has(unit)) return;
    const oldModel = unit.model;
    if (!oldModel) return;

    const position = oldModel.position.clone();
    const rotation = oldModel.rotation.clone();
    const clone = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(sourceScene) : sourceScene.clone(true);

    clone.name = 'ajax_glb_root';
    clone.position.copy(position);
    clone.rotation.copy(rotation);
    clone.rotation.y += MODEL_Y_ROTATION;
    clone.userData.ajaxGLB = true;

    const rawBox = new THREE.Box3().setFromObject(clone);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const importedScale = rawSize.y > 0 ? TARGET_HEIGHT / rawSize.y : 1;
    clone.scale.setScalar(importedScale);
    clone.position.y -= rawBox.min.y * importedScale;
    clone.userData.ajaxBaseScale = importedScale;

    clone.traverse(o => {
      o.userData.ajaxGLB = true;
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = !!renderer.shadowMap.enabled;
        o.receiveShadow = !!renderer.shadowMap.enabled;
      }
    });

    unit.model = clone;
    unit.body = clone;
    unit.core = findNamed(clone, ['core', 'Core', 'chest', 'Chest']) || clone;
    unit.weapon = findNamed(clone, ['weapon', 'Weapon', 'right_hand', 'RightHand', 'hand.R', 'Hand.R']) || null;
    unit._ajaxBaseRotationY = clone.rotation.y;
    unit._ajaxBaseScale = importedScale;

    scene.add(clone);

    if (sourceAnimations.length && THREE.AnimationMixer) {
      const mixer = new THREE.AnimationMixer(clone);
      const preferred = sourceAnimations.find(a => /idle|breath|stand/i.test(a.name)) || sourceAnimations[0];
      mixer.clipAction(preferred).reset().play();
      mixers.push(mixer);
      unit._ajaxMixer = mixer;
    } else {
      const idle = makeProceduralIdle(clone);
      if (idle) idleControllers.push(idle);
      unit._ajaxIdleController = idle;
    }

    scene.remove(oldModel);
    disposeObject(oldModel);
    unit._ajaxGLBLoaded = true;
    replaced.add(unit);
  }

  function replaceAllAjax() {
    const rosters = [];
    if (typeof playerUnits !== 'undefined' && Array.isArray(playerUnits)) rosters.push(playerUnits);
    if (typeof enemyUnits !== 'undefined' && Array.isArray(enemyUnits)) rosters.push(enemyUnits);
    let count = 0;
    rosters.flat().filter(u => u && u.defId === 'ajax').forEach(u => {
      replaceAjaxModel(u);
      if (u._ajaxGLBLoaded) count++;
    });
    return count;
  }

  function waitForUnits() {
    const deadline = performance.now() + 30000;
    const poll = () => {
      const count = replaceAllAjax();
      if (count > 0) console.info('[Hero Vortex] Ajax GLB active:', MODEL_URL, 'animations:', sourceAnimations.length);
      if (performance.now() < deadline) requestAnimationFrame(poll);
    };
    poll();
  }

  function start() {
    ensureLoaders()
      .then(loadGLB)
      .then(gltf => {
        sourceScene = gltf.scene;
        sourceAnimations = gltf.animations || [];
        console.info('[Hero Vortex] Ajax GLB downloaded:', MODEL_URL, 'animations:', sourceAnimations.length);
        waitForUnits();
      })
      .catch(err => console.error('[Hero Vortex] Ajax GLB failed; procedural fallback remains active.', err));
  }

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const rosters = [];
    if (typeof playerUnits !== 'undefined' && Array.isArray(playerUnits)) rosters.push(playerUnits);
    if (typeof enemyUnits !== 'undefined' && Array.isArray(enemyUnits)) rosters.push(enemyUnits);
    rosters.flat().filter(u => u && u._ajaxGLBLoaded && u.model).forEach(u => {
      const s = u._ajaxBaseScale || 1;
      u.model.scale.setScalar(s);
      if (typeof u._ajaxBaseRotationY === 'number') u.model.rotation.y = u._ajaxBaseRotationY;
    });

    mixers.forEach(m => m.update(dt));
    idleControllers.forEach(c => updateProceduralIdle(c, dt));
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  requestAnimationFrame(tick);
})();