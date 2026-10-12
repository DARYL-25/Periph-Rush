# ============================================================
# Périph' Rush — roue de poids lourd / bus / utilitaire (design générique)
# Pneu à flancs bombés, 4 rainures longitudinales, pavés d'épaule ;
# jante acier à voile embouti, 8 trous d'aération, moyeu et 10 écrous.
# Une seule roue « WheelR » (face extérieure vers +Y Blender, centrée à
# l'origine, rayon 0,5 m) : le jeu la met à l'échelle de chaque véhicule
# et la miroite pour le côté gauche.
# Usage : python3 tools/blender/heavy_wheel.py  → assets/fleet/w_heavy.glb
# ============================================================
import bpy
import bmesh
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'fleet', 'w_heavy.glb')
R, WT = 0.5, 0.30
SEG = 20


def mat(name, color, metallic=0.0, rough=0.5):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    return m


def lathe(bm, prof, seg=SEG, closed=False):
    """prof : liste (rayon, y) ; révolution autour de l'axe Y."""
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, y, r * sa)) for (r, y) in prof])
    faces = []
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for k in range(len(prof) - 1):
            faces.append(bm.faces.new((A[k], A[k + 1], B[k + 1], B[k])))
    return faces


def box_at(bm, cx, cy, cz, sx, sy, sz, ang):
    """pavé orienté : sx radial, sy axial, sz tangentiel, tourné de ang autour de Y."""
    ca, sa = math.cos(ang), math.sin(ang)
    vs = []
    for dx in (-sx / 2, sx / 2):
        for dy in (-sy / 2, sy / 2):
            for dz in (-sz / 2, sz / 2):
                x, z = cx + dx, cz + dz
                vs.append(bm.verts.new((x * ca - z * sa, cy + dy, x * sa + z * ca)))
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for q in f:
        bm.faces.new([vs[i] for i in q])


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tire_m = mat('tire', (0.025, 0.025, 0.028), 0.0, 0.9)
    rim_m = mat('rim', (0.78, 0.79, 0.8), 1.0, 0.3)

    # ---------------- pneu ----------------
    bm = bmesh.new()
    h = WT / 2
    rb = 0.295  # rayon du talon (accroche jante)
    prof = [
        (rb, -h + 0.03), (rb + 0.03, -h + 0.005), (0.40, -h - 0.004), (0.455, -h + 0.006), (0.482, -h + 0.03),
        (R, -h + 0.05),
        (R, -0.098), (R - 0.013, -0.094), (R - 0.013, -0.078), (R, -0.074),
        (R, -0.032), (R - 0.013, -0.028), (R - 0.013, -0.012), (R, -0.008),
        (R, 0.008), (R - 0.013, 0.012), (R - 0.013, 0.028), (R, 0.032),
        (R, 0.074), (R - 0.013, 0.078), (R - 0.013, 0.094), (R, 0.098),
        (R, h - 0.05), (0.482, h - 0.03), (0.455, h - 0.006), (0.40, h + 0.004), (rb + 0.03, h - 0.005), (rb, h - 0.03),
    ]
    lathe(bm, prof)
    # pavés d'épaule (entailles transversales simulées par des blocs en relief alternés)
    n = SEG
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        for sd in (-1, 1):
            box_at(bm, R + 0.001, sd * (h - 0.072), 0, 0.012, 0.04, 2 * math.pi * R / n * 0.45, a)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('tire')
    bm.to_mesh(me)
    bm.free()
    tire = bpy.data.objects.new('WheelR_tire', me)
    tire.data.materials.append(tire_m)

    # ---------------- jante acier ----------------
    bm = bmesh.new()
    # profil : rebord extérieur → voile embouti → moyeu (face extérieure en +Y)
    rprof = [
        (rb + 0.006, -h + 0.035), (rb + 0.018, -h + 0.02), (rb - 0.01, -h + 0.04), (0.27, -0.06),
        (0.27, 0.05), (rb - 0.01, h - 0.04), (rb + 0.018, h - 0.02), (rb + 0.006, h - 0.035),
        (0.268, h - 0.045), (0.24, 0.07), (0.205, 0.075), (0.15, 0.098), (0.11, 0.10), (0.095, 0.12), (0.06, 0.14), (0.0, 0.142),
    ]
    lathe(bm, rprof)
    # écrous de roue (10, hexagonaux) + cache-moyeu
    for i in range(10):
        a = 2 * math.pi * i / 10
        cx, cz = 0.13 * math.cos(a), 0.13 * math.sin(a)
        ring0, ring1 = [], []
        for k in range(6):
            b = 2 * math.pi * k / 6
            x, z = cx + 0.016 * math.cos(b), cz + 0.016 * math.sin(b)
            ring0.append(bm.verts.new((x, 0.098, z)))
            ring1.append(bm.verts.new((x, 0.122, z)))
        for k in range(6):
            bm.faces.new((ring0[k], ring0[(k + 1) % 6], ring1[(k + 1) % 6], ring1[k]))
        bm.faces.new(ring1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('rim')
    bm.to_mesh(me)
    bm.free()
    rim = bpy.data.objects.new('WheelR_rim', me)
    rim.data.materials.append(rim_m)

    # trous d'aération du voile (disques sombres légèrement en retrait)
    bm = bmesh.new()
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        cx, cz = 0.215 * math.cos(a), 0.215 * math.sin(a)
        c = bm.verts.new((cx, 0.0745, cz))
        ring = []
        for k in range(10):
            b = 2 * math.pi * k / 10
            u, w = 0.032 * math.cos(b), 0.022 * math.sin(b)
            ring.append(bm.verts.new((cx + u * math.cos(a) - w * math.sin(a), 0.0745, cz + u * math.sin(a) + w * math.cos(a))))
        for k in range(10):
            bm.faces.new((c, ring[(k + 1) % 10], ring[k]))
    me = bpy.data.meshes.new('holes')
    bm.to_mesh(me)
    bm.free()
    holes = bpy.data.objects.new('WheelR_holes', me)
    holes.data.materials.append(tire_m)

    root = bpy.data.objects.new('WheelR', None)
    for o in (tire, rim, holes):
        bpy.context.scene.collection.objects.link(o)
        o.parent = root
        for p in o.data.polygons:
            p.use_smooth = True
    bpy.context.scene.collection.objects.link(root)
    # repère « Body » attendu par le chargeur (petit triangle invisible sous le sol)
    me = bpy.data.meshes.new('Body')
    me.from_pydata([(0, 0, -5), (0.01, 0, -5), (0, 0.01, -5)], [], [(0, 1, 2)])
    body = bpy.data.objects.new('Body', me)
    body.data.materials.append(rim_m)
    bpy.context.scene.collection.objects.link(body)
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (tire, rim, holes))
    print('tris', tri)


def export():
    for o in bpy.data.objects:
        o.select_set(True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_animations=False)
    print('GLB', OUT, os.path.getsize(OUT))


if __name__ == '__main__':
    build()
    export()
