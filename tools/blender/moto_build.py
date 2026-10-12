# ============================================================
# Périph' Rush — deux-roues au design original (Blender, module bpy)
# 5 modèles : maxi-scooter, scooter urbain, roadster, trail, scooter
# de livreur — chacun avec son pilote posé (IK des bras / jambes).
# Repère : X = avant, Y = gauche, Z = haut ; sol z = 0 ; origine au
# milieu de l'empattement. Roues séparées (WheelF / WheelR) pour
# la rotation en jeu. Couleurs des vêtements en couleurs de sommets
# (attribut « Col ») sur le matériau « det ».
# Usage : python3 tools/blender/moto_build.py [--render] [ids…]
# ============================================================
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vkit as K  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'assets', 'fleet')
SNAPS = os.path.join(ROOT, 'tools', 'snaps')


def srgb(h):
    """couleur hexadécimale sRGB → linéaire"""
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def vcol(ob, hexc):
    me = ob.data
    lin = srgb(hexc)
    at = me.color_attributes.get('Col') or me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for d in at.data:
        d.color = (*lin, 1.0)
    me.color_attributes.active_color = at
    return ob


def finish(ob, matname, col=None, smooth=True, sub=0):
    ob.data.materials.clear()
    ob.data.materials.append(K.M[matname])
    if sub:
        md = ob.modifiers.new('sub', 'SUBSURF')
        md.levels = md.render_levels = sub
        K.apply_mods(ob)
    if smooth:
        K.shade_smooth(ob, 40)
    if matname == 'det':
        vcol(ob, col if col is not None else 0x1e2024)
    return ob


def active():
    return bpy.context.active_object


def cyl(name, p0, p1, r, matname, col=None, verts=12, r1=None):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    if r1 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=L, location=(p0 + p1) / 2)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r1, depth=L, location=(p0 + p1) / 2)
    ob = active()
    ob.name = name
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(ob, matname, col)


def sph(name, loc, r, matname, col=None, scale=(1, 1, 1), seg=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=r, location=loc)
    ob = active()
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(ob, matname, col)


def box(name, loc, size, matname, col=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = active()
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel:
        bv = ob.modifiers.new('bv', 'BEVEL')
        bv.width = bevel
        bv.segments = 2
        K.apply_mods(ob)
    return finish(ob, matname, col, smooth=bevel > 0)


def loft(name, sts, matname, col=None, n=14, sub=1):
    """sections superelliptiques le long de X : (x, zc, hz, hw, p[, yc])"""
    verts, faces = [], []
    for (x, zc, hz, hw, p, *rest) in sts:
        yc = rest[0] if rest else 0.0
        for k in range(n):
            a = 2 * math.pi * k / n
            ca, sa = math.cos(a), math.sin(a)
            y = yc + hw * math.copysign(abs(ca) ** (2 / p), ca)
            z = zc + hz * math.copysign(abs(sa) ** (2 / p), sa)
            verts.append((x, y, z))
    m = len(sts)
    for i in range(m - 1):
        for k in range(n):
            a, b = i * n + k, i * n + (k + 1) % n
            faces.append([a, b, b + n, a + n])
    # bouchons
    verts.append((sts[0][0], sts[0][5] if len(sts[0]) > 5 else 0.0, sts[0][1]))
    c0 = len(verts) - 1
    verts.append((sts[-1][0], sts[-1][5] if len(sts[-1]) > 5 else 0.0, sts[-1][1]))
    c1 = len(verts) - 1
    for k in range(n):
        faces.append([c0, (k + 1) % n, k])
        faces.append([c1, (m - 1) * n + k, (m - 1) * n + (k + 1) % n])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    K.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    return finish(ob, matname, col, sub=sub)


def tube(name, pts, r, matname, col=None, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    ob = bpy.data.objects.new(name, cu)
    K.link(ob)
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = active()
    return finish(ob, matname, col)


def join(name, objs):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = active()
    ob.name = name
    return ob


# ---------------------------------------------------------------
# roue : pneu (lathe) + jante (bâtons, rayons ou disque) + disque de frein
# ---------------------------------------------------------------
def wheel(name, x, r, w, style='cast', brake=True):
    objs = []
    rr = r - (0.075 if r > 0.29 else 0.065)
    prof = []
    for i in range(13):
        a = -math.pi / 2 + math.pi * i / 12
        prof.append((r - w * 0.5 + w * 0.5 * math.cos(a), w / 2 * math.sin(a)))
    prof = [(rr, -w / 2 + 0.01)] + prof + [(rr, w / 2 - 0.01)]
    objs.append(K.lathe(name + '_t', prof, 28, 'tire'))
    rim = [(rr + 0.004, -w / 2 + 0.015), (rr + 0.012, -w / 2 + 0.02), (rr, -w / 2 + 0.028), (rr - 0.01, 0), (rr, w / 2 - 0.028), (rr + 0.012, w / 2 - 0.02), (rr + 0.004, w / 2 - 0.015)]
    objs.append(K.lathe(name + '_r', rim, 28, 'rim'))
    objs.append(cyl(name + '_hub', (0, -w * 0.45, 0), (0, w * 0.45, 0), 0.045, 'rim', verts=12))
    if style == 'spoke':
        for k in range(32):
            a = 2 * math.pi * k / 32
            side = 1 if k % 2 else -1
            p0 = (math.cos(a + 0.2) * 0.04, side * w * 0.35, math.sin(a + 0.2) * 0.04)
            p1 = (math.cos(a) * (rr - 0.01), side * 0.004, math.sin(a) * (rr - 0.01))
            objs.append(cyl(name + '_sp', p0, p1, 0.0028, 'rim', verts=4))
    else:
        nsp = 5 if style == 'cast' else 3
        for k in range(nsp):
            a = 2 * math.pi * k / nsp
            for off in ((-0.09, 0.09) if style == 'cast' else (0,)):
                p1 = (math.cos(a + off) * (rr - 0.01), 0, math.sin(a + off) * (rr - 0.01))
                objs.append(cyl(name + '_sp', (0, 0, 0), p1, 0.013 if style == 'cast' else 0.03, 'rim', verts=6))
    if brake:
        objs.append(cyl(name + '_disc', (0, w * 0.5 + 0.004, 0), (0, w * 0.5 + 0.012, 0), rr * 0.82, 'rim', verts=24))
    wh = join(name, objs)
    wh.location = (x, 0, r)
    return wh


# ---------------------------------------------------------------
# pilote : tronc incliné, IK bras / jambes, casque intégral
# ---------------------------------------------------------------
def ik(root, target, a, b, hint):
    root, target, hint = Vector(root), Vector(target), Vector(hint).normalized()
    d = target - root
    L = min(d.length, a + b - 0.005)
    dn = d.normalized()
    along = (a * a - b * b + L * L) / (2 * L)
    h = math.sqrt(max(0.0, a * a - along * along))
    perp = (hint - dn * hint.dot(dn)).normalized()
    return root + dn * along + perp * h


def rider(R, pal):
    """R : seat (x,z), lean (rad), grip (x,z,half), foot (x,z,y), knee hint"""
    sx, sz = R['seat']
    lean = R['lean']
    hip = Vector((sx, 0, sz + 0.1))
    up = Vector((math.sin(lean), 0, math.cos(lean)))
    sh = hip + up * 0.55
    jacket, pants, helmet = pal['jacket'], pal['pants'], pal['helmet']
    # bassin + tronc (loft le long de l'axe incliné : construit droit puis tourné)
    tr = loft('Torso', [(0.0, 0, 0.16, 0.17, 2.4), (0.18, 0, 0.13, 0.19, 2.6), (0.40, 0, 0.12, 0.21, 2.6), (0.52, 0, 0.1, 0.2, 2.4), (0.58, 0, 0.06, 0.12, 2.2)], 'det', jacket, n=12, sub=1)
    tr.rotation_euler = (0, -(math.pi / 2 - lean), 0)
    tr.location = hip
    bpy.context.view_layer.objects.active = tr
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    neck = sh + up * 0.08
    cyl('Neck', sh, neck + up * 0.05, 0.055, 'det', jacket, verts=10)
    head = neck + up * 0.16 + Vector((0.03, 0, 0))
    sph('Helmet', head, 0.155, 'det', helmet, scale=(1.08, 0.92, 1.0), seg=18)
    # visière fumée + mentonnière
    sph('Visor', head + Vector((0.07, 0, 0.005)), 0.125, 'glass', scale=(0.75, 0.9, 0.55), seg=14)
    box('Chin', head + Vector((0.11, 0, -0.08)), (0.09, 0.18, 0.07), 'det', helmet, bevel=0.025)
    # bras
    gx, gz, gh = R['grip']
    for s in (1, -1):
        shoulder = sh + Vector((0, s * 0.2, -0.04))
        hand = Vector((gx, s * gh, gz))
        elbow = ik(shoulder, hand, 0.31, 0.3, (0.05, s * 0.6, -1.0))
        cyl('UpperArm', shoulder, elbow, 0.058, 'det', jacket, verts=10, r1=0.05)
        cyl('Forearm', elbow, hand, 0.05, 'det', jacket, verts=10, r1=0.042)
        sph('Elbow', elbow, 0.055, 'det', jacket, seg=10)
        sph('Glove', hand, 0.048, 'det', 0x15161a, scale=(1.2, 0.8, 0.9), seg=10)
        sph('Shoulder', shoulder, 0.07, 'det', jacket, seg=10)
    # jambes
    fx, fz, fy = R['foot']
    for s in (1, -1):
        hp = hip + Vector((0.02, s * 0.11, -0.06))
        ft = Vector((fx, s * fy, fz))
        knee = ik(hp, ft, 0.44, 0.44, R.get('knee', (1.0, s * 0.25, 0.6)))
        cyl('Thigh', hp, knee, 0.085, 'det', pants, verts=12, r1=0.068)
        cyl('Shin', knee, ft + Vector((0, 0, 0.06)), 0.062, 'det', pants, verts=12, r1=0.05)
        sph('Knee', knee, 0.07, 'det', pants, seg=10)
        box('Boot', ft + Vector((0.06, 0, 0.03)), (0.24, 0.1, 0.11), 'det', 0x111214, bevel=0.03)


# ---------------------------------------------------------------
# éléments communs
# ---------------------------------------------------------------
def fork(D):
    """fourche télescopique + colonne ; renvoie la tête de direction"""
    ax = Vector((D['WB'] / 2, 0, D['RF']))
    rake = math.radians(D.get('rake', 26))
    axis = Vector((-math.sin(rake), 0, math.cos(rake)))
    head = ax + axis * D.get('forkL', 0.72)
    for s in (1, -1):
        off = Vector((0, s * 0.1, 0))
        cyl('ForkLow', ax + off, ax + off + axis * 0.32, 0.03, 'det', 0x2a2c30, verts=10)
        cyl('ForkUp', ax + off + axis * 0.3, head + off, 0.024, 'bright', verts=10)
    box('TripleClamp', head + axis * 0.02, (0.1, 0.26, 0.04), 'det', 0x202226, bevel=0.01)
    return head, axis


def bars(D, head):
    gx, gz, gh = D['grip']
    cyl('Bar', (gx - 0.02, -gh, gz), (gx - 0.02, gh, gz), 0.012, 'bright', verts=8)
    cyl('Riser', head, (gx - 0.03, 0, gz - 0.02), 0.02, 'det', 0x1b1c1f, verts=8)
    for s in (1, -1):
        cyl('Grip', (gx - 0.02, s * (gh - 0.12), gz), (gx - 0.02, s * (gh + 0.01), gz), 0.019, 'det', 0x111214, verts=10)
        cyl('Lever', (gx, s * (gh - 0.14), gz + 0.01), (gx + 0.06, s * (gh - 0.02), gz + 0.0), 0.006, 'bright', verts=6)
        # rétroviseurs
        m0 = Vector((gx - 0.04, s * (gh - 0.1), gz))
        m1 = m0 + Vector((-0.04, s * 0.06, 0.24))
        cyl('MirrorStalk', m0, m1, 0.007, 'det', 0x111214, verts=6)
        box('Mirror', m1 + Vector((0, s * 0.03, 0.03)), (0.03, 0.13, 0.08), 'det', 0x16171a, bevel=0.015)


def plate_and_tail(x, z, w=0.16):
    box('PlateHolder', (x - 0.02, 0, z), (0.02, w, 0.12), 'det', 0x16171a)
    box('TailLight', (x + 0.04, 0, z + 0.13), (0.03, w * 0.8, 0.045), 'lensR', bevel=0.01)
    for s in (1, -1):
        box('BlinkR', (x + 0.02, s * (w * 0.5 + 0.06), z + 0.1), (0.04, 0.05, 0.03), 'lensF', bevel=0.008)


# ---------------------------------------------------------------
# modèles
# ---------------------------------------------------------------
def build_maxi(D, scoot=False):
    WB, RF, RR = D['WB'], D['RF'], D['RR']
    head, axis = fork(D)
    k = 0.86 if scoot else 1.0
    # tablier avant (bouclier) et nez
    loft('Shield', [(0.86 * k, 0.62, 0.05, 0.07, 2.4), (0.83 * k, 0.66, 0.2 * k, 0.12 * k, 3.6), (0.74 * k, 0.74, 0.3 * k, 0.17 * k, 4.2),
                    (0.60 * k, 0.78, 0.32 * k, 0.185 * k, 4.4), (0.46 * k, 0.76, 0.3 * k, 0.17 * k, 4.2), (0.40 * k, 0.72, 0.24 * k, 0.11 * k, 3.4)], 'paint', n=18, sub=1)
    # plancher (repose-pieds) + tunnel central
    loft('Floor', [(0.42 * k, 0.44, 0.05, 0.17, 4), (0.10, 0.42, 0.05, 0.20, 4), (-0.18, 0.44, 0.06, 0.18, 4)], 'det', 0x1b1c1f, n=12, sub=0)
    if not scoot:
        loft('Tunnel', [(0.40, 0.52, 0.08, 0.10, 2.2), (0.10, 0.56, 0.12, 0.11, 2.4), (-0.15, 0.62, 0.16, 0.13, 2.4)], 'paint', n=12, sub=1)
    # carrosserie arrière + coque de selle
    loft('Rear', [(-0.08, 0.56, 0.12, 0.17, 3.2), (-0.30, 0.62, 0.15, 0.18, 3.4), (-0.58, 0.69, 0.13, 0.17, 3.4),
                  (-0.84 * k, 0.76, 0.09, 0.13, 3.0), (-1.0 * k, 0.80, 0.04, 0.07, 2.4)], 'paint', n=16, sub=1)
    zs = 0.80 if not scoot else 0.77
    loft('Seat', [(0.02, zs - 0.06, 0.035, 0.14, 2.6), (-0.18, zs - 0.045, 0.045, 0.17, 3), (-0.38, zs - 0.04, 0.045, 0.17, 3),
                  (-0.52, zs + 0.0, 0.05, 0.15, 3), (-0.64, zs + 0.04, 0.05, 0.13, 2.6), (-0.76, zs + 0.03, 0.03, 0.09, 2.4)], 'det', 0x16171a, n=14, sub=1)
    if not scoot:  # dosseret pilote
        loft('Backrest', [(-0.44, zs + 0.06, 0.07, 0.12, 2.6), (-0.50, zs + 0.08, 0.08, 0.13, 2.6), (-0.55, zs + 0.06, 0.07, 0.12, 2.6)], 'det', 0x16171a, n=12, sub=1)
    # contre-tablier (genoux) en plastique noir
    loft('Inner', [(0.30 * k + 0.08, 0.66, 0.24 * k, 0.16 * k, 3.2), (0.26 * k + 0.06, 0.62, 0.18 * k, 0.15 * k, 3.0)], 'det', 0x1b1c1f, n=12, sub=1)
    # bloc moteur-transmission (côté gauche) + pot (droite)
    box('CVT', (-0.42, 0.13, RR + 0.04), (0.62, 0.08, 0.2), 'det', 0x2b2d31, bevel=0.03)
    box('Engine', (-0.12, 0, 0.36), (0.32, 0.26, 0.2), 'det', 0x24262a, bevel=0.03)
    tube('Exhaust', [(-0.05, -0.1, 0.28), (-0.35, -0.2, 0.3), (-0.62, -0.2, 0.36)], 0.045, 'bright')
    cyl('Muffler', (-0.45, -0.2, 0.35), (-0.78, -0.21, 0.42), 0.06, 'det', 0x2a2c30, verts=12)
    # garde-boue avant
    loft('FenderF', [(WB / 2 + 0.24, RF + 0.02, 0.02, 0.07, 2), (WB / 2 + 0.05, RF + 0.10, 0.03, 0.08, 2.2), (WB / 2 - 0.18, RF + 0.04, 0.02, 0.07, 2)], 'paint', n=10, sub=0)
    # optiques
    if scoot:
        sph('HeadLight', (0.84 * k + 0.03, 0, 1.0), 0.07, 'lensF', scale=(0.5, 1, 0.8))
        loft('HeadCover', [(0.62, 0.98, 0.06, 0.12, 2.4), (0.80, 0.99, 0.08, 0.13, 2.4), (0.88, 0.98, 0.06, 0.1, 2.2)], 'paint', n=12, sub=1)
    else:
        for s in (1, -1):
            box('HeadLight', (0.835, s * 0.085, 0.86), (0.04, 0.11, 0.045), 'lensF', rot=(s * 0.3, 0.5, 0), bevel=0.012)
        box('Turn', (0.86, 0, 0.72), (0.03, 0.2, 0.025), 'lensF', bevel=0.008)
        loft('Screen', [(0.70, 1.06, 0.008, 0.16, 2.4), (0.64, 1.2, 0.008, 0.18, 2.4), (0.56, 1.34, 0.008, 0.15, 2.2)], 'glass', n=10, sub=0)
    plate_and_tail(-0.99 * k + 0.02, 0.62)
    bars(D, head)
    if D.get('topbox'):
        box('TopBox', (-0.78, 0, 1.18), (0.46, 0.44, 0.42), 'det', D['boxCol'], bevel=0.03)
        box('BoxRack', (-0.78, 0, 0.95), (0.4, 0.3, 0.03), 'det', 0x1b1c1f)
    wheel('WheelF', WB / 2, RF, D['tireF'], 'cast' if not scoot else 'tri', brake=True)
    wheel('WheelR', -WB / 2, RR, D['tireR'], 'cast' if not scoot else 'tri', brake=False)


def build_roadster(D):
    WB, RF, RR = D['WB'], D['RF'], D['RR']
    head, axis = fork(D)
    # cadre treillis (tubes)
    piv = Vector((-0.12, 0, 0.45))
    for s in (1, -1):
        y = s * 0.12
        tube('Frame', [head + Vector((0, y * 0.5, -0.02)), Vector((0.2, y, 0.78)), Vector((-0.1, y, 0.72)), Vector((-0.12, y, 0.48))], 0.018, 'det', 0x8a1f1a)
        tube('Frame', [head + Vector((0, y * 0.5, -0.12)), Vector((0.25, y, 0.48)), piv + Vector((0, y, 0))], 0.016, 'det', 0x8a1f1a)
    # réservoir sculpté + écopes
    loft('Tank', [(0.40, 0.92, 0.07, 0.12, 2.4), (0.30, 0.96, 0.12, 0.17, 2.8), (0.12, 0.98, 0.13, 0.19, 3.0), (-0.04, 0.95, 0.11, 0.17, 2.8), (-0.12, 0.90, 0.07, 0.13, 2.4)], 'paint', n=16, sub=1)
    for s in (1, -1):
        loft('Scoop', [(0.42, 0.80, 0.03, 0.04, 2, s * 0.17), (0.30, 0.78, 0.07, 0.04, 2.4, s * 0.19), (0.16, 0.76, 0.06, 0.03, 2.2, s * 0.17)], 'paint', n=10, sub=1)
    # moteur bicylindre parallèle (carters + bloc + culasse) + radiateur
    box('Crankcase', (0.08, 0, 0.36), (0.36, 0.34, 0.22), 'det', 0x2b2d31, bevel=0.04)
    box('Cylinders', (0.16, 0, 0.58), (0.2, 0.3, 0.26), 'det', 0x3a3d42, rot=(0, -0.25, 0), bevel=0.03)
    box('Head', (0.21, 0, 0.73), (0.2, 0.3, 0.09), 'bright', rot=(0, -0.25, 0), bevel=0.02)
    for s in (1, -1):
        box('Cover', (0.06, s * 0.18, 0.36), (0.18, 0.02, 0.14), 'bright', bevel=0.01)
    box('Radiator', (0.38, 0, 0.58), (0.05, 0.36, 0.3), 'det', 0x111214, rot=(0, -0.2, 0))
    tube('Header', [(0.27, -0.06, 0.62), (0.36, -0.08, 0.4), (0.25, -0.1, 0.18), (-0.05, -0.12, 0.17), (-0.25, -0.18, 0.28)], 0.03, 'bright')
    cyl('Muffler', (-0.22, -0.19, 0.27), (-0.48, -0.2, 0.36), 0.06, 'det', 0x2a2c30, verts=12)
    # bras oscillant + amortisseur
    for s in (1, -1):
        cyl('Swingarm', piv + Vector((0, s * 0.1, 0)), (-WB / 2, s * 0.1, RR), 0.03, 'bright', verts=8)
    cyl('Shock', (-0.2, 0, 0.5), (-0.38, 0, 0.75), 0.03, 'det', 0xd4a017, verts=8)
    # selle + coque arrière effilée
    loft('Seat', [(-0.08, 0.86, 0.035, 0.14, 2.6), (-0.30, 0.86, 0.04, 0.15, 3), (-0.52, 0.89, 0.04, 0.12, 2.8), (-0.64, 0.93, 0.03, 0.09, 2.4)], 'det', 0x141517, n=12, sub=1)
    loft('Tail', [(-0.40, 0.84, 0.06, 0.13, 2.6), (-0.62, 0.89, 0.07, 0.11, 2.6), (-0.84, 0.95, 0.05, 0.07, 2.4), (-0.92, 0.97, 0.025, 0.04, 2.2)], 'paint', n=12, sub=1)
    box('TailLight', (-0.92, 0, 0.95), (0.03, 0.08, 0.03), 'lensR', bevel=0.008)
    box('Hugger', (-WB / 2 + 0.02, 0, RR + 0.14), (0.4, 0.1, 0.02), 'det', 0x16171a, rot=(0, 0.3, 0))
    cyl('PlateArm', (-0.75, 0, 0.8), (-0.95, 0, 0.62), 0.015, 'det', 0x16171a, verts=6)
    plate_and_tail(-0.95, 0.56, 0.13)
    # optique ronde + tête de fourche
    sph('HeadShell', head + Vector((0.12, 0, -0.08)), 0.11, 'det', 0x16171a, scale=(0.8, 1, 1))
    sph('HeadLight', head + Vector((0.19, 0, -0.08)), 0.085, 'lensF', scale=(0.35, 1, 1))
    loft('FenderF', [(WB / 2 + 0.2, RF + 0.03, 0.015, 0.06, 2), (WB / 2 + 0.02, RF + 0.07, 0.02, 0.065, 2.2), (WB / 2 - 0.16, RF + 0.03, 0.015, 0.06, 2)], 'paint', n=10, sub=0)
    bars(D, head)
    wheel('WheelF', WB / 2, RF, D['tireF'], 'cast')
    wheel('WheelR', -WB / 2, RR, D['tireR'], 'cast', brake=False)


def build_trail(D):
    WB, RF, RR = D['WB'], D['RF'], D['RR']
    head, axis = fork(D)
    # bec + carénage + bulle haute
    loft('Beak', [(WB / 2 + 0.28, RF + 0.20, 0.02, 0.08, 2), (WB / 2 + 0.12, RF + 0.33, 0.04, 0.12, 2.4), (WB / 2 - 0.05, RF + 0.42, 0.05, 0.13, 2.4)], 'paint', n=10, sub=1)
    loft('Fairing', [(0.78, 1.02, 0.08, 0.13, 2.4), (0.66, 1.08, 0.18, 0.22, 2.8), (0.50, 1.06, 0.2, 0.24, 3), (0.38, 1.0, 0.16, 0.22, 2.8)], 'paint', n=16, sub=1)
    for s in (1, -1):
        box('HeadLight', (0.79, s * 0.07, 1.02), (0.04, 0.11, 0.07), 'lensF', rot=(0, 0.35, 0), bevel=0.01)
    loft('Screen', [(0.66, 1.22, 0.01, 0.16, 2.4), (0.58, 1.38, 0.01, 0.17, 2.4), (0.50, 1.50, 0.01, 0.15, 2.2)], 'glass', n=10, sub=0)
    # gros réservoir + flancs
    loft('Tank', [(0.42, 0.98, 0.1, 0.18, 2.4), (0.25, 1.04, 0.16, 0.24, 2.8), (0.05, 1.03, 0.16, 0.24, 3), (-0.12, 0.97, 0.12, 0.19, 2.8), (-0.20, 0.92, 0.07, 0.14, 2.4)], 'paint', n=16, sub=1)
    # moteur + sabot + pare-carters
    box('Engine', (0.08, 0, 0.5), (0.4, 0.34, 0.3), 'det', 0x2b2d31, bevel=0.04)
    box('Cyl', (0.18, 0, 0.72), (0.22, 0.3, 0.2), 'det', 0x3a3d42, rot=(0, -0.2, 0), bevel=0.03)
    box('SkidPlate', (0.12, 0, 0.28), (0.5, 0.3, 0.04), 'bright', rot=(0, 0.12, 0), bevel=0.01)
    for s in (1, -1):
        tube('CrashBar', [(0.42, s * 0.12, 0.85), (0.38, s * 0.27, 0.62), (0.22, s * 0.28, 0.42), (0.0, s * 0.18, 0.4)], 0.014, 'bright')
    tube('Header', [(0.3, -0.06, 0.6), (0.36, -0.1, 0.38), (0.0, -0.14, 0.3), (-0.3, -0.2, 0.5)], 0.028, 'bright')
    cyl('Muffler', (-0.3, -0.22, 0.5), (-0.62, -0.24, 0.66), 0.065, 'bright', verts=12)
    for s in (1, -1):
        cyl('Swingarm', (-0.12, s * 0.1, 0.5), (-WB / 2, s * 0.1, RR), 0.035, 'bright', verts=8)
    # selle étagée + porte-bagages + valises alu
    loft('Seat', [(-0.12, 0.90, 0.04, 0.16, 2.8), (-0.36, 0.89, 0.05, 0.17, 3), (-0.55, 0.95, 0.05, 0.15, 3), (-0.72, 0.97, 0.04, 0.12, 2.6)], 'det', 0x141517, n=12, sub=1)
    loft('Tail', [(-0.55, 0.88, 0.06, 0.14, 2.6), (-0.80, 0.92, 0.06, 0.12, 2.6), (-0.94, 0.94, 0.04, 0.08, 2.4)], 'paint', n=12, sub=1)
    box('Rack', (-0.85, 0, 1.0), (0.32, 0.3, 0.025), 'det', 0x1b1c1f)
    for s in (1, -1):
        box('Pannier', (-0.66, s * 0.33, 0.66), (0.46, 0.17, 0.36), 'bright', bevel=0.03)
        box('PannierLid', (-0.66, s * 0.33, 0.85), (0.47, 0.18, 0.04), 'det', 0x1b1c1f, bevel=0.01)
    box('TailLight', (-0.95, 0, 0.92), (0.03, 0.1, 0.04), 'lensR', bevel=0.008)
    plate_and_tail(-0.98, 0.62, 0.14)
    bars(D, head)
    wheel('WheelF', WB / 2, RF, D['tireF'], 'spoke')
    wheel('WheelR', -WB / 2, RR, D['tireR'], 'spoke', brake=False)


DESIGNS = {
    # maxi-scooter : selle basse, pieds en avant sur le plancher
    'm_maxi': dict(kind='maxi', WB=1.58, RF=0.30, RR=0.29, tireF=0.12, tireR=0.16, rake=26, forkL=0.66,
                   grip=(0.46, 1.05, 0.36), paint=(0.05, 0.05, 0.06),
                   R=dict(seat=(-0.26, 0.76), lean=0.10, grip=(0.46, 1.05, 0.36), foot=(0.36, 0.48, 0.17), knee=(1.0, 0.3, 0.9)),
                   pal=dict(jacket=0x2d3138, pants=0x1c1d22, helmet=0x15161a)),
    'm_scoot': dict(kind='scoot', WB=1.35, RF=0.26, RR=0.26, tireF=0.11, tireR=0.12, rake=27, forkL=0.6,
                    grip=(0.40, 1.0, 0.33), paint=(0.75, 0.75, 0.78),
                    R=dict(seat=(-0.22, 0.72), lean=0.06, grip=(0.40, 1.0, 0.33), foot=(0.2, 0.46, 0.15), knee=(1.0, 0.3, 0.7)),
                    pal=dict(jacket=0x223452, pants=0x3a4a63, helmet=0xe8eaed)),
    'm_road': dict(kind='road', WB=1.45, RF=0.31, RR=0.31, tireF=0.12, tireR=0.18, rake=25, forkL=0.74,
                   grip=(0.42, 1.04, 0.38), paint=(0.5, 0.04, 0.04),
                   R=dict(seat=(-0.30, 0.80), lean=0.36, grip=(0.42, 1.04, 0.38), foot=(-0.14, 0.38, 0.2), knee=(1.0, 0.35, 0.3)),
                   pal=dict(jacket=0x151619, pants=0x2e3e5c, helmet=0x8a1a16)),
    'm_trail': dict(kind='trail', WB=1.53, RF=0.36, RR=0.33, tireF=0.11, tireR=0.15, rake=27, forkL=0.82,
                    grip=(0.40, 1.18, 0.4), paint=(0.75, 0.74, 0.70),
                    R=dict(seat=(-0.34, 0.88), lean=0.16, grip=(0.40, 1.18, 0.4), foot=(-0.06, 0.44, 0.2), knee=(1.0, 0.35, 0.4)),
                    pal=dict(jacket=0x6b6656, pants=0x3c3c3a, helmet=0xd8d4c8)),
    'm_livreur': dict(kind='scoot', WB=1.35, RF=0.26, RR=0.26, tireF=0.11, tireR=0.12, rake=27, forkL=0.6,
                      grip=(0.40, 1.0, 0.33), paint=(0.05, 0.05, 0.06), topbox=True, boxCol=0x1fb5a8,
                      R=dict(seat=(-0.2, 0.72), lean=0.1, grip=(0.40, 1.0, 0.33), foot=(0.2, 0.46, 0.15), knee=(1.0, 0.3, 0.7)),
                      pal=dict(jacket=0x1fa89c, pants=0x22252b, helmet=0x15161a)),
    # v20 : motard de la Police nationale (moto routière blanche, valises, feux bleus) — design générique
    'm_police': dict(kind='trail', WB=1.53, RF=0.33, RR=0.33, tireF=0.12, tireR=0.17, rake=26, forkL=0.78,
                     grip=(0.40, 1.16, 0.4), paint=(0.92, 0.93, 0.94), police=True,
                     R=dict(seat=(-0.32, 0.86), lean=0.12, grip=(0.40, 1.16, 0.4), foot=(-0.04, 0.44, 0.2), knee=(1.0, 0.35, 0.4)),
                     pal=dict(jacket=0x1b2547, pants=0x1b2547, helmet=0xf2f3f5)),
}


def police_kit():
    # valises latérales, top-case, feux bleus avant / arrière, bande bleue
    for sd in (1, -1):
        box(f'Pannier{sd}', (-0.58, sd * 0.31, 0.62), (0.52, 0.17, 0.36), 'det', 0xeef0f2, bevel=0.03)
        box(f'PannierBand{sd}', (-0.58, sd * 0.397, 0.62), (0.5, 0.01, 0.07), 'det', 0x1e3a8a)
        box(f'BlueF{sd}', (0.70, sd * 0.13, 1.02), (0.05, 0.07, 0.05), 'det', 0x2a5cff)
    box('TopCase', (-0.78, 0, 0.98), (0.36, 0.38, 0.26), 'det', 0xeef0f2, bevel=0.03)
    box('BlueR', (-0.80, 0, 1.16), (0.12, 0.2, 0.06), 'det', 0x2a5cff)
    box('Screen', (0.56, 0, 1.24), (0.04, 0.42, 0.34), 'det', 0x9aa6b2, rot=(0, -0.35, 0))


def build(vid):
    D = DESIGNS[vid]
    K.clear()
    K.M = K.make_mats(D['paint'])
    K.LOD = 'lo'
    if D['kind'] in ('maxi', 'scoot'):
        build_maxi(D, scoot=D['kind'] == 'scoot')
    elif D['kind'] == 'road':
        build_roadster(D)
    else:
        build_trail(D)
    rider(D['R'], D['pal'])
    if D.get('police'):
        police_kit()
    # objet de référence « Body » attendu par l'export
    b = [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('Wheel')]
    b[0].name = 'Body'


def export(path):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in bpy.data.objects:
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = bpy.data.objects['Body']
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_animations=False, export_vertex_color='ACTIVE')
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('GLB', os.path.basename(path), os.path.getsize(path), 'tris', tri)
    return tri


def render(prefix, views=('34av', 'profil', '34ar')):
    # matériau « det » : couleur des sommets visible au rendu
    m = K.M['det']
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    an = nt.nodes.new('ShaderNodeVertexColor')
    an.layer_name = 'Col'
    nt.links.new(an.outputs['Color'], bsdf.inputs['Base Color'])
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 800, 520
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.75, 0.8, 0.86, 1)
    bg.inputs['Strength'].default_value = 0.6
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    gp = bpy.context.active_object
    gp.data.materials.append(K.mat('ground', (0.35, 0.35, 0.36), 0.0, 0.7))
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 10), rotation=(0.6, 0.3, 0.8))
    sun = bpy.context.active_object
    sun.data.energy = 3.5
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    K.link(cam)
    sc.camera = cam
    cam.data.lens = 45
    V = {'34av': (2.8, -2.4, 1.5), 'profil': (0.0, -3.9, 0.9), '34ar': (-2.8, -2.3, 1.6), 'face': (3.8, 0, 1.1)}
    for v in views:
        cam.location = V[v]
        d = Vector((0, 0, 0.78)) - Vector(V[v])
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{prefix}_{v}.png'
        bpy.ops.render.render(write_still=True)
    for o in (gp, cam, sun):
        bpy.data.objects.remove(o, do_unlink=True)
    nt.nodes.remove(an)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for vid in args or list(DESIGNS):
        build(vid)
        if '--render' in sys.argv:
            render(os.path.join(SNAPS, f'moto_{vid}'))
        export(os.path.join(OUT, f'{vid}.glb'))
