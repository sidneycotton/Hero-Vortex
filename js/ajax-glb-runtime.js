/* Ajax GLB runtime
 * Replaces the old procedural Ajax model with the real GLB in assets/characters/ajax/ajax.glb.
 * Supports skinned/rigged meshes and plays an embedded idle animation when available.
 */
(function () {
  'use strict';

  const MODEL_URL = 'assets/characters/ajax/ajax.glb';
  let sourceScene = null;
  let sourceAnimations = [];
  let loaderReady = false;
  const mixers = [];

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

  function disposeOldModel(unit) {
    if (!unit || !unit.model) return;
    const old = unit.model;
    scene.remove(old);
    old.traverse(o => {
      if (o.userData && o.userData.ajaxGLB) return;
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
    if (!unit || unit.defId !== 'ajax' || !sourceScene) return;

    const oldModel = unit.model;
    const position = oldModel.position.clone();
    const rotation = oldModel.rotation.clone();
    const scale = oldModel.scale.clone();

    const clone = THREE.SkeletonUtils
      ? THREE.SkeletonUtils.clone(sourceScene)
      : sourceScene.clone(true);

    clone.name = 'ajax_glb_root';
    clone.position.copy(position);
    clone.rotation.copy(rotation);
    clone.scale.copy(scale);
    clone.userData.ajaxGLB = true;

    clone.traverse(o => {
      o.userData.ajaxGLB = true;
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = !!renderer.shadowMap.enabled;
        o.receiveShadow = !!renderer.shadowMap.enabled;
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { m.side = THREE.FrontSide; });
        }
      }
    });

    // The old animation system expects these handles. Point them at sensible
    // nodes in the imported model instead of falling back to primitive parts.
    unit.model = clone;
    unit.body = clone;
    unit.core = findNamed(clone, ['core', 'Core', 'chest', 'Chest']) || clone;
    unit.weapon = findNamed(clone, ['weapon', 'Weapon', 'right_hand', 'RightHand']) || null;

    // Keep the hit point/camera framing close to the existing character scale.
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y > 0) {
      const targetHeight = 2.25;
      const s = targetHeight / size.y;
      clone.scale.multiplyScalar(s);
      clone.position.y -= center.y * s;
    }

    scene.add(clone);

    // If the GLB contains animation clips, use an embedded Idle/first clip.
    if (sourceAnimations.length && THREE.AnimationMixer) {
      const mixer = new THREE.AnimationMixer(clone);
      const preferred = sourceAnimations.find(a => /idle|breath|stand/i.test(a.name)) || sourceAnimations[0];
      const action = mixer.clipAction(preferred);
      action.reset().play();
      mixers.push(mixer);
      unit._ajaxMixer = mixer;
    }

    if (oldModel && oldModel !== clone) {
      scene.remove(oldModel);
      oldModel.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => m.dispose());
        }
      });
    }

    unit._ajaxGLBLoaded = true;
  }

  function replaceAllAjax() {
    if (typeof playerUnits !== 'undefined') playerUnits.filter(u => u.defId === 'ajax').forEach(replaceAjaxModel);
    if (typeof enemyUnits !== 'undefined') enemyUnits.filter(u => u.defId === 'ajax').forEach(replaceAjaxModel);
  }

  function start() {
    ensureLoaders()
      .then(loadGLB)
      .then(gltf => {
        sourceScene = gltf.scene;
        sourceAnimations = gltf.animations || [];
        replaceAllAjax();
        console.info('[Hero Vortex] Ajax GLB loaded:', MODEL_URL, 'animations:', sourceAnimations.length);
      })
      .catch(err => {
        console.error('[Hero Vortex] Ajax GLB failed; procedural fallback remains active.', err);
      });
  }

  // Mixers run alongside the game's existing render loop.
  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    mixers.forEach(m => m.update(dt));
    requestAnimationFrame(tick);
  }

  // The main game script creates its units before DOMContentLoaded. Waiting
  // until the document is ready guarantees playerUnits/enemyUnits exist.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  requestAnimationFrame(tick);
})();
