"""Génère js/periph-data.js à partir des extraits OpenStreetMap (data/*.txt).

Données © contributeurs OpenStreetMap (ODbL) — extraites via Overpass :
  - data/ring_raw.txt   : axe du Boulevard Périphérique Intérieur (628 sommets,
                          mètres locaux X=est, Z=sud autour de 48.8590N 2.3400E)
  - data/runs.txt       : attributs par tronçon (voies/tunnel/pont/niveau)
  - data/junctions.txt  : bretelles de sortie (X) / d'entrée (E) + panneaux
  - data/buildings.txt  : (optionnel) bâtiments proches, rectangles orientés
Usage : python3 tools/build_periph_data.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(ROOT, "data", f)

ring = open(D("ring_raw.txt")).read().split()
pts = [[float(v) for v in t.split(",")] for t in ring]

runs = []
for r in open(D("runs.txt")).read().split(";"):
    r = r.strip()
    if not r:
        continue
    s, k = r.split(" ", 1)
    lanes, tunnel, bridge, layer, cov = k.split("/")
    runs.append([int(s), int(lanes), 1 if tunnel else 0, 1 if bridge else 0, int(layer)])

junctions = []
for line in open(D("junctions.txt")).read().strip().splitlines():
    s, kind, lanes, dest = line.split("|")
    ds = []
    for d in dest.split(";"):
        d = d.strip()
        if not d:
            continue
        parts = d.split(":")
        ds.append([parts[0], parts[1] if len(parts) > 1 else "white", parts[2] if len(parts) > 2 else ""])
    junctions.append([int(s), kind, int(lanes), ds])

out = ["// Généré par tools/build_periph_data.py — NE PAS ÉDITER À LA MAIN.",
       "// Géométrie et attributs : © contributeurs OpenStreetMap (ODbL).",
       "export const RING_PTS = " + json.dumps([round(v, 1) for p in pts for v in p], separators=(",", ":")) + ";",
       "// [s, voies, tunnel, pont, niveau]",
       "export const RING_RUNS = " + json.dumps(runs, separators=(",", ":"), ensure_ascii=False) + ";",
       "// [s, 'X'|'E', voies de bretelle, [[texte, couleur, réf], …]]",
       "export const JUNCTIONS = " + json.dumps(junctions, separators=(",", ":"), ensure_ascii=False) + ";"]

import base64
bpath = D("buildings.bin")
if os.path.exists(bpath):
    out.append("// bâtiments (rectangles orientés) : base64 d'un Int16Array transposé en 7 colonnes")
    out.append("// [cx*2, cz*2, largeur*4, profondeur*4, angle*1000, hauteur*4 (0 = inconnue), type(+16 si hauteur estimée)]")
    out.append("export const BUILDINGS_B64 = " + json.dumps(base64.b64encode(open(bpath, "rb").read()).decode()) + ";")
else:
    out.append("export const BUILDINGS_B64 = '';")
gpath = D("bigbuildings.json")
out.append("// grands bâtiments non rectangulaires : [hauteur, type, [x,z,…], nom]")
out.append("export const BIG_BUILDINGS = " + (open(gpath).read().strip() if os.path.exists(gpath) else "[]") + ";")
lpath = D("landuse.json")
out.append("// occupation du sol : [type, [x,z,…], ligne?] — wood/park/pitch/cemetery/rail/water/urban/river")
out.append("export const LANDUSE = " + (open(lpath).read().strip() if os.path.exists(lpath) else "[]") + ";")

with open(os.path.join(ROOT, "js", "periph-data.js"), "w") as f:
    f.write("\n".join(out) + "\n")
print("ok", len(pts), "pts", len(runs), "runs", len(junctions), "junctions")
