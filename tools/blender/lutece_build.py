# ============================================================
# Périph' Rush — « Lutèce » : citadine 5 portes ORIGINALE (design maison)
# Gabarit d'une compacte française des années 2000 : L 4,02 · l 1,72 ·
# h 1,48 · empattement 2,58. Design propre au jeu : optiques en amande
# horizontales, barrette de calandre chromée, prise d'air hexagonale,
# feux arrière en bandeau horizontal, plaque arrière dans le bouclier.
#
# Méthode : cage lofté (sections) → Subdivision Surface → surfaces
# classées (vitrages, montants), optiques/calandres découpées dans la
# carrosserie (conformes à la surface), joints de portes projetés,
# roues détaillées (pneu au profil tourné, jante 5 doubles branches,
# disque, étrier), habitacle sommaire visible au travers des vitres.
#
# Usage : python3 tools/blender/lutece_build.py [--render]
#   (module bpy) ou blender -b --python tools/blender/lutece_build.py
# Produit : assets/lutece.glb (+ tools/snaps/lutece_*.png avec --render)
# Repère : X = longueur (avant = +X), Y = largeur, Z = hauteur.
# Matériaux nommés pour le jeu : paint glass det bright lensF lensR tire rim
# ============================================================
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix

L, W, H = 4.02, 1.72, 1.48
WB = 2.58
AX_F = L / 2 - 0.78
AX_R = AX_F - WB
WR = 0.305           # rayon roue (195/55 R16)
TRACK = 0.742        # demi-voie (centre pneu)
ARCH_R = 0.355

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
SNAPS = os.path.join(REPO, 'tools', 'snaps')
ASSETS = os.path.join(REPO, 'assets')
os.makedirs(SNAPS, exist_ok=True)


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def interp(pts, x):
    """pts triés par x décroissant ; interpolation Catmull-Rom."""
    if x >= pts[0][0]:
        return pts[0][1]
    if x <= pts[-1][0]:
        return pts[-1][1]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        if x1 <= x <= x0:
            t = (x0 - x) / (x0 - x1)
            p0 = pts[max(i - 1, 0)][1]
            p3 = pts[min(i + 2, len(pts) - 1)][1]
            t2, t3 = t * t, t * t * t
            return 0.5 * ((2 * y0) + (-p0 + y1) * t + (2 * p0 - 5 * y0 + 4 * y1 - p3) * t2 + (-p0 + 3 * y0 - 3 * y1 + p3) * t3)
    return pts[-1][1]


# ---------------------------------------------------------------
# lignes directrices (x, z) / (x, demi-largeur)
# ---------------------------------------------------------------
X0, X1 = L / 2, -L / 2
TOP = [  # profil supérieur : bouclier, capot, pare-brise, pavillon, hayon
    (2.010, 0.560), (1.985, 0.640), (1.930, 0.705), (1.700, 0.775), (1.300, 0.840), (0.980, 0.878),
    (0.760, 1.040), (0.480, 1.300), (0.300, 1.405),
    (-0.200, 1.468), (-0.800, 1.455), (-1.250, 1.405),
    (-1.520, 1.300), (-1.760, 1.120), (-1.900, 0.980),
    (-1.965, 0.860), (-2.000, 0.720), (-2.010, 0.560),
]
BELT = [  # ligne de ceinture (bas des vitres) — remonte vers l'arrière
    (2.010, 0.600), (1.300, 0.820), (0.980, 0.862), (0.600, 0.880), (0.000, 0.900),
    (-0.700, 0.928), (-1.150, 0.952), (-1.350, 0.985), (-1.600, 0.990), (-2.010, 0.900),
]
PLAN = [  # demi-largeur maximale (épaule)
    (2.010, 0.640), (1.960, 0.735), (1.800, 0.810), (1.450, 0.848), (1.000, 0.858),
    (0.000, 0.860), (-1.000, 0.858), (-1.500, 0.846), (-1.850, 0.800), (-1.975, 0.742), (-2.010, 0.660),
]
ROOF_HALF = [(0.4, 0.560), (0.0, 0.615), (-0.8, 0.612), (-1.4, 0.560)]
BOTTOM = [  # bas de caisse / boucliers
    (2.010, 0.300), (1.900, 0.235), (1.600, 0.215), (1.000, 0.200), (-1.000, 0.200), (-1.650, 0.240), (-1.950, 0.300), (-2.010, 0.360),
]
CABIN = (-1.62, 0.96)       # zone vitrée (x)
WS = (0.30, 0.94)           # pare-brise
RG = (-1.70, -1.22)         # lunette arrière


def roof_half(x):
    return interp(ROOF_HALF, x)


def arch_cut(x):
    """relève le bas de caisse sur les passages de roue (arc)."""
    z = 0.0
    for ax in (AX_F, AX_R):
        d = x - ax
        if abs(d) < ARCH_R + 0.06:
            z = max(z, WR * 0.15 + math.sqrt(max(0.0, (ARCH_R + 0.06) ** 2 - d * d)))
    return z


def section(x):
    """demi-profil (y, z) du bas (axe) au sommet (axe) — liste de points."""
    zb = interp(BOTTOM, x)
    zt = interp(TOP, x)
    zbelt = min(interp(BELT, x), zt - 0.02)
    w = interp(PLAN, x)
    cab = CABIN[0] - 0.12 <= x <= CABIN[1] + 0.05
    # rétrécissement en plan du nez et de la poupe (galbe)
    end = 1.0
    if x > 1.75:
        end = lerp(1.0, 0.86, smooth((x - 1.75) / 0.26))
    if x < -1.80:
        end = lerp(1.0, 0.90, smooth((-1.80 - x) / 0.21))
    pts = []
    pts.append((0.0, zb))
    pts.append((w * 0.70 * end, zb - 0.005))
    pts.append((w * 0.93 * end, zb + 0.04))
    pts.append((w * 0.985, zb + 0.16))
    zs = lerp(zb, zbelt, 0.72)                     # ligne d'épaule (nervure)
    pts.append((w, zs - 0.08))
    pts.append((w * 0.995, zs))
    pts.append((w * 0.975, zbelt - 0.01))
    if cab and zt - zbelt > 0.12:
        # flanc vitré incliné (tumblehome) jusqu'au pavillon
        rh = roof_half(x)
        gw = w * 0.93
        pts.append((gw, zbelt + 0.015))
        pts.append((lerp(gw, rh + 0.05, 0.55), lerp(zbelt, zt, 0.55)))
        pts.append((rh + 0.035, zt - 0.045))
        pts.append((rh - 0.04, zt - 0.006))
        pts.append((rh * 0.55, zt + 0.004))
    else:
        # capot / malle : dessus bombé
        pts.append((w * 0.90, zt - 0.012))
        pts.append((w * 0.55, zt + 0.006))
    pts.append((0.0, zt + (0.008 if not cab else 0.005)))
    return pts


def stations():
    xs = set()
    k = 0
    x = X0
    base = [2.010, 2.000, 1.985, 1.96, 1.92, 1.86, 1.78, 1.68, 1.58, 1.48, 1.38, 1.28, 1.18, 1.08, 0.98,
            0.90, 0.80, 0.68, 0.55, 0.40, 0.25, 0.10, -0.05, -0.20, -0.40, -0.60, -0.80, -0.95, -1.10, -1.25,
            -1.38, -1.50, -1.62, -1.72, -1.82, -1.90, -1.95, -1.985, -2.000, -2.010]
    return base


# ---------------------------------------------------------------
# matériaux
# ---------------------------------------------------------------
def mat(name, color, metallic=0.0, rough=0.5, alpha=1.0, emit=None, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    for key in ('Coat Weight', 'Clearcoat'):
        if key in b.inputs:
            b.inputs[key].default_value = coat
            break
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
    if emit:
        for key in ('Emission Color', 'Emission'):
            if key in b.inputs:
                b.inputs[key].default_value = (*emit, 1.0)
                break
        if 'Emission Strength' in b.inputs:
            b.inputs['Emission Strength'].default_value = 0.6
    m.diffuse_color = (*color, alpha)
    return m


def make_mats():
    return {
        'paint': mat('paint', (0.55, 0.06, 0.05), 0.55, 0.28, coat=1.0),
        'glass': mat('glass', (0.02, 0.03, 0.04), 0.0, 0.04),
        'det': mat('det', (0.035, 0.037, 0.04), 0.0, 0.7),
        'bright': mat('bright', (0.80, 0.81, 0.83), 1.0, 0.18),
        'lensF': mat('lensF', (0.82, 0.86, 0.90), 0.2, 0.08),
        'lensR': mat('lensR', (0.55, 0.03, 0.03), 0.1, 0.12),
        'tire': mat('tire', (0.025, 0.025, 0.028), 0.0, 0.88),
        'rim': mat('rim', (0.70, 0.72, 0.75), 1.0, 0.26),
    }


M = {}


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_obj(name, verts, faces, matname):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    link(ob)
    ob.data.materials.append(M[matname])
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def shade_smooth(ob, angle=50):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass


# ---------------------------------------------------------------
# caisse : loft symétrique fermé + subdivision
# ---------------------------------------------------------------
def build_body():
    xs = stations()
    rings = [section(x) for x in xs]
    n = max(len(r) for r in rings)
    # rééchantillonne chaque demi-profil à n points (abscisse curviligne)
    def resample(r, n):
        d = [0.0]
        for i in range(1, len(r)):
            d.append(d[-1] + math.dist(r[i - 1], r[i]))
        out = []
        for k in range(n):
            s = d[-1] * k / (n - 1)
            j = 1
            while j < len(d) - 1 and d[j] < s:
                j += 1
            t = (s - d[j - 1]) / max(d[j] - d[j - 1], 1e-9)
            out.append((lerp(r[j - 1][0], r[j][0], t), lerp(r[j - 1][1], r[j][1], t)))
        return out
    N = 16
    verts, faces = [], []
    idx = {}
    for i, (x, r) in enumerate(zip(xs, rings)):
        rr = resample(r, N)
        for k, (y, z) in enumerate(rr):
            # points sur l'axe : un seul sommet
            if k in (0, N - 1):
                idx[(i, k, 0)] = len(verts)
                verts.append((x, 0.0, z))
                idx[(i, k, 1)] = idx[(i, k, 0)]
                idx[(i, k, -1)] = idx[(i, k, 0)]
            else:
                for sgn in (1, -1):
                    idx[(i, k, sgn)] = len(verts)
                    verts.append((x, sgn * y, z))
    for i in range(len(xs) - 1):
        for k in range(N - 1):
            for sgn in (1, -1):
                a, b = idx[(i, k, sgn)], idx[(i, k + 1, sgn)]
                c, d = idx[(i + 1, k + 1, sgn)], idx[(i + 1, k, sgn)]
                q = [a, b, c, d] if sgn > 0 else [a, d, c, b]
                q2 = []
                for v in q:
                    if v not in q2:
                        q2.append(v)
                if len(q2) >= 3:
                    faces.append(q2)
    # bouchons avant / arrière
    for i, flip in ((0, False), (len(xs) - 1, True)):
        ring = [idx[(i, k, 1)] for k in range(N)] + [idx[(i, k, -1)] for k in range(N - 2, 0, -1)]
        faces.append(ring[::-1] if not flip else ring)
    ob = mesh_obj('Body', verts, faces, 'paint')
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    apply_mods(ob)
    # passages de roue : on enlève les faces sous l'arc et on ferme par un « tube » d'aile
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        for ax in (AX_F, AX_R):
            if math.hypot(c.x - ax, c.z - WR) < ARCH_R and abs(c.y) > 0.35:
                kill.append(f)
                break
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    for ax in (AX_F, AX_R):
        for sgn in (1, -1):
            arch_liner(ax, sgn)
    shade_smooth(ob, 60)
    return ob


def arch_liner(ax, sgn):
    """doublure noire du passage de roue (demi-tube) + élargisseur peint."""
    verts, faces = [], []
    n = 22
    y0, y1 = sgn * 0.36, sgn * 0.88
    for i in range(n + 1):
        a = math.pi * i / n
        x = ax + math.cos(a) * ARCH_R
        z = WR + math.sin(a) * ARCH_R
        verts.append((x, y0, z))
        verts.append((x, y1, z))
    for i in range(n):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        faces.append([a, b, c, d] if sgn > 0 else [a, d, c, b])
    mesh_obj('ArchLiner', verts, faces, 'det')


# ---------------------------------------------------------------
# DÉCALQUES PROJETÉS : vitrages, optiques, calandre, joints…
# Chaque élément est un contour 2D net (dense), triangulé (Delaunay
# contraint), puis projeté par lancer de rayons sur la carrosserie et
# décollé de quelques mm : bords parfaitement propres, conformes au galbe.
# ---------------------------------------------------------------
from mathutils.bvhtree import BVHTree
from mathutils import geometry as GEO

BVH = None


def make_bvh(body):
    global BVH
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    BVH = BVHTree.FromBMesh(bm)
    bm.free()


def P_SIDE(sgn):
    return lambda u, v: (Vector((u, sgn * 2.5, v)), Vector((0, -sgn, 0)))


P_FRONT = lambda u, v: (Vector((3.5, u, v)), Vector((-1, 0, 0)))
P_REAR = lambda u, v: (Vector((-3.5, u, v)), Vector((1, 0, 0)))
P_TOP = lambda u, v: (Vector((u, v, 3.0)), Vector((0, 0, -1)))


def resample_poly(poly, step=0.008, closed=True):
    out = []
    pts = poly + ([poly[0]] if closed else [])
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        n = max(1, int(math.dist(a, b) / step))
        for k in range(n):
            t = k / n
            out.append((lerp(a[0], b[0], t), lerp(a[1], b[1], t)))
    if not closed:
        out.append(pts[-1])
    return out


def rounded(poly, r=0.03, n=5):
    """arrondit les sommets d'un polygone (congés)."""
    out = []
    m = len(poly)
    for i in range(m):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % m])
        d0, d1 = (p0 - p1), (p2 - p1)
        l0, l1 = d0.length, d1.length
        rr = min(r, l0 * 0.45, l1 * 0.45)
        a = p1 + d0.normalized() * rr
        b = p1 + d1.normalized() * rr
        for k in range(n + 1):
            t = k / n
            q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b
            out.append((q.x, q.y))
    return out


def decal(name, poly, proj, matname, offset=0.004, step=0.035, mirror=False, rnd=0.0, min_cos=0.0):
    """contour poly (u,v) → maillage projeté sur la caisse. mirror : duplique en -u."""
    polys = [poly]
    if mirror:
        polys.append([(-u, v) for (u, v) in poly][::-1])
    verts, faces = [], []
    for pl in polys:
        if rnd:
            pl = rounded(pl, rnd)
        outline = resample_poly(pl, 0.008)
        # points intérieurs (grille)
        us = [p[0] for p in outline]
        vs = [p[1] for p in outline]
        inner = []
        u = min(us) + step / 2
        while u < max(us):
            v = min(vs) + step / 2
            while v < max(vs):
                if pip(outline, u, v) and min(math.dist((u, v), q) for q in outline[::3]) > step * 0.45:
                    inner.append((u, v))
                v += step
            u += step
        allp = outline + inner
        nO = len(outline)
        cdt = GEO.delaunay_2d_cdt([Vector(p) for p in allp], [(i, (i + 1) % nO) for i in range(nO)], [list(range(nO))], 1, 1e-7)
        vco, _, tris = cdt[0], cdt[1], cdt[2]
        base = len(verts)
        ok = []
        for c in vco:
            o, d = proj(c.x, c.y)
            hit, nrm, _, _ = BVH.ray_cast(o, d, 10.0)
            if hit is None:
                ok.append(None)
                verts.append((0, 0, 0))
            else:
                if nrm.dot(d) > 0:
                    nrm = -nrm
                if -nrm.dot(d) < min_cos:
                    ok.append(None)
                    verts.append((0, 0, 0))
                    continue
                q = hit + nrm * offset
                ok.append(nrm)
                verts.append((q.x, q.y, q.z))
        for t in tris:
            if any(ok[i] is None for i in t):
                continue
            a, b, c = (Vector(verts[base + i]) for i in t)
            fn = (b - a).cross(c - a)
            out = ok[t[0]]
            tt = list(t) if fn.dot(out) >= 0 else [t[0], t[2], t[1]]
            faces.append([base + i for i in tt])
    ob = mesh_obj(name, verts, faces, matname)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    shade_smooth(ob, 35)
    return ob


def pip(poly, x, y):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def strip(polyline, width):
    """bande (contour fermé) le long d'une polyligne (u,v)."""
    left, right = [], []
    for i, p in enumerate(polyline):
        a = Vector(polyline[max(i - 1, 0)])
        b = Vector(polyline[min(i + 1, len(polyline) - 1)])
        t = (b - a).normalized()
        n = Vector((-t.y, t.x)) * (width / 2)
        left.append((p[0] + n.x, p[1] + n.y))
        right.append((p[0] - n.x, p[1] - n.y))
    return left + right[::-1]


def roof_edge_z(x):
    return interp(TOP, x) - 0.075


def dlo():
    """contour des vitres latérales (x, z) : montant A incliné, pavillon,
    custode qui remonte en pointe (signature du modèle), ceinture."""
    pts = []
    pts.append((0.905, interp(BELT, 0.905) + 0.035))
    # montant A : parallèle au pare-brise
    for x in (0.80, 0.68, 0.56, 0.45):
        pts.append((x, roof_edge_z(x) - 0.04 + (0.0 if x < 0.5 else -0.02)))
    for x in (0.30, 0.0, -0.40, -0.80, -1.10):
        pts.append((x, roof_edge_z(x) - 0.012))
    # custode : bord arrière tendu qui plonge en pointe vers la ceinture
    pts.append((-1.30, roof_edge_z(-1.30) - 0.035))
    pts.append((-1.45, interp(BELT, -1.45) + 0.10))
    pts.append((-1.52, interp(BELT, -1.52) + 0.035))
    for x in (-1.30, -0.80, -0.20, 0.40, 0.80):
        pts.append((x, interp(BELT, x) + 0.032))
    return pts


def glazing():
    for sgn in (1, -1):
        side = P_SIDE(sgn)
        poly = dlo() if sgn > 0 else dlo()[::-1]
        # cadre noir (joints, encadrement) puis vitrage par-dessus
        decal(f'WinFrame{sgn}', grow(dlo(), 0.018) if sgn > 0 else grow(dlo(), 0.018)[::-1], side, 'det', offset=0.003, rnd=0.03)
        decal(f'Glass{sgn}', poly, side, 'glass', offset=0.0055, rnd=0.035)
        # montant B noir laqué + séparation vitre de custode
        decal(f'Bpillar{sgn}', [(-0.08, 0.90), (-0.20, 0.90), (-0.22, 1.44), (-0.10, 1.44)], side, 'det', offset=0.007)
        decal(f'Qdiv{sgn}', strip([(-1.08, interp(BELT, -1.08)), (-1.13, roof_edge_z(-1.13))], 0.035), side, 'det', offset=0.007)
        # joints d'ouvrants (portes, trappe)
        for li in ([(0.955, 0.93), (0.985, 0.62), (0.985, 0.28)],
                   [(-0.14, 0.92), (-0.14, 0.26)],
                   [(-1.14, 0.97), (-1.06, 0.62), (-1.00, 0.27)]):
            decal(f'Seam{sgn}', strip(li, 0.006), side, 'det', offset=0.0015, step=0.05)
        # baguette latérale et bas de caisse noir
        decal(f'Rub{sgn}', strip([(0.90, 0.46), (-1.05, 0.475)], 0.045), side, 'det', offset=0.005, rnd=0.02)
        decal(f'Sill{sgn}', [(AX_F - 0.42, 0.21), (AX_F - 0.42, 0.27), (AX_R + 0.42, 0.27), (AX_R + 0.42, 0.21)], side, 'det', offset=0.003, rnd=0.02)
        # élargisseurs d'ailes en plastique grainé (couvrent la découpe des passages de roue)
        for ax in (AX_F, AX_R):
            arch_trim(ax, sgn)
        # trappe à carburant (côté droit seulement)
        if sgn < 0:
            decal('FuelFlap', strip([(-1.40, 0.80), (-1.25, 0.80)], 0.004), side, 'det', offset=0.0015)
    # pare-brise (projection verticale)
    ws = [(0.935, 0.66), (0.935, -0.66), (0.33, -0.575), (0.33, 0.575)]
    decal('WsFrame', grow_uv(ws, 0.02), P_TOP, 'det', offset=0.003, rnd=0.06)
    decal('Windshield', ws, P_TOP, 'glass', offset=0.0055, rnd=0.06)
    # lunette arrière
    rg = [(-1.26, 0.53), (-1.26, -0.53), (-1.71, -0.47), (-1.71, 0.47)]
    decal('RgFrame', grow_uv(rg, 0.02), P_TOP, 'det', offset=0.003, rnd=0.05)
    decal('RearGlass', rg, P_TOP, 'glass', offset=0.0055, rnd=0.05)
    # joint de capot
    decal('HoodSeam', strip([(1.93, -0.62), (1.93, 0.62)], 0.006), P_TOP, 'det', offset=0.0015)


def arch_trim(ax, sgn):
    """bande d'élargisseur en relief qui épouse l'aile, avec retour vers l'intérieur."""
    verts, faces = [], []
    n = 36
    for i in range(n + 1):
        a = math.pi * (-0.06 + 1.12 * i / n)
        ca, sa = math.cos(a), math.sin(a)
        r1 = ARCH_R + 0.065
        o = Vector((ax + ca * r1, sgn * 2.5, WR + sa * r1))
        hit, nrm, _, _ = BVH.ray_cast(o, Vector((0, -sgn, 0)), 10.0)
        y = abs(hit.y) if hit else 0.84
        z0 = max(WR + sa * (ARCH_R - 0.012), 0.2)
        z1 = max(WR + sa * r1, 0.21)
        x0, x1 = ax + ca * (ARCH_R - 0.012), ax + ca * r1
        verts += [(x1, sgn * (y + 0.004), z1), (x0, sgn * (y + 0.016), z0), (x0, sgn * (y - 0.09), z0)]
    for i in range(n):
        for k in range(2):
            a, b = 3 * i + k, 3 * i + k + 1
            c, d = 3 * (i + 1) + k + 1, 3 * (i + 1) + k
            faces.append([a, b, c, d] if sgn > 0 else [a, d, c, b])
    ob = mesh_obj(f'ArchTrim{sgn}', verts, faces, 'det')
    shade_smooth(ob, 60)


def grow(poly, d):
    """agrandit grossièrement un polygone (x,z) autour de son centre."""
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    out = []
    for (x, z) in poly:
        v = Vector((x - cx, z - cz))
        out.append((x + v.normalized().x * d * 1.0, z + v.normalized().y * d * 1.6))
    return out


grow_uv = grow


def lamps_and_grille():
    # ---- optiques avant en amande horizontales (vue de face : y, z) ----
    head = [(0.36, 0.700), (0.52, 0.735), (0.68, 0.742), (0.78, 0.725), (0.80, 0.692), (0.76, 0.658), (0.60, 0.632), (0.44, 0.640)]
    decal('HeadBezel', grow(head, 0.012), P_FRONT, 'det', offset=0.003, mirror=True, rnd=0.02, min_cos=0.22)
    decal('HeadReflector', head, P_FRONT, 'bright', offset=0.005, mirror=True, rnd=0.025, min_cos=0.22)
    # deux projecteurs ronds + feu de jour en virgule
    for cy in (0.50, 0.66):
        circ = [(cy + 0.034 * math.cos(a), 0.690 + 0.030 * math.sin(a)) for a in [i * math.pi / 10 for i in range(20)]]
        decal('Projector', circ, P_FRONT, 'lensF', offset=0.008, mirror=True)
    decal('DRL', strip([(0.42, 0.652), (0.60, 0.645), (0.78, 0.668)], 0.012), P_FRONT, 'lensF', offset=0.008, mirror=True, min_cos=0.35)
    # barrette de calandre chromée + calandre haute
    decal('GrilleUpper', [(0.31, 0.690), (0.31, 0.615), (-0.31, 0.615), (-0.31, 0.690)], P_FRONT, 'det', offset=0.004, rnd=0.02)
    decal('GrilleBar', strip([(-0.33, 0.660), (0.33, 0.660)], 0.016), P_FRONT, 'bright', offset=0.007)
    # prise d'air basse hexagonale + lames
    intake = [(0.20, 0.52), (0.42, 0.50), (0.50, 0.40), (0.44, 0.31), (-0.44, 0.31), (-0.50, 0.40), (-0.42, 0.50), (-0.20, 0.52)]
    decal('Intake', intake, P_FRONT, 'det', offset=0.004, rnd=0.03)
    for z in (0.37, 0.44):
        decal('IntakeSlat', strip([(-0.44, z), (0.44, z)], 0.008), P_FRONT, 'bright', offset=0.006)
    # antibrouillards (cerclés de noir)
    fog = [(0.66 + 0.06 * math.cos(a), 0.41 + 0.045 * math.sin(a)) for a in [i * math.pi / 10 for i in range(20)]]
    decal('FogRing', grow(fog, 0.015), P_FRONT, 'det', offset=0.004, mirror=True)
    decal('Fog', fog, P_FRONT, 'lensF', offset=0.006, mirror=True)
    # plaque avant (support) et lèvre basse
    decal('PlateF', [(0.26, 0.585), (0.26, 0.53), (-0.26, 0.53), (-0.26, 0.585)], P_FRONT, 'det', offset=0.004)
    decal('Lip', [(0.70, 0.28), (0.72, 0.235), (-0.72, 0.235), (-0.70, 0.28)], P_FRONT, 'det', offset=0.003, rnd=0.02)
    # ---- arrière : feux en bandeau horizontal, plaque dans le bouclier ----
    tail = [(0.30, 0.955), (0.62, 0.968), (0.80, 0.955), (0.84, 0.915), (0.78, 0.878), (0.30, 0.882)]
    decal('TailFrame', grow(tail, 0.01), P_REAR, 'det', offset=0.003, mirror=True, rnd=0.015, min_cos=0.35)
    decal('TailLamp', tail, P_REAR, 'lensR', offset=0.006, mirror=True, rnd=0.015, min_cos=0.35)
    decal('TailInsert', [(0.34, 0.935), (0.46, 0.937), (0.46, 0.900), (0.34, 0.900)], P_REAR, 'lensF', offset=0.008, mirror=True, rnd=0.01)
    decal('TailBand', [(0.30, 0.942), (0.30, 0.900), (-0.30, 0.900), (-0.30, 0.942)], P_REAR, 'lensR', offset=0.007, rnd=0.012)
    decal('HatchSeam', strip([(-0.86, 0.62), (0.86, 0.62)], 0.006), P_REAR, 'det', offset=0.0015)
    decal('PlateR', [(0.27, 0.575), (0.27, 0.455), (-0.27, 0.455), (-0.27, 0.575)], P_REAR, 'det', offset=0.004, rnd=0.01)
    decal('Diffuser', [(0.70, 0.36), (0.72, 0.30), (-0.72, 0.30), (-0.70, 0.36)], P_REAR, 'det', offset=0.003, rnd=0.02)
    decal('Reflex', [(0.58, 0.40), (0.72, 0.40), (0.72, 0.375), (0.58, 0.375)], P_REAR, 'lensR', offset=0.005, mirror=True)
    decal('Handle', [(0.10, 0.70), (0.10, 0.665), (-0.10, 0.665), (-0.10, 0.70)], P_REAR, 'bright', offset=0.006, rnd=0.01)
    # échappement
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.032, depth=0.12, location=(-1.98, 0.42, 0.30), rotation=(0, math.pi / 2, 0))
    ex = bpy.context.active_object
    ex.data.materials.append(M['bright'])


def box(name, loc, size, matname, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = ob.modifiers.new('bv', 'BEVEL')
        bv.width = bevel
        bv.segments = 3
        apply_mods(ob)
    ob.data.materials.clear()
    ob.data.materials.append(M[matname])
    shade_smooth(ob, 35)
    return ob


def mirrors_handles():
    for sgn in (1, -1):
        # rétroviseur : coque galbée (sphère aplatie) + pied
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1, location=(0.79, sgn * 0.975, 0.975))
        m = bpy.context.active_object
        m.name = f'Mirror{sgn}'
        m.scale = (0.11, 0.12, 0.062)
        bpy.ops.object.transform_apply(scale=True)
        for v in m.data.vertices:          # coque en goutte : avant arrondi, arrière tronqué
            if v.co.x < -0.02:
                v.co.x = -0.02 + (v.co.x + 0.02) * 0.25
        bpy.ops.object.transform_apply(scale=True)
        m.data.materials.append(M['paint'])
        shade_smooth(m, 80)
        box(f'MirrorGlass{sgn}', (0.745, sgn * 0.975, 0.975), (0.008, 0.20, 0.10), 'bright', bevel=0.003)
        box(f'MirrorArm{sgn}', (0.84, sgn * 0.90, 0.93), (0.05, 0.12, 0.04), 'det', bevel=0.01)
        # poignées affleurantes
        for x in (0.55, -0.55):
            box(f'Handle{sgn}{x}', (x, sgn * 0.857, 0.80), (0.15, 0.025, 0.032), 'bright', bevel=0.008)
        # répétiteur de clignotant sur l'aile
        box(f'Repeater{sgn}', (1.25, sgn * 0.853, 0.70), (0.06, 0.012, 0.022), 'lensF', bevel=0.004)
    # essuie-glaces
    for y in (-0.05, 0.42):
        box(f'Wiper{y}', (0.92, y, 0.888), (0.03, 0.55, 0.012), 'det', rot=(0, 0.25, 0.10))
    # becquet de pavillon
    box('Spoiler', (-1.31, 0, 1.392), (0.16, 1.08, 0.025), 'paint', rot=(0, 0.32, 0), bevel=0.01)
    box('BrakeLight', (-1.36, 0, 1.383), (0.02, 0.40, 0.015), 'lensR')
    # antenne courte sur le pavillon (arrière)
    box('Antenna', (-1.05, 0, 1.50), (0.12, 0.025, 0.045), 'det', rot=(0, -0.3, 0), bevel=0.01)


def interior():
    """habitacle sommaire visible par les vitres (planche, sièges, appuis-tête)."""
    box('Dash', (0.62, 0, 0.88), (0.45, 1.40, 0.18), 'det', bevel=0.04)
    for y in (-0.38, 0.38):
        box(f'SeatF{y}', (-0.15, y, 0.62), (0.50, 0.48, 0.14), 'det', bevel=0.05)
        box(f'SeatBackF{y}', (-0.36, y, 0.92), (0.12, 0.46, 0.55), 'det', rot=(0, -0.22, 0), bevel=0.05)
        box(f'HeadrestF{y}', (-0.46, y, 1.26), (0.08, 0.26, 0.18), 'det', bevel=0.04)
        box(f'Wheel{y}' if False else f'Steering{y}', (0.36, 0.38, 0.98), (0.04, 0.36, 0.36), 'det', rot=(0, 0.45, 0)) if y > 0 else None
    box('SeatR', (-1.00, 0, 0.64), (0.45, 1.30, 0.14), 'det', bevel=0.05)
    box('SeatBackR', (-1.22, 0, 0.92), (0.12, 1.28, 0.52), 'det', rot=(0, -0.18, 0), bevel=0.05)
    box('Floor', (-0.30, 0, 0.42), (2.40, 1.45, 0.04), 'det')


# ---------------------------------------------------------------
# roues
# ---------------------------------------------------------------
def lathe(name, profile, segs, matname, y_axis=True):
    """révolution d'un profil (r, y) autour de l'axe Y."""
    verts, faces = [], []
    n = len(profile)
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for (r, y) in profile:
            verts.append((r * math.cos(a), y, r * math.sin(a)))
    for i in range(segs):
        j = (i + 1) % segs
        for k in range(n - 1):
            faces.append([i * n + k, j * n + k, j * n + k + 1, i * n + k + 1])
    ob = mesh_obj(name, verts, faces, matname)
    shade_smooth(ob, 30)
    return ob


def build_wheel(name, x, side):
    objs = []
    w = 0.195
    # pneu : profil de flanc arrondi + bande de roulement
    prof = []
    for i in range(13):
        a = -math.pi / 2 + math.pi * i / 12
        prof.append((WR - 0.055 + 0.055 * math.cos(a) * 1.0 + (0.0 if abs(a) < 1.2 else 0), w / 2 * math.sin(a)))
    prof = [(0.208, -w / 2 + 0.01)] + prof + [(0.208, w / 2 - 0.01)]
    tire = lathe(name + '_tire', prof, 40, 'tire')
    objs.append(tire)
    # jante : voile creux + 5 doubles branches
    rim_prof = [(0.040, 0.06), (0.06, 0.07), (0.075, 0.082), (0.18, 0.075), (0.200, 0.09), (0.210, 0.095), (0.212, 0.06), (0.212, -0.08)]
    rim = lathe(name + '_rimbarrel', rim_prof, 40, 'rim')
    objs.append(rim)
    for k in range(5):
        for off in (-0.13, 0.13):
            a = 2 * math.pi * k / 5 + off
            bpy.ops.mesh.primitive_cube_add(size=1)
            sp = bpy.context.active_object
            sp.scale = (0.135, 0.022, 0.026)
            sp.location = (math.cos(a) * 0.125, 0.082, math.sin(a) * 0.125)
            sp.rotation_euler = (0, -a, 0)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            bv = sp.modifiers.new('bv', 'BEVEL')
            bv.width = 0.008
            bv.segments = 2
            apply_mods(sp)
            sp.data.materials.clear()
            sp.data.materials.append(M['rim'])
            sp.name = name + f'_spoke{k}{off}'
            objs.append(sp)
    # moyeu + écrous + cache central sans logo
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.052, depth=0.03, location=(0, 0.088, 0), rotation=(math.pi / 2, 0, 0))
    hub = bpy.context.active_object
    hub.data.materials.append(M['rim'])
    objs.append(hub)
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.011, depth=0.03, location=(math.cos(a) * 0.036, 0.10, math.sin(a) * 0.036), rotation=(math.pi / 2, 0, 0))
        nut = bpy.context.active_object
        nut.data.materials.append(M['bright'])
        objs.append(nut)
    # disque de frein + étrier
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.15, depth=0.02, location=(0, -0.02, 0), rotation=(math.pi / 2, 0, 0))
    disc = bpy.context.active_object
    disc.data.materials.append(M['rim'])
    objs.append(disc)
    box(name + '_caliper', (-0.10, 0.0, 0.10), (0.07, 0.06, 0.10), 'det', rot=(0, 0.7, 0), bevel=0.01)
    objs.append(bpy.context.active_object)
    # assemblage + orientation (côté gauche : miroir)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in bpy.context.selected_objects:
        if o not in objs:
            o.select_set(False)
    bpy.ops.object.join()
    wh = bpy.context.active_object
    wh.name = name
    if side < 0:
        wh.scale = (1, -1, 1)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    wh.location = (x, side * TRACK, WR)
    return wh


# ---------------------------------------------------------------
def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def build():
    clear()
    global M
    M = make_mats()
    body = build_body()
    make_bvh(body)
    glazing()
    lamps_and_grille()
    mirrors_handles()
    interior()
    for name, x, side in (('WheelFL', AX_F, 1), ('WheelFR', AX_F, -1), ('WheelRL', AX_R, 1), ('WheelRR', AX_R, -1)):
        build_wheel(name, x, side)
    return body


def render(prefix='lutece'):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.render.film_transparent = False
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    nt = world.node_tree
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'
    except Exception:
        pass
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
    # sol
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    gp = bpy.context.active_object
    gm = mat('ground', (0.32, 0.32, 0.33), 0.0, 0.6)
    gp.data.materials.append(gm)
    # soleil
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 10), rotation=(0.7, 0.2, 0.9))
    bpy.context.active_object.data.energy = 3.5
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    link(cam)
    sc.camera = cam
    cam_data.lens = 50
    views = {'34av': (5.6, -3.8, 1.5), 'profil': (0.0, -7.2, 0.9), '34ar': (-5.4, -3.9, 1.7), 'face': (7.5, 0.0, 1.0)}
    for k, pos in views.items():
        cam.location = pos
        d = Vector((0, 0, 0.62)) - Vector(pos)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(SNAPS, f'{prefix}_{k}.png')
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(gp, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def export():
    # convertit courbes/modificateurs en maillages
    for o in list(bpy.data.objects):
        o.select_set(o.type in ('MESH', 'CURVE'))
    bpy.context.view_layer.objects.active = bpy.data.objects['Body']
    bpy.ops.object.convert(target='MESH')
    path = os.path.join(ASSETS, 'lutece.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False)
    print('GLB', path, os.path.getsize(path))


if __name__ == '__main__':
    build()
    if '--render' in sys.argv:
        render()
    export()
