(() => {
  let loaderReady = null;
  let modelReady = null;

  function addScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  loaderReady = addScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/GLTFLoader.js')
    .then(() => addScript('js/ajax-model-asset.js'))
    .catch(err => console.error('Ajax 3D runtime setup failed', err));

  const originalBuilder = window.buildAjaxModel;

  // Replace the primitive Ajax builder with an asynchronous, game-ready
  // GLB-backed builder. buildUnitModel() is still synchronous, so it creates
  // a lightweight anchor immediately and swaps the real model in when ready.
  window.buildAjaxModel = function ajax3dBuilder(bodyGroup, mainMat, accentMat, def) {
    const anchor = new THREE.Group();
    anchor.name = 'ajax_model_anchor';
    bodyGroup.add(anchor);

    // Named hooks retained for the existing animation code.
    const core = new THREE.Group();
    core.name = 'core';
    bodyGroup.add(core);

    // Keep the old fallback available until the real mesh has arrived. This
    // prevents a blank character if a browser/network blocks the loader.
    let fallback = null;
    if (typeof originalBuilder === 'function') {
      try {
        fallback = originalBuilder(bodyGroup, mainMat, accentMat, def);
      } catch (e) {
        console.warn('Ajax fallback builder failed', e);
      }
    }

    const install = () => {
      if (modelReady) return modelReady;
      modelReady = loaderReady.then(() => new Promise((resolve, reject) => {
        if (typeof loadAjaxGameModel !== 'function') return reject(new Error('loadAjaxGameModel unavailable'));
        loadAjaxGameModel((sceneRoot) => {
          sceneRoot.name = 'AjaxGLB';
          // The generated GLB is authored in the same world orientation as
          // Hero Vortex: Y-up, front toward +Z. Player/enemy root rotation
          // is handled by Unit just like every other unit.
          sceneRoot.scale.setScalar(1.0);
          sceneRoot.traverse(obj => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              if (obj.material && obj.material.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          });
          anchor.add(sceneRoot);

          // A tiny hidden weapon hook lets the existing combat animation
          // system keep its generic contract without needing a visible prop.
          const weaponHook = new THREE.Group();
          weaponHook.name = 'weapon';
          sceneRoot.add(weaponHook);

          if (fallback) {
            // Remove the procedural Ajax pieces after the real model is in.
            const fallbackRoot = fallback[0]?.parent?.parent || null;
            // The fallback builder adds directly to bodyGroup; identify its
            // named top-level meshes/groups and remove everything except our
            // two hooks and the loaded anchor.
            [...bodyGroup.children].forEach(child => {
              if (child !== anchor && child !== core && child !== sceneRoot) {
                bodyGroup.remove(child);
                child.traverse(o => {
                  if (o.geometry) o.geometry.dispose();
                  if (o.material && o.material !== mainMat && o.material !== accentMat) {
                    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                    else o.material.dispose();
                  }
                });
              }
            });
          }

          // Re-run the same per-mesh outline policy used by the rest of the
          // game, but only on the newly loaded Ajax hierarchy.
          const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
          sceneRoot.traverse(o => {
            if (!o.isMesh || o.userData.isOutline) return;
            const outline = new THREE.Mesh(o.geometry, outlineMat);
            outline.scale.multiplyScalar(1.035);
            outline.userData.isOutline = true;
            outline.renderOrder = -1;
            o.add(outline);
          });

          resolve(sceneRoot);
        }, reject);
      }));
      return modelReady;
    };

    install().catch(err => {
      console.warn('Ajax GLB load failed; keeping procedural fallback.', err);
    });

    return fallback || [];
  };

  window.AJAX_3D_STATUS = () => ({ ready: !!modelReady, loading: !!loaderReady });
})();
