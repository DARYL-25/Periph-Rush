// ============================================================
// Périph' Rush — rétroviseur (v20, option des réglages)
// Vue arrière rendue dans une petite texture 1 image sur 3 (coût
// réduit : basse résolution, champ court, pas de mise à jour des
// ombres), puis affichée en surimpression dans le cadre #mirror.
// ============================================================

export class Mirror {
  constructor(THREE, renderer) {
    this.T = THREE;
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(320, 90, { depthBuffer: true });
    this.cam = new THREE.PerspectiveCamera(46, 320 / 90, 0.4, 230);
    this.oScene = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); // image inversée comme dans un vrai rétro
    this.quad = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.rt.texture, depthTest: false }));
    this.oScene.add(this.quad);
    this.frame = 0;
    this._p = {};
    this.el = document.getElementById('mirror');
  }

  render(enabled, scene, player, track) {
    this.el.classList.toggle('hidden', !enabled);
    if (!enabled) return;
    const r = this.renderer, T = this.T;
    if (this.frame++ % 3 === 0) {
      const p = this._p, g = player.bundle.group;
      track.pointAt(((player.s - 35) % track.length + track.length) % track.length, p);
      const back = (player.len || 4.2) / 2 + 0.2;
      this.cam.position.set(g.position.x - Math.sin(g.rotation.y) * back, g.position.y + 1.25, g.position.z - Math.cos(g.rotation.y) * back);
      this.cam.lookAt(p.x + p.rx * player.lat, p.y + 1.0, p.z + p.rz * player.lat);
      const sh = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(this.rt);
      r.render(scene, this.cam);
      r.setRenderTarget(null);
      r.shadowMap.autoUpdate = sh;
    }
    // surimpression dans le cadre HTML
    const rect = this.el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight;
    this.oCam.right = W; this.oCam.top = H; this.oCam.updateProjectionMatrix();
    this.quad.scale.set(rect.width - 6, rect.height - 6, 1);
    this.quad.position.set(rect.left + rect.width / 2, H - (rect.top + rect.height / 2), 0);
    const ac = r.autoClear;
    r.autoClear = false;
    r.render(this.oScene, this.oCam);
    r.autoClear = ac;
  }
}
