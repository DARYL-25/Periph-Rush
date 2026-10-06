// ============================================================
// Périph' Rush — relevé Street View du tour complet (v12, oct. 2026)
// Sens intérieur, 100 points de vue tous les 350 m depuis l'entrée de
// la Porte Maillot (détail : docs/SURVEY-v12.md). Les abscisses sont
// exprimées en mètres APRÈS LE DÉPART (off), converties en s au chargement.
//
// Pour chaque rive :
//   wall   : parement en tranchée/couverture
//            beton | beige | meuliere | pierre | moellons | dalles | caissons | fresque | talus
//   crown  : couronnement en tête de mur : balustrade | grille | (grillage par défaut)
//   screen : équipement de rive hors tranchée
//            grilleVerte | grilleNoire | grilleGrise | grillage | glissiere | muret | talus
//            beige | blanc | brique | tole | lames | vert | medaillons
//   veg    : végétation de rive : arbres | bois | platanes | peupliers | pins | marronniers
//            lierre | haieRouge | arbustes
// R = rive droite (côté Paris) ; G = rive extérieure du sens opposé (vue au-delà du TPC).
// Le texte « Blvd Périphérique » / « E15 » / « E50 » de Street View est une
// surcouche Google : il n'existe pas sur la chaussée et n'est pas reproduit.
// ============================================================

import { wrap } from './utils.js';

const R = [
  [0, 1350, { wall: 'beige', veg: 'arbres' }],                 // Maillot – Ternes – Champerret (couvertures)
  [1350, 1700, { wall: 'talus', screen: 'talus', veg: 'bois' }], // Asnières : talus boisés
  [1700, 1950, { wall: 'beige' }],
  [1950, 2400, { wall: 'pierre', crown: 'balustrade', veg: 'arbres' }],
  [2400, 2800, { wall: 'meuliere', screen: 'grilleVerte', veg: 'arbres' }], // pont-rail de Clichy
  [2800, 4000, { screen: 'grilleVerte', veg: 'arbres' }],
  [4000, 4400, { screen: 'beige' }],
  [4400, 4700, { screen: 'medaillons' }],
  [4700, 5100, { screen: 'grilleVerte', veg: 'arbres' }],
  [5100, 5450, { screen: 'brique', veg: 'arbres' }],
  [5450, 5800, { screen: 'vert' }],
  [5800, 6150, { screen: 'blanc', veg: 'arbres' }],
  [6150, 6900, { screen: 'grilleVerte' }],                       // viaduc de la Chapelle
  [6900, 7300, { screen: 'talus', wall: 'talus', veg: 'platanes' }],
  [7300, 7500, { wall: 'pierre', crown: 'balustrade', screen: 'muret', veg: 'arbres' }],
  [7500, 7900, { screen: 'talus', wall: 'talus', veg: 'arbres' }],
  [7900, 8250, { wall: 'fresque', screen: 'blanc', veg: 'arbres' }],
  [8250, 8600, { screen: 'glissiere', wall: 'talus' }],
  [8600, 9600, { screen: 'grilleVerte', veg: 'pins' }],          // viaduc de Pantin, Zénith
  [9600, 10000, { screen: 'talus', veg: 'arbres' }],
  [10000, 10650, { screen: 'grilleVerte' }],
  [10650, 11000, { screen: 'lames' }],
  [11000, 11400, { screen: 'talus', wall: 'talus', veg: 'lierre' }],
  [11400, 11800, { screen: 'talus', wall: 'talus', veg: 'arbres' }],
  [11800, 12450, { wall: 'meuliere', veg: 'arbres' }],
  [12450, 13200, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [13200, 13800, { wall: 'beton', crown: 'grille', screen: 'muret' }], // échangeur A3
  [13800, 14700, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [14700, 15600, { wall: 'talus', screen: 'talus', veg: 'marronniers' }],
  [15600, 15900, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [15900, 16700, { wall: 'talus', screen: 'grillage', veg: 'arbres' }],
  [16700, 17050, { wall: 'meuliere', veg: 'lierre' }],
  [17050, 17700, { wall: 'beton' }],                               // échangeur de Bercy
  [17700, 18300, { screen: 'grilleVerte' }],                       // pont amont
  [18300, 18700, { screen: 'talus', veg: 'peupliers' }],
  [18700, 19700, { screen: 'grilleVerte' }],
  [19700, 20100, { screen: 'grilleGrise' }],
  [20100, 21500, { wall: 'meuliere', crown: 'balustrade', screen: 'muret' }], // Italie
  [21500, 22300, { screen: 'muret', veg: 'arbres' }],
  [22300, 22600, { screen: 'glissiere', veg: 'arbres' }],
  [22600, 23600, { screen: 'grilleNoire', veg: 'arbustes' }],
  [23600, 24000, { wall: 'pierre', screen: 'muret', veg: 'arbres' }],
  [24000, 24350, { wall: 'moellons', crown: 'balustrade' }],
  [24350, 24700, { wall: 'caissons' }],
  [24700, 25400, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [25400, 25800, { wall: 'pierre' }],
  [25800, 26100, { wall: 'beton' }],
  [26100, 26450, { wall: 'meuliere', veg: 'pins' }],
  [26450, 26800, { wall: 'pierre', crown: 'grille' }],
  [26800, 28150, { screen: 'grilleVerte' }],                       // expositions, Balard
  [28150, 29250, { screen: 'grilleVerte', veg: 'peupliers' }],     // pont aval
  [29250, 30700, { wall: 'beton' }],                               // Parc des Princes, Auteuil
  [30700, 31400, { wall: 'talus', veg: 'bois' }],                  // bois de Boulogne
  [31400, 32400, { wall: 'beton' }],
  [32400, 32800, { wall: 'pierre' }],
  [32800, 33100, { wall: 'beton' }],
  [33100, 33500, { wall: 'dalles', veg: 'bois' }],
  [33500, 34100, { wall: 'beige' }],
  [34100, 34600, { wall: 'talus', veg: 'bois' }],
  [34600, 36000, { screen: 'grilleGrise', wall: 'beige' }],
];

const G = [
  [0, 1350, { wall: 'beige' }],
  [1350, 1700, { wall: 'talus', screen: 'talus', veg: 'bois' }],
  [1700, 1950, { wall: 'beige' }],
  [1950, 2400, { wall: 'talus', screen: 'talus', veg: 'bois' }],
  [2400, 2800, { wall: 'beton', screen: 'muret' }],
  [2800, 3600, { screen: 'grilleVerte' }],
  [3600, 4700, { screen: 'beige' }],
  [4700, 5100, { screen: 'tole' }],
  [5100, 5800, { screen: 'blanc' }],
  [5800, 6150, { screen: 'talus', wall: 'talus', veg: 'bois' }],
  [6150, 6900, { screen: 'grilleVerte' }],
  [6900, 7300, { screen: 'talus', wall: 'talus', veg: 'platanes' }],
  [7300, 8250, { screen: 'talus', wall: 'talus', veg: 'arbres' }],
  [8250, 8600, { screen: 'glissiere' }],
  [8600, 9300, { screen: 'blanc' }],
  [9300, 9600, { screen: 'grilleVerte' }],
  [9600, 10000, { screen: 'beige', veg: 'arbres' }],
  [10000, 10650, { screen: 'grilleVerte' }],
  [10650, 11400, { screen: 'blanc' }],
  [11400, 11800, { screen: 'brique', wall: 'beton' }],
  [11800, 13200, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [13200, 14000, { wall: 'beton', screen: 'muret', veg: 'arbres' }],
  [14000, 14600, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [14600, 14900, { wall: 'beton', crown: 'grille' }],
  [14900, 15600, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [15600, 15900, { wall: 'pierre', crown: 'balustrade' }],
  [15900, 16700, { wall: 'talus', screen: 'talus', veg: 'haieRouge' }],
  [16700, 17050, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [17050, 17700, { wall: 'beton' }],
  [17700, 18300, { screen: 'grilleVerte' }],
  [18300, 18700, { screen: 'talus', veg: 'arbustes' }],
  [18700, 19700, { screen: 'grilleVerte' }],
  [19700, 20100, { screen: 'muret' }],
  [20100, 21500, { wall: 'meuliere', crown: 'balustrade', screen: 'muret' }],
  [21500, 22300, { screen: 'blanc' }],
  [22300, 22600, { screen: 'muret' }],
  [22600, 23300, { screen: 'blanc' }],
  [23300, 23600, { screen: 'muret' }],
  [23600, 24000, { wall: 'pierre', screen: 'muret' }],
  [24000, 24350, { wall: 'moellons', crown: 'balustrade' }],
  [24350, 24700, { wall: 'beige', screen: 'beige' }],
  [24700, 25400, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [25400, 26100, { wall: 'beton' }],
  [26100, 26450, { wall: 'talus', screen: 'talus', veg: 'arbres' }],
  [26450, 26800, { wall: 'pierre' }],
  [26800, 29250, { screen: 'grilleVerte' }],
  [29250, 30700, { wall: 'beton' }],
  [30700, 31400, { wall: 'talus', veg: 'bois' }],
  [31400, 33100, { wall: 'beton' }],
  [33100, 33500, { wall: 'talus', veg: 'bois' }],
  [33500, 34100, { wall: 'beige' }],
  [34100, 34600, { wall: 'talus', veg: 'bois' }],
  [34600, 36000, { screen: 'grilleGrise', wall: 'beige' }],
];

// terre-plein central : DBA double avec bande plantée
const MED_WIDE = [[4700, 9000], [9600, 10000], [12800, 14700], [18300, 18700], [33000, 33500], [34100, 34650]];
// éclairage : candélabres en rive (crosse simple) par défaut ; doubles en Y en rive ; en Y sur le TPC (secteur sud)
const LAMPS = [[8300, 10000, 'edgeY'], [15600, 15800, 'edgeY'], [17700, 20100, 'medY']];
// couvertures : appuis centraux (voiles percés, colonnes rondes, piles carrées) et puits de lumière
const COVERS = [
  [0, 450, { piers: 'square' }], [450, 1400, { piers: 'voile' }], [1400, 2100, { piers: 'voile' }],
  [2400, 2620, { rail: true }], [17000, 17700, { piers: 'square', ads: true }],
  [29300, 29850, { piers: 'arcade' }], [31700, 32400, { piers: 'col' }], [32700, 33150, { piers: 'col' }],
  [33450, 33800, { piers: 'col', sky: true }], [33850, 34200, { piers: 'square' }],
];

// repères ponctuels relevés
export const SPOTS = [
  { off: 2470, kind: 'train' },                                   // rame sur le pont-rail de Clichy
  { off: 2390, kind: 'led', side: 1 }, { off: 2420, kind: 'led', side: 1 },
  { off: 2950, kind: 'billboard', side: -1, ad: 1 },
  { off: 3470, kind: 'concreteGantry' },
  { off: 6060, kind: 'footbridge' },
  { off: 7700, kind: 'fuel', side: 1 },
  { off: 13300, kind: 'flyover', h: 7.5, skew: 0.35 }, { off: 13380, kind: 'flyover', h: 13.5, skew: -0.25 }, { off: 13470, kind: 'flyover', h: 7.5, skew: 0.15 },
  { off: 14350, kind: 'eqGantry' },
  { off: 14380, kind: 'radarMed' },
  { off: 16850, kind: 'billboard', side: 1, ad: 0 },
  { off: 22950, kind: 'billboard', side: 1, ad: 2 }, { off: 23000, kind: 'billboard', side: -1, ad: 3 },
  { off: 23420, kind: 'billboard', side: 1, ad: 4 }, { off: 23440, kind: 'billboard', side: 1, ad: 5 },
  { off: 26700, kind: 'footbridge' },
  { off: 31200, kind: 'footbridge' },
  { off: 34650, kind: 'mast', side: 1 }, { off: 34700, kind: 'mast', side: -1 },
  { off: 34700, kind: 'flyover', h: 8, skew: 0.5 }, { off: 34780, kind: 'flyover', h: 8, skew: -0.4 },
];

export class Survey {
  constructor(track) {
    this.track = track;
    const L = track.length, s0 = track.startS;
    const conv = (list) => list.map(([a, b, v]) => ({ s0: wrap(s0 + a, L), len: Math.min(b, L) - a, v }));
    this.R = conv(R); this.G = conv(G);
    this.med = conv(MED_WIDE.map(([a, b]) => [a, b, true]));
    this.lamps = conv(LAMPS);
    this.covers = conv(COVERS);
    this.spots = SPOTS.map((p) => ({ ...p, s: wrap(s0 + p.off, L) }));
    this.L = L;
  }
  find(list, s) {
    for (const r of list) if (wrap(s - r.s0, this.L) < r.len) return r.v;
    return null;
  }
  side(s, side) { return this.find(side > 0 ? this.R : this.G, s) || {}; }
  wideMedian(s) { return !!this.find(this.med, s); }
  lampStyle(s) { return this.find(this.lamps, s) || 'edge'; }
  cover(s) { return this.find(this.covers, s) || { piers: 'voile' }; }
}
