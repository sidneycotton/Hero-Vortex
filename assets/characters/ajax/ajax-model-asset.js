/* Ajax GLB bridge. Loads the generated GLB model from the main branch. */
let ajaxGameModelPromise = null;

function loadAjaxGameModel(onLoaded, onError) {
  if (!ajaxGameModelPromise) {
    ajaxGameModelPromise = new Promise((resolve, reject) => {
      if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
        reject(new Error('THREE.GLTFLoader is not available'));
        return;
      }
      const loader = new THREE.GLTFLoader();
      loader.load('assets/characters/ajax/ajax.glb', gltf => resolve(gltf.scene), undefined, reject);
    });
  }
  ajaxGameModelPromise.then(model => onLoaded(model)).catch(err => { if (onError) onError(err); });
}
