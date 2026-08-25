/* Ajax 3D runtime: load the generated GLB hero model. */
(() => {
  let ready = null;

  function loadAjaxModel() {
    if (!ready) {
      ready = new Promise((resolve, reject) => {
        const load = () => {
          if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function') return resolve();
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/GLTFLoader.js';
          s.onload = () => typeof THREE.GLTFLoader === 'function' ? resolve() : reject(new Error('GLTFLoader unavailable'));
          s.onerror = () => reject(new Error('Failed to load GLTFLoader'));
          document.head.appendChild(s);
        };
        load();
      });
    }
    return ready;
  }

  const original = BESPOKE_BUILDERS.ajax;
  BESPOKE_BUILDERS.ajax = function ajax3dBuilder(bodyGroup, mainMat, accentMat, def) {
    const anchor = new THREE.Group();
    anchor.name = 'ajax_model_anchor';
    bodyGroup.add(anchor);
    if (typeof original === 'function') {
      try { original(bodyGroup, mainMat, accentMat, def); } catch (e) {}
    }

    loadAjaxModel().then(() => new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      loader.load('assets/characters/ajax/ajax.glb', gltf => resolve(gltf.scene), undefined, reject);
    })).then(model => {
      model.name = 'Ajax_GLTF';
      model.scale.setScalar(1);
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      anchor.add(model);
      [...bodyGroup.children].forEach(child => {
        if (child === anchor) return;
        bodyGroup.remove(child);
        child.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
      });
      window.__AJAX_3D_LAST_ERROR = null;
      window.__AJAX_3D_STATUS = 'ready';
      console.log('[Ajax 3D] GLB MODEL INSTALLED', model);
    }).catch(err => {
      window.__AJAX_3D_LAST_ERROR = String(err.message || err);
      window.__AJAX_3D_STATUS = 'error';
      console.error('[Ajax 3D] GLB installation failed', err);
    });
    return [];
  };
})();
