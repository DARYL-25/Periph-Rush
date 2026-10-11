# ============================================================
# Périph' Rush — kit de modélisation Blender des véhicules (designs originaux)
# Cage lofté (sections) → Subdivision → détails en « décalques projetés »
# (contour 2D net → Delaunay contraint → lancer de rayons sur la caisse).
# Chaque véhicule est décrit par un dictionnaire de spécification (voir
# fleet_build.py). Deux niveaux de détail : 'hi' (joueur) et 'lo' (trafic).
# Repère : X = longueur (avant = +X), Y = largeur, Z = hauteur.
# Matériaux nommés pour le jeu : paint glass det bright lensF lensR tire rim
# ============================================================
import bpy
import bmesh
import math
import os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils import geometry as GEO

S = {}          # spécification courante
M = {}          # matériaux
BVH = None
LOD = 'hi'


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


# raccourcis vers la spécification
def top(x): return interp(S['TOP'], x)
def belt(x): return interp(S['BELT'], x)
def plan(x): return interp(S['PLAN'], x)
def bottom(x): return interp(S['BOTTOM'], x)
def roof_half(x): return interp(S['ROOF_HALF'], x)
def roof_edge_z(x): return top(x) - 0.075
def AXF(): return S['L'] / 2 - S['ovF']
def AXR(): return AXF() - S['WB']


# ---------------------------------------------------------------
# matériaux
# ---------------------------------------------------------------
def mat(name, color, metallic=0.0, rough=0.5, coat=0.0):
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
    m.diffuse_color = (*color, 1.0)
    return m


def make_mats(paint=(0.55, 0.06, 0.05)):
    return {
        'paint': mat('paint', paint, 0.55, 0.28, coat=1.0),
        'glass': mat('glass', (0.02, 0.03, 0.04), 0.0, 0.04),
        'det': mat('det', (0.035, 0.037, 0.04), 0.0, 0.7),
        'bright': mat('bright', (0.80, 0.81, 0.83), 1.0, 0.18),
        'lensF': mat('lensF', (0.82, 0.86, 0.90), 0.2, 0.08),
        'lensR': mat('lensR', (0.55, 0.03, 0.03), 0.1, 0.12),
        'tire': mat('tire', (0.025, 0.025, 0.028), 0.0, 0.88),
        'rim': mat('rim', (0.70, 0.72, 0.75), 1.0, 0.26),
    }


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
# caisse
# ---------------------------------------------------------------
def section(x):
    L = S['L']
    X0, X1 = L / 2, -L / 2
    zb, zt = bottom(x), top(x)
    zbelt = min(belt(x), zt - 0.02)
    w = plan(x)
    CAB = S['CABIN']
    cab = CAB[0] - 0.12 <= x <= CAB[1] + 0.05
    end = 1.0
    if x > X0 - 0.27:
        end = lerp(1.0, S.get('noseTaper', 0.86), smooth((x - (X0 - 0.27)) / 0.27))
    if x < X1 + 0.22:
        end = lerp(1.0, S.get('tailTaper', 0.90), smooth(((X1 + 0.22) - x) / 0.22))
    sq = S.get('boxy', 0.0)                   # 0 = galbé, 1 = carré (utilitaires)
    pts = [(0.0, zb), (w * lerp(0.70, 0.9, sq) * end, zb - 0.005), (w * lerp(0.93, 0.99, sq) * end, zb + 0.04),
           (w * lerp(0.985, 1.0, sq), zb + 0.16)]
    zs = lerp(zb, zbelt, 0.72)
    pts += [(w, zs - 0.08), (w * 0.995, zs), (w * 0.975, zbelt - 0.01)]
    if cab and zt - zbelt > 0.12:
        rh = roof_half(x)
        gw = w * lerp(0.93, 0.975, sq)
        pts += [(gw, zbelt + 0.015), (lerp(gw, rh + 0.05, 0.55), lerp(zbelt, zt, 0.55)),
                (rh + lerp(0.035, 0.012, sq), zt - lerp(0.045, 0.02, sq)), (rh - 0.04, zt - 0.006), (rh * 0.55, zt + 0.004)]
    else:
        pts += [(w * lerp(0.90, 0.97, sq), zt - 0.012), (w * 0.55, zt + 0.006)]
    pts.append((0.0, zt + 0.006))
    return pts


def stations():
    L = S['L']
    base = [2.010, 2.000, 1.985, 1.96, 1.92, 1.86, 1.78, 1.68, 1.58, 1.48, 1.38, 1.28, 1.18, 1.08, 0.98,
            0.90, 0.80, 0.68, 0.55, 0.40, 0.25, 0.10, -0.05, -0.20, -0.40, -0.60, -0.80, -0.95, -1.10, -1.25,
            -1.38, -1.50, -1.62, -1.72, -1.82, -1.90, -1.95, -1.985, -2.000, -2.010]
    if LOD == 'lo':
        base = [2.010, 1.99, 1.95, 1.86, 1.72, 1.55, 1.35, 1.12, 0.92, 0.70, 0.40, 0.05, -0.30, -0.65, -0.95, -1.22, -1.45, -1.65, -1.82, -1.93, -1.985, -2.010]
    k = L / 4.02
    # les points de rupture (pare-brise, lunette) restent présents
    xs = sorted(set([round(b * k, 4) for b in base] + [S['WS'][0], S['WS'][1], S['CABIN'][0], S['CABIN'][1]]), reverse=True)
    return xs


def build_body():
    xs = stations()
    rings = [section(x) for x in xs]

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
    N = 16 if LOD == 'hi' else 12
    verts, faces, idx = [], [], {}
    for i, (x, r) in enumerate(zip(xs, rings)):
        rr = resample(r, N)
        for k, (y, z) in enumerate(rr):
            if k in (0, N - 1):
                idx[(i, k, 0)] = len(verts)
                verts.append((x, 0.0, z))
                idx[(i, k, 1)] = idx[(i, k, -1)] = idx[(i, k, 0)]
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
    for i, flip in ((0, False), (len(xs) - 1, True)):
        ring = [idx[(i, k, 1)] for k in range(N)] + [idx[(i, k, -1)] for k in range(N - 2, 0, -1)]
        faces.append(ring[::-1] if not flip else ring)
    ob = mesh_obj('Body', verts, faces, 'paint')
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 2 if LOD == 'hi' else 1
    apply_mods(ob)
    # passages de roue
    WR, AR = S['WR'], S['ARCH_R']
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        for ax in (AXF(), AXR()):
            if math.hypot(c.x - ax, c.z - WR) < AR and abs(c.y) > S['W'] * 0.2:
                kill.append(f)
                break
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    for ax in (AXF(), AXR()):
        for sgn in (1, -1):
            arch_liner(ax, sgn)
    shade_smooth(ob, 60)
    return ob


def arch_liner(ax, sgn):
    WR, AR, W = S['WR'], S['ARCH_R'], S['W']
    verts, faces = [], []
    n = 22 if LOD == 'hi' else 12
    y0, y1 = sgn * W * 0.21, sgn * (W / 2 + 0.03)
    for i in range(n + 1):
        a = math.pi * i / n
        x = ax + math.cos(a) * AR
        z = WR + math.sin(a) * AR
        verts += [(x, y0, z), (x, y1, z)]
    for i in range(n):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        faces.append([a, b, c, d] if sgn > 0 else [a, d, c, b])
    mesh_obj('ArchLiner', verts, faces, 'det')


# ---------------------------------------------------------------
# décalques projetés
# ---------------------------------------------------------------
def make_bvh(body):
    global BVH
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    BVH = BVHTree.FromBMesh(bm)
    bm.free()


def P_SIDE(sgn):
    return lambda u, v: (Vector((u, sgn * 3.0, v)), Vector((0, -sgn, 0)))


P_FRONT = lambda u, v: (Vector((4.5, u, v)), Vector((-1, 0, 0)))
P_REAR = lambda u, v: (Vector((-4.5, u, v)), Vector((1, 0, 0)))
P_TOP = lambda u, v: (Vector((u, v, 4.0)), Vector((0, 0, -1)))


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
    out = []
    m = len(poly)
    for i in range(m):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % m])
        d0, d1 = (p0 - p1), (p2 - p1)
        rr = min(r, d0.length * 0.45, d1.length * 0.45)
        a = p1 + d0.normalized() * rr
        b = p1 + d1.normalized() * rr
        for k in range(n + 1):
            t = k / n
            q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b
            out.append((q.x, q.y))
    return out


def decal(name, poly, proj, matname, offset=0.004, step=0.035, mirror=False, rnd=0.0, min_cos=0.0):
    """contour poly (u,v) → maillage projeté sur la caisse. mirror : duplique en -u."""
    if LOD == 'lo':
        step = max(step, 0.06)
        offset = offset * 1.8 + 0.002          # triangles plus grands : on décolle davantage
    if min_cos == 0.0 and proj in (P_FRONT, P_REAR):
        min_cos = 0.2                          # jamais de bavure rasante sur les flancs
    edge_step = 0.008 if LOD == 'hi' else 0.025
    polys = [poly]
    if mirror:
        polys.append([(-u, v) for (u, v) in poly][::-1])
    verts, faces = [], []
    for pl in polys:
        if rnd:
            pl = rounded(pl, rnd, 5 if LOD == 'hi' else 2)
        outline = resample_poly(pl, edge_step)
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
        try:
            cdt = GEO.delaunay_2d_cdt([Vector(p) for p in allp], [(i, (i + 1) % nO) for i in range(nO)], [list(range(nO))], 1, 1e-7)
        except Exception:
            continue
        vco, tris = cdt[0], cdt[2]
        base = len(verts)
        ok = []
        for c in vco:
            o, d = proj(c.x, c.y)
            hit, nrm, _, _ = BVH.ray_cast(o, d, 10.0)
            if hit is None:
                ok.append(None)
                verts.append((0, 0, 0))
                continue
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
            tt = list(t) if fn.dot(ok[t[0]]) >= 0 else [t[0], t[2], t[1]]
            faces.append([base + i for i in tt])
    if not faces:
        return None
    ob = mesh_obj(name, verts, faces, matname)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    shade_smooth(ob, 35)
    return ob


def strip(polyline, width):
    left, right = [], []
    for i, p in enumerate(polyline):
        a = Vector(polyline[max(i - 1, 0)])
        b = Vector(polyline[min(i + 1, len(polyline) - 1)])
        t = (b - a).normalized()
        n = Vector((-t.y, t.x)) * (width / 2)
        left.append((p[0] + n.x, p[1] + n.y))
        right.append((p[0] - n.x, p[1] - n.y))
    return left + right[::-1]


def grow(poly, d, ky=1.6):
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    out = []
    for (x, z) in poly:
        v = Vector((x - cx, z - cz)).normalized()
        out.append((x + v.x * d, z + v.y * d * ky))
    return out


def ellipse(cu, cv, ru, rv, n=20):
    return [(cu + ru * math.cos(a), cv + rv * math.sin(a)) for a in [i * 2 * math.pi / n for i in range(n)]]


# ---------------------------------------------------------------
# vitrages et côtés
# ---------------------------------------------------------------
def dlo():
    """contour des vitres latérales (x, z), paramétré par S['DLO']."""
    D = S['DLO']
    pts = [(D['a_base'], belt(D['a_base']) + 0.035)]
    for t in (0.25, 0.5, 0.75, 1.0):
        x = lerp(D['a_base'] - 0.08, D['a_top'], t)
        pts.append((x, lerp(belt(D['a_base']) + 0.2, roof_edge_z(D['a_top']) - 0.012, smooth(t)) if t < 1 else roof_edge_z(x) - 0.012))
    x = D['a_top'] - 0.15
    while x > D['c_top'] + 0.05:
        pts.append((x, roof_edge_z(x) - 0.012))
        x -= 0.3
    pts.append((D['c_top'], roof_edge_z(D['c_top']) - 0.03))
    for (x, dz) in D.get('c_line', [(D['c_base'], 0.035)]):
        pts.append((x, belt(x) + dz))
    x = D['c_base'] + 0.2
    while x < D['a_base'] - 0.1:
        pts.append((x, belt(x) + 0.032))
        x += 0.35
    return pts


def glazing():
    D = S['DLO']
    for sgn in (1, -1):
        side = P_SIDE(sgn)
        poly = dlo()
        frame = grow(poly, 0.018)
        decal(f'WinFrame{sgn}', frame if sgn > 0 else frame[::-1], side, 'det', offset=0.003, rnd=0.03)
        decal(f'Glass{sgn}', poly if sgn > 0 else poly[::-1], side, 'glass', offset=0.0055, rnd=0.035)
        bx = D['b_x']
        decal(f'Bpillar{sgn}', [(bx + 0.06, belt(bx)), (bx - 0.06, belt(bx)), (bx - 0.08, top(bx)), (bx + 0.04, top(bx))], side, 'det', offset=0.007)
        if D.get('q_x'):
            qx = D['q_x']
            decal(f'Qdiv{sgn}', strip([(qx, belt(qx)), (qx - 0.05, roof_edge_z(qx - 0.05))], 0.035), side, 'det', offset=0.007)
        zlow = bottom(0) + 0.06
        for li in S['SEAMS']:
            decal(f'Seam{sgn}', strip(li, 0.006), side, 'det', offset=0.0015, step=0.05)
        if S.get('rub', True):
            zr = S.get('rub_z', 0.46)
            decal(f'Rub{sgn}', strip([(D['a_base'] - 0.02, zr), (D['c_base'] + 0.45, zr + 0.015)], 0.045), side, 'det', offset=0.005, rnd=0.02)
        decal(f'Sill{sgn}', [(AXF() - S['ARCH_R'] - 0.07, zlow - 0.04), (AXF() - S['ARCH_R'] - 0.07, zlow + 0.03),
                             (AXR() + S['ARCH_R'] + 0.07, zlow + 0.03), (AXR() + S['ARCH_R'] + 0.07, zlow - 0.04)],
              side, 'det', offset=0.003, rnd=0.02)
        if S.get('cladding'):
            # bas de caisse et ailes en plastique noir (SUV)
            decal(f'Clad{sgn}', [(AXF() + S['ARCH_R'] + 0.1, zlow + 0.12), (AXF() + S['ARCH_R'] + 0.1, zlow - 0.05),
                                 (AXR() - S['ARCH_R'] - 0.1, zlow - 0.05), (AXR() - S['ARCH_R'] - 0.1, zlow + 0.12)], side, 'det', offset=0.004, rnd=0.03)
        for ax in (AXF(), AXR()):
            arch_trim(ax, sgn, S.get('archTrimW', 0.055))
    WS, RG = S['WS'], S['RG']
    wsp = [(WS[1] - 0.005, roof_half(WS[1]) + 0.07), (WS[1] - 0.005, -roof_half(WS[1]) - 0.07),
           (WS[0], -roof_half(WS[0]) + 0.02), (WS[0], roof_half(WS[0]) - 0.02)]
    decal('WsFrame', grow(wsp, 0.02), P_TOP, 'det', offset=0.003, rnd=0.06)
    decal('Windshield', wsp, P_TOP, 'glass', offset=0.0055, rnd=0.06)
    rgp = [(RG[1], roof_half(RG[1]) - 0.05), (RG[1], -roof_half(RG[1]) + 0.05), (RG[0], -roof_half(RG[0]) + 0.02), (RG[0], roof_half(RG[0]) - 0.02)]
    proj = P_REAR if S.get('rearVertical') else P_TOP
    if S.get('rearVertical'):
        rgp = [(roof_half(RG[1]) - 0.06, top(RG[1]) - 0.08), (-roof_half(RG[1]) + 0.06, top(RG[1]) - 0.08),
               (-roof_half(RG[1]) + 0.02, belt(RG[0]) + 0.05), (roof_half(RG[1]) - 0.02, belt(RG[0]) + 0.05)]
    decal('RgFrame', grow(rgp, 0.02), proj, 'det', offset=0.003, rnd=0.05)
    decal('RearGlass', rgp, proj, 'glass', offset=0.0055, rnd=0.05)
    hx = S['L'] / 2 - S.get('hoodSeamBack', 0.09)
    decal('HoodSeam', strip([(hx, -plan(hx) * 0.75), (hx, plan(hx) * 0.75)], 0.006), P_TOP, 'det', offset=0.0015)


def arch_trim(ax, sgn, wdt=0.055):
    WR, AR = S['WR'], S['ARCH_R']
    verts, faces = [], []
    n = 36 if LOD == 'hi' else 14
    for i in range(n + 1):
        a = math.pi * (-0.06 + 1.12 * i / n)
        ca, sa = math.cos(a), math.sin(a)
        r1 = AR + wdt + 0.01
        o = Vector((ax + ca * r1, sgn * 3.0, WR + sa * r1))
        hit, nrm, _, _ = BVH.ray_cast(o, Vector((0, -sgn, 0)), 10.0)
        y = abs(hit.y) if hit else S['W'] / 2 - 0.02
        z0 = max(WR + sa * (AR - 0.012), 0.2)
        z1 = max(WR + sa * r1, 0.21)
        x0, x1 = ax + ca * (AR - 0.012), ax + ca * r1
        verts += [(x1, sgn * (y + 0.004), z1), (x0, sgn * (y + 0.016), z0), (x0, sgn * (y - 0.09), z0)]
    for i in range(n):
        for k in range(2):
            a, b = 3 * i + k, 3 * i + k + 1
            c, d = 3 * (i + 1) + k + 1, 3 * (i + 1) + k
            faces.append([a, b, c, d] if sgn > 0 else [a, d, c, b])
    ob = mesh_obj(f'ArchTrim{sgn}', verts, faces, 'det')
    shade_smooth(ob, 60)


# ---------------------------------------------------------------
# pièces rapportées
# ---------------------------------------------------------------
def box(name, loc, size, matname, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel and LOD == 'hi':
        bv = ob.modifiers.new('bv', 'BEVEL')
        bv.width = bevel
        bv.segments = 3
        apply_mods(ob)
    ob.data.materials.clear()
    ob.data.materials.append(M[matname])
    shade_smooth(ob, 35)
    return ob


def body_y(x, z, sgn=1):
    hit, _, _, _ = BVH.ray_cast(Vector((x, sgn * 3.0, z)), Vector((0, -sgn, 0)), 10.0)
    return abs(hit.y) if hit else plan(x)


def fittings():
    D = S['DLO']
    W = S['W']
    for sgn in (1, -1):
        mx = D['a_base'] - 0.11
        mz = belt(mx) + 0.085
        my = body_y(mx, mz) + 0.10
        seg = (24, 14) if LOD == 'hi' else (12, 8)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=(mx, sgn * my, mz))
        m = bpy.context.active_object
        m.name = f'Mirror{sgn}'
        m.scale = (0.11, 0.12, 0.062) if S.get('kind') != 'van' else (0.13, 0.13, 0.12)
        bpy.ops.object.transform_apply(scale=True)
        for v in m.data.vertices:
            if v.co.x < -0.02:
                v.co.x = -0.02 + (v.co.x + 0.02) * 0.25
        m.data.materials.append(M['paint' if not S.get('blackMirrors') else 'det'])
        shade_smooth(m, 80)
        box(f'MirrorGlass{sgn}', (mx - 0.045, sgn * my, mz), (0.008, 0.20, 0.10 if S.get('kind') != 'van' else 0.2), 'bright', bevel=0.003)
        box(f'MirrorArm{sgn}', (mx + 0.04, sgn * (my - 0.08), mz - 0.04), (0.05, 0.12, 0.04), 'det', bevel=0.01)
        for x in S['HANDLES']:
            hz = belt(x) - 0.09
            box(f'Handle{sgn}', (x, sgn * (body_y(x, hz) + 0.006), hz), (0.15, 0.025, 0.032), S.get('handleMat', 'bright'), bevel=0.008)
        rx = AXF() + 0.05
        box(f'Repeater{sgn}', (rx, sgn * (body_y(rx, 0.70) + 0.004), belt(rx) - 0.12), (0.06, 0.012, 0.022), 'lensF', bevel=0.004)
    WS = S['WS']
    for y in (-0.05 * W / 1.72, 0.42 * W / 1.72):
        box('Wiper', (WS[1] - 0.02, y, top(WS[1]) + 0.012), (0.03, 0.55 * W / 1.72, 0.012), 'det', rot=(0, 0.25, 0.10))
    re = S['CABIN'][0] + 0.32
    if S.get('spoiler', True):
        box('Spoiler', (re, 0, top(re) - 0.01), (0.16, roof_half(re) * 1.9, 0.025), 'paint', rot=(0, 0.32, 0), bevel=0.01)
        box('BrakeLight', (re - 0.05, 0, top(re) - 0.02), (0.02, 0.40, 0.015), 'lensR')
    else:
        box('BrakeLight', (re + 0.05, 0, top(re + 0.05) - 0.03), (0.02, 0.40, 0.02), 'lensR')
    ax = S['CABIN'][0] + 0.55
    box('Antenna', (ax, 0, top(ax) + 0.03), (0.12, 0.025, 0.045), 'det', rot=(0, -0.3, 0), bevel=0.01)
    if S.get('rails'):
        for sgn in (1, -1):
            x0, x1 = S['WS'][0] - 0.05, S['CABIN'][0] + 0.25
            n = 6
            for i in range(n):
                xa = lerp(x0, x1, i / n)
                xb = lerp(x0, x1, (i + 1) / n)
                xm = (xa + xb) / 2
                box('Rail', (xm, sgn * (roof_half(xm) * 0.86), top(xm) - 0.012 + 0.03), (abs(xb - xa) + 0.01, 0.035, 0.03), 'bright' if S['rails'] == 'alu' else 'det')
            for xf in (x0 + 0.05, x1 - 0.05):   # pieds de barres
                box('RailFoot', (xf, sgn * (roof_half(xf) * 0.86), top(xf) - 0.01), (0.07, 0.04, 0.05), 'det')
    if S.get('taxi'):
        tx = S['WS'][0] - 0.25
        box('TaxiSign', (tx, 0, top(tx) + 0.07), (0.20, 0.42, 0.12), 'lensF', bevel=0.02)
        box('TaxiBase', (tx, 0, top(tx) + 0.012), (0.24, 0.46, 0.03), 'det')
    for (ex, ey, ez) in S.get('EXHAUST', []):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16 if LOD == 'hi' else 8, radius=0.032, depth=0.12, location=(ex, ey, ez), rotation=(0, math.pi / 2, 0))
        bpy.context.active_object.data.materials.append(M['bright'])


def interior():
    W, cab = S['W'], S['CABIN']
    zf = bottom(0) + 0.2
    if LOD == 'lo':
        box('Cabin', ((cab[0] + cab[1]) / 2, 0, zf + 0.35), ((cab[1] - cab[0]) * 0.9, W * 0.8, 0.5), 'det')
        return
    dx = S['WS'][1] - 0.42
    box('Dash', (dx, 0, belt(dx) - 0.02), (0.40, W * 0.80, 0.16), 'det', bevel=0.04)
    sx = S['DLO']['b_x'] - 0.02
    for y in (-0.22 * W, 0.22 * W):
        box('SeatF', (sx, y, zf + 0.2), (0.50, 0.48, 0.14), 'det', bevel=0.05)
        box('SeatBackF', (sx - 0.21, y, zf + 0.5), (0.12, 0.46, 0.55), 'det', rot=(0, -0.22, 0), bevel=0.05)
        box('HeadrestF', (sx - 0.31, y, zf + 0.84), (0.08, 0.26, 0.18), 'det', bevel=0.04)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.018, location=(dx - 0.24, 0.22 * W, belt(dx) + 0.06), rotation=(0, math.pi / 2 - 0.45, 0))
    bpy.context.active_object.data.materials.append(M['det'])
    rx = sx - 0.85
    box('SeatR', (rx, 0, zf + 0.22), (0.45, W * 0.76, 0.14), 'det', bevel=0.05)
    box('SeatBackR', (rx - 0.22, 0, zf + 0.5), (0.12, W * 0.75, 0.52), 'det', rot=(0, -0.18, 0), bevel=0.05)


# ---------------------------------------------------------------
# roues
# ---------------------------------------------------------------
def lathe(name, profile, segs, matname):
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
    WR = S['WR']
    w = S.get('tireW', 0.195)
    rr = WR - S.get('sidewall', 0.097)           # rayon de jante
    hi = LOD == 'hi'
    objs = []
    prof = []
    nseg = 12 if hi else 6
    for i in range(nseg + 1):
        a = -math.pi / 2 + math.pi * i / nseg
        prof.append((WR - 0.05 + 0.05 * math.cos(a), w / 2 * math.sin(a)))
    prof = [(rr - 0.004, -w / 2 + 0.01)] + prof + [(rr - 0.004, w / 2 - 0.01)]
    segs = 40 if hi else 20
    objs.append(lathe(name + '_tire', prof, segs, 'tire'))
    if hi:   # sculptures de la bande de roulement (rainures)
        for k in range(48):
            a = 2 * math.pi * k / 48
            box(name + '_tread', (math.cos(a) * (WR + 0.001), 0, math.sin(a) * (WR + 0.001)), (0.012, w * 0.82, 0.004), 'det', rot=(0, -a + math.pi / 2, 0))
            objs.append(bpy.context.active_object)
    face = w / 2 - 0.015
    rim_prof = [(0.040, face - 0.035), (0.06, face - 0.025), (0.075, face - 0.013), (rr - 0.03, face - 0.02), (rr - 0.01, face - 0.005), (rr, face), (rr + 0.002, face - 0.035), (rr + 0.002, -w / 2 + 0.02)]
    objs.append(lathe(name + '_rimbarrel', rim_prof, segs, 'rim'))
    style = S.get('rimStyle', 'double5')
    spokes = {'double5': [(k * 72, d) for k in range(5) for d in (-7.5, 7.5)], 'five': [(k * 72, 0) for k in range(5)],
              'six': [(k * 60, 0) for k in range(6)], 'ten': [(k * 36, 0) for k in range(10)], 'cover': []}[style]
    if not hi and style == 'double5':
        spokes = [(k * 72, 0) for k in range(5)]
    for (deg, off) in spokes:
        a = math.radians(deg + off)
        bpy.ops.mesh.primitive_cube_add(size=1)
        sp = bpy.context.active_object
        sp.scale = (rr - 0.07, 0.022, 0.026 if style != 'five' else 0.045)
        sp.location = (math.cos(a) * (rr / 2 + 0.02), face - 0.013, math.sin(a) * (rr / 2 + 0.02))
        sp.rotation_euler = (0, -a, 0)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if hi:
            bv = sp.modifiers.new('bv', 'BEVEL')
            bv.width = 0.008
            bv.segments = 2
            apply_mods(sp)
        sp.data.materials.clear()
        sp.data.materials.append(M['rim'])
        objs.append(sp)
    if style == 'cover':   # enjoliveur plein (utilitaires, flottes)
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=rr - 0.005, depth=0.01, location=(0, face - 0.01, 0), rotation=(math.pi / 2, 0, 0))
        bpy.context.active_object.data.materials.append(M['rim'])
        objs.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20 if hi else 10, radius=0.052, depth=0.03, location=(0, face - 0.005, 0), rotation=(math.pi / 2, 0, 0))
    bpy.context.active_object.data.materials.append(M['rim'])
    objs.append(bpy.context.active_object)
    if hi:
        for k in range(4):
            a = 2 * math.pi * k / 4 + 0.4
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.011, depth=0.03, location=(math.cos(a) * 0.036, face + 0.008, math.sin(a) * 0.036), rotation=(math.pi / 2, 0, 0))
            bpy.context.active_object.data.materials.append(M['bright'])
            objs.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28 if hi else 12, radius=rr - 0.05, depth=0.02, location=(0, -0.03, 0), rotation=(math.pi / 2, 0, 0))
    bpy.context.active_object.data.materials.append(M['rim'])
    objs.append(bpy.context.active_object)
    box(name + '_caliper', (-(rr - 0.1), -0.01, rr - 0.1), (0.07, 0.06, 0.10), S.get('caliper', 'det'), rot=(0, 0.7, 0), bevel=0.01)
    objs.append(bpy.context.active_object)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
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
    wh.location = (x, side * S['TRACK'], WR)
    return wh


# ---------------------------------------------------------------
def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            coll.remove(d)


def build(spec, lod='hi'):
    global S, M, LOD
    S, LOD = spec, lod
    clear()
    M = make_mats(spec.get('paint', (0.55, 0.06, 0.05)))
    body = build_body()
    make_bvh(body)
    glazing()
    spec['front']()
    spec['rear']()
    fittings()
    interior()
    if spec.get('extra'):
        spec['extra']()
    for name, x, side in (('WheelFL', AXF(), 1), ('WheelFR', AXF(), -1), ('WheelRL', AXR(), 1), ('WheelRR', AXR(), -1)):
        build_wheel(name, x, side)
    return body


def render(path_prefix, views=('34av', 'profil', '34ar'), res=(960, 540), samples=24):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get('Background')
    sky = nt.nodes.get('Sky Texture') or nt.nodes.new('ShaderNodeTexSky')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    gp = bpy.context.active_object
    gp.data.materials.append(mat('ground', (0.32, 0.32, 0.33), 0.0, 0.6))
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 10), rotation=(0.7, 0.2, 0.9))
    sun = bpy.context.active_object
    sun.data.energy = 3.5
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    sc.camera = cam
    cam.data.lens = 50
    k = S['L'] / 4.02
    V = {'34av': (5.6 * k, -3.8 * k, 1.5), 'profil': (0.0, -7.4 * k, 0.9), '34ar': (-5.4 * k, -3.9 * k, 1.7), 'face': (7.5 * k, 0.0, 1.0), 'dos': (-7.5 * k, 0, 1.1)}
    for v in views:
        pos = V[v]
        cam.location = pos
        d = Vector((0, 0, S['H'] * 0.42)) - Vector(pos)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{path_prefix}_{v}.png'
        bpy.ops.render.render(write_still=True)
    for o in (gp, cam, sun):
        bpy.data.objects.remove(o, do_unlink=True)


def export(path):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in list(bpy.data.objects):
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = bpy.data.objects['Body']
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False)
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('GLB', os.path.basename(path), os.path.getsize(path), 'tris', tri)
    return tri
