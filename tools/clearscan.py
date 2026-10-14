"""Contrôle géométrique du tour complet (v17).

1. Gabarit : aucun sommet/centre de triangle d'un ouvrage ou équipement ne doit
   se trouver dans le volume roulable (voies principales + bretelles), entre
   0,15 m et 1,7 m au-dessus de la chaussée -> « poteaux en pleine route »,
   murs/glissières dans lesquels on peut rouler.
2. Panneaux : chaque panneau doit être visible de face (rayons depuis 1,5 m
   devant ses 4 coins) -> panneaux plantés dans un mur, un écran, un talus.

Usage : python3 tools/clearscan.py [chunk0] [chunk1]   (serveur : tools/devserver.py 8814)
Résultat : tools/snaps/clearscan.json + résumé.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c0 = int(sys.argv[1]) if len(sys.argv) > 1 else 0
c1 = int(sys.argv[2]) if len(sys.argv) > 2 else 10**6

JS = r"""
async ([c0, c1]) => {
  const T = await import('/vendor/three.module.min.js');
  const { CFG } = await import('/js/config.js');
  const P = window.__periph, W = P.world, t = P.track, L = t.length, M = W.mats;
  const signMats = new Set(M.signCache.values());
  const skip = new Set([M.road, M.paint, M.pool, M.tpool, M.water, M.lampGlow, M.graf, M.bld, M.canopy, M.trunk]);
  const n = W.chunkCount();
  const out = { gab: [], sign: [], nsigns: 0 };
  const rc = new T.Raycaster();
  const p = {};
  const offOf = (s) => Math.round(((s - t.startS) % L + L) % L);
  // couloirs roulables en s : [{a, b, y}] (lat min/max du gabarit véhicule, altitude chaussée)
  const corridors = (s) => {
    t.pointAt(s, p);
    const Em = t.mainEdgeAt(s), list = W.ramps.at(s, p.y), half = 0.78;
    const max = W.ramps.mainMax(s, 0.68, p.y);
    const cs = [], Bq = W.ramps.barrier(s, p.y);
    for (const o of list) {
      if (o.parallel || o.g < 0.35) continue;
      const mn = W.ramps.rampMin(o, s, p.y, 0.68);
      cs.push({ a: Number.isFinite(mn) ? mn - 0.78 : Em + o.gap * 0.5 + 0.3, b: Em + o.gap + o.w >= Bq.R - 0.01 ? Bq.R + Bq.c - 0.68 + 0.78 : Em + o.gap + o.w - 0.2, y: o.hr, ramp: 1 });
    }
    cs.unshift({ a: W.ramps.mainMin(s, 0.68) - half, b: max + half, y: p.y, ramp: 0 });
    cs.forEach((c) => { c.Em = Em; c.rp = list.map((o) => (o.parallel ? 'P' : o.r.kind) + o.gap.toFixed(1) + '/' + o.w.toFixed(1)).join(' '); });
    return cs;
  };
  for (let idx = Math.max(0, c0); idx < Math.min(n, c1); idx++) {
    for (const [k, c] of W.chunks) { P.scene.remove(c.group); for (const g of c.geoms) g.dispose(); }
    W.chunks.clear();
    W.buildChunk(idx);
    const ch = W.chunks.get(idx);
    ch.group.updateMatrixWorld(true);
    const s0 = idx * CFG.CHUNK_LEN, len = Math.min(CFG.CHUNK_LEN, L - s0);
    // rangées de projection (pas 1 m) pour (x,z) -> (s, lat)
    const R = [];
    for (let s = s0 - 20; s <= s0 + len + 20; s += 1) { const q = {}; t.pointAt(s, q); q.s = s; R.push(q); }
    const toTrack = (x, z) => {
      let best = -1, bd = 1e9;
      for (let i = 0; i < R.length; i++) { const dx = x - R[i].x, dz = z - R[i].z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      const q = R[best], dx = x - q.x, dz = z - q.z;
      return { s: q.s + dx * q.tx + dz * q.tz, lat: dx * q.rx + dz * q.rz };
    };
    const corrCache = new Map();
    const corrAt = (s) => { const k = Math.round(s * 2); if (!corrCache.has(k)) corrCache.set(k, corridors(k / 2)); return corrCache.get(k); };
    const obst = [], signs = [];
    ch.group.traverse((o) => {
      if (!o.isMesh) return;
      if (signMats.has(o.material)) signs.push(o);
      else if (!skip.has(o.material)) obst.push(o);
    });
    // 1. gabarit
    const flagged = new Map();
    for (const o of obst) {
      const pos = o.geometry.getAttribute('position'), ix = o.geometry.index;
      const test = (x, y, z) => {
        const tp = toTrack(x, z);
        if (tp.s < s0 - 0.5 || tp.s > s0 + len + 0.5) return;
        for (const c of corrAt(tp.s)) {
          if (tp.lat > c.a + 0.08 && tp.lat < c.b - 0.08 && y > c.y + 0.15 && y < c.y + 1.7) {
            const key = Math.round(tp.s / 3) + ':' + c.ramp;
            if (!flagged.has(key)) flagged.set(key, { off: offOf(tp.s), s: Math.round(tp.s), lat: +tp.lat.toFixed(2), dy: +(y - c.y).toFixed(2), ramp: c.ramp, a: +c.a.toFixed(2), b: +c.b.toFixed(2), Em: +c.Em.toFixed(2), rp: c.rp, mat: o.material === M.metal ? 'metal' : o.material === M.struct ? 'struct' : o.material === M.rail ? 'rail' : o.material === M.lamp ? 'lamp' : o.material.type });
            return;
          }
        }
      };
      for (let i = 0; i < pos.count; i++) test(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (ix) for (let i = 0; i < ix.count; i += 3) {
        const a = ix.array[i], b = ix.array[i + 1], c = ix.array[i + 2];
        test((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3);
      }
    }
    out.gab.push(...flagged.values());
    // 2. panneaux : visibilité de face
    const targets = obst.filter((o) => o.material !== M.lamp);
    for (const o of signs) {
      const pos = o.geometry.getAttribute('position'), ix = o.geometry.index;
      for (let i = 0; i < ix.count; i += 6) {
        const A = new T.Vector3().fromBufferAttribute(pos, ix.array[i]), B = new T.Vector3().fromBufferAttribute(pos, ix.array[i + 1]);
        const C = new T.Vector3().fromBufferAttribute(pos, ix.array[i + 2]), D = new T.Vector3().fromBufferAttribute(pos, ix.array[i + 5]);
        const nrm = new T.Vector3().subVectors(B, A).cross(new T.Vector3().subVectors(C, A)).normalize();
        const ctr = new T.Vector3().add(A).add(B).add(C).add(D).multiplyScalar(0.25);
        out.nsigns++;
        let blocked = 0, what = '';
        for (const corner of [A, B, C, D]) {
          const q = corner.clone().lerp(ctr, 0.12);
          const org = q.clone().addScaledVector(nrm, 1.5);
          rc.set(org, nrm.clone().negate()); rc.far = 1.48; rc.near = 0;
          const h = rc.intersectObjects(targets, false);
          if (h.length) { blocked++; what = h[0].object.material === M.metal ? 'metal' : h[0].object.material === M.struct ? 'struct' : h[0].object.material === M.rail ? 'rail' : 'x'; }
        }
        if (blocked) {
          const tp = toTrack(ctr.x, ctr.z);
          out.sign.push({ off: offOf(tp.s), s: Math.round(tp.s), lat: +tp.lat.toFixed(2), y: +(ctr.y - t.elevationAt(tp.s)).toFixed(2), w: +A.distanceTo(B).toFixed(2), blocked, what, tex: o.material.map && o.material.map.name || '' });
        }
      }
    }
  }
  for (const [k, c] of W.chunks) { P.scene.remove(c.group); }
  W.chunks.clear();
  return out;
}
"""

with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = br.new_page(viewport={"width": 320, "height": 200})
    logs = []
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto("http://127.0.0.1:8814/?test", wait_until="load")
    for _ in range(400):
        pg.wait_for_timeout(1000)
        if pg.evaluate("!!(window.__periph && window.__periph.step)"):
            break
    pg.set_default_timeout(0)
    res = pg.evaluate(JS, [c0, c1])
    os.makedirs(os.path.join(ROOT, "tools", "snaps"), exist_ok=True)
    json.dump(res, open(os.path.join(ROOT, "tools", "snaps", "clearscan.json"), "w"), indent=0)
    print("gabarit:", len(res["gab"]), "| panneaux masqués:", len(res["sign"]), "/", res["nsigns"])
    for g in res["gab"][:60]: print("G", g)
    for s in res["sign"][:60]: print("S", s)
    for l in logs[:10]: print(l)
    br.close()
