/* Ajax model bridge: use the dedicated PS3-era-inspired Ajax prototype. */
let ajaxPS3ModelPromise = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureAjaxPS3ModelReady() {
  if (!ajaxPS3ModelPromise) {
    ajaxPS3ModelPromise = loadScriptOnce('assets/characters/ajax/ajax-model.js').then(() => {
      if (typeof window.createAjaxPS3Model !== 'function') {
        throw new Error('createAjaxPS3Model() was not exposed by the Ajax model asset.');
      }
    });
  }
  return ajaxPS3ModelPromise;
}

async function loadAjaxGameModel(onLoaded, onError) {
  try {
    await ensureAjaxPS3ModelReady();
    const model = window.createAjaxPS3Model(THREE);
    onLoaded(model, null);
  } catch (err) {
    console.error('[Ajax 3D] dedicated PS3 model load failed', err);
    if (onError) onError(err);
  }
}
