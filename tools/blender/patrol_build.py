# ============================================================
# Périph' Rush — fourgon d'intervention / de balisage (v21)
# Grand fourgon tôlé à toit surélevé sur la caisse « Cargo » du parc
# (design générique, aucun logo d'exploitant) avec la livrée réglementaire
# française des véhicules d'intervention sur voie rapide :
#   • caisse jaune fluo, bandeau bleu bas de caisse ;
#   • face arrière couverte de chevrons rouges et blancs rétroréfléchissants
#     (pointe vers le haut), encadrant la grande vitre arrière ;
#   • chevrons sur l'arrière des flancs.
# L'équipement de toit (flèche lumineuse à feux jaunes, PMV « RALENTIR »,
# gyrophares) est ajouté dans le jeu (events.js) pour pouvoir clignoter.
#   python3 tools/blender/patrol_build.py [--render]
# ============================================================
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vkit as K  # noqa: E402
import fleet_build as F  # noqa: E402
from vkit import decal, P_SIDE, P_REAR  # noqa: E402

RED, WHITE, BLUE, BLACK = 0xc8102e, 0xf4f5f2, 0x1d3f8f, 0x15171a
SX, ZK, Z0 = 1.12, 0.36, 0.95   # allongement, rehausse du toit au-dessus de Z0


def vcol(ob, hexc):
    if ob is None:
        return None
    c = [((hexc >> 16) & 255) / 255, ((hexc >> 8) & 255) / 255, (hexc & 255) / 255]
    lin = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)
    me = ob.data
    at = me.color_attributes.get('Col') or me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for d in at.data:
        d.color = (*lin, 1.0)
    me.color_attributes.active_color = at
    return ob


def high_roof():
    """allonge la caisse et surélève le pavillon (fourgon grand volume)"""
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if o.name.startswith('Wheel'):
            o.location.x *= SX
            continue
        mw = o.matrix_world.copy()
        inv = mw.inverted()
        for v in o.data.vertices:
            w = mw @ v.co
            w.x *= SX
            if w.z > Z0:
                w.z += (w.z - Z0) * ZK
            v.co = inv @ w
        o.data.update()


def clip(poly, x0, x1, y0, y1):
    """Sutherland–Hodgman : polygone ∩ rectangle"""
    def cut(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            ia, ib = inside(a), inside(b)
            if ib:
                if not ia:
                    out.append(inter(a, b))
                out.append(b)
            elif ia:
                out.append(inter(a, b))
        return out

    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))

    def iy(yc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), yc)

    p = poly
    for inside, inter in ((lambda q: q[0] >= x0, ix(x0)), (lambda q: q[0] <= x1, ix(x1)),
                          (lambda q: q[1] >= y0, iy(y0)), (lambda q: q[1] <= y1, iy(y1))):
        if not p:
            return []
        p = cut(p, inside, inter)
    return p


def chevrons(name, rect, proj, mirror_axis=None, w=0.16, up=True, flip=False):
    """bandes obliques alternées rouge / blanc dans un rectangle (u0,u1,v0,v1) ;
    mirror_axis : abscisse de l'axe de symétrie (chevrons en V)"""
    u0, u1, v0, v1 = rect
    k = 0
    span = (u1 - u0) + (v1 - v0)
    for side in ((-1, 1) if mirror_axis is not None else (1,)):
        lo = u0 if (mirror_axis is None or side < 0) else mirror_axis
        hi = u1 if (mirror_axis is None or side > 0) else mirror_axis
        if mirror_axis is not None:
            lo, hi = (u0, mirror_axis) if side < 0 else (mirror_axis, u1)
        d = -span
        i = 0
        while d < span:
            s = -1 if (side < 0) != flip else 1
            # bande : u = s*(v - v0) + d .. + w
            a = (lo + 0, 0)
            poly = [(s * (v0 - v0) + d + u0, v0), (s * (v0 - v0) + d + u0 + w, v0),
                    (s * (v1 - v0) + d + u0 + w, v1), (s * (v1 - v0) + d + u0, v1)]
            del a
            pc = clip(poly, lo, hi, v0, v1)
            if len(pc) >= 3:
                col = RED if i % 2 == 0 else WHITE
                ob = decal(f'{name}{k}', pc, proj, 'det', offset=0.007, step=0.06)
                vcol(ob, col)
                k += 1
            d += w
            i += 1
    return k


def livery():
    S = K.S
    L = S['L'] * SX
    xr = -L / 2
    # face arrière : chevrons en V sous la vitre et de part et d'autre
    n = chevrons('ChevR', (-0.9, 0.9, 0.44, 1.32), P_REAR, mirror_axis=0.0)
    n += chevrons('ChevRL', (0.66, 0.92, 1.32, 2.2), P_REAR)
    n += chevrons('ChevRR', (-0.92, -0.66, 1.32, 2.2), P_REAR, flip=True)
    # bandeau supérieur rouge/blanc au-dessus de la vitre
    n += chevrons('ChevRT', (-0.66, 0.66, 2.02, 2.22), P_REAR, mirror_axis=0.0)
    # flancs : bandeau bleu bas de caisse + chevrons sur l'arrière
    for sg in (1, -1):
        vcol(decal(f'Blue{sg}', [(xr + 0.25, 0.60), (xr + 4.6, 0.60), (xr + 4.6, 0.86), (xr + 0.25, 0.86)], P_SIDE(sg), 'det', offset=0.006, step=0.06), BLUE)
        n += chevrons(f'ChevS{sg}', (xr + 0.08, xr + 0.95, 0.9, 2.15), P_SIDE(sg), flip=sg < 0)
    print('chevrons', n)


def build():
    spec = dict(F.CARGO, id='patrol_van', paint=(0.80, 0.88, 0.10))
    K.build(spec, 'lo')
    high_roof()
    body = bpy.data.objects['Body'] if 'Body' in bpy.data.objects else [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('Wheel')][0]
    K.make_bvh(body)
    livery()


def export(path):
    for o in list(bpy.data.objects):
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False, export_vertex_color='ACTIVE')
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('GLB', os.path.basename(path), os.path.getsize(path), 'tris', tri)


if __name__ == '__main__':
    build()
    if '--render' in sys.argv:
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'det' and not o.data.color_attributes.get('Col'):
                vcol(o, 0x0a0b0c)
        m = K.M['det']
        nt = m.node_tree
        an = nt.nodes.new('ShaderNodeVertexColor')
        an.layer_name = 'Col'
        nt.links.new(an.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color'])
        K.render(os.path.join(F.SNAPS, 'patrol'), views=('34av', '34ar', 'dos'), res=(800, 450), samples=16)
        nt.nodes.remove(an)
        build()
    export(os.path.join(F.OUT, 'patrol_van.glb'))
