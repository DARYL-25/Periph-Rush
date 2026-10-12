"""Vue libre (v17) : caméra posée sur la chaussée et visant un point monde (lat/lon) ou un point de la piste.
Usage : python3 tools/viewshot.py name off lat_cam h_cam  (target: lat,lon | s:off_target,lat_target) [fov]
"""
import base64, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name, off, latc, hc, target = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
fov = float(sys.argv[6]) if len(sys.argv) > 6 else 60
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 900, "height": 506})
    pg.goto("http://127.0.0.1:8814/?test", wait_until="load")
    for _ in range(300):
        pg.wait_for_timeout(1000)
        if pg.evaluate("!!(window.__periph && window.__periph.step)"): break
    pg.evaluate("document.getElementById('m-play').click()")
    pg.evaluate("window.__periph.step(3)")
    data = pg.evaluate("""([off, latc, hc, target, fov]) => {
      const P = window.__periph, t = P.track, L = t.length;
      const s = (t.startS + off) % L;
      P.player.s = s; P.player.lat = 7; P.player.v = 0; P.traffic.reset(s);
      P.ambience.startDay(11, 'soleil'); P.game._night = null; P.game.applyNight();
      for (const [k, c] of P.world.chunks) P.scene.remove(c.group);
      P.world.chunks.clear(); P.world.prebuild(s); P.step(3);
      const p = {}; t.pointAt(s, p);
      const cam = P.camera; cam.fov = fov; cam.updateProjectionMatrix();
      cam.position.set(p.x + p.rx * latc, p.y + hc, p.z + p.rz * latc);
      let tx, ty, tz;
      if (target.startsWith('s:')) { const [o2, l2, h2] = target.slice(2).split(',').map(Number); const q = {}; t.pointAt((t.startS + o2) % L, q); tx = q.x + q.rx * l2; ty = q.y + (h2 || 3); tz = q.z + q.rz * l2; }
      else { const [la, lo, hh] = target.split(',').map(Number); const LAT0 = 48.8590, LON0 = 2.34; tx = (lo - LON0) * 111320 * Math.cos(LAT0 * Math.PI / 180); tz = -(la - LAT0) * 111132; ty = hh || 20; }
      cam.lookAt(tx, ty, tz);
      P.renderer.render(P.scene, cam);
      return P.snap(900, 0.85);
    }""", [off, latc, hc, target, fov])
    os.makedirs(os.path.join(ROOT, "tools", "snaps"), exist_ok=True)
    open(os.path.join(ROOT, "tools", "snaps", name + ".jpg"), "wb").write(base64.b64decode(data.split(",", 1)[1]))
    print("ok", name)
    b.close()
