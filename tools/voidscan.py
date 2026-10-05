"""Détecte les 'vides' : rayons latéraux depuis la chaussée qui ne touchent rien (ciel/hors-jeu).
Usage : python3 tools/voidscan.py [pas_m] [s_debut] [s_fin]   (serveur : tools/devserver.py 8814)"""
import json, os, sys
from playwright.sync_api import sync_playwright
step = float(sys.argv[1]) if len(sys.argv) > 1 else 50
a = float(sys.argv[2]) if len(sys.argv) > 2 else 0
b = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9
with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = br.new_page(viewport={"width": 320, "height": 200})
    pg.goto("http://127.0.0.1:8814/?test", wait_until="load")
    for _ in range(240):
        pg.wait_for_timeout(1000)
        if pg.evaluate("!!(window.__periph && window.__periph.step)"): break
    pg.evaluate("document.getElementById('m-play').click()")
    pg.evaluate("window.__periph.step(5)")
    res = pg.evaluate("""async ([step, a, b]) => {
      const T = await import('/vendor/three.module.min.js');
      const P = window.__periph, L = P.track.length, out = [];
      const FARD = 110; const rc = new T.Raycaster(); rc.far = 400;
      const p = {};
      const end = Math.min(b, L);
      for (let off = a; off < end; off += step) {
        const s = (P.track.startS + off) % L;
        P.world.prebuild(s);
        const targets = [...P.world.chunks.values()].map(c => c.group);
        for (const g of targets) g.updateMatrixWorld(true);
        P.track.pointAt(s, p);
        const miss = [];
        for (const lat of [4, 10]) {
          const o = new T.Vector3(p.x + p.rx * lat, p.y + 1.6, p.z + p.rz * lat);
          for (const deg of [-130, -110, -90, -70, -50, 50, 70, 90, 110, 130]) {
            const th = deg * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th);
            const dx = c * p.tx + sn * p.rx, dz = c * p.tz + sn * p.rz;
            const d = new T.Vector3(dx, -(o.y) / 60, dz).normalize();
            rc.set(o, d);
            const hit = rc.intersectObjects(targets, true).filter(h => h.object.visible !== false);
            if (!hit.length) miss.push(deg + '@' + lat + ':none'); else if (hit[0].distance > FARD) miss.push(deg + '@' + lat + ':' + Math.round(hit[0].distance));
          }
        }
        if (miss.length) out.push([Math.round(off), Math.round(s), miss.join(' ')]);
        if (P.world.chunks.size > 20) { for (const [k, c] of P.world.chunks) { P.scene.remove(c.group); } P.world.chunks.clear(); }
      }
      return out;
    }""", [step, a, b])
    json.dump(res, open("/tmp/voidscan.json", "w"))
    print(len(res), "points avec vide")
    for r in res[:80]: print(r)
    br.close()
