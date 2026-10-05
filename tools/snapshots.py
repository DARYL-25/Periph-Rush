"""Captures de contrôle headless (Playwright) du périphérique.

Usage : python3 tools/snapshots.py <prefix> [s1,s2,...] [preset]
  - démarre une partie, téléporte le joueur à chaque abscisse s (m après
    la Porte Maillot), laisse le monde se construire et enregistre
    tools/snaps/<prefix>_<s>.jpg
Nécessite le serveur : python3 tools/devserver.py 8814
"""
import base64
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
prefix = sys.argv[1] if len(sys.argv) > 1 else "snap"
offsets = [float(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "200").split(",")]
preset = sys.argv[3] if len(sys.argv) > 3 else None
W, H = (int(v) for v in os.environ.get("SNAP_SIZE", "900x506").split("x"))

out = os.path.join(ROOT, "tools", "snaps")
os.makedirs(out, exist_ok=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": W, "height": H})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto("http://127.0.0.1:8814/?test", wait_until="load")
    for _ in range(240):
        pg.wait_for_timeout(1000)
        if pg.evaluate("!!(window.__periph && window.__periph.step)"):
            break
    else:
        print("\n".join(logs)); raise SystemExit("boot timeout")
    pg.evaluate("window.__YAW = %s" % os.environ.get("YAW", "0"))
    pg.evaluate("window.__LAT = %s" % os.environ.get("LAT", "7"))
    pg.evaluate("document.getElementById('m-play').click()")
    pg.evaluate("window.__periph.step(5)")
    for off in offsets:
        stats = pg.evaluate(
            """([off, preset]) => {
              const P = window.__periph;
              const s = (P.track.startS + off) % P.track.length;
              P.player.s = s; P.player.lat = window.__LAT || 7.0; P.player.v = 13;
              P.traffic.reset(s);
              if (preset) { P.ambience.setPreset(preset, 0); P.game.applyNight(); }
              for (const [k, c] of P.world.chunks) { P.scene.remove(c.group); }
              P.world.chunks.clear();
              P.world.prebuild(s);
              P.step(30);
              P.player.updateCamera(P.camera, 1, true);
              P.step(2);
              if (window.__YAW) { P.camera.rotateY(window.__YAW); P.renderer.render(P.scene, P.camera); }
              const info = P.renderer.info.render;
              return { calls: info.calls, tris: info.triangles, s: Math.round(s),
                       porte: P.track.nextPorte(s).porte.name };
            }""",
            [off, preset],
        )
        data = pg.evaluate("window.__periph.snap(%d, 0.82)" % W)
        name = f"{prefix}_{int(off)}"
        with open(os.path.join(out, name + ".jpg"), "wb") as f:
            f.write(base64.b64decode(data.split(",", 1)[1]))
        print(name, stats)
    for l in logs[:30]:
        print(l)
    b.close()
