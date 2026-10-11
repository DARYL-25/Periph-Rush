# ============================================================
# Périph' Rush — flotte de véhicules au design ORIGINAL (aucun modèle réel,
# aucun logo). Construits avec vkit.py ; exportés en GLB dans assets/fleet/.
#   python3 tools/blender/fleet_build.py [id ...] [--render] [--lo-only]
# 'lutece' existe en deux niveaux : hi (voiture du joueur) et lo (trafic).
# ============================================================
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vkit as K  # noqa: E402
from vkit import decal, strip, grow, ellipse, P_FRONT, P_REAR, P_SIDE, belt, top, box  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(REPO, 'assets', 'fleet')
SNAPS = os.path.join(REPO, 'tools', 'snaps')


def sc(pts, kx=1.0, kz=1.0, dz=0.0):
    return [(x * kx, z * kz + dz) for (x, z) in pts]


# ============================================================
# 1. LUTÈCE — citadine 5 portes (voiture du joueur)
# ============================================================
def lutece_front():
    head = [(0.36, 0.700), (0.52, 0.735), (0.68, 0.742), (0.78, 0.725), (0.80, 0.692), (0.76, 0.658), (0.60, 0.632), (0.44, 0.640)]
    decal('HeadBezel', grow(head, 0.012), P_FRONT, 'det', offset=0.003, mirror=True, rnd=0.02, min_cos=0.22)
    decal('HeadReflector', head, P_FRONT, 'bright', offset=0.005, mirror=True, rnd=0.025, min_cos=0.22)
    for cy in (0.50, 0.66):
        decal('Projector', ellipse(cy, 0.690, 0.034, 0.030), P_FRONT, 'lensF', offset=0.008, mirror=True)
        if K.LOD == 'hi':
            decal('ProjRing', ellipse(cy, 0.690, 0.044, 0.039), P_FRONT, 'det', offset=0.0065, mirror=True)
    decal('DRL', strip([(0.42, 0.652), (0.60, 0.645), (0.78, 0.668)], 0.012), P_FRONT, 'lensF', offset=0.008, mirror=True, min_cos=0.35)
    decal('GrilleUpper', [(0.31, 0.690), (0.31, 0.615), (-0.31, 0.615), (-0.31, 0.690)], P_FRONT, 'det', offset=0.004, rnd=0.02)
    decal('GrilleBar', strip([(-0.33, 0.660), (0.33, 0.660)], 0.016), P_FRONT, 'bright', offset=0.007)
    intake = [(0.20, 0.52), (0.42, 0.50), (0.50, 0.40), (0.44, 0.31), (-0.44, 0.31), (-0.50, 0.40), (-0.42, 0.50), (-0.20, 0.52)]
    decal('Intake', intake, P_FRONT, 'det', offset=0.004, rnd=0.03)
    for z in (0.37, 0.44):
        decal('IntakeSlat', strip([(-0.44, z), (0.44, z)], 0.008), P_FRONT, 'bright', offset=0.006)
    fog = ellipse(0.66, 0.41, 0.06, 0.045)
    decal('FogRing', grow(fog, 0.015), P_FRONT, 'det', offset=0.004, mirror=True)
    decal('Fog', fog, P_FRONT, 'lensF', offset=0.006, mirror=True)
    decal('PlateF', [(0.27, 0.585), (0.27, 0.53), (-0.27, 0.53), (-0.27, 0.585)], P_FRONT, 'det', offset=0.004)
    decal('Lip', [(0.70, 0.28), (0.72, 0.235), (-0.72, 0.235), (-0.70, 0.28)], P_FRONT, 'det', offset=0.003, rnd=0.02)


def lutece_rear():
    tail = [(0.30, 0.955), (0.62, 0.968), (0.80, 0.955), (0.84, 0.915), (0.78, 0.878), (0.30, 0.882)]
    decal('TailFrame', grow(tail, 0.01), P_REAR, 'det', offset=0.003, mirror=True, rnd=0.015, min_cos=0.35)
    decal('TailLamp', tail, P_REAR, 'lensR', offset=0.006, mirror=True, rnd=0.015, min_cos=0.35)
    decal('TailInsert', [(0.34, 0.935), (0.46, 0.937), (0.46, 0.900), (0.34, 0.900)], P_REAR, 'lensF', offset=0.008, mirror=True, rnd=0.01)
    decal('TailBand', [(0.30, 0.942), (0.30, 0.900), (-0.30, 0.900), (-0.30, 0.942)], P_REAR, 'lensR', offset=0.007, rnd=0.012)
    if K.LOD == 'hi':   # filets lumineux internes (LED) dans le bandeau
        for z in (0.912, 0.928):
            decal('TailLED', strip([(-0.82, z + 0.012), (0.82, z + 0.012)], 0.004), P_REAR, 'lensF', offset=0.0085, min_cos=0.35)
    decal('HatchSeam', strip([(-0.86, 0.62), (0.86, 0.62)], 0.006), P_REAR, 'det', offset=0.0015)
    decal('PlateR', [(0.27, 0.575), (0.27, 0.455), (-0.27, 0.455), (-0.27, 0.575)], P_REAR, 'det', offset=0.004, rnd=0.01)
    decal('Diffuser', [(0.70, 0.36), (0.72, 0.30), (-0.72, 0.30), (-0.70, 0.36)], P_REAR, 'det', offset=0.003, rnd=0.02)
    decal('Reflex', [(0.58, 0.40), (0.72, 0.40), (0.72, 0.375), (0.58, 0.375)], P_REAR, 'lensR', offset=0.005, mirror=True)
    decal('Handle', [(0.10, 0.70), (0.10, 0.665), (-0.10, 0.665), (-0.10, 0.70)], P_REAR, 'bright', offset=0.006, rnd=0.01)


LUTECE = dict(
    id='lutece', L=4.02, W=1.72, H=1.48, WB=2.58, ovF=0.78, WR=0.305, TRACK=0.742, ARCH_R=0.355, tireW=0.195,
    TOP=[(2.010, 0.560), (1.985, 0.640), (1.930, 0.705), (1.700, 0.775), (1.300, 0.840), (0.980, 0.878), (0.760, 1.040), (0.480, 1.300),
         (0.300, 1.405), (-0.200, 1.468), (-0.800, 1.455), (-1.250, 1.405), (-1.520, 1.300), (-1.760, 1.120), (-1.900, 0.980),
         (-1.965, 0.860), (-2.000, 0.720), (-2.010, 0.560)],
    BELT=[(2.010, 0.600), (1.300, 0.820), (0.980, 0.862), (0.600, 0.880), (0.000, 0.900), (-0.700, 0.928), (-1.150, 0.952),
          (-1.350, 0.985), (-1.600, 0.990), (-2.010, 0.900)],
    PLAN=[(2.010, 0.640), (1.960, 0.735), (1.800, 0.810), (1.450, 0.848), (1.000, 0.858), (0.000, 0.860), (-1.000, 0.858),
          (-1.500, 0.846), (-1.850, 0.800), (-1.975, 0.742), (-2.010, 0.660)],
    ROOF_HALF=[(0.4, 0.560), (0.0, 0.615), (-0.8, 0.612), (-1.4, 0.560)],
    BOTTOM=[(2.010, 0.300), (1.900, 0.235), (1.600, 0.215), (1.000, 0.200), (-1.000, 0.200), (-1.650, 0.240), (-1.950, 0.300), (-2.010, 0.360)],
    CABIN=(-1.62, 0.96), WS=(0.30, 0.94), RG=(-1.70, -1.22),
    DLO=dict(a_base=0.905, a_top=0.45, c_top=-1.30, c_line=[(-1.45, 0.10), (-1.52, 0.035)], c_base=-1.52, b_x=-0.14, q_x=-1.10),
    SEAMS=[[(0.955, 0.93), (0.985, 0.62), (0.985, 0.28)], [(-0.14, 0.92), (-0.14, 0.26)], [(-1.14, 0.97), (-1.06, 0.62), (-1.00, 0.27)]],
    HANDLES=(0.55, -0.55), EXHAUST=[(-1.98, 0.42, 0.30)], rimStyle='double5',
    front=lutece_front, rear=lutece_rear, paint=(0.55, 0.06, 0.05), extra=lambda: lutece_extra(),
)


def lutece_extra():
    """finitions de la version joueur : jonc chromé de ceinture, aileron de requin, joint de pavillon."""
    if K.LOD != 'hi':
        return
    for sgn in (1, -1):
        pts = [(x / 100, belt(x / 100) + 0.012) for x in range(88, -152, -8)]
        decal(f'BeltChrome{sgn}', strip(pts, 0.012), P_SIDE(sgn), 'bright', offset=0.0068, step=0.05)
    pass


# ============================================================
# Générateur de profils paramétriques (silhouettes originales)
# ============================================================
HATCH_REAR = [(0.0, 1.0), (0.355, 0.876), (0.671, 0.663), (0.855, 0.497), (0.941, 0.355), (0.987, 0.189), (1.0, 0.0)]
PLAN_F = [(1.0, 0.744), (0.975, 0.855), (0.896, 0.942), (0.721, 0.986), (0.498, 0.998), (0.0, 1.0), (-0.498, 0.998),
          (-0.746, 0.984), (-0.920, 0.930), (-0.983, 0.863), (-1.0, 0.767)]


def profile(p):
    L, W, H = p['L'], p['W'], p['H']
    X0, X1 = L / 2, -L / 2
    zn, zh, xc, xr, xre = p['zn'], p['zh'], p['xc'], p['xr'], p['xre']
    zb = p.get('zbot', 0.20)
    zend = p.get('zend', 0.56 + (zb - 0.2))
    kind = p['rear']
    T = [(X0, zn - 0.145), (X0 - 0.025, zn - 0.065), (X0 - 0.08, zn)]
    for t in (0.3, 0.6):
        T.append((lerp(X0 - 0.08, xc, t), lerp(zn, zh, 1 - (1 - t) ** 1.5)))
    T.append((xc, zh))
    for t in (0.3, 0.65):
        T.append((lerp(xc, xr, t), lerp(zh, H - 0.075, smoothstep(t * 0.85 + 0.1))))
    T.append((xr, H - 0.075))
    T.append((lerp(xr, xre, 0.25), H - 0.012))
    T.append((lerp(xr, xre, 0.6), H - 0.02))
    T.append((xre, H - 0.065))
    if kind == 'hatch':
        for (u, v) in HATCH_REAR[1:]:
            T.append((lerp(xre, X1, u), lerp(zend, H - 0.065, v)))
    elif kind == 'sedan':
        xdk, zdk = p['xdk'], p['zdk']
        T += [(lerp(xre, xdk, 0.35), lerp(H - 0.065, zdk, 0.28)), (lerp(xre, xdk, 0.75), lerp(H - 0.065, zdk, 0.78)), (xdk, zdk),
              (lerp(xdk, X1, 0.6), zdk - 0.005), (X1 + 0.09, zdk - 0.025), (X1 + 0.02, zdk - 0.09), (X1, zend)]
    else:   # break, SUV, monospace, fourgon : hayon presque vertical
        T += [(X1 + 0.13, H - 0.13), (X1 + 0.06, H - 0.32), (X1 + 0.025, lerp(zend, H, 0.45)), (X1 + 0.005, lerp(zend, H, 0.2)), (X1, zend)]
    zbelt = p['zbelt']
    rise = p.get('rise', 0.09)
    cab0 = p['cab0']
    BELT = [(X0, zn - 0.04), (xc + 0.3, zbelt - 0.04), (xc, zbelt), (lerp(xc, cab0, 0.5), zbelt + rise * 0.45), (cab0 + 0.1, zbelt + rise), (X1, zbelt + rise - 0.09)]
    PLAN = [(X0 * u if u > 0 else -X1 * u, W / 2 * k) for (u, k) in PLAN_F]
    PLAN = [(u * (X0 if u > 0 else -X1) / 1.0, W / 2 * k) for (u, k) in PLAN_F]
    PLAN = [((X0 * u) if u >= 0 else (X1 * -u), W / 2 * k) for (u, k) in PLAN_F]
    rh = W / 2 * p.get('roofK', 0.715)
    ROOF = [(xr + 0.1, rh * 0.91), (lerp(xr, xre, 0.3), rh), (lerp(xr, xre, 0.8), rh * 0.995), (cab0 + 0.2, rh * 0.92)]
    BOT = [(X0, zb + 0.10), (X0 - 0.11, zb + 0.035), (X0 - 0.41, zb + 0.015), (0.5, zb), (-0.5, zb), (X1 + 0.36, zb + 0.04), (X1 + 0.06, zb + 0.10), (X1, zb + 0.16)]
    return T, BELT, PLAN, ROOF, BOT


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def make_spec(p, front, rear, **extra):
    T, BELT, PLAN, ROOF, BOT = profile(p)
    L = p['L']
    X1 = -L / 2
    xc, xr, xre, cab0 = p['xc'], p['xr'], p['xre'], p['cab0']
    a_base = xc - 0.075
    b_x = p.get('b_x', a_base - 1.05)
    spec = dict(id=p['id'], L=L, W=p['W'], H=p['H'], WB=p['WB'], ovF=p['ovF'], WR=p['WR'], TRACK=p['W'] / 2 - 0.118,
                ARCH_R=p['WR'] + 0.05, tireW=p.get('tireW', 0.205), TOP=T, BELT=BELT, PLAN=PLAN, ROOF_HALF=ROOF, BOTTOM=BOT,
                CABIN=(cab0, xc - 0.02), WS=(xr, xc - 0.04), front=front, rear=rear, paint=p.get('paint', (0.3, 0.32, 0.36)))
    if p['rear'] == 'hatch':
        spec['RG'] = (cab0 - 0.08, xre + 0.03)
    elif p['rear'] == 'sedan':
        spec['RG'] = (p['xdk'] + 0.06, xre + 0.02)
        spec['CABIN'] = (p['xdk'] + 0.25, xc - 0.02)
    else:
        spec['RG'] = (X1 + 0.02, X1 + 0.3)
        spec['rearVertical'] = True
    c_top = p.get('c_top', xre - 0.05 if p['rear'] != 'sedan' else xre - 0.08)
    c_base = p.get('c_base', c_top - 0.22)
    q_x = p.get('q_x', b_x - 0.95 if p.get('doors', 5) == 5 else None)
    spec['DLO'] = dict(a_base=a_base, a_top=xr + 0.15, c_top=c_top, c_line=p.get('c_line', [(c_base, 0.035)]), c_base=c_base, b_x=b_x, q_x=q_x)
    zl = BOT[3][1] + 0.06
    seams = [[(a_base + 0.05, p['zbelt'] + 0.02), (a_base + 0.08, zl)], [(b_x, p['zbelt'] + 0.03), (b_x, zl)]]
    if q_x:
        seams.append([(q_x - 0.04, p['zbelt'] + 0.07), (q_x + 0.04, zl + 0.15), (q_x + 0.10, zl)])
    spec['SEAMS'] = seams + p.get('seams', [])
    spec['HANDLES'] = (b_x + 0.69, b_x - 0.41) if q_x else (b_x + 0.69,)
    spec['hoodSeamBack'] = p.get('hoodSeamBack', 0.09)
    spec.update(extra)
    return spec


# ---------- éléments avant / arrière génériques (styles originaux) ----------
def front_kit(zn, W, lamp='slim', grille='trapeze', fog=True, plate=True, inner=0.33, zlamp=None):
    hw = W / 2
    zl = zlamp or zn - 0.07
    if lamp == 'slim':       # optique effilée en lame
        sh = [(inner, zl + 0.012), (hw * 0.62, zl + 0.03), (hw * 0.92, zl + 0.02), (hw * 0.95, zl - 0.02), (hw * 0.6, zl - 0.04), (inner + 0.02, zl - 0.025)]
    elif lamp == 'round':    # gros phares ronds
        sh = ellipse(hw * 0.70, zl - 0.01, 0.085, 0.075, 24)
    elif lamp == 'rect':     # optique rectangulaire haute (SUV, utilitaire)
        sh = [(inner + 0.02, zl + 0.04), (hw * 0.93, zl + 0.04), (hw * 0.95, zl - 0.07), (inner + 0.04, zl - 0.07)]
    else:                    # trapèze étiré
        sh = [(inner, zl + 0.02), (hw * 0.90, zl + 0.04), (hw * 0.94, zl - 0.01), (hw * 0.80, zl - 0.05), (inner + 0.03, zl - 0.04)]
    decal('HeadBezel', grow(sh, 0.012), P_FRONT, 'det', offset=0.003, mirror=True, rnd=0.015, min_cos=0.22)
    decal('HeadReflector', sh, P_FRONT, 'bright', offset=0.005, mirror=True, rnd=0.02, min_cos=0.22)
    cx = sum(p[0] for p in sh) / len(sh)
    cz = sum(p[1] for p in sh) / len(sh)
    decal('Projector', ellipse(cx + 0.03, cz, 0.032, 0.026), P_FRONT, 'lensF', offset=0.008, mirror=True)
    if lamp != 'round':
        decal('DRL', strip([(inner + 0.04, cz - 0.012), (hw * 0.86, cz - 0.0)], 0.009), P_FRONT, 'lensF', offset=0.0085, mirror=True, min_cos=0.3)
    zg = zl - 0.10
    if grille == 'trapeze':      # grande calandre trapézoïdale noire cerclée de chrome
        g = [(inner - 0.02, zl + 0.0), (-(inner - 0.02), zl + 0.0), (-(inner + 0.12), zg - 0.2), (inner + 0.12, zg - 0.2)]
        decal('GrilleRim', grow(g, 0.015), P_FRONT, 'bright', offset=0.004, rnd=0.03)
        decal('Grille', g, P_FRONT, 'det', offset=0.006, rnd=0.03)
    elif grille == 'bars':       # calandre à lames chromées horizontales
        g = [(inner, zl + 0.01), (-inner, zl + 0.01), (-inner, zg - 0.03), (inner, zg - 0.03)]
        decal('Grille', g, P_FRONT, 'det', offset=0.004, rnd=0.02)
        for k in range(4):
            z = lerp(zl - 0.005, zg - 0.015, k / 3)
            decal('GrilleBar', strip([(-inner + 0.02, z), (inner - 0.02, z)], 0.009), P_FRONT, 'bright', offset=0.007)
    elif grille == 'oval':       # bouche ovale souriante
        decal('Grille', ellipse(0, zg + 0.02, inner * 0.9, 0.06, 28), P_FRONT, 'det', offset=0.004)
        decal('GrilleBar', strip([(-inner * 0.7, zg + 0.02), (inner * 0.7, zg + 0.02)], 0.01), P_FRONT, 'bright', offset=0.007)
    else:                        # barrette fine + grande prise basse
        decal('GrilleBar', strip([(-inner, zl - 0.02), (inner, zl - 0.02)], 0.016), P_FRONT, 'bright', offset=0.007)
    zi = zg - (0.2 if grille == 'trapeze' else 0.08)
    if grille != 'trapeze':
        it = [(hw * 0.35, zi), (hw * 0.55, zi - 0.03), (hw * 0.6, zi - 0.13), (-hw * 0.6, zi - 0.13), (-hw * 0.55, zi - 0.03), (-hw * 0.35, zi)]
        decal('Intake', it, P_FRONT, 'det', offset=0.004, rnd=0.03)
    if fog:
        f = ellipse(hw * 0.76, zi - 0.08, 0.05, 0.035)
        decal('FogRing', grow(f, 0.014), P_FRONT, 'det', offset=0.004, mirror=True)
        decal('Fog', f, P_FRONT, 'lensF', offset=0.006, mirror=True)
    if plate:
        zp = zi - (0.03 if grille == 'trapeze' else 0.17)
        decal('PlateF', [(0.27, zp + 0.055), (0.27, zp), (-0.27, zp), (-0.27, zp + 0.055)], P_FRONT, 'det', offset=0.004)
    return zi


def rear_kit(zt, W, lamp='hband', zplate=0.50, band=True, plate_on_hatch=False):
    hw = W / 2
    if lamp == 'hband':        # bandeau horizontal
        sh = [(hw * 0.35, zt + 0.04), (hw * 0.95, zt + 0.045), (hw * 0.98, zt - 0.01), (hw * 0.9, zt - 0.04), (hw * 0.35, zt - 0.035)]
    elif lamp == 'L':          # feux en L qui s'enroulent
        sh = [(hw * 0.55, zt + 0.06), (hw * 0.97, zt + 0.06), (hw * 0.98, zt - 0.16), (hw * 0.86, zt - 0.16), (hw * 0.86, zt - 0.02), (hw * 0.55, zt - 0.02)]
    elif lamp == 'C':          # feux en C
        sh = [(hw * 0.62, zt + 0.06), (hw * 0.96, zt + 0.06), (hw * 0.97, zt - 0.12), (hw * 0.62, zt - 0.12), (hw * 0.62, zt - 0.07), (hw * 0.88, zt - 0.07), (hw * 0.88, zt + 0.01), (hw * 0.62, zt + 0.01)]
    elif lamp == 'tall':       # feux verticaux de montant (break, fourgon)
        sh = [(hw * 0.84, zt + 0.25), (hw * 0.98, zt + 0.25), (hw * 0.98, zt - 0.2), (hw * 0.84, zt - 0.2)]
    else:                      # ovale
        sh = ellipse(hw * 0.75, zt, 0.14, 0.05, 24)
    decal('TailFrame', grow(sh, 0.01), P_REAR, 'det', offset=0.003, mirror=True, rnd=0.012, min_cos=0.3)
    decal('TailLamp', sh, P_REAR, 'lensR', offset=0.006, mirror=True, rnd=0.012, min_cos=0.3)
    cx = sum(p[0] for p in sh) / len(sh)
    decal('TailInsert', [(cx - 0.05, zt + 0.012), (cx + 0.05, zt + 0.012), (cx + 0.05, zt - 0.015), (cx - 0.05, zt - 0.015)], P_REAR, 'lensF', offset=0.008, mirror=True)
    if band:
        decal('TailBand', [(hw * 0.35, zt + 0.02), (hw * 0.35, zt - 0.02), (-hw * 0.35, zt - 0.02), (-hw * 0.35, zt + 0.02)], P_REAR, 'bright', offset=0.006, rnd=0.01)
    decal('PlateR', [(0.27, zplate + 0.12), (0.27, zplate), (-0.27, zplate), (-0.27, zplate + 0.12)], P_REAR, 'det', offset=0.004, rnd=0.01)
    decal('Diffuser', [(hw * 0.8, 0.40), (hw * 0.84, 0.32), (-hw * 0.84, 0.32), (-hw * 0.8, 0.40)], P_REAR, 'det', offset=0.003, rnd=0.02)
    decal('Reflex', [(hw * 0.68, 0.43), (hw * 0.82, 0.43), (hw * 0.82, 0.41), (hw * 0.68, 0.41)], P_REAR, 'lensR', offset=0.005, mirror=True)


# ============================================================
# 2. MISTRAL — petite citadine ronde (3,85 m)
# ============================================================
P_MISTRAL = dict(id='mistral', L=3.85, W=1.70, H=1.52, WB=2.46, ovF=0.72, WR=0.30, zn=0.80, zh=0.92, xc=0.88, xr=0.20, xre=-1.20, cab0=-1.52,
                 zbelt=0.92, rise=0.06, rear='hatch', zend=0.56, roofK=0.73, paint=(0.85, 0.72, 0.25))
MISTRAL = make_spec(P_MISTRAL, lambda: front_kit(0.80, 1.70, lamp='round', grille='oval', inner=0.30),
                    lambda: rear_kit(0.98, 1.70, lamp='oval', zplate=0.50, band=False), rimStyle='six', spoiler=True,
                    EXHAUST=[(-1.90, 0.40, 0.30)])

# ============================================================
# 3. AURORE — compacte 5 portes anguleuse (4,30 m)
# ============================================================
P_AURORE = dict(id='aurore', L=4.30, W=1.80, H=1.45, WB=2.64, ovF=0.86, WR=0.315, zn=0.76, zh=0.89, xc=0.98, xr=0.30, xre=-1.32, cab0=-1.70,
                zbelt=0.90, rise=0.11, rear='hatch', zend=0.58, paint=(0.15, 0.22, 0.38))
AURORE = make_spec(P_AURORE, lambda: front_kit(0.76, 1.80, lamp='slim', grille='trapeze', inner=0.30),
                   lambda: rear_kit(0.96, 1.80, lamp='C', zplate=0.50), rimStyle='ten', EXHAUST=[(-2.10, 0.45, 0.30), (-2.10, -0.45, 0.30)])

# ============================================================
# 4. CONCORDE — berline tricorps (4,68 m) ; variante taxi
# ============================================================
P_CONCORDE = dict(id='concorde', L=4.68, W=1.82, H=1.46, WB=2.76, ovF=0.92, WR=0.32, zn=0.76, zh=0.90, xc=1.10, xr=0.40, xre=-0.95, cab0=-1.40,
                  zbelt=0.91, rise=0.10, rear='sedan', xdk=-1.62, zdk=1.02, zend=0.60, paint=(0.12, 0.13, 0.15), q_x=None,
                  seams=[[(-1.08, 0.99), (-1.08, 0.40), (-1.00, 0.28)]])
CONCORDE = make_spec(P_CONCORDE, lambda: front_kit(0.76, 1.82, lamp='trap', grille='bars', inner=0.38),
                     lambda: rear_kit(0.93, 1.82, lamp='hband', zplate=0.55, band=True), rimStyle='five',
                     EXHAUST=[(-2.30, 0.48, 0.32)], spoiler=False)
TAXI = dict(CONCORDE, id='taxi', taxi=True, paint=(0.80, 0.80, 0.80))

# ============================================================
# 5. RIVIERA — break (4,62 m)
# ============================================================
P_RIVIERA = dict(id='riviera', L=4.62, W=1.80, H=1.50, WB=2.70, ovF=0.90, WR=0.315, zn=0.77, zh=0.90, xc=1.06, xr=0.38, xre=-1.95, cab0=-2.10,
                 zbelt=0.91, rise=0.07, rear='wagon', zend=0.58, c_top=-2.02, c_line=[(-2.08, 0.06), (-2.10, 0.035)], paint=(0.45, 0.47, 0.50))
RIVIERA = make_spec(P_RIVIERA, lambda: front_kit(0.77, 1.80, lamp='trap', grille='bar', inner=0.32),
                    lambda: rear_kit(0.96, 1.80, lamp='L', zplate=0.50, band=True), rimStyle='double5', rails='alu',
                    EXHAUST=[(-2.28, 0.42, 0.30)], spoiler=False)

# ============================================================
# 6. ATLAS — SUV compact (4,45 m)
# ============================================================
P_ATLAS = dict(id='atlas', L=4.45, W=1.84, H=1.64, WB=2.66, ovF=0.88, WR=0.345, zbot=0.30, zn=0.92, zh=1.03, xc=0.98, xr=0.34, xre=-1.78, cab0=-1.98,
               zbelt=1.05, rise=0.07, rear='suv', zend=0.70, c_top=-1.86, c_line=[(-1.93, 0.07), (-1.96, 0.035)], paint=(0.28, 0.33, 0.30))
ATLAS = make_spec(P_ATLAS, lambda: front_kit(0.92, 1.84, lamp='rect', grille='trapeze', inner=0.30),
                  lambda: rear_kit(1.10, 1.84, lamp='hband', zplate=0.62), rimStyle='six', rails='black', cladding=True,
                  archTrimW=0.085, EXHAUST=[(-2.20, 0.45, 0.40)])

# ============================================================
# 7. ODYSSÉE — monospace (4,55 m)
# ============================================================
P_ODYSSEE = dict(id='odyssee', L=4.55, W=1.84, H=1.68, WB=2.80, ovF=0.88, WR=0.32, zbot=0.22, zn=0.86, zh=0.98, xc=1.30, xr=0.30, xre=-1.90, cab0=-2.06,
                 zbelt=0.98, rise=0.05, rear='mpv', zend=0.60, c_top=-1.98, c_line=[(-2.04, 0.06), (-2.06, 0.035)], paint=(0.62, 0.64, 0.67))
ODYSSEE = make_spec(P_ODYSSEE, lambda: front_kit(0.86, 1.84, lamp='trap', grille='bar', inner=0.34),
                    lambda: rear_kit(1.08, 1.84, lamp='tall', zplate=0.55, band=False), rimStyle='five', rails='black',
                    EXHAUST=[(-2.25, 0.42, 0.32)], spoiler=True)

# ============================================================
# 8. CARGO — fourgon utilitaire (5,00 m, 1,95 m)
# ============================================================
P_CARGO = dict(id='cargo', L=5.00, W=1.92, H=1.95, WB=3.10, ovF=0.92, WR=0.33, zbot=0.26, zn=0.98, zh=1.10, xc=1.60, xr=1.02, xre=-2.38, cab0=-2.45,
               zbelt=1.12, rise=0.0, rear='van', zend=0.62, doors=3, b_x=0.38, c_top=0.42, c_line=[(0.40, 0.04)], roofK=0.86, paint=(0.90, 0.91, 0.92),
               seams=[[(-0.10, 1.75), (-0.10, 0.36)], [(-1.20, 1.75), (-1.20, 0.36)], [(-1.20, 1.10), (-0.10, 1.10)]])
CARGO = make_spec(P_CARGO, lambda: front_kit(0.98, 1.92, lamp='rect', grille='bars', inner=0.36),
                  lambda: rear_kit(1.0, 1.92, lamp='tall', zplate=0.48, band=False), rimStyle='cover', boxy=0.85, rub_z=0.55,
                  blackMirrors=True, handleMat='det', spoiler=False, EXHAUST=[(-2.40, 0.50, 0.32)], noseTaper=0.93, tailTaper=0.98)

# ============================================================
# 9. FURIA — berline sportive fastback (4,75 m), rare et rapide
# ============================================================
P_FURIA = dict(id='furia', L=4.75, W=1.88, H=1.40, WB=2.85, ovF=0.88, WR=0.335, zbot=0.15, zn=0.70, zh=0.84, xc=1.05, xr=0.28, xre=-0.85, cab0=-1.85,
               zbelt=0.88, rise=0.10, rear='hatch', zend=0.58, c_top=-0.95, c_line=[(-1.45, 0.06), (-1.62, 0.03)], paint=(0.70, 0.70, 0.72))
FURIA = make_spec(P_FURIA, lambda: front_kit(0.70, 1.88, lamp='slim', grille='trapeze', inner=0.36),
                  lambda: rear_kit(0.90, 1.88, lamp='hband', zplate=0.50, band=True), rimStyle='ten', caliper='lensR',
                  EXHAUST=[(-2.36, 0.52, 0.27), (-2.36, 0.42, 0.27), (-2.36, -0.42, 0.27), (-2.36, -0.52, 0.27)], tireW=0.235, spoiler=False)

FLEET = {'lutece': LUTECE, 'mistral': MISTRAL, 'aurore': AURORE, 'concorde': CONCORDE, 'taxi': TAXI, 'riviera': RIVIERA,
         'atlas': ATLAS, 'odyssee': ODYSSEE, 'cargo': CARGO, 'furia': FURIA}


def run(ids, render=False, lo_only=False):
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for vid in ids:
        spec = FLEET[vid]
        lods = ['lo'] if lo_only else (['hi', 'lo'] if vid == 'lutece' else ['lo'])
        for lod in lods:
            K.build(spec, lod)
            if render:
                K.render(os.path.join(SNAPS, f'fleet_{vid}_{lod}'), views=('34av', '34ar') if lod == 'lo' else ('34av', 'profil', '34ar', 'face'))
            name = f'{vid}.glb' if lod == 'lo' else f'{vid}_hi.glb'
            report[name] = K.export(os.path.join(OUT, name))
    print(report)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    run(args or list(FLEET), render='--render' in sys.argv, lo_only='--lo-only' in sys.argv)
