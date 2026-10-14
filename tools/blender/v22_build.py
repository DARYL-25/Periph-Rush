# ============================================================
# Périph' Rush — v22 : véhicules de service et utilitaires sérigraphiés
# Caisses ORIGINALES du parc (aucun modèle réel reproduit, aucun logo
# de marque) avec les livrées réelles :
#   police_pn   SUV compact gris, livrée Police nationale 2020 (flèches bleue
#               et rouge encadrant l'écusson, pointillés rétroréfléchissants,
#               POLICE, rampe bleue de toit, « 17 » au hayon)
#   smur_vl     même SUV, véhicule léger médicalisé (jaune, damier jaune/vert,
#               SAMU 75 / SMUR en bleu, « 15 »)
#   crs_van     fourgon tôlé à toit haut bleu nuit des CRS (grilles de vitres,
#               pare-buffle, rampe + haut-parleurs, POLICE / CRS)
#   samu_umh    fourgon ambulance à toit haut (unité mobile hospitalière)
#   livr_bleu   fourgon de livraison bleu nuit, filet bleu ciel (plateformes
#               de livraison en ligne) — sans nom ni logo
#   livr_expr   fourgon de messagerie express blanc et bleu — sans nom ni logo
#   pro_*       utilitaires d'artisans / de sociétés (lettrage générique)
#   auto_ecole  citadine d'auto-école (enseigne de toit, « A » d'apprenti)
#   python3 tools/blender/v22_build.py [id ...] [--render]
# ============================================================
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vkit as K  # noqa: E402
import fleet_build as F  # noqa: E402
import lettering as T  # noqa: E402
from vkit import decal, P_SIDE, P_REAR, P_FRONT, P_TOP, ellipse, strip  # noqa: E402

NAVY, NAVY2, RED, WHITE, BLUE_LENS, GREY = 0x1a2550, 0x0f1a3c, 0xc8102e, 0xf2f3f5, 0x2050e0, 0x2a2d33
PN_BLUE, PN_RED = 0x1f3f9a, 0xd0202e
SAMU_BLUE, SAMU_YEL, SAMU_GRN, SAMU_BODY = 0x1b3a8c, 0xf4e01c, 0x1f8a3a, (0.93, 0.80, 0.10)
BLACK = 0x121316


# ------------------------------------------------------------------
# caisse SUV compact à pavillon fuyant (4,54 m) — silhouette originale
# ------------------------------------------------------------------
P_SUV = dict(id='suv_c', L=4.54, W=1.89, H=1.64, WB=2.74, ovF=0.92, WR=0.36, zbot=0.31, zn=0.94, zh=1.05, xc=1.02, xr=0.30,
             xre=-1.12, cab0=-1.98, zbelt=1.08, rise=0.12, rear='hatch', zend=0.84, roofK=0.70, c_top=-1.30,
             c_line=[(-1.72, 0.07), (-1.86, 0.035)], paint=(0.42, 0.44, 0.46), tireW=0.225)


def suv_front():
    zn, W = 0.94, 1.89
    hw = W / 2
    # optiques effilées très hautes + calandre sans cadre en damier sombre
    F.front_kit(zn, W, lamp='slim', grille='bar', inner=0.36, fog=False)
    decal('SkidF', [(0.48, 0.42), (-0.48, 0.42), (-0.52, 0.36), (0.52, 0.36)], P_FRONT, 'bright', offset=0.005, rnd=0.02)


def suv_rear():
    F.rear_kit(1.10, 1.89, lamp='hband', zplate=0.62, band=True)


SUV = F.make_spec(P_SUV, suv_front, suv_rear, rimStyle='ten', cladding=True, archTrimW=0.09, spoiler=True,
                  EXHAUST=[], blackMirrors=True)


def roof_z(x):
    """hauteur du pavillon en x (tient compte de l'allongement / rehausse des fourgons à toit haut)"""
    if not K.S.get('_high'):
        return K.top(x)
    z = K.top(x / SX)
    return z + (z - Z0) * ZK if z > Z0 else z


def light_bar(x, length=1.10, depth=0.26, col=BLUE_LENS, z_extra=0.0):
    z = roof_z(x) + z_extra
    T.vcol(K.box('LightBarBase', (x, 0, z + 0.012), (depth * 0.92, length * 0.98, 0.026), 'det'), GREY)
    T.vcol(K.box('LightBar', (x, 0, z + 0.05), (depth, length, 0.06), 'det', bevel=0.02), col)
    T.vcol(K.box('LightBarMid', (x, 0, z + 0.052), (depth * 1.01, length * 0.34, 0.05), 'det'), 0x2a2d33)
    print('BEACON', K.S['id'], 'x', round(x, 3), 'top', round(z + 0.085, 3))
    return z + 0.085


def pn_livery():
    """livrée Police nationale 2020 sur caisse grise"""
    xa, xr = K.AXF() - K.S['ARCH_R'] - 0.05, K.AXR() + K.S['ARCH_R'] + 0.05
    bx = K.S['DLO']['b_x']
    # flèches : bleue vers l'avant, rouge vers l'arrière, pointe tournée vers l'écusson central
    zb0, zb1 = 0.50, 0.70
    blue = [(xa, zb0), (bx + 0.30, zb0), (bx + 0.12, (zb0 + zb1) / 2), (bx + 0.30, zb1), (xa + 0.05, zb1)]
    red = [(xr - 0.05, zb1), (bx - 0.42, zb1), (bx - 0.24, (zb0 + zb1) / 2), (bx - 0.42, zb0), (xr, zb0)]
    T.side_poly('PNArrowB', blue, PN_BLUE)
    T.side_poly('PNArrowR', red, PN_RED)
    # écusson (dessin générique : bouclier bleu marine, liseré blanc) entre les deux pointes
    zc = (zb0 + zb1) / 2
    shield = [(bx + 0.02, zc + 0.12), (bx - 0.14, zc + 0.12), (bx - 0.14, zc - 0.02), (bx - 0.06, zc - 0.13), (bx + 0.02, zc - 0.02)]
    T.side_poly('PNShieldW', K.grow(shield, 0.018, 1.0), WHITE, offset=0.0065)
    T.side_poly('PNShield', shield, NAVY, offset=0.0075)
    # POLICE en grandes capitales bleu marine sur les portes, au-dessus des flèches
    T.side_text('PNText', 'POLICE', bx - 0.06, 0.76, 0.17, NAVY, bold=True)
    # pointillés rétroréfléchissants au-dessus des poignées
    for sg in (1, -1):
        x = xa - 0.05
        k = 0
        while x > xr + 0.1:
            z = K.belt(x) - 0.035
            T.vcol(decal(f'PNDot{sg}_{k}', [(x, z - 0.012), (x - 0.06, z - 0.012), (x - 0.06, z + 0.012), (x, z + 0.012)], P_SIDE(sg), 'det', offset=0.006, step=0.06), 0xe8ecf2)
            x -= 0.12
            k += 1
    # capot : POLICE lisible dans le rétroviseur des usagers devant, filet bleu-blanc-rouge
    T.top_text('PNHood', 'POLICE', 1.60, 0.20, NAVY, read_from='front')
    # hayon : POLICE + 17
    T.rear_text('PNRear', 'POLICE', 0.86, 0.08, NAVY, bold=True, yc=-0.12)
    T.rear_text('PNRear17', '17', 0.86, 0.08, NAVY, yc=0.50, bold=True)
    # feux bleus à éclats dans la calandre et rampe LED de toit
    for sg in (1, -1):
        T.vcol(decal(f'GrilleBlue{sg}', ellipse(sg * 0.30, 0.70, 0.05, 0.022), P_FRONT, 'det', offset=0.01), BLUE_LENS)
    light_bar(-0.22, 1.12, 0.26)


def smur_livery():
    """véhicule léger SMUR : caisse jaune, damier jaune/vert, lettrage bleu (arrêté du 13 avril 2026)"""
    xa, xr = K.AXF() - K.S['ARCH_R'] - 0.04, K.AXR() + K.S['ARCH_R'] + 0.04
    T.battenburg('SmurB', xr, xa, 0.44, 2, 0.11, (SAMU_GRN, SAMU_YEL))
    bx = K.S['DLO']['b_x']
    T.side_text('SmurT', 'SAMU 75', bx + 0.02, 0.795, 0.125, SAMU_BLUE, bold=True)
    T.side_text('SmurS', 'SMUR', bx + 0.02, 0.69, 0.06, SAMU_BLUE)
    T.top_text('SmurHood', 'SAMU', 1.62, 0.18, SAMU_BLUE, read_from='front')
    T.top_text('SmurRoof', 'SAMU 75', -0.6, 0.22, SAMU_BLUE, read_from='side')
    # face arrière : bandes alternées jaune / rouge + SAMU
    for i in range(8):
        y0 = -0.78 + i * 0.195
        T.vcol(decal(f'SmurRearBand{i}', [(y0 + 0.195, 0.48), (y0, 0.48), (y0, 0.56), (y0 + 0.195, 0.56)], P_REAR, 'det', offset=0.008, min_cos=0.3),
               RED if i % 2 else SAMU_YEL)
    T.rear_text('SmurRear', 'SAMU 75', 0.86, 0.075, SAMU_BLUE, bold=True)
    light_bar(-0.22, 1.12, 0.26)


# ------------------------------------------------------------------
# fourgons à toit haut (base « Cargo »)
# ------------------------------------------------------------------
SX, ZK, Z0 = 1.12, 0.36, 0.95


def high_roof(sx=SX, zk=ZK):
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if o.name.startswith('Wheel'):
            o.location.x *= sx
            continue
        mw = o.matrix_world.copy()
        inv = mw.inverted()
        for v in o.data.vertices:
            w = mw @ v.co
            w.x *= sx
            if w.z > Z0:
                w.z += (w.z - Z0) * zk
            v.co = inv @ w
        o.data.update()


def van_base(vid, paint, high=True):
    spec = dict(F.CARGO, id=vid, paint=paint)
    K.build(spec, 'lo')
    if high:
        high_roof()
    body = bpy.data.objects['Body']
    K.make_bvh(body)
    return spec


def van_xr():
    return -K.S['L'] * SX / 2


def crs_livery():
    L = K.S['L'] * SX
    xf, xr = L / 2, -L / 2
    # filet tricolore horizontal bas de caisse
    T.side_poly('CrsB', [(xr + 0.2, 0.62), (xf - 0.75, 0.62), (xf - 0.75, 0.66), (xr + 0.2, 0.66)], 0x2b54c6)
    T.side_poly('CrsW', [(xr + 0.2, 0.66), (xf - 0.75, 0.66), (xf - 0.75, 0.70), (xr + 0.2, 0.70)], WHITE)
    T.side_poly('CrsR', [(xr + 0.2, 0.70), (xf - 0.75, 0.70), (xf - 0.75, 0.74), (xr + 0.2, 0.74)], RED)
    T.side_text('CrsText', 'POLICE', -0.9, 1.05, 0.34, WHITE, bold=True)
    T.side_text('CrsDoor', 'CRS', 1.42, 0.88, 0.13, WHITE, bold=True)
    T.rear_text('CrsRear', 'POLICE', 1.50, 0.14, WHITE, bold=True)
    T.rear_text('CrsRearN', 'CRS 7', 0.92, 0.07, WHITE)
    T.top_text('CrsRoof', 'POLICE', -0.9, 0.42, WHITE, read_from='side')
    # grilles de protection sur les vitres latérales de cabine et la lunette arrière
    for sg in (1, -1):
        x0, x1 = 0.70, 1.55
        for k in range(7):
            x = x0 + (x1 - x0) * k / 6
            z = 1.18
            y = sg * (K.body_y(x, 1.45, sg) + 0.03)
            T.vcol(K.box(f'CrsGrilleV{sg}_{k}', (x, y, 1.48), (0.018, 0.018, 0.56), 'det'), 0x23262b)
        for z in (1.24, 1.48, 1.72):
            xm = (x0 + x1) / 2
            T.vcol(K.box(f'CrsGrilleH{sg}_{z}', (xm, sg * (K.body_y(xm, z, sg) + 0.035), z), (x1 - x0, 0.016, 0.016), 'det'), 0x23262b)
    # grille de pare-brise relevée (repliée sur le toit, à l'avant)
    xw = 1.30
    T.vcol(K.box('CrsWsGrid', (xw, 0, roof_z(xw) + 0.05), (0.42, 1.55, 0.03), 'det'), 0x23262b)
    # pare-buffle
    for sg in (1, -1):
        T.vcol(K.box(f'CrsBullV{sg}', (xf + 0.06, sg * 0.42, 0.62), (0.05, 0.05, 0.46), 'det'), 0x1a1c20)
    T.vcol(K.box('CrsBullH', (xf + 0.08, 0, 0.80), (0.05, 1.0, 0.05), 'det'), 0x1a1c20)
    T.vcol(K.box('CrsBullL', (xf + 0.08, 0, 0.48), (0.05, 1.1, 0.06), 'det'), 0x1a1c20)
    # rampe lumineuse + haut-parleurs
    zt = light_bar(1.05, 1.30, 0.28)
    for sg in (1, -1):
        T.vcol(K.box(f'CrsHp{sg}', (0.72, sg * 0.36, zt - 0.03), (0.22, 0.2, 0.1), 'det', bevel=0.02), 0x2a2d33)
    # feux bleus arrière en haut de caisse
    for sg in (1, -1):
        T.vcol(K.box(f'CrsBlueR{sg}', (xr + 0.40, sg * 0.36, roof_z(xr + 0.40) - 0.01), (0.10, 0.14, 0.07), 'det'), BLUE_LENS)


def samu_livery():
    L = K.S['L'] * SX
    xf, xr = L / 2, -L / 2
    T.battenburg('SamuB', xr + 0.12, xf - 1.0, 0.52, 2, 0.15, (SAMU_GRN, SAMU_YEL))
    T.side_text('SamuT', 'SAMU 75', -0.55, 1.35, 0.26, SAMU_BLUE, bold=True)
    T.side_text('SamuS', 'SMUR PARIS', -0.55, 1.13, 0.12, SAMU_BLUE)
    # logogramme « 15 » dans un disque bleu (porte avant)
    for sg in (1, -1):
        T.vcol(decal(f'Samu15D{sg}', ellipse(1.30, 1.05, 0.15, 0.15, 24), P_SIDE(sg), 'det', offset=0.006, step=0.05), SAMU_BLUE)
    T.side_text('Samu15', '15', 1.30, 0.99, 0.12, WHITE, offset=0.0085)
    # croix d'assistance sur le flanc arrière haut
    for sg in (1, -1):
        for poly in ([(-1.42, 1.70), (-1.62, 1.70), (-1.62, 2.00), (-1.42, 2.00)], [(-1.37, 1.78), (-1.67, 1.78), (-1.67, 1.92), (-1.37, 1.92)]):
            T.vcol(decal(f'SamuCross{sg}{poly[0][0]}{poly[0][1]}', poly, P_SIDE(sg), 'det', offset=0.006, step=0.05), SAMU_BLUE)
    # face arrière : chevrons jaune / rouge + SAMU
    from patrol_build import chevrons
    import patrol_build as PB
    PB.RED, PB.WHITE = RED, SAMU_YEL
    PB.vcol = T.vcol
    chevrons('SamuChev', (-0.9, 0.9, 0.46, 1.05), P_REAR, mirror_axis=0.0, w=0.15)
    T.rear_text('SamuRear', 'SAMU 75', 1.62, 0.12, SAMU_BLUE, bold=True)
    T.rear_text('SamuRearS', 'SMUR', 1.40, 0.07, SAMU_BLUE)
    T.top_text('SamuRoof', 'SAMU 75', -0.6, 0.45, SAMU_BLUE, read_from='side')
    zt = light_bar(1.05, 1.30, 0.28)
    for sg in (1, -1):
        T.vcol(K.box(f'SamuBlueR{sg}', (xr + 0.40, sg * 0.36, roof_z(xr + 0.40) - 0.01), (0.10, 0.14, 0.07), 'det'), BLUE_LENS)
    del zt


# fourgons de livraison (sans nom ni logo) ---------------------------------
def livr_bleu_livery():
    """plateforme de livraison en ligne : caisse bleu nuit, filet bleu ciel, flancs unis"""
    L = K.S['L'] * SX
    xf, xr = L / 2, -L / 2
    sky = 0x19a9e0
    T.side_poly('LbSky', [(xr + 0.05, 0.40), (xf - 0.78, 0.40), (xf - 0.78, 0.46), (xr + 0.05, 0.46)], sky)
    # grand bandeau courbe bleu ciel (vague) sur l'arrière des flancs
    wave = [(xr + 0.05, 0.62), (-0.2, 0.62), (0.2, 0.72), (0.45, 0.90), (0.40, 0.96), (0.1, 0.80), (-0.4, 0.72), (xr + 0.05, 0.72)]
    T.side_poly('LbWave', wave, sky, rnd=0.05)
    T.side_text('LbText', 'LIVRAISON', -0.6, 1.55, 0.13, WHITE)
    T.rear_text('LbRear', 'LIVRAISON', 1.70, 0.07, WHITE)
    T.rear_text('LbRear2', 'ATTENTION ARRETS FREQUENTS', 0.95, 0.035, WHITE)


def livr_expr_livery():
    """messagerie express : caisse blanche, bas de caisse et arrière bleu marine, diagonales bleu clair"""
    L = K.S['L'] * SX
    xf, xr = L / 2, -L / 2
    dark, light = 0x1d2b6e, 0x3fa9f5
    T.side_poly('LeDark', [(xr + 0.03, 0.40), (xf - 0.75, 0.40), (xf - 0.75, 0.86), (0.4, 0.86), (-0.2, 1.25), (xr + 0.03, 1.25)], dark)
    for k, dx in enumerate((0.0, 0.32)):
        T.side_poly(f'LeDiag{k}', [(0.62 + dx, 0.86), (0.78 + dx, 0.86), (0.18 + dx, 1.30), (0.02 + dx, 1.30)], light, offset=0.0075)
    T.side_text('LeText', 'EXPRESS', -1.1, 0.95, 0.16, WHITE, bold=True, offset=0.0085)
    T.side_text('LeText2', 'COLIS 24H', -0.4, 1.62, 0.11, dark)
    for i in range(1):
        T.vcol(decal('LeRearDark', [(0.95, 0.40), (-0.95, 0.40), (-0.95, 1.10), (0.95, 1.10)], P_REAR, 'det', offset=0.006, min_cos=0.3), dark)
    T.rear_text('LeRear', 'EXPRESS', 0.70, 0.09, WHITE, bold=True)


def roof_rack(ladder=True):
    """galerie de toit d'artisan (barres alu) + échelle sanglée"""
    alu = 0xb9bec4
    xs = [0.30, -0.55, -1.40, -2.15]
    for x in xs:
        z = roof_z(x)
        T.vcol(K.box(f'RackBar{x}', (x, 0, z + 0.06), (0.05, 1.62, 0.04), 'det'), alu)
        for sg in (1, -1):
            T.vcol(K.box(f'RackFoot{x}{sg}', (x, sg * 0.76, z + 0.025), (0.06, 0.05, 0.06), 'det'), 0x2a2d33)
    for sg in (1, -1):
        T.vcol(K.box(f'RackRail{sg}', (-0.92, sg * 0.80, roof_z(-0.92) + 0.10), (2.6, 0.035, 0.035), 'det'), alu)
    if ladder:
        y0 = -0.28
        zt = max(roof_z(x) for x in xs) + 0.10
        for sg in (1, -1):
            T.vcol(K.box(f'LadderRail{sg}', (-0.95, y0 + sg * 0.2, zt), (2.9, 0.05, 0.03), 'det'), alu)
        for k in range(11):
            T.vcol(K.box(f'LadderRung{k}', (-2.35 + k * 0.28, y0, zt), (0.03, 0.4, 0.025), 'det'), alu)
        for x in (0.05, -1.9):
            T.vcol(K.box(f'Strap{x}', (x, y0, zt + 0.005), (0.04, 0.46, 0.035), 'det'), 0xd08a1a)


def pro_livery(title, sub, phone, stripe, accent=None, text_col=None, rack=False):
    def f():
        if rack:
            roof_rack()
        L = K.S['L'] * SX if K.S.get('_high') else K.S['L']
        xf, xr = L / 2, -L / 2
        tc = text_col or stripe
        T.side_poly('ProStripe', [(xr + 0.05, 0.56), (xf - 0.80, 0.56), (xf - 0.80, 0.66), (xr + 0.05, 0.66)], stripe)
        if accent:
            T.side_poly('ProAccent', [(xr + 0.05, 0.66), (xf - 0.80, 0.66), (xf - 0.80, 0.69), (xr + 0.05, 0.69)], accent)
        top = 1.62 if K.S.get('_high') else 1.42
        T.side_text('ProTitle', title, -0.75, top - 0.30, 0.17, tc, bold=True)
        if sub:
            T.side_text('ProSub', sub, -0.75, top - 0.52, 0.085, tc)
        if phone:
            T.side_text('ProTel', phone, -0.75, 0.80, 0.075, 0x2a2d33)
        T.rear_text('ProRear', title.split(' ')[0], 1.10 if not K.S.get('_high') else 1.30, 0.07, tc)
    return f


# auto-école --------------------------------------------------------------
def auto_ecole_extra():
    x = -0.35
    z = K.top(x)
    # enseigne de toit (caisson trapézoïdal blanc, bandeau rouge, lettrage bleu)
    T.vcol(K.box('AeBase', (x, 0, z + 0.015), (0.30, 0.95, 0.03), 'det'), GREY)
    T.vcol(K.box('AeSign', (x, 0, z + 0.15), (0.12, 0.92, 0.24), 'det', bevel=0.02), 0xf3f4f6)
    T.vcol(K.box('AeBand', (x, 0, z + 0.05), (0.125, 0.93, 0.05), 'det'), 0xc8102e)
    for sg in (1, -1):
        T.flat_text(f'AeTxt{sg}', 'AUTO-ECOLE', (x + sg * 0.063, 0, z + 0.165), (0, sg, 0), (0, 0, 1), 0.10, 0x1b3a8c)
    # disque « A » (conducteur novice) sur le hayon
    T.vcol(decal('AeDisc', ellipse(-0.42, 0.98, 0.075, 0.075, 20), P_REAR, 'det', offset=0.008, min_cos=0.3), 0xf4f4f4)
    T.rear_text('AeA', 'A', 0.94, 0.08, 0xc8102e, yc=-0.42, bold=True)


# ------------------------------------------------------------------
BUILDS = {}


def suv_job(vid, paint, extra):
    def run():
        spec = dict(SUV, id=vid, paint=paint, extra=extra)
        K.build(spec, 'lo')
    return run


def van_job(vid, paint, livery, high=True):
    def run():
        van_base(vid, paint, high)
        K.S['_high'] = high
        livery()
    return run


BUILDS['police_pn'] = suv_job('police_pn', (0.50, 0.52, 0.54), pn_livery)
BUILDS['smur_vl'] = suv_job('smur_vl', SAMU_BODY, smur_livery)
BUILDS['crs_van'] = van_job('crs_van', (0.04, 0.06, 0.14), crs_livery)
BUILDS['samu_umh'] = van_job('samu_umh', SAMU_BODY, samu_livery)
BUILDS['livr_bleu'] = van_job('livr_bleu', (0.035, 0.05, 0.085), livr_bleu_livery)
BUILDS['livr_expr'] = van_job('livr_expr', (0.90, 0.91, 0.92), livr_expr_livery)
BUILDS['pro_plomb'] = van_job('pro_plomb', (0.90, 0.91, 0.92), pro_livery('PLOMBERIE', 'CHAUFFAGE - SANITAIRE', '01 45 00 00 00', 0x1b4fa8, 0xd0202e, rack=True), high=False)
BUILDS['pro_elec'] = van_job('pro_elec', (0.90, 0.91, 0.92), pro_livery('ELECTRICITE', 'DEPANNAGE 7J/7', '01 42 00 00 00', 0xf08a12, 0x22252b, 0x22252b, rack=True), high=False)
BUILDS['pro_btp'] = van_job('pro_btp', (0.95, 0.47, 0.06), pro_livery('TRAVAUX PUBLICS', 'VOIRIE - RESEAUX', None, 0x22252b, None, 0x22252b), high=True)
BUILDS['pro_loc'] = van_job('pro_loc', (0.90, 0.91, 0.92), pro_livery('LOCATION', 'UTILITAIRES 12 M3', '0 800 00 00 00', 0x1f8a3a, 0xf4c20c), high=True)
BUILDS['pro_demen'] = van_job('pro_demen', (0.90, 0.91, 0.92), pro_livery('DEMENAGEMENT', 'GARDE-MEUBLES', '01 40 00 00 00', 0x6a1f8a, None), high=True)
BUILDS['auto_ecole'] = lambda: K.build(dict(F.MISTRAL, id='auto_ecole', paint=(0.85, 0.86, 0.87), extra=auto_ecole_extra), 'lo')


def export(path):
    for o in list(bpy.data.objects):
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = bpy.data.objects['Body']
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False, export_vertex_color='ACTIVE')
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('GLB', os.path.basename(path), os.path.getsize(path), 'tris', tri)


def show_vcols():
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'det' and not o.data.color_attributes.get('Col'):
            T.vcol(o, 0x0a0b0c)
    m = K.M['det']
    nt = m.node_tree
    an = nt.nodes.new('ShaderNodeVertexColor')
    an.layer_name = 'Col'
    nt.links.new(an.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color'])
    return an


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')] or list(BUILDS)
    for vid in args:
        BUILDS[vid]()
        if '--render' in sys.argv:
            an = show_vcols()
            K.render(os.path.join(F.SNAPS, f'v22_{vid}'), views=('34av', '34ar'), res=(800, 450), samples=12)
            K.M['det'].node_tree.nodes.remove(an)
            BUILDS[vid]()
        export(os.path.join(F.OUT, f'{vid}.glb'))
