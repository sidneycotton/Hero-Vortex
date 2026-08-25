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

  // IMPORTANT: index.html builds BESPOKE_BUILDERS once during script
  // evaluation. Replacing window.buildAjaxModel later does NOT update that
  // registry automatically. The previous version therefore never reached
  // this GLB-backed builder and kept using the original primitive Ajax.
  loaderReady = addScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/GLTFLoader.js')
    .then(() => addScript('js/ajax-model-asset.js'))
    .catch(err => {
      console.error('[Ajax 3D] loader setup failed', err);
      throw err;
    });

  const originalBuilder = (typeof window.buildAjaxModel === 'function')
    ? window.buildAjaxModel
    : null;

  window.buildAjaxModel = function ajax3dBuilder(bodyGroup, mainMat, accentMat, def) {
    const anchor = new THREE.Group();
    anchor.name = 'ajax_model_anchor';
    bodyGroup.add(anchor);

    const core = new THREE.Group();
    core.name = 'core';
    bodyGroup.add(core);

    let fallback = null;
    if (originalBuilder) {
      try {
        fallback = originalBuilder(bodyGroup, mainMat, accentMat, def);
      } catch (e) {
        console.warn('[Ajax 3D] primitive fallback builder failed', e);
      }
    }

    const install = () => {
      if (modelReady) return modelReady;

      modelReady = loaderReady.then(() => new Promise((resolve, reject) => {
        if (typeof window.loadAjaxGameModel !== 'function') {
          reject(new Error('loadAjaxGameModel unavailable'));
          return;
        }

        window.loadAjaxGameModel((sceneRoot) => {
          try {
            sceneRoot.name = 'AjaxGLB';
            sceneRoot.scale.setScalar(1.0);

            sceneRoot.traverse(obj => {
              if (!obj.isMesh) return;
              obj.castShadow = true;
              obj.receiveShadow = true;
              if (obj.material && obj.material.map && THREE.SRGBColorSpace) {
                obj.material.map.colorSpace = THREE.SRGBColorSpace;
              }
            });

            anchor.add(sceneRoot);

            const weaponHook = new THREE.Group();
            weaponHook.name = 'weapon';
            sceneRoot.add(weaponHook);

            if (fallback) {
              [...bodyGroup.children].forEach(child => {
                if (child !== anchor && child !== core) {
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

            const outlineMat = new THREE.MeshBasicMaterial({
              color: 0x000000,
              side: THREE.BackSide
            });
            sceneRoot.traverse(o => {
              if (!o.isMesh || o.userData.isOutline) return;
              const outline = new THREE.Mesh(o.geometry, outlineMat);
              outline.scale.multiplyScalar(1.035);
              outline.userData.isOutline = true;
              outline.renderOrder = -1;
              o.add(outline);
            });

            window.__AJAX_3D_LAST_ERROR = null;
            console.log('[Ajax 3D] GLB installed successfully', sceneRoot);
            resolve(sceneRoot);
          } catch (err) {
            reject(err);
          }
        }, reject);
      })).catch(err => {
        window.__AJAX_3D_LAST_ERROR = String(err && err.message ? err.message : err);
        console.error('[Ajax 3D] GLB load failed', err);
        throw err;
      });

      return modelReady;
    };

    install().catch(() => {});
    return fallback || [];
  };

  // CRITICAL: refresh the registry that buildUnitModel() actually consults.
  if (typeof BESPOKE_BUILDERS === 'object' && BESPOKE_BUILDERS) {
    BESPOKE_BUILDERS.ajax = window.buildAjaxModel;
  }

  window.AJAX_3D_STATUS = () => ({
    loaderReady: !!loaderReady,
    ready: !!modelReady,
    error: window.__AJAX_3D_LAST_ERROR || null
  });
})();
