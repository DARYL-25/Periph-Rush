// ============================================================
// Périph' Rush — relevé Look Around v28/v29 (nov. 2026) : tronçons reconstruits
// de la Porte d'Ivry à la Porte de Clichy (abscisses s de la piste, sens intérieur).
// Détail du relevé : docs/SURVEY-v28.md. Dans ces tronçons, la signalisation
// automatique est remplacée par les équipements relevés un par un et les
// bâtiments de premier rang sont modélisés avec des façades dédiées.
// Lacunes du relevé (laissées telles quelles) : 4250-4600 (couverture A6b),
// 10350-11450 (Balard, flouté), 13700-14650 (Auteuil), 17567-18300 (Maillot),
// 19850-20350 (Asnières nord).
// ============================================================

export const SECTORS = [[3100, 4250], [4600, 10350], [11450, 13700], [14650, 17567], [18300, 19850], [20350, 20900]];
export const SECTOR = [3100, 20900];
export const inSector = (s) => SECTORS.some(([a, b]) => s >= a && s < b);
const F = { wall: 'talus', screen: 'talus', veg: 'fourre' };   // talus couvert d'un fourré dense

// rive droite (côté Paris)
export const SIDE_R = [
  [3100, 3195, { wall: 'meuliere', crown: 'balustrade' }],
  [3195, 3255, { wall: 'meuliere', crown: 'balustrade', veg: 'arbustes' }],
  [3255, 3450, F],
  [3450, 3650, { wall: 'meuliere', veg: 'arbres' }],
  [3650, 3945, F],
  [3945, 4250, { wall: 'meuliere', crown: 'grille' }],
  [4600, 4783, F],
  [4783, 4860, { screen: 'grilleGrise' }],
  [4860, 5240, { screen: 'grilleNoire', veg: 'arbres' }],
  [5240, 5330, { screen: 'grilleBlanche', veg: 'arbres' }],
  [5330, 5430, { screen: 'beige' }],
  [5430, 5750, { screen: 'grilleGrise', veg: 'arbres' }],
  [5750, 6839, { screen: 'grilleNoire', veg: 'arbres' }],
  [6839, 7321, { wall: 'meuliere', crown: 'balustrade' }],
  [7383, 7480, { wall: 'pierre' }], [7480, 7620, { wall: 'beton', crown: 'grille' }],
  [7620, 7827, F],
  [7885, 8123, { wall: 'beton', crown: 'grille', veg: 'arbres' }],
  [8123, 8500, F],
  [8500, 8614, { wall: 'meuliere', crown: 'balustrade' }],
  [9020, 9710, { wall: 'meuliere', crown: 'balustrade', veg: 'arbres' }],
  [9710, 10350, { screen: 'grilleVerte' }],
  [11450, 11950, { screen: 'grilleVerte' }],
  [11950, 12153, { screen: 'beige', veg: 'platanes' }],
  [12153, 12360, { wall: 'dalles', crown: 'grille', veg: 'arbres' }],
  [12554, 12701, { wall: 'dalles', crown: 'grille' }],
  [12804, 12972, { wall: 'beton', crown: 'grille' }],
  [13554, 13700, { wall: 'beton' }],
  [14650, 14738, { wall: 'dalles', crown: 'grille', veg: 'bois' }],
  [15312, 15450, F], [15450, 15578, { wall: 'dalles', veg: 'bois' }],
  [15644, 15815, { wall: 'beton' }],
  [16104, 16300, { screen: 'grilleNoire', veg: 'bois' }], [16300, 16522, { wall: 'dalles', veg: 'bois' }],
  [16742, 16947, { wall: 'beton', veg: 'bois' }],
  [17183, 17567, F],
  [18300, 18561, { wall: 'dalles', crown: 'grille' }], [18772, 19000, { wall: 'beige', crown: 'grille' }],
  [19307, 19465, F],
  [20350, 20438, F], [20534, 20900, { screen: 'grilleVerte', veg: 'arbres' }],
];
// rive extérieure (au-delà du TPC)
export const SIDE_G = [
  [3100, 3450, { wall: 'meuliere', crown: 'balustrade', veg: 'platanes' }],
  [3450, 4250, { wall: 'meuliere', crown: 'balustrade' }],
  [4600, 5250, { screen: 'muret', veg: 'peupliers' }], [5250, 6839, { screen: 'muret', veg: 'pins' }],
  [6839, 7321, { wall: 'meuliere', crown: 'balustrade' }],
  [7383, 7827, { wall: 'beton', veg: 'lierre' }],
  [7885, 8500, F],
  [9020, 9200, { screen: 'tole' }], [9200, 9710, { wall: 'meuliere' }],
  [9710, 10350, { screen: 'grilleVerte' }], [11450, 11950, { screen: 'grilleVerte' }],
  [12153, 12360, { wall: 'beton', crown: 'grille' }],
  [14650, 14738, { wall: 'dalles', crown: 'grille', veg: 'bois' }],
  [15312, 15578, F], [16104, 16522, F], [16742, 16947, F],
  [17183, 17567, { wall: 'dalles' }], [18300, 18561, { wall: 'beton' }], [18772, 19000, { wall: 'beton' }],
  [19307, 19465, F], [20534, 20900, { screen: 'muret', veg: 'platanes' }],
];
export const MEDIAN_WIDE = [[5470, 5750], [12554, 12701], [20560, 20700]];
export const LAMPS = [[7650, 8200, 'edgeY'], [11450, 11950, 'medY']];

const P = (name) => ({ kind: 'porte', name });
const A10 = { kind: 'blue', text: 'BORDEAUX-NANTES', ref: 'A 10' };
const LYON = { kind: 'blue', text: 'LYON-ÉVRY' };
const ORLY = { kind: 'blue', text: 'ORLY-RUNGIS', plane: true };
const A13 = { kind: 'green', text: 'ROUEN', ref: 'A 13' };
const VERS = { kind: 'vers', ref: 'A 14-A 15-A 1' };
const CDG = { kind: 'green', text: 'CH. DE GAULLE', plane: true };
const D = (ref, dist, arrow = false) => ({ kind: 'ref', ref, dist, arrow });

// équipements relevés (at = position latérale en largeurs de voie depuis le TPC ; 'R' = au-dessus de la sortie)
export const FEATURES = [
  { type: 'obridge', s: 3140, len: 20, parapet: 'balustrade' },                       // pont de la Porte d'Ivry
  { type: 'danger', s: 3162 },
  { type: 'rg', s: 3300, vmsAt: 1.0, panels: [{ at: 3.45, lines: [{ kind: 'ref', ref: 'D 7', dist: '300 m' }, P("Porte d'Italie")] }] },
  { type: 'limit', s: 3292 },
  { type: 'sos', s: 3350 }, { type: 'cctv', s: 3354 },
  { type: 'rg', s: 3438, vmsAt: 1.3, panels: [] },                                    // PMV accolé au pont
  { type: 'obridge', s: 3455, len: 18, parapet: 'rail', piers: 'round' },             // pont de la Porte de Choisy
  { type: 'rg', s: 3690, panels: [
    { at: 1.0, lines: [{ kind: 'ref', ref: 'A 6b' }, A10, LYON, ORLY] },
    { at: 'R', lines: [{ kind: 'ref', ref: 'D 7' }, P("Porte d'Italie"), { kind: 'down', n: 2 }] }] },
  { type: 'rg', s: 3905, light: true, panels: [{ sig: true, at: 0.5 }, { sig: true, at: 1.5 }, { sig: true, at: 2.5 }, { sig: true, at: 3.5 }] },
  { type: 'obridge', s: 3962, len: 30, parapet: 'rail' },                             // pont de l'avenue d'Italie
  { type: 'rg', s: 3996, panels: [
    { at: 0.95, lines: [{ kind: 'vers', ref: 'A 6a' }, { kind: 'green', text: 'ROUEN', ref: 'A 13' }, P('Porte de Gentilly'), P("Porte d'Orléans")] },
    { at: 'R', lines: [{ kind: 'ref', ref: 'A 6b' }, A10, LYON, ORLY] }] },
  { type: 'noStop', s: 4004 },
  { type: 'sos', s: 4125 }, { type: 'limit', s: 4135 },
  { type: 'limit', s: 4612 },
  { type: 'noStop', s: 4688 },
  { type: 'rg', s: 4700, style: 'beige', vmsAt: 1.0, panels: [{ at: 'R', lines: [{ kind: 'ref', ref: 'D 920', dist: '600 m' }, P('Porte de Gentilly'), P("Porte d'Orléans")] }] },
  { type: 'sosDist', s: 4736, dist: '200 m' },
  { type: 'rg', s: 5070, cant: true, panels: [
    { at: 0.8, lines: [{ kind: 'ref', ref: 'A 6a', dist: '600 m' }, A10, LYON, ORLY] },
    { at: 2.5, lines: [{ kind: 'ref', ref: 'D 920', dist: '300 m' }, P('Porte de Gentilly'), P("Porte d'Orléans")] }] },
  { type: 'sos', s: 5130 },
  { type: 'noStop', s: 5250 },
  { type: 'presign', s: 5292, lines: [{ kind: 'ref', ref: 'D 920', arrow: true }, P('Porte de Gentilly'), P("Porte d'Orléans")] },
  { type: 'rg', s: 5462, cant: true, panels: [
    { at: 0.75, lines: [{ kind: 'green', text: 'ROUEN', ref: 'A 13' }, P('Porte de Châtillon'), P('Porte de Montrouge')] },
    { at: 2.35, lines: [{ kind: 'ref', ref: 'A 6a' }, A10, LYON, ORLY, { kind: 'down', n: 1 }] }] },
  { type: 'sos', s: 5560 },
  { type: 'noStop', s: 5642 },
  // ---- Gentilly → Orléans → Châtillon ----
  { type: 'textPanel', s: 5810, lines: ['ALLUMEZ VOS', 'CODES'] },
  { type: 'noStop', s: 6260 },
  { type: 'obridge', s: 6470, len: 4, parapet: 'cage' },                              // passerelle du Cambodge
  { type: 'sos', s: 6476 },
  { type: 'rg', s: 6880, vmsAt: 1.0, panels: [{ at: 'R', lines: [D('D 906', '800 m'), P('Porte de Châtillon'), P('Porte de Montrouge')] }] },
  { type: 'limit', s: 6874 }, { type: 'limit', s: 6876, median: true },
  { type: 'sosDist', s: 6945, dist: '200 m' }, { type: 'noStop', s: 7050 },
  { type: 'limit', s: 7300 }, { type: 'limit', s: 7302, median: true },
  { type: 'sos', s: 7450 },
  { type: 'presign', s: 7600, lines: [D('D 906', null, true), P('Porte de Châtillon'), P('Porte de Montrouge')] },
  { type: 'danger', s: 8060 }, { type: 'sos', s: 8130 },
  { type: 'limit', s: 8250 }, { type: 'limit', s: 8252, median: true },
  // ---- Vanves, Plaine, Versailles ----
  { type: 'obridge', s: 8500, len: 16, parapet: 'balustrade' },
  { type: 'rg', s: 8550, style: 'beige', vmsAt: 1.2, panels: [{ at: 'R', lines: [P('Porte Brancion'), P('Porte de Vanves')] }] },
  { type: 'limit', s: 8556 }, { type: 'sos', s: 8590 }, { type: 'noStop', s: 8570 },
  { type: 'tunnelSign', s: 8585, name: 'Vanves', dist: '420 m' },
  { type: 'rg', s: 8606, panels: [
    { at: 0.6, lines: [P('Porte de Sèvres')] },
    { at: 1.9, lines: [D(null, '500 m'), P('Porte de la Plaine'), P('Porte de Versailles')] },
    { at: 'R', lines: [D(null, null, true), P('Porte Brancion'), P('Porte de Vanves')] }] },
  { type: 'sos', s: 9030 },
  { type: 'presign', s: 9036, lines: [P('Porte de la Plaine'), P('Porte de Versailles')] },
  { type: 'noStop', s: 9160 },
  { type: 'radarSign', s: 9250 },
  { type: 'rg', s: 9450, vmsAt: 1.2, panels: [] },
  { type: 'limit', s: 9452 }, { type: 'limit', s: 9454, median: true },
  { type: 'eqGantry', s: 9650 },
  { type: 'sos', s: 10210 },
  // ---- viaduc de Seine, Saint-Cloud, Molitor, Parc des Princes ----
  { type: 'sos', s: 11700 },
  { type: 'rg', s: 11990, vmsAt: 1.2, panels: [] },
  { type: 'presign', s: 12066, lines: [{ kind: 'green', text: 'PARIS-CENTRE' }, P('Porte de Saint-Cloud')] },
  { type: 'hov', s: 12330 },
  { type: 'bridgeSign', s: 12359.4, cols: [{ lines: [A13], far: true }, { lines: [P("Porte d'Auteuil"), P('Porte Molitor')], left: true }, { lines: [D('D 910', '100 m'), { kind: 'green', text: 'BOULOGNE' }], right: true }] },
  { type: 'bridgeSign', s: 12700.4, cols: [{ lines: [D(null, '700 m'), P("Porte d'Auteuil"), P('Porte Molitor')], right: true }] },
  { type: 'limit', s: 12830 }, { type: 'limit', s: 12832, median: true },
  { type: 'rg', s: 12900, vmsAt: 1.2, panels: [] },
  { type: 'bridgeSign', s: 12971.4, cols: [{ lines: [{ kind: 'blue', text: 'ROUEN', ref: 'A 13' }, { kind: 'blue', text: 'VERSAILLES' }], left: true }, { lines: [P("Porte d'Auteuil")], right: true }] },
  { type: 'noStop', s: 13565 }, { type: 'sos', s: 13570 },
  { type: 'rg', s: 13605, panels: [
    { at: 0.7, lines: [VERS, CDG] },
    { at: 2.0, lines: [P('Porte de Passy')] },
    { at: 'R', lines: [D('A 13', null, true), { kind: 'blue', text: 'ROUEN' }, { kind: 'blue', text: 'ST-QUENTIN-EN-Y.' }, { kind: 'blue', text: 'VERSAILLES' }] }] },
  // ---- bois de Boulogne : Passy, Muette, Dauphine, approche Maillot ----
  { type: 'rg', s: 14690, vmsAt: 1.0, panels: [] },
  { type: 'bridgeSign', s: 14737.4, cols: [{ lines: [D(null, '400 m'), P('Porte de Passy')], right: true }] },
  { type: 'rg', s: 15332, panels: [{ at: 3.0, lines: [P('Porte de la Muette')] }] },
  { type: 'noStop', s: 15346 },
  { type: 'radarSign', s: 15705 },
  { type: 'danger', s: 16130 },
  { type: 'rg', s: 16300, vmsAt: 0.9, panels: [
    { at: 2.5, lines: [VERS, CDG, { kind: 'green', text: 'LA DÉFENSE' }, P('Porte Maillot')] },
    { at: 'R', lines: [P('Porte Dauphine')] }] },
  { type: 'limit', s: 16304, median: true },
  { type: 'presign', s: 16746, lines: [D(null, null, true), P('Porte Dauphine')] },
  { type: 'limit', s: 16790 }, { type: 'noStop', s: 16810 },
  { type: 'limit', s: 17260 }, { type: 'limit', s: 17262, median: true },
  { type: 'rg', s: 17335, panels: [
    { at: 0.8, lines: [{ kind: 'vers', ref: 'A 14' }] },
    { at: 'R', lines: [D('N 13', null), { kind: 'green', text: 'LA DÉFENSE' }, P('Porte Maillot')] }] },
  { type: 'noStop', s: 17460 },
  // ---- Champerret, Asnières ----
  { type: 'rg', s: 18322, light: true, panels: [{ at: 'R', lines: [D('D 908', '500 m'), P('Porte de Champerret')] }] },
  { type: 'obridge', s: 18345, len: 34, parapet: 'rail' },
  { type: 'noStop', s: 18400 }, { type: 'limit', s: 18430, median: true },
  { type: 'bridgeSign', s: 18560.4, cols: [{ lines: [P("Porte d'Asnières")], left: true }, { lines: [D('D 908', '250 m'), P('Porte de Champerret')], right: true }] },
  { type: 'rg', s: 18872, vmsAt: 1.0, panels: [] },
  { type: 'limit', s: 18876 }, { type: 'limit', s: 18878, median: true },
  { type: 'rg', s: 19330, vmsAt: 1.3, panels: [{ at: 'R', lines: [D('D 909', '500 m'), P("Porte d'Asnières")] }] },
  { type: 'danger', s: 19400 }, { type: 'noStop', s: 19404 },
  // ---- Clichy ----
  { type: 'rg', s: 20680, style: 'beige', panels: [{ at: 1.8, lines: [P('Porte de Saint-Ouen')] }, { at: 'R', lines: [D('D 911', '100 m'), P('Porte de Clichy')] }] },
  { type: 'noStop', s: 20600 },
];


// ============================================================
// Bâtiments de premier rang, un par un : [s, côté (1 = Paris, -1 = banlieue), recul d (m, de l'axe à la façade),
// longueur le long de la voie, profondeur, hauteur, façade, options]
// options : cyl (plan circulaire), tiers [[kLong, kProf, y0, h, façade?]] volumes superposés, y0
// ============================================================
export const BUILDINGS = [
  // Ivry → Italie → A6b
  [3152, 1, 27, 62, 20, 30, 'gBlue'], [3222, 1, 30, 46, 26, 9, 'beton', { tiers: [[1, 1, 9, 5, 'hall']] }],
  [3205, -1, 34, 72, 18, 28, 'gBlue'], [3472, 1, 40, 64, 14, 30, 'white50'], [3462, -1, 34, 52, 14, 25, 'brique30'],
  [3600, -1, 36, 60, 16, 20, 'bandW'], [3700, -1, 36, 80, 16, 21, 'gridW'], [3820, -1, 38, 60, 16, 26, 'gBlack'],
  [3995, 1, 26, 64, 16, 22, 'brique30'], [4085, 1, 28, 60, 16, 24, 'hbm'], [4015, -1, 44, 44, 18, 32, 'white50'], [4100, -1, 46, 60, 16, 22, 'gridW'],
  // Poterne des Peupliers, Charléty, Gentilly
  [4690, -1, 36, 84, 18, 22, 'gBronze'], [4818, 1, 23, 74, 22, 18, 'bandW', { round: true }],
  [4930, 1, 110, 2.2, 2.2, 46, 'beton', { tiers: [[4, 0.6, 46, 7, 'hall']] }], [4990, 1, 150, 2.2, 2.2, 46, 'beton', { tiers: [[4, 0.6, 46, 7, 'hall']] }],
  [4960, 1, 220, 2.2, 2.2, 46, 'beton', { tiers: [[4, 0.6, 46, 7, 'hall']] }], [5030, 1, 250, 2.2, 2.2, 46, 'beton', { tiers: [[4, 0.6, 46, 7, 'hall']] }],
  [5085, 1, 95, 42, 14, 26, 'hbm'], [5260, -1, 42, 64, 18, 28, 'gridW'], [5345, -1, 42, 56, 20, 20, 'gGreen'],
  [5565, 1, 30, 52, 14, 26, 'saumon'], [5632, 1, 46, 40, 18, 22, 'gBlue'], [5570, -1, 42, 64, 14, 24, 'haussmann'], [5650, -1, 44, 40, 12, 14, 'brique30'],
  [5720, 1, 42, 44, 16, 30, 'loggia'], [5830, 1, 46, 44, 14, 22, 'stripeRW'], [5900, 1, 50, 30, 14, 20, 'gGreen'],
  [5820, -1, 40, 50, 14, 22, 'brique30'], [5900, -1, 40, 40, 14, 26, 'hbmRose'],
  // église de Gentilly, passerelle, porte d'Orléans
  [6205, 1, 44, 44, 14, 27, 'redAllege'], [6292, 1, 24, 44, 16, 23, 'facets'], [6370, 1, 30, 40, 16, 22, 'gBlack'],
  [6300, -1, 52, 44, 18, 17, 'pierre', { tiers: [[0.18, 0.44, 17, 43, 'pierre'], [0.11, 0.26, 60, 9, 'pierre']] }],
  [6240, -1, 40, 40, 14, 20, 'hbmRose'], [6480, -1, 40, 40, 12, 13, 'brique30'], [6560, -1, 40, 60, 16, 20, 'bandW'], [6640, -1, 40, 50, 18, 20, 'gBlue', { round: true }],
  [6505, 1, 30, 26, 26, 28, 'relief', { cyl: true }], [6562, 1, 30, 28, 28, 26, 'bandW', { cyl: true }], [6625, 1, 34, 40, 14, 23, 'loggia'], [6700, 1, 40, 22, 22, 36, 'tour'],
  [6600, -1, 70, 60, 16, 20, 'gBlue'], [6880, -1, 44, 16, 16, 46, 'gridW', { tiers: [[0.9, 0.9, 46, 6, 'mesh']] }], [6950, -1, 44, 60, 16, 26, 'bandW'],
  // Montrouge, Châtillon
  [7060, -1, 40, 60, 14, 22, 'haussmann'], [7180, -1, 40, 60, 14, 22, 'hbmRose'], [7450, -1, 44, 50, 14, 28, 'white50'], [7520, -1, 46, 60, 16, 18, 'bandW'],
  [7520, 1, 46, 44, 14, 26, 'loggia'], [7560, 1, 60, 3, 3, 26, 'hbm'],
  [7640, 1, 30, 64, 30, 15, 'gBlack'], [7720, -1, 44, 50, 18, 30, 'gBlue'], [7790, -1, 44, 40, 16, 26, 'white50'],
  [7960, -1, 46, 70, 14, 24, 'hbmRose'], [8050, -1, 46, 70, 14, 24, 'hbmRose'], [8140, -1, 60, 20, 20, 48, 'tour'],
  [8300, -1, 50, 80, 14, 24, 'barre'], [8420, -1, 60, 22, 22, 54, 'tour'], [8440, -1, 110, 22, 22, 50, 'tour'],
  // Vanves, Plaine, Versailles, Parc des expositions, tour Triangle
  [8660, 1, 40, 50, 16, 28, 'white50'], [8640, -1, 44, 50, 16, 26, 'white50'],
  [9080, -1, 44, 90, 14, 28, 'barre'], [9190, -1, 50, 50, 16, 30, 'hbmRose'], [9270, -1, 56, 24, 24, 58, 'tour'],
  [9240, 1, 110, 76, 76, 13, 'beton', { cyl: true, tiers: [[0.8, 0.8, 13, 5, 'hall'], [0.5, 0.5, 18, 4, 'hall']] }],
  [9760, 1, 26, 130, 60, 17, 'hall'], [9920, 1, 26, 150, 60, 17, 'hall'], [10090, 1, 28, 120, 50, 16, 'hall'],
  [9900, 1, 150, 150, 36, 30, 'silver', { tiers: [[0.84, 0.86, 30, 30], [0.68, 0.74, 60, 30], [0.52, 0.62, 90, 30], [0.36, 0.5, 120, 30], [0.2, 0.4, 150, 30]] }],
  [9780, -1, 30, 110, 50, 16, 'hall'], [9960, -1, 34, 60, 16, 26, 'haussmann'], [10060, -1, 34, 60, 18, 18, 'bandW'], [10150, -1, 36, 50, 14, 26, 'saumon'],
  [10270, 1, 26, 72, 34, 24, 'parking'], [10250, -1, 36, 70, 18, 26, 'gBlack'], [10330, -1, 40, 40, 14, 22, 'brique30'],
  // Seine, Saint-Cloud
  [11520, -1, 34, 64, 20, 30, 'gBlue'], [12110, 1, 30, 50, 24, 12, 'hall'], [12000, 1, 46, 50, 14, 26, 'brique30'],
  // Auteuil : façade ocre à lames
  [13560, 1, 22, 150, 24, 14, 'ocreLames'],
  // Dauphine (université)
  [16810, 1, 36, 120, 20, 22, 'bandW'],
  // Champerret, Asnières
  [18350, -1, 36, 84, 18, 28, 'bandW'], [18900, -1, 24, 40, 14, 8, 'corten'], [18920, 1, 30, 110, 30, 9, 'parking'],
  [18900, -1, 60, 60, 18, 28, 'gBlue'], [19380, -1, 60, 70, 14, 36, 'brique30'], [19440, -1, 90, 70, 14, 36, 'loggia'], [19360, -1, 120, 22, 22, 56, 'tour'],
  // Clichy
  [20690, 1, 22, 64, 20, 18, 'facets'], [20610, 1, 24, 50, 14, 14, 'beton'], [20850, 1, 26, 150, 18, 28, 'gBlue'],
  [20800, -1, 40, 50, 18, 30, 'white50'], [20880, -1, 40, 70, 18, 28, 'gBlue'], [20620, -1, 40, 50, 14, 22, 'brique30'],
];
