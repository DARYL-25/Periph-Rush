# ============================================================
# Périph' Rush — lettrage des livrées (v22)
# Police bâton maison 5×7 (majuscules, chiffres, ponctuation simple) :
#   • text_rects : rectangles fusionnés d'un texte (mètres)
#   • side_text / rear_text / front_text / top_text : projetés sur la caisse (vkit.decal)
#   • flat_text : à plat sur un plan quelconque (caissons, panneaux de toit)
# Couleurs portées par les sommets (attribut « Col », matériau det).
# ============================================================
import bpy
from mathutils import Vector

import vkit as K
from vkit import decal, P_SIDE, P_REAR, P_FRONT, P_TOP

G = {
    'A': ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
    'B': ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
    'C': ['.1111', '1....', '1....', '1....', '1....', '1....', '.1111'],
    'D': ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
    'E': ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
    'F': ['11111', '1....', '1....', '1111.', '1....', '1....', '1....'],
    'G': ['.1111', '1....', '1....', '1.111', '1...1', '1...1', '.1111'],
    'H': ['1...1', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
    'I': ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
    'J': ['..111', '...1.', '...1.', '...1.', '...1.', '1..1.', '.11..'],
    'K': ['1...1', '1..1.', '1.1..', '11...', '1.1..', '1..1.', '1...1'],
    'L': ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
    'M': ['1...1', '11.11', '1.1.1', '1.1.1', '1...1', '1...1', '1...1'],
    'N': ['1...1', '11..1', '1.1.1', '1..11', '1...1', '1...1', '1...1'],
    'O': ['.111.', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
    'P': ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
    'Q': ['.111.', '1...1', '1...1', '1...1', '1.1.1', '1..1.', '.11.1'],
    'R': ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
    'S': ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'],
    'T': ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '..1..'],
    'U': ['1...1', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
    'V': ['1...1', '1...1', '1...1', '1...1', '.1.1.', '.1.1.', '..1..'],
    'W': ['1...1', '1...1', '1...1', '1.1.1', '1.1.1', '11.11', '1...1'],
    'X': ['1...1', '.1.1.', '.1.1.', '..1..', '.1.1.', '.1.1.', '1...1'],
    'Y': ['1...1', '.1.1.', '.1.1.', '..1..', '..1..', '..1..', '..1..'],
    'Z': ['11111', '....1', '...1.', '..1..', '.1...', '1....', '11111'],
    '0': ['.111.', '1...1', '1..11', '1.1.1', '11..1', '1...1', '.111.'],
    '1': ['..1..', '.11..', '..1..', '..1..', '..1..', '..1..', '.111.'],
    '2': ['.111.', '1...1', '....1', '...1.', '..1..', '.1...', '11111'],
    '3': ['1111.', '....1', '....1', '.111.', '....1', '....1', '1111.'],
    '4': ['...1.', '..11.', '.1.1.', '1..1.', '11111', '...1.', '...1.'],
    '5': ['11111', '1....', '1111.', '....1', '....1', '1...1', '.111.'],
    '6': ['.111.', '1....', '1....', '1111.', '1...1', '1...1', '.111.'],
    '7': ['11111', '....1', '...1.', '..1..', '.1...', '.1...', '.1...'],
    '8': ['.111.', '1...1', '1...1', '.111.', '1...1', '1...1', '.111.'],
    '9': ['.111.', '1...1', '1...1', '.1111', '....1', '....1', '.111.'],
    '-': ['...', '...', '...', '111', '...', '...', '...'],
    '/': ['....1', '....1', '...1.', '..1..', '.1...', '1....', '1....'],
    '.': ['.', '.', '.', '.', '.', '.', '1'],
    '&': ['.11..', '1..1.', '1.1..', '.1...', '1.1.1', '1..1.', '.11.1'],
    ' ': ['..', '..', '..', '..', '..', '..', '..'],
}
ACCENT = {'É': 'E', 'È': 'E', 'À': 'A', 'Ô': 'O'}


def srgb_lin(hexc):
    c = [((hexc >> 16) & 255) / 255, ((hexc >> 8) & 255) / 255, (hexc & 255) / 255]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def vcol(ob, hexc):
    if ob is None:
        return None
    lin = srgb_lin(hexc)
    me = ob.data
    at = me.color_attributes.get('Col') or me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for d in at.data:
        d.color = (*lin, 1.0)
    me.color_attributes.active_color = at
    return ob


def text_rects(txt, px, bold=False):
    """rectangles (s0, s1, v0, v1) : s le long de la lecture, v vers le haut (0 = pied des lettres)."""
    rects = []
    s = 0.0
    for ch0 in txt:
        ch = ACCENT.get(ch0, ch0)
        g = G[ch]
        w, rows = len(g[0]), len(g)
        runs = []
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
        for run in runs:
            for m in merged:
                if m[1] == run[0] - 1 and m[2] == run[2] and m[3] == run[3]:
                    m[1] = run[0]
                    break
            else:
                merged.append(run)
        e = px * 0.12 if bold else 0.0
        for r0, r1, c0, c1 in merged:
            rects.append((s + c0 * px - e, s + (c1 + 1) * px + e, (rows - 1 - r1) * px, (rows - r0) * px))
        if ch0 != ch:   # accent aigu
            rects.append((s + 2.2 * px, s + 3.6 * px, rows * px + 0.35 * px, rows * px + 1.0 * px))
        s += (w + 1) * px
    return rects, s - px


def text_width(txt, height):
    return text_rects(txt, height / 7)[1]


def side_text(name, txt, xc, z0, height, col, sides=(1, -1), bold=False, offset=0.007):
    px = height / 7
    rects, width = text_rects(txt, px, bold)
    for sg in sides:
        for i, (s0, s1, v0, v1) in enumerate(rects):
            if sg > 0:
                u0, u1 = xc + width / 2 - s1, xc + width / 2 - s0
            else:
                u0, u1 = xc - width / 2 + s0, xc - width / 2 + s1
            poly = [(u0, z0 + v0), (u1, z0 + v0), (u1, z0 + v1), (u0, z0 + v1)]
            vcol(decal(f'{name}{sg}_{i}', poly, P_SIDE(sg), 'det', offset=offset, step=0.05), col)
    return width


def rear_text(name, txt, z0, height, col, yc=0.0, bold=False):
    px = height / 7
    rects, width = text_rects(txt, px, bold)
    for i, (s0, s1, v0, v1) in enumerate(rects):
        u0, u1 = yc + width / 2 - s1, yc + width / 2 - s0
        poly = [(u0, z0 + v0), (u1, z0 + v0), (u1, z0 + v1), (u0, z0 + v1)]
        vcol(decal(f'{name}_{i}', poly, P_REAR, 'det', offset=0.008, step=0.05, min_cos=0.3), col)
    return width


def front_text(name, txt, z0, height, col, yc=0.0, bold=False):
    px = height / 7
    rects, width = text_rects(txt, px, bold)
    for i, (s0, s1, v0, v1) in enumerate(rects):
        u0, u1 = yc - width / 2 + s0, yc - width / 2 + s1
        poly = [(u0, z0 + v0), (u1, z0 + v0), (u1, z0 + v1), (u0, z0 + v1)]
        vcol(decal(f'{name}_{i}', poly, P_FRONT, 'det', offset=0.008, step=0.05, min_cos=0.3), col)
    return width


def top_text(name, txt, xc, height, col, yc=0.0, read_from='front'):
    """texte sur le capot / le pavillon (vu d'en haut). read_from='front' : lisible depuis l'avant
    (capot, comme dans un rétroviseur on lit à l'envers) ; 'side' : lisible depuis un hélicoptère côté gauche."""
    px = height / 7
    rects, width = text_rects(txt, px)
    for i, (s0, s1, v0, v1) in enumerate(rects):
        if read_from == 'front':      # lecture : de +y vers -y, pied des lettres vers l'arrière (-x)
            y0, y1 = yc + width / 2 - s1, yc + width / 2 - s0
            x0, x1 = xc - height / 2 + v0, xc - height / 2 + v1
        else:                          # lecture le long de -x (pied vers -y)
            x0, x1 = xc + width / 2 - s1, xc + width / 2 - s0
            y0, y1 = yc - height / 2 + v0, yc - height / 2 + v1
        poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        vcol(decal(f'{name}_{i}', poly, P_TOP, 'det', offset=0.008, step=0.05, min_cos=0.3), col)
    return width


def flat_quad(name, pts, col, mat='det'):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(K.M[mat])
    return vcol(ob, col)


def flat_text(name, txt, origin, u, v, height, col, centered=True):
    """texte plat : origin (centre si centered), u = sens de lecture, v = vers le haut (vecteurs unitaires)"""
    o, u, v = Vector(origin), Vector(u).normalized(), Vector(v).normalized()
    px = height / 7
    rects, width = text_rects(txt, px)
    base = o - u * (width / 2 if centered else 0) - v * (height / 2 if centered else 0)
    objs = []
    for i, (s0, s1, v0, v1) in enumerate(rects):
        a = base + u * s0 + v * v0
        b = base + u * s1 + v * v0
        c = base + u * s1 + v * v1
        d = base + u * s0 + v * v1
        objs.append(flat_quad(f'{name}_{i}', [a, b, c, d], col))
    return width


def side_poly(name, poly, col, sides=(1, -1), offset=0.006, rnd=0.0, step=0.06):
    """polygone (x, z) projeté sur les deux flancs (même orientation avant/arrière)"""
    out = []
    for sg in sides:
        pl = poly if sg > 0 else poly[::-1]
        out.append(vcol(decal(f'{name}{sg}', pl, P_SIDE(sg), 'det', offset=offset, step=step, rnd=rnd), col))
    return out


def battenburg(name, x0, x1, z0, rows, cell, cols_ab, sides=(1, -1), offset=0.007, proj='side'):
    """damier rétroréfléchissant (Battenburg) : rows rangées de carrés alternés de deux couleurs"""
    n = int((x1 - x0) / cell)
    k = 0
    for r in range(rows):
        for i in range(n):
            col = cols_ab[(i + r) % 2]
            xa, xb = x0 + i * cell, x0 + (i + 1) * cell
            za, zb = z0 + r * cell, z0 + (r + 1) * cell
            if proj == 'side':
                side_poly(f'{name}{k}', [(xb, za), (xa, za), (xa, zb), (xb, zb)], col, sides, offset=offset, step=0.08)
            k += 1
