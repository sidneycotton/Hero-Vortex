// Minimal fake THREE.js stub, just enough surface area for
// js/models.js's bespoke builders to run headlessly under plain Node
// (no WebGL, no real geometry math) so validateUnitModel() can be
// exercised in tests/model-regression.js without a browser.
//
// This does NOT attempt to be a faithful three.js reimplementation —
// it only needs to support the calls the builders actually make:
// construct a mesh/group with a geometry+material, position/rotation/
// scale as plain vector-ish objects, .add()/.getObjectByName()/
// .traverse() tree operations, and Object3D naming. Anything a builder
// calls that isn't stubbed here will throw a clear "not implemented"
// error rather than silently doing the wrong thing — that's a real
// finding (see handoff.md Step 8's "a rotation method not stubbed
// correctly" bug class) and should be fixed in this stub, not swallowed.

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}

class Euler {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

class Color {
  constructor(hex) { this.set(hex !== undefined ? hex : 0xffffff); }
  set(hex) {
    if (typeof hex === 'number') this.hex = hex;
    else if (hex instanceof Color) this.hex = hex.hex;
    else this.hex = 0xffffff;
    return this;
  }
  clone() { return new Color(this.hex); }
  multiplyScalar() { return this; } // darken-tint no-op; the real bug this
  // is standing in for (see handoff.md) is a clone LOSING .color entirely,
  // which validateUnitModel checks for structurally, not numerically.
  lerp() { return this; } // blend-toward-color no-op, same rationale as multiplyScalar above.
  getHex() { return this.hex; }
}

let uidCounter = 0;

class Object3D {
  constructor() {
    this.id = uidCounter++;
    this.name = '';
    this.children = [];
    this.parent = null;
    this.position = new Vector3();
    this.rotation = new Euler();
    this.scale = new Vector3(1, 1, 1);
    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.userData = {};
  }
  add(...objs) {
    // Real three.js's Object3D.add(object) takes only object arguments —
    // any extra non-Object3D args (e.g. a stray string) are silently
    // ignored, not used as a rename. Matching that exactly here (rather
    // than "fixing" it) is deliberate: this stub's job is to reproduce
    // real THREE semantics so bugs like a dropped rename surface as an
    // actual validateUnitModel finding (a missing mesh name), not get
    // silently absorbed by a more forgiving stub.
    objs.forEach(o => {
      if (o && typeof o === 'object' && 'children' in o) { o.parent = this; this.children.push(o); }
    });
    return this;
  }
  remove(...objs) {
    objs.forEach(o => {
      const i = this.children.indexOf(o);
      if (i !== -1) this.children.splice(i, 1);
    });
    return this;
  }
  getObjectByName(name) {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.getObjectByName(name);
      if (found) return found;
    }
    return null;
  }
  traverse(fn) {
    fn(this);
    this.children.forEach(c => c.traverse(fn));
  }
  clone() {
    // Shallow-ish clone sufficient for the builders' `.clone()` calls on
    // groups/meshes (mostly used for symmetric L/R limb pairs).
    const c = new this.constructor();
    Object.assign(c, this);
    c.children = this.children.map(ch => ch.clone());
    c.position = this.position.clone();
    c.scale = new Vector3(this.scale.x, this.scale.y, this.scale.z);
    c.rotation = new Euler(this.rotation.x, this.rotation.y, this.rotation.z);
    c.userData = { ...this.userData };
    return c;
  }
}

class Group extends Object3D {}

class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.isMesh = true;
    this.geometry = geometry || {};
    this.material = material || {};
  }
  clone() {
    const c = super.clone();
    c.isMesh = true;
    c.geometry = this.geometry;
    c.material = this.material && this.material.clone ? this.material.clone() : this.material;
    return c;
  }
}

// Geometries: only need to exist as distinct tagged objects; builders
// don't inspect their internals in ways this stub needs to reproduce.
// Called with `new` by the real builder code (e.g. `new THREE.SphereGeometry(...)`),
// so these must be constructible classes, not plain factory functions.
function makeGeometryClass(kind) {
  return class {
    constructor(...args) { this.isGeometry = true; this.kind = kind; this.args = args; }
  };
}

class MeshToonMaterial {
  constructor(opts = {}) {
    this.color = new Color(opts.color);
    this.gradientMap = opts.gradientMap;
    this.emissive = opts.emissive !== undefined ? new Color(opts.emissive) : undefined;
    this.emissiveIntensity = opts.emissiveIntensity;
    this.transparent = opts.transparent;
    this.opacity = opts.opacity;
    this.side = opts.side;
  }
  clone() {
    const c = new MeshToonMaterial({});
    // Deliberately go through the SAME field set validateUnitModel checks,
    // via a real .color.clone() — mirrors the real three.js Material.clone()
    // contract this stub exists to catch violations of (see handoff.md's
    // "a material clone losing its color object" bug).
    c.color = this.color.clone();
    c.gradientMap = this.gradientMap;
    c.emissive = this.emissive ? this.emissive.clone() : undefined;
    c.emissiveIntensity = this.emissiveIntensity;
    c.transparent = this.transparent;
    c.opacity = this.opacity;
    c.side = this.side;
    return c;
  }
}

class MeshBasicMaterial extends MeshToonMaterial {}

const THREE = {
  Vector3, Euler, Color, Object3D, Group, Mesh,
  MeshToonMaterial, MeshBasicMaterial,
  SphereGeometry: makeGeometryClass('sphere'),
  BoxGeometry: makeGeometryClass('box'),
  CylinderGeometry: makeGeometryClass('cylinder'),
  ConeGeometry: makeGeometryClass('cone'),
  TorusGeometry: makeGeometryClass('torus'),
  OctahedronGeometry: makeGeometryClass('octahedron'),
  RingGeometry: makeGeometryClass('ring'),
  TubeGeometry: makeGeometryClass('tube'),
  CatmullRomCurve3: class { constructor(points) { this.points = points; } },
  DoubleSide: 'double',
  BackSide: 'back',
  FrontSide: 'front',
};

module.exports = { THREE };
