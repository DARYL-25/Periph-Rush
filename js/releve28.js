// ============================================================
// Périph' Rush — relevé Look Around v28 (nov. 2026), 1er tronçon reconstruit :
// Porte d'Ivry → bifurcation A6a (abscisses s de la piste, sens intérieur).
// Détail du relevé : docs/SURVEY-v28.md. Dans ce tronçon, la signalisation
// automatique est remplacée par les équipements relevés un par un.
// Lacune du relevé (couverture après la bifurcation A6b) : s 4250 → 4600,
// laissée telle quelle.
// ============================================================

export const SECTOR = [3100, 5750];
export const GAP = [4250, 4600];
export const inSector = (s) => s >= SECTOR[0] && s < SECTOR[1] && !(s >= GAP[0] && s < GAP[1]);

// rive droite (côté Paris)
export const SIDE_R = [
  [3100, 3195, { wall: 'meuliere', crown: 'balustrade' }],                 // haut mur meulière après le pont d'Ivry
  [3195, 3255, { wall: 'meuliere', crown: 'balustrade', screen: 'muret', veg: 'arbustes' }],
  [3255, 3450, { wall: 'talus', screen: 'talus', veg: 'arbres' }],          // DBA + talus boisé
  [3450, 3650, { wall: 'meuliere', veg: 'arbres' }],                        // mur meulière à bandeau (pont de Choisy)
  [3650, 3945, { wall: 'talus', screen: 'talus', veg: 'arbres' }],          // talus très végétalisé, bretelle d'Italie
  [3945, 4250, { wall: 'meuliere', crown: 'grille' }],                      // haut mur meulière + grillage vert (A6b)
  [4600, 4783, { screen: 'talus', wall: 'talus', veg: 'arbres' }],          // fourré dense (robiniers, ailantes)
  [4783, 4860, { screen: 'grilleGrise' }],                                  // viaduc de la Poterne : dés + lisses
  [4860, 5240, { screen: 'grilleNoire', veg: 'arbres' }],                   // clôture sombre, cèdres, cimetière
  [5240, 5330, { screen: 'grilleBlanche', veg: 'arbres' }],                 // treillis blanc (Cité U)
  [5330, 5430, { screen: 'beige' }],                                        // mur béton clair à panneaux
  [5430, 5750, { screen: 'grilleGrise', veg: 'arbres' }],                   // parapet à dés + lisses
];
// rive extérieure (au-delà du TPC)
export const SIDE_G = [
  [3100, 3450, { wall: 'meuliere', crown: 'balustrade', veg: 'platanes' }],
  [3450, 3945, { wall: 'meuliere', crown: 'balustrade' }],
  [3945, 4250, { wall: 'meuliere', crown: 'balustrade' }],                  // arcades + balustrade
  [4600, 5250, { screen: 'muret', veg: 'peupliers' }],                      // mur tagué, peupliers
  [5250, 5750, { screen: 'muret', veg: 'pins' }],
];
// TPC large planté à l'approche de l'A6a
export const MEDIAN_WIDE = [[5470, 5750]];

const P = (name) => ({ kind: 'porte', name });
const A10 = { kind: 'blue', text: 'BORDEAUX-NANTES', ref: 'A 10' };
const LYON = { kind: 'blue', text: 'LYON-ÉVRY' };
const ORLY = { kind: 'blue', text: 'ORLY-RUNGIS', plane: true };

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
];

// bâtiments de premier rang : type de façade et hauteur d'après le relevé
// [s0, s1, côté (1 = Paris, -1 = banlieue), façade, hauteur m]
export const FRONT = [
  [3130, 3200, 1, 'office', 30], [3200, 3270, 1, 'industry', 13], [3430, 3530, 1, 'barre', 30],
  [3940, 4110, 1, 'hbm', 24], [4775, 4870, 1, 'office', 19], [5040, 5120, 1, 'hbm', 26], [5440, 5750, 1, 'ocre', 26],
  [3130, 3270, -1, 'office', 28], [3430, 3530, -1, 'hbm', 26], [3560, 3930, -1, 'office', 21],
  [3940, 4110, -1, 'barre', 30], [4600, 4790, -1, 'office', 22], [5180, 5420, -1, 'office', 29], [5440, 5750, -1, 'haussmann', 24],
];
