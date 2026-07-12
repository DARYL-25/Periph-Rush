# ============================================================
# Périph' Rush — modélisation Blender de la Renault Clio 3 (phase 2)
# d'après blueprint : L 4027 · W 1720 · H 1493 · empattement 2575,
# porte-à-faux AV 770 / AR 682, roues 185/60R15 (Ø ~603 mm).
#
# Stratégie : loft DENSE (40 sections × 13 points, miroir) sans
# subdivision — la silhouette du blueprint est respectée au mm ;
# les arrondis (bas de caisse, épaule, bord de pavillon) sont
# intégrés aux sections. Lissage par Edge Split (40°).
#
# Usage :
#   blender --background --factory-startup --python tools/blender/clio3_build.py
# Produit : assets/clio3.glb + tools/snaps/bl_*.png
# Repère : X = longueur (avant = +X), Y = largeur, Z = hauteur.
# ============================================================
import bpy
import math
import os
from mathutils import Vector

# ---------------------------------------------------------------
# PARAMÈTRES (mètres)
# ---------------------------------------------------------------
L = 4.027
W = 1.720
H = 1.493
WB = 2.575
AXLE_F = L / 2 - 0.770                 # 1.2435
AXLE_R = AXLE_F - WB                   # -1.3315
WHEEL_R = 0.301
TRACK_HALF = 0.75
ARCH_R = 0.340

# silhouette (x, z) : bouclier → capot → pare-brise → toit → hayon
TOPLINE = [
    (2.014, 0.600), (1.955, 0.640), (1.905, 0.672), (1.500, 0.772), (1.060, 0.848), (0.960, 0.872),
    (0.660, 1.130), (0.400, 1.352),
    (-0.100, 1.418), (-0.700, 1.408), (-0.980, 1.372),
    (-1.380, 1.208), (-1.640, 1.062),
    (-1.850, 0.930), (-1.980, 0.760), (-2.014, 0.560),
]
BELT = [
    (2.014, 0.610), (1.905, 0.640), (1.500, 0.742), (1.060, 0.820), (0.500, 0.836),
    (-0.200, 0.856), (-0.900, 0.892), (-1.500, 0.940), (-1.900, 0.980), (-2.014, 0.900),
]
PLAN = [
    (2.014, 0.630), (1.905, 0.705), (1.600, 0.792), (1.243, 0.832),
    (0.800, 0.856), (0.000, 0.860), (-0.800, 0.852), (-1.331, 0.830),
    (-1.700, 0.784), (-1.950, 0.706), (-2.014, 0.648),
]
ROCKER_Z = 0.185
BUMPER_BOT_F = 0.235
BUMPER_BOT_R = 0.280
ROOF_HALF = 0.615
GLASS_BASE_HALF = 0.765
CABIN_X = (-1.60, 1.00)
WS_X = (0.44, 0.92)                    # pare-brise (surface haute)
RG_X = (-1.60, -0.98)                  # lunette
PILLARS = [(0.80, 1.02), (-0.12, 0.02), (-1.60, -1.22)]  # A, B, C (bandes en x)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(OUT_DIR, '..', '..'))
SNAPS = os.path.join(REPO, 'tools', 'snaps')
ASSETS = os.path.join(REPO, 'assets')
os.makedirs(SNAPS, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

def interp(pts, x):
    pts = sorted(pts, key=lambda p: -p[0])
    if x >= pts[0][0]:
        return pts[0][1]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        if x1 <= x <= x0:
            t = (x0 - x) / max(x0 - x1, 1e-9)
            ym = pts[max(0, i - 1)][1]
            yp = pts[min(len(pts) - 1, i + 2)][1]
            t2, t3 = t * t, t * t * t
            return 0.5 * ((2 * y0) + (-ym + y1) * t +
                          (2 * ym - 5 * y0 + 4 * y1 - yp) * t2 +
                          (-ym + 3 * y0 - 3 * y1 + yp) * t3)
    return pts[-1][1]

def top_z(x):
    return interp(TOPLINE, x)

def half_w(x):
    return max(interp(PLAN, x), 0.06)

def mat(name, color, metallic=0.0, rough=0.5):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1.0)   # couleur viewport (rendus Workbench)
    m.metallic = metallic
    m.roughness = rough
    return m

MATS = {
    'paint': mat('paint', (0.32, 0.52, 0.82), 0.4, 0.35),
    'glass': mat('glass', (0.02, 0.04, 0.06), 0.0, 0.08),
    'det': mat('det', (0.05, 0.055, 0.06), 0.0, 0.75),
    'bright': mat('bright', (0.75, 0.77, 0.80), 1.0, 0.25),
    'lensF': mat('lensF', (0.85, 0.90, 0.95), 0.3, 0.15),
    'lensR': mat('lensR', (0.55, 0.05, 0.04), 0.2, 0.2),
    'tire': mat('tire', (0.035, 0.035, 0.04), 0.0, 0.9),
    'rim': mat('rim', (0.72, 0.74, 0.77), 1.0, 0.3),
}
MAT_ORDER = ['paint', 'glass', 'det', 'bright', 'lensF', 'lensR', 'tire', 'rim']

def new_obj(name, me):
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------
# sections : 13 points (y, z), arrondis intégrés
# ---------------------------------------------------------------
def arch_lift(x):
    z = None
    for ax in (AXLE_F, AXLE_R):
        dx = abs(x - ax)
        if dx < ARCH_R:
            zz = WHEEL_R * 0.98 + math.sqrt(ARCH_R * ARCH_R - dx * dx) * 0.95
            z = max(z or 0, zz)
    return z

def flare(x):
    f = 0.0
    for ax in (AXLE_F, AXLE_R):
        d = abs(x - ax) / (ARCH_R + 0.16)
        if d < 1:
            f = max(f, math.cos(d * math.pi / 2) ** 2)
    return 1.0 + 0.020 * f

def bottom_z(x):
    a = arch_lift(x)
    if a is not None:
        return a
    if x > AXLE_F + ARCH_R * 0.6:
        return BUMPER_BOT_F
    if x < AXLE_R - ARCH_R * 0.6:
        return BUMPER_BOT_R
    return ROCKER_Z

def section(x):
    hw = half_w(x) * flare(x)
    top = top_z(x)
    # la ceinture converge sous la ligne de toit aux extrémités (nez, hayon)
    belt = min(interp(BELT, x), top - 0.038)
    bot = bottom_z(x)
    in_cab = CABIN_X[0] <= x <= CABIN_X[1]
    w_rock = hw * 0.90
    w_belt = hw
    sh = max(belt - 0.055, bot + 0.05)          # épaule
    pts = [
        (0.0, bot),
        (w_rock * 0.96, bot),
        (w_rock, bot + 0.035),                   # arrondi bas de caisse
        (hw * 0.985, bot + (sh - bot) * 0.45),   # flanc
        (w_belt, sh),                            # épaule (le plus large)
        (w_belt * 0.995, belt - 0.012),          # tôle jusqu'à la ceinture
        (w_belt * 0.975, belt),                  # arête de ceinture
    ]
    if in_cab:
        g0 = min(GLASS_BASE_HALF, hw * 0.94)
        pts += [
            (g0, belt + 0.03),                   # base du vitrage (retrait)
            ((g0 + ROOF_HALF) / 2, (belt + 0.03 + top - 0.05) / 2),  # vitre
            (ROOF_HALF + 0.012, top - 0.045),    # haut de vitre
            (ROOF_HALF, top - 0.015),            # bord de pavillon (arrondi)
            (ROOF_HALF * 0.55, top),             # dôme du pavillon
            (0.0, top + 0.004),
        ]
    else:
        # hors cabine : dôme du capot / de la malle
        we = hw * 0.88
        crown = 0.020 if x > 0 else 0.014
        pts += [
            (we, top - 0.026),
            (we * 0.78, top - 0.010),
            (we * 0.55, top - 0.002),
            (we * 0.36, top + crown * 0.35),
            (we * 0.18, top + crown * 0.5),
            (0.0, top + crown * 0.55),
        ]
    return pts

def stations():
    xs = set()
    n = 40
    xs.add(round(L / 2 - 0.0562, 4))
    xs.add(round(-L / 2 + 0.0562, 4))
    for i in range(1, n):
        xs.add(round(L / 2 - i * L / n, 4))
    for ax in (AXLE_F, AXLE_R):
        for d in (-ARCH_R, -ARCH_R * 0.7, -ARCH_R * 0.35, 0,
                  ARCH_R * 0.35, ARCH_R * 0.7, ARCH_R):
            xs.add(round(ax + d, 4))
    for x in [CABIN_X[0], CABIN_X[1], WS_X[0], WS_X[1], RG_X[0], RG_X[1]]:
        xs.add(round(x, 4))
    for a, b in PILLARS:
        xs.add(round(a, 4))
        xs.add(round(b, 4))
    # le loft s'arrête à ±(L/2 − 0.056) : les capots d'extrémité prennent le relais
    return sorted((x for x in xs if -L / 2 + 0.056 <= x <= L / 2 - 0.056),
                  reverse=True)

def build_body():
    STN = stations()
    ring_n = 13
    verts, faces = [], []

    def add_ring(x, sec, y_scale=1.0, z_squash=1.0):
        bot = min(z for (_, z) in sec)
        top = max(z for (_, z) in sec)
        mid = (bot + top) / 2
        for (y, z) in sec:
            verts.append((x, y * y_scale, mid + (z - mid) * z_squash))

    # convergence progressive aux extrémités → boucliers bombés (pas de gouttière)
    # positions ABSOLUES dans l'empattement total : longueur finale = L exactement
    x0, xn = STN[0], STN[-1]
    cap_f = [(L / 2 - 0.036, 0.93, 0.98), (L / 2 - 0.014, 0.78, 0.90), (L / 2 - 0.002, 0.48, 0.74)]
    cap_r = [(-L / 2 + 0.036, 0.94, 0.98), (-L / 2 + 0.014, 0.80, 0.91), (-L / 2 + 0.002, 0.50, 0.76)]
    sec0 = section(x0)
    secn = section(xn)
    rings = []
    for (x, ys, zs) in cap_f:
        rings.append((x, sec0, ys, zs))
    for x in STN:
        rings.append((x, section(x), 1.0, 1.0))
    for (x, ys, zs) in reversed(cap_r):
        rings.append((x, secn, ys, zs))
    for (x, sec, ys, zs) in rings:
        add_ring(x, sec, ys, zs)
    n = len(rings)
    for s in range(n - 1):
        for i in range(ring_n - 1):
            a = s * ring_n + i
            faces.append((a, a + ring_n, a + ring_n + 1, a + 1))
    # petits éventails de fermeture au centre des boucliers
    for (base, xoff, sec) in ((0, cap_f[-1][0], sec0), ((n - 1) * ring_n, cap_r[-1][0], secn)):
        bot = min(z for (_, z) in sec)
        top = max(z for (_, z) in sec)
        c = len(verts)
        verts.append((xoff, 0.0, (bot + top) / 2))
        for i in range(ring_n - 1):
            if base == 0:
                faces.append((base + i + 1, base + i, c))
            else:
                faces.append((base + i, base + i + 1, c))

    me = bpy.data.meshes.new('ClioBody')
    me.from_pydata(verts, [], faces)
    me.update()
    # normales cohérentes vers l'extérieur (sinon les booleans s'inversent)
    import bmesh as _bm
    bm = _bm.new()
    bm.from_mesh(me)
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = new_obj('Body', me)
    for nm in MAT_ORDER:
        ob.data.materials.append(MATS[nm])

    mir = ob.modifiers.new('Mirror', 'MIRROR')
    mir.use_axis = (False, True, False)
    mir.merge_threshold = 0.0008
    for p in me.polygons:
        p.use_smooth = True
    es = ob.modifiers.new('Split', 'EDGE_SPLIT')
    es.split_angle = math.radians(43)
    return ob

def apply_all(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def cut_arches(body):
    # le loft dessine déjà l'ouverture d'arche (bas de caisse relevé en arc) ;
    # on ajoute seulement les fourreaux sombres derrière les roues
    apply_all(body)
    for ax in (AXLE_F, AXLE_R):
        for sy in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(
                radius=ARCH_R - 0.02, depth=0.26, vertices=32,
                location=(ax, sy * 0.44, WHEEL_R * 0.98),
                rotation=(math.pi / 2, 0, 0))
            tube = bpy.context.active_object
            tube.name = 'ArchTube'
            tube.data.materials.append(MATS['det'])

def classify_faces(ob):
    me = ob.data
    idx = {n: i for i, n in enumerate(MAT_ORDER)}
    for p in me.polygons:
        c = p.center
        x, ay, z = c.x, abs(c.y), c.z
        m = 'paint'
        belt = interp(BELT, x)
        # bandeau vitré latéral
        if CABIN_X[0] < x < CABIN_X[1] and z > belt + 0.035 and ay > ROOF_HALF - 0.03:
            m = 'glass'
            for (p0, p1) in PILLARS:
                if min(p0, p1) - 0.001 <= x <= max(p0, p1) + 0.001:
                    m = 'paint'
        # pare-brise / lunette (surfaces hautes)
        if WS_X[0] < x < WS_X[1] and z > belt + 0.10 and ay < GLASS_BASE_HALF - 0.02:
            m = 'glass'
        if RG_X[0] < x < RG_X[1] and z > 1.00 and ay < 0.70:
            m = 'glass'
        # plastiques : lèvres de boucliers et bas de caisse
        if z < 0.30 and (x > 1.86 or x < -1.86):
            m = 'det'
        if z < ROCKER_Z + 0.04 and abs(x) < 1.05:
            m = 'det'
        p.material_index = idx[m]

# ---------------------------------------------------------------
# détails ancrés sur les fonctions de surface
# ---------------------------------------------------------------
def blister(name, loc, scale, rot, matname):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=18, ring_count=10,
                                          location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    ob.rotation_euler = rot
    ob.data.materials.append(MATS[matname])
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def box(name, loc, size, matname, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    ob.rotation_euler = rot
    ob.data.materials.append(MATS[matname])
    return ob

def build_details():
    # optiques avant en goutte, couchées sur la pente capot/bouclier
    for sy in (1, -1):
        hx = 1.825
        hy = half_w(hx) * 0.70
        hz = top_z(hx) - 0.085
        blister('HeadlightGlass', (hx, sy * hy, hz),
                (0.185, 0.125, 0.07), (math.radians(sy * 8), math.radians(-22), sy * -0.55), 'lensF')
    # feux arrière verticaux en goutte, plaqués sur les custodes
    for sy in (1, -1):
        tx = -1.935
        ty = half_w(tx) * 0.84
        tz = min(interp(BELT, tx), top_z(tx) - 0.038) - 0.035
        blister('TaillightR', (tx, sy * ty, tz),
                (0.052, 0.088, 0.165), (0, math.radians(10), sy * 0.40), 'lensR')
        blister('TaillightIns', (tx - 0.025, sy * (ty - 0.022), tz - 0.012),
                (0.032, 0.045, 0.055), (0, math.radians(10), sy * 0.40), 'bright')
    # calandre fendue, entrée basse, antibrouillards (dans la face du bouclier)
    box('GrilleSlot', (2.002, 0, 0.585), (0.06, 0.60, 0.05), 'det')
    box('LowerIntake', (2.008, 0, 0.385), (0.06, 0.68, 0.13), 'det')
    for sy in (1, -1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.046, depth=0.05,
            location=(2.012, sy * 0.38, 0.37), rotation=(0, math.pi / 2, 0))
        fog = bpy.context.active_object
        fog.name = 'Fog'
        fog.data.materials.append(MATS['bright'])
    # rétroviseurs sur l'angle de porte avant
    for sy in (1, -1):
        mx = 0.86
        my = half_w(mx)
        box('MirrorArm', (mx, sy * (my + 0.025), 0.915), (0.045, 0.10, 0.03), 'det')
        blister('MirrorShell', (mx - 0.015, sy * (my + 0.048), 0.935),
                (0.048, 0.07, 0.052), (0, 0, sy * -0.2), 'paint')
    # baguettes latérales
    for sy in (1, -1):
        for bx0, bx1 in [(0.72, -0.10), (-0.24, -1.05)]:
            cx = (bx0 + bx1) / 2
            box('SideStrip', (cx, sy * (half_w(cx) * flare(cx) + 0.004), 0.50),
                (abs(bx0 - bx1) - 0.06, 0.016, 0.045), 'det')
    # antenne courte à l'avant du pavillon
    bpy.ops.mesh.primitive_cone_add(radius1=0.011, radius2=0.003, depth=0.26,
        location=(0.30, 0, top_z(0.30) + 0.11), rotation=(0, 0.55, 0))
    ant = bpy.context.active_object
    ant.name = 'Antenna'
    ant.data.materials.append(MATS['det'])
    # essuie-glaces couchés sur l'auvent
    for sy, rr in ((0.30, 0.30), (-0.22, 0.26)):
        wx = 1.00
        box('Wiper', (wx, sy, top_z(wx) + 0.008), (0.025, 0.40, 0.012), 'det',
            rot=(0, 0, rr))
    # poignées de portes
    for hx in (0.30, -0.60):
        for sy in (1, -1):
            box('Handle', (hx, sy * (half_w(hx) + 0.003), interp(BELT, hx) - 0.075),
                (0.125, 0.018, 0.026), 'paint')
    # troisième feu stop + plaque de seuil hayon
    box('Stop3', (-1.30, 0, top_z(-1.30) - 0.015), (0.03, 0.28, 0.02), 'lensR')

def build_wheel(name, x, y):
    bpy.ops.mesh.primitive_torus_add(major_radius=WHEEL_R - 0.075,
                                     minor_radius=0.080,
                                     major_segments=28, minor_segments=14,
                                     location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    tire = bpy.context.active_object
    tire.data.materials.append(MATS['tire'])
    for p in tire.data.polygons:
        p.use_smooth = True
    parts = [tire]
    bpy.ops.mesh.primitive_cylinder_add(radius=WHEEL_R * 0.58, depth=0.04,
        location=(0, 0.045, 0), rotation=(math.pi / 2, 0, 0))
    disc = bpy.context.active_object
    disc.data.materials.append(MATS['rim'])
    parts.append(disc)
    bpy.ops.mesh.primitive_cylinder_add(radius=WHEEL_R * 0.13, depth=0.07,
        location=(0, 0.06, 0), rotation=(math.pi / 2, 0, 0))
    hub = bpy.context.active_object
    hub.data.materials.append(MATS['rim'])
    parts.append(hub)
    for i in range(12):
        a = i / 12 * math.tau
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(
            math.cos(a) * WHEEL_R * 0.31, 0.05, math.sin(a) * WHEEL_R * 0.31))
        sp = bpy.context.active_object
        sp.scale = (0.012, 0.015, WHEEL_R * 0.28)
        sp.rotation_euler = (0, -a, 0)
        sp.data.materials.append(MATS['rim'])
        parts.append(sp)
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = tire
    bpy.ops.object.join()
    wheel = bpy.context.active_object
    wheel.name = name
    # fige l'orientation du tore dans la géométrie, PUIS retourne le côté droit
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if y < 0:
        wheel.rotation_euler = (0, 0, math.pi)
    wheel.location = (x, y, WHEEL_R)
    return wheel

# ---------------------------------------------------------------
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)

def look_at(cam, target):
    d = (Vector(target) - cam.location).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def render_views():
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.render.resolution_x = 980
    scn.render.resolution_y = 560
    cam_data = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    views = {
        'bl_profil': ((0.0, -7.4, 0.85), (0, 0, 0.7), 36),
        'bl_face': ((7.6, 0.0, 0.95), (0, 0, 0.7), 32),
        'bl_arriere': ((-7.6, 0.0, 0.95), (0, 0, 0.7), 32),
        'bl_34': ((5.1, -4.7, 1.9), (0, 0, 0.62), 40),
        'bl_34r': ((-5.1, 4.7, 1.9), (0, 0, 0.62), 40),
    }
    for name, (loc, tgt, lens) in views.items():
        cam.location = loc
        cam_data.lens = lens
        look_at(cam, tgt)
        scn.render.filepath = os.path.join(SNAPS, name + '.png')
        bpy.ops.render.render(write_still=True)

def export_glb():
    path = os.path.join(ASSETS, 'clio3.glb')
    bpy.ops.object.select_all(action='SELECT')
    for ob in bpy.context.selected_objects:
        if ob.type != 'MESH':
            ob.select_set(False)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True,
        export_materials='EXPORT', export_animations=False)
    return path

def main():
    clear_scene()
    body = build_body()
    cut_arches(body)
    classify_faces(body)
    build_details()
    build_wheel('WheelFL', AXLE_F, TRACK_HALF)
    build_wheel('WheelFR', AXLE_F, -TRACK_HALF)
    build_wheel('WheelRL', AXLE_R, TRACK_HALF)
    build_wheel('WheelRR', AXLE_R, -TRACK_HALF)
    # dump : objets qui débordent de l'enveloppe attendue (debug)
    for ob in bpy.data.objects:
        if ob.type != 'MESH':
            continue
        xs2 = [(ob.matrix_world @ Vector(c)) for c in ob.bound_box]
        mnx = min(v.x for v in xs2)
        mxx = max(v.x for v in xs2)
        mny = min(v.y for v in xs2)
        mxy = max(v.y for v in xs2)
        if mnx < -2.05 or mxx > 2.05 or mny < -0.90 or mxy > 0.90:
            print(f'HORS_GABARIT {ob.name}: x[{mnx:.2f},{mxx:.2f}] y[{mny:.2f},{mxy:.2f}]')
    # sommets extrêmes de la coque (élucidation)
    body = bpy.data.objects.get('Body')
    if body:
        lo = [v.co[:] for v in body.data.vertices if v.co.y < -0.9][:4]
        tail = min((v.co.x for v in body.data.vertices), default=0)
        print(f'BODY_EXTREMES y<-0.9: {lo} · x_min={tail:.3f}')
    render_views()
    path = export_glb()
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'CLIO3_DONE glb={path} faces={tris}')

main()
