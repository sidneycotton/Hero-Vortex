// =============================================================
// ============ SECTION 2: THREE.JS SCENE SETUP ================
// =============================================================

const canvasWrap = document.getElementById('canvas-wrap');
// `let` (not `const`) so the team-select deck preview can temporarily point
// MoveLibrary's impact flourishes (which all reference this module-level
// `scene`) at its own separate preview scene while playing an ability
// showcase animation, then restore it — see js/team-select.js's
// playAbilityPreview / withPreviewScene.
let scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1610, 0.02);

const camera = new THREE.PerspectiveCamera(45, canvasWrap.clientWidth / canvasWrap.clientHeight, 0.1, 100);
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 700;
const CAMERA_LOOK_AT = new THREE.Vector3(0, 1, 0);
camera.position.set(0, isMobile ? 9.5 : 8, isMobile ? 14.5 : 12);
camera.lookAt(CAMERA_LOOK_AT);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 2 : 2));
renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
renderer.shadowMap.enabled = !isMobile; // skip shadows on mobile for perf
if (renderer.shadowMap.enabled) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasWrap.appendChild(renderer.domElement);

// ------------------------------------------------------------
// Battlefield — everything scenery-related (ground, sky, props,
// hills, pillars, ambient/key/rim lights) now lives in
// js/battlefields/*.js, one file per themed arena. This initial
// build is just a placeholder so `scene` isn't empty before the
// first match starts — js/planning-ui.js's initGame() is what
// actually calls rebuildBattlefield() at the start of every match
// (including the first), which is also what makes main-menu.js's
// "Choose Battlefield" popup take effect (that choice is only made
// AFTER this file has already run once at page load).
// `let` (not `const`) since initGame reassigns both on every rebuild;
// other files (e.g. effects.js) reference these two lights by name.
// ------------------------------------------------------------
const battlefieldRefs = buildBattlefield(scene, renderer);
let playerLight = battlefieldRefs.playerLight;
let enemyLight = battlefieldRefs.enemyLight;

function onResize() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

