/* Ajax 3D runtime: use the self-contained white-shark model. */
(() => {
  let ready = null;

  function loadAjaxModel() {
    if (!ready) {
      ready = new Promise((resolve, reject) => {
        if (typeof window.createAjaxPS3Model === 'function') return resolve();
        const s = document.createElement('script');
        s.src = 'assets/characters/ajax/ajax-model.js';
        s.onload = () => typeof window.createAjaxPS3Model === 'function'
          ? resolve()
          : reject(new Error('Ajax model loaded but createAjaxPS3Model is missing'));
        s.onerror = () => reject(new Error('Failed to load Ajax model'));
        document.head.appendChild(s);
      });
    }
    return ready;
  }

  const original = BESPOKE_BUILDERS.ajax;
  BESPOKE_BUILDERS.ajax = function ajax3dBuilder(bodyGroup, mainMat, accentMat, def) {
    const anchor = new THREE.Group();
    anchor.name = 'ajax_model_anchor';
    bodyGroup.add(anchor);

    let fallback = [];
    if (typeof original === 'function') {
      try { fallback = original(bodyGroup, mainMat, accentMat, def) || []; } catch (e) {}
    }

    loadAjaxModel().then(() => {
      const model = window.createAjaxPS3Model(THREE);
      model.name = 'Ajax_White_Shark';
      model.scale.setScalar(1);
      model.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      anchor.add(model);

      [...bodyGroup.children].forEach(child => {
        if (child === anchor) return;
        bodyGroup.remove(child);
        child.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
            else if (o.material.dispose) o.material.dispose();
          }
        });
      });

      window.__AJAX_3D_LAST_ERROR = null;
      window.__AJAX_3D_STATUS = 'ready';
      console.log('[Ajax 3D] WHITE SHARK MODEL INSTALLED', model);
    }).catch(err => {
      window.__AJAX_3D_LAST_ERROR = String(err.message || err);
      window.__AJAX_3D_STATUS = 'error';
      console.error('[Ajax 3D] model installation failed', err);
    });

    return fallback;
  };
})();
