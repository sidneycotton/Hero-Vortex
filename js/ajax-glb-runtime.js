/* Ajax GLB runtime
 * Replaces the old procedural Ajax model with the real GLB in assets/characters/ajax/ajax.glb.
 * Supports skinned/rigged meshes and embedded animations.
 */
(function () {
  'use strict';

  const MODEL_URL = 'assets/characters/ajax/ajax.glb';
  const TARGET_HEIGHT = 2.25;
  let sourceScene = null;
  let sourceAnimations = [];
  let loaderReady = false;
  const mixers = [];
  const replaced = new WeakSet();

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
      loader.load(
        MODEL_URL,
        gltf => resolve(gltf),
        undefined,
        err => reject(err || new Error('Ajax GLB failed to load'))
      );
    });
  }

  function findNamed(root, names) {
    let found = null;
    root.traverse(o => {
      if (!found && names.includes(o.name)) found = o;
    });
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

  function replaceAjaxModel(unit) {
    if (!unit || unit.defId !== 'ajax' || !sourceScene || replaced.has(unit)) return;

    const oldModel = unit.model;
    if (!oldModel) return;

    const position = oldModel.position.clone();
    const rotation = oldModel.rotation.clone();

    // SkeletonUtils.clone is important for SkinnedMesh/Skeleton hierarchies.
    const clone = THREE.SkeletonUtils
      ? THREE.SkeletonUtils.clone(sourceScene)
      : sourceScene.clone(true);

    clone.name = 'ajax_glb_root';
    clone.position.copy(position);
    clone.rotation.copy(rotation);
    clone.userData.ajaxGLB = true;

    // Normalize the imported model to the same approximate battlefield height
    // as the existing characters, while placing its feet on the ground.
    const rawBox = new THREE.Box3().setFromObject(clone);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (rawSize.y > 0) {
      const scale = TARGET_HEIGHT / rawSize.y;
      clone.scale.setScalar(scale);
      clone.position.y -= rawBox.min.y * scale;
    }

    clone.traverse(o => {
      o.userData.ajaxGLB = true;
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = !!renderer.shadowMap.enabled;
        o.receiveShadow = !!renderer.shadowMap.enabled;
      }
    });

    // The existing animation code expects these handles. Point them at
    // sensible imported nodes so combat animation still works.
    unit.model = clone;
    unit.body = clone;
    unit.core = findNamed(clone, ['core', 'Core', 'chest', 'Chest']) || clone;
    unit.weapon = findNamed(clone, ['weapon', 'Weapon', 'right_hand', 'RightHand', 'hand.R', 'Hand.R']) || null;

    scene.add(clone);

    if (sourceAnimations.length && THREE.AnimationMixer) {
      const mixer = new THREE.AnimationMixer(clone);
      const preferred = sourceAnimations.find(a => /idle|breath|stand/i.test(a.name)) || sourceAnimations[0];
      mixer.clipAction(preferred).reset().play();
      mixers.push(mixer);
      unit._ajaxMixer = mixer;
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
    // The game does NOT create its Unit objects until the player finishes the
    // team-selection screen and calls initGame(). DOMContentLoaded is therefore
    // too early. Poll briefly after the GLB loads, then keep a lightweight
    // observer alive for restarts/summons.
    const deadline = performance.now() + 30000;
    const poll = () => {
      const count = replaceAllAjax();
      if (count > 0) {
        console.info('[Hero Vortex] Ajax GLB active:', MODEL_URL, 'animations:', sourceAnimations.length);
      }
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
      .catch(err => {
        console.error('[Hero Vortex] Ajax GLB failed; procedural fallback remains active.', err);
      });
  }

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    mixers.forEach(m => m.update(dt));
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  requestAnimationFrame(tick);
})();
