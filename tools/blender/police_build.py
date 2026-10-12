# ============================================================
# Périph' Rush — véhicules de police (v19), sur les caisses originales
# du parc (aucun modèle réel reproduit) :
#   police_pn : berline « Concorde » sérigraphiée POLICE (caisse blanche,
#               bandeau bleu marine, filet rouge, rampe lumineuse de toit)
#   crs_van   : fourgon « Cargo » des CRS (bleu nuit, POLICE en blanc,
#               filets blanc/rouge, CRS sur les portes avant, rampe de toit)
# Lettrage en pavés (police bâton maison) projeté sur la carrosserie,
# couleurs portées par les sommets (attribut « Col », matériau det).
#   python3 tools/blender/police_build.py [--render]
# ============================================================
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vkit as K  # noqa: E402
import fleet_build as F  # noqa: E402
from vkit import decal, P_SIDE, P_REAR  # noqa: E402

NAVY, RED, WHITE, BLUE_LENS, GREY = 0x1a2550, 0xc8102e, 0xf2f3f5, 0x2050e0, 0x2a2d33

GLYPHS = {
    'P': ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
    'O': ['.111.', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
    'L': ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
    'I': ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
    'C': ['.1111', '1....', '1....', '1....', '1....', '1....', '.1111'],
    'E': ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
    'R': ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
    'S': ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'],
}


def vcol(ob, hexc):
    if ob is None:
        return None
    me = ob.data
    c = [((hexc >> 16) & 255) / 255, ((hexc >> 8) & 255) / 255, (hexc & 255) / 255]
    lin = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)
    at = me.color_attributes.get('Col') or me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for d in at.data:
        d.color = (*lin, 1.0)
    me.color_attributes.active_color = at
    return ob


def text_rects(txt, px):
    """rectangles (s0, s1, v0, v1) en mètres : s le long de la lecture, v vers le haut (0 = bas)."""
    rects = []
    s = 0.0
    for ch in txt:
        g = GLYPHS[ch]
        w, rows = len(g[0]), len(g)
        runs = []  # (r, c0, c1) segments horizontaux maximaux
        for r in range(rows):
            c = 0
            while c < w:
                if g[r][c] == '1':
                    c1 = c
                    while c1 + 1 < w and g[r][c1 + 1] == '1':
                        c1 += 1
                    runs.append([r, r, c, c1])
                    c = c1 + 1
                else:
                    c += 1
        merged = []
        for run in runs:  # fusion verticale des segments identiques consécutifs
            for m in merged:
                if m[1] == run[0] - 1 and m[2] == run[2] and m[3] == run[3]:
                    m[1] = run[0]
                    break
            else:
                merged.append(run)
        for r0, r1, c0, c1 in merged:
            rects.append((s + c0 * px, s + (c1 + 1) * px, (rows - 1 - r1) * px, (rows - r0) * px))
        s += (w + 1) * px
    return rects, s - px


def side_text(name, txt, xc, z0, height, col, sides=(1, -1)):
    px = height / 7
    rects, width = text_rects(txt, px)
    for sg in sides:
        for i, (s0, s1, v0, v1) in enumerate(rects):
            # lecture de gauche à droite pour un observateur de chaque côté
            if sg > 0:
                u0, u1 = xc + width / 2 - s1, xc + width / 2 - s0
            else:
                u0, u1 = xc - width / 2 + s0, xc - width / 2 + s1
            poly = [(u0, z0 + v0), (u1, z0 + v0), (u1, z0 + v1), (u0, z0 + v1)]
            vcol(decal(f'{name}{sg}_{i}', poly, P_SIDE(sg), 'det', offset=0.006, step=0.05), col)


def rear_text(name, txt, z0, height, col, yc=0.0):
    px = height / 7
    rects, width = text_rects(txt, px)
    for i, (s0, s1, v0, v1) in enumerate(rects):
        u0, u1 = yc + width / 2 - s1, yc + width / 2 - s0
        poly = [(u0, z0 + v0), (u1, z0 + v0), (u1, z0 + v1), (u0, z0 + v1)]
        vcol(decal(f'{name}_{i}', poly, P_REAR, 'det', offset=0.006, step=0.05, min_cos=0.3), col)


def band(name, x0, x1, z0, z1, col, rnd=0.0):
    for sg in (1, -1):
        vcol(decal(f'{name}{sg}', [(x1, z1), (x0, z1), (x0, z0), (x1, z0)], P_SIDE(sg), 'det', offset=0.005, step=0.06, rnd=rnd), col)


def light_bar(x, length=1.12, depth=0.24):
    z = K.top(x)
    bar = K.box('LightBar', (x, 0, z + 0.045), (depth, length, 0.075), 'det', bevel=0.02)
    vcol(bar, BLUE_LENS)
    base = K.box('LightBarBase', (x, 0, z + 0.008), (depth * 0.9, length * 0.96, 0.02), 'det')
    vcol(base, GREY)
    print('BEACON', K.S['id'], 'x', round(x, 3), 'top', round(z + 0.085, 3))


def pn_livery():
    S = K.S
    xa, xr = K.AXF() - K.S['ARCH_R'] - 0.06, K.AXR() + K.S['ARCH_R'] + 0.06
    band('PNBand', xr, xa, 0.44, 0.60, NAVY)
    band('PNRed', xr, xa, 0.625, 0.65, RED)
    side_text('PNText', 'POLICE', (xa + xr) / 2 + 0.02, 0.68, 0.15, NAVY)
    rear_text('PNRear', 'POLICE', 0.78, 0.075, NAVY)
    light_bar(-0.15)


def crs_livery():
    xa, xr = K.AXF() - K.S['ARCH_R'] - 0.05, K.AXR() + K.S['ARCH_R'] + 0.05
    band('CRSWhite', xr, xa, 0.60, 0.64, WHITE)
    band('CRSRed', xr, xa, 0.64, 0.68, RED)
    side_text('CRSText', 'POLICE', -1.05, 0.98, 0.24, WHITE)
    side_text('CRSDoor', 'CRS', 1.12, 0.86, 0.12, WHITE)
    rear_text('CRSRear', 'POLICE', 1.30, 0.11, WHITE)
    light_bar(0.95, 1.2, 0.26)


SPECS = {
    'police_pn': dict(F.CONCORDE, id='police_pn', paint=(0.9, 0.91, 0.92), extra=pn_livery),
    'crs_van': dict(F.CARGO, id='crs_van', paint=(0.05, 0.07, 0.16), extra=crs_livery),
}


def export(path):
    for o in list(bpy.data.objects):
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = bpy.data.objects['Body']
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False, export_vertex_color='ACTIVE')
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('GLB', os.path.basename(path), os.path.getsize(path), 'tris', tri)


def show_vcols():
    m = K.M['det']
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    an = nt.nodes.new('ShaderNodeVertexColor')
    an.layer_name = 'Col'
    nt.links.new(an.outputs['Color'], bsdf.inputs['Base Color'])
    return an


if __name__ == '__main__':
    for vid, spec in SPECS.items():
        K.build(spec, 'lo')
        if '--render' in sys.argv:
            # les objets sans « Col » apparaîtraient noirs : on leur donne la teinte det
            for o in bpy.data.objects:
                if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'det' and not o.data.color_attributes.get('Col'):
                    vcol(o, 0x0a0b0c)
            an = show_vcols()
            K.render(os.path.join(F.SNAPS, f'police_{vid}'), views=('34av', '34ar'), res=(800, 450), samples=16)
            K.M['det'].node_tree.nodes.remove(an)
            K.build(spec, 'lo')
        export(os.path.join(F.OUT, f'{vid}.glb'))
