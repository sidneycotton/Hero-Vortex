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

// Ground — procedural stone-tile texture (canvas-based, no external assets)
// so the arena reads as a physical place instead of a flat dark disc.
function makeStoneFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5248';
  ctx.fillRect(0, 0, size, size);
  // tile grid
  const tiles = 8;
  const tileSize = size / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = 82 + Math.floor(Math.random() * 22) - 11;
      ctx.fillStyle = `rgb(${shade + 8},${shade},${shade - 10})`;
      ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
    }
  }
  // mortar lines
  ctx.strokeStyle = 'rgba(20,16,12,0.55)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * tileSize, 0); ctx.lineTo(i * tileSize, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * tileSize); ctx.lineTo(size, i * tileSize); ctx.stroke();
  }
  // subtle speckle for wear/texture
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}
const groundGeo = new THREE.CircleGeometry(16, 48);
const groundMat = new THREE.MeshStandardMaterial({ map: makeStoneFloorTexture(), color: 0xffffff, roughness: 0.85, metalness: 0.05 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// outer rim ring so the arena reads as a bounded stage
const rimGeo = new THREE.RingGeometry(15.5, 16, 64);
const rimMat = new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.8 });
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.005;
scene.add(rim);

// Sky — gradient dome so the horizon isn't just fog fading to nothing
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4a5d7a');
  grad.addColorStop(0.5, '#8a7a5e');
  grad.addColorStop(1, '#c9a96a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}
const skyGeo = new THREE.SphereGeometry(60, 24, 16);
const skyMat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Distant hill silhouettes ringing the arena, so there's a horizon instead
// of the floor disc vanishing straight into fog
const hillMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 1 });
for (let i = 0; i < 14; i++) {
  const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
  const dist = 24 + Math.random() * 8;
  const hill = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 3, 5 + Math.random() * 4, 6), hillMat);
  hill.position.set(Math.cos(ang) * dist, 1, Math.sin(ang) * dist);
  hill.rotation.y = Math.random() * Math.PI;
  scene.add(hill);
}

// Stone pillars ringing the arena edge to give the space a built, roofed-
// stage feel rather than an empty plain
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.75 });
const pillarCapMat = new THREE.MeshStandardMaterial({ color: 0x5a5040, roughness: 0.7 });
for (let i = 0; i < 8; i++) {
  const ang = (i / 8) * Math.PI * 2;
  const dist = 13.5;
  const pillarGroup = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4, 8), pillarMat);
  shaft.position.y = 2;
  shaft.castShadow = true;
  pillarGroup.add(shaft);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), pillarCapMat);
  cap.position.y = 4.15;
  pillarGroup.add(cap);
  const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 0.8 }));
  brazier.position.y = 4.4;
  pillarGroup.add(brazier);
  pillarGroup.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
  scene.add(pillarGroup);
}

// Center divide glow ring
const ringGeo = new THREE.RingGeometry(3.5, 3.85, 48);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcf6b, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
const centerRing = new THREE.Mesh(ringGeo, ringMat);
centerRing.rotation.x = -Math.PI / 2;
centerRing.position.y = 0.02;
scene.add(centerRing);

// team-tinted floor washes so each side of the arena reads at a glance
const playerWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 0.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.06 }));
playerWash.rotation.x = -Math.PI / 2;
playerWash.position.y = 0.015;
scene.add(playerWash);
const enemyWash = new THREE.Mesh(new THREE.CircleGeometry(15, 32, Math.PI * 1.5, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.06 }));
enemyWash.rotation.x = -Math.PI / 2;
enemyWash.position.y = 0.015;
scene.add(enemyWash);

// (grid helper removed — the stone tile texture now provides floor structure)

// Lighting
const ambient = new THREE.AmbientLight(0x6b6050, 0.6);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.0);
keyLight.position.set(4, 10, 6);
keyLight.castShadow = renderer.shadowMap.enabled;
if (keyLight.castShadow) {
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
}
scene.add(keyLight);

// Team-colored rim lights
const playerLight = new THREE.PointLight(0x4fd1c5, 1.1, 14);
playerLight.position.set(0, 3, 6);
scene.add(playerLight);

const enemyLight = new THREE.PointLight(0xff6b6b, 1.1, 14);
enemyLight.position.set(0, 3, -6);
scene.add(enemyLight);

function onResize() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

