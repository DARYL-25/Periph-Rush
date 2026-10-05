// ============================================================
// Périph' Rush — textures procédurales (canvas) du décor
// Enrobé, béton des tranchées (coffrage, coulures, tags), GBA,
// écrans antibruit, talus, façades (HBM en brique, haussmannien,
// barres 60-70, bureaux vitrés, logements récents, entrepôts).
// Tout est généré au chargement : aucune image externe.
// ============================================================

import { rng } from './utils.js';

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(THREE, cv, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function speckle(c, w, h, n, cols, smin = 1, smax = 2.5, rand = Math.random) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[(rand() * cols.length) | 0];
    const s = smin + rand() * (smax - smin);
    c.fillRect(rand() * w, rand() * h, s, s);
  }
}
// bruit de valeur lissé (pour taches / variations)
function blotches(c, w, h, n, rgba, rmin, rmax, rand = Math.random) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w, y = rand() * h, r = rmin + rand() * (rmax - rmin);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ---------- enrobé (tuile de 8 m × 8 m) ----------
export function asphaltTextures(THREE) {
  const S = 1024, rand = rng(77);
  const cv = cnv(S, S), c = cv.getContext('2d');
  c.fillStyle = '#4a4c50'; c.fillRect(0, 0, S, S);
  blotches(c, S, S, 40, 'rgba(30,31,34,0.18)', 60, 220, rand);
  blotches(c, S, S, 30, 'rgba(120,122,126,0.10)', 40, 160, rand);
  speckle(c, S, S, 90000, ['rgba(20,20,22,0.55)', 'rgba(140,140,145,0.45)', 'rgba(95,95,100,0.5)', 'rgba(170,165,155,0.35)'], 0.8, 2.2, rand);
  // fissures fines et joints de reprise
  c.strokeStyle = 'rgba(15,15,17,0.55)';
  for (let i = 0; i < 9; i++) {
    c.lineWidth = 0.8 + rand() * 1.6;
    c.beginPath();
    let x = rand() * S, y = rand() * S;
    c.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.2) * 50; c.lineTo(x, y); }
    c.stroke();
  }
  // rustine rectangulaire (enrobé plus récent, plus sombre)
  c.fillStyle = 'rgba(28,29,32,0.35)'; c.fillRect(S * 0.62, S * 0.1, S * 0.22, S * 0.33);
  c.strokeStyle = 'rgba(10,10,12,0.5)'; c.lineWidth = 2; c.strokeRect(S * 0.62, S * 0.1, S * 0.22, S * 0.33);
  const map = tex(THREE, cv);
  // relief
  const bv = cnv(512, 512), b = bv.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, 512, 512);
  speckle(b, 512, 512, 40000, ['#5a5a5a', '#a8a8a8', '#707070', '#949494'], 0.8, 2, rand);
  const bump = tex(THREE, bv, { srgb: false });
  return { map, bump };
}

// ---------- peinture routière usée (blanc, tuile) ----------
export function paintTexture(THREE) {
  const cv = cnv(128, 512), c = cv.getContext('2d'), rand = rng(5);
  c.fillStyle = '#f2f2ec'; c.fillRect(0, 0, 128, 512);
  speckle(c, 128, 512, 2600, ['rgba(70,72,76,0.55)', 'rgba(90,92,96,0.35)', 'rgba(200,200,195,0.6)'], 1, 3, rand);
  blotches(c, 128, 512, 10, 'rgba(80,80,80,0.25)', 10, 40, rand);
  return tex(THREE, cv);
}

// ---------- béton des murs de tranchée / couvertures (tuile 6 m × 6 m) ----------
export function concreteTextures(THREE) {
  const out = [];
  for (let v = 0; v < 3; v++) {
    const S = 512, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(300 + v);
    c.fillStyle = ['#a7a49c', '#9d9a93', '#b0aca2'][v]; c.fillRect(0, 0, S, S);
    blotches(c, S, S, 50, 'rgba(255,255,255,0.08)', 20, 90, rand);
    blotches(c, S, S, 40, 'rgba(60,55,45,0.10)', 20, 120, rand);
    speckle(c, S, S, 14000, ['rgba(80,78,72,0.25)', 'rgba(220,218,210,0.25)'], 0.6, 1.8, rand);
    // planches de coffrage horizontales + joints verticaux tous les 2,5 m
    c.strokeStyle = 'rgba(70,66,58,0.22)'; c.lineWidth = 1;
    for (let y = 0; y < S; y += S / 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); }
    c.strokeStyle = 'rgba(40,38,34,0.5)'; c.lineWidth = 3;
    for (let x = 0; x <= S; x += S * (2.5 / 6) * 0.999) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, S); c.stroke(); }
    // coulures noires depuis le haut
    for (let i = 0; i < 26; i++) {
      const x = rand() * S, w = 3 + rand() * 14, h = S * (0.15 + rand() * 0.6);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(30,30,28,${0.35 + rand() * 0.3})`); g.addColorStop(1, 'rgba(30,30,28,0)');
      c.fillStyle = g; c.fillRect(x, 0, w, h);
    }
    // encrassement en pied de mur (projections de la chaussée)
    const g2 = c.createLinearGradient(0, S, 0, S * 0.7);
    g2.addColorStop(0, 'rgba(25,24,22,0.55)'); g2.addColorStop(1, 'rgba(25,24,22,0)');
    c.fillStyle = g2; c.fillRect(0, S * 0.7, S, S * 0.3);
    // tags (variante 1 et 2)
    if (v > 0) {
      const cols = ['#d23b6e', '#2d6cdf', '#f2f2f2', '#111111', '#f0b400', '#3bb273', '#9a4fd6'];
      for (let t = 0; t < (v === 2 ? 6 : 3); t++) {
        const x0 = rand() * S * 0.8, y0 = S * (0.45 + rand() * 0.3);
        c.strokeStyle = cols[(rand() * cols.length) | 0];
        c.lineWidth = 3 + rand() * 5; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x0, y0);
        let x = x0, y = y0;
        for (let k = 0; k < 10 + rand() * 12; k++) {
          x += 6 + rand() * 18; y = y0 + (rand() - 0.5) * 50;
          c.quadraticCurveTo(x - 8, y0 - 30 * rand(), x, y);
        }
        c.stroke();
        if (rand() < 0.5) { c.strokeStyle = '#111'; c.lineWidth = 1.5; c.stroke(); }
      }
    }
    out.push(tex(THREE, cv));
  }
  return out;
}

// ---------- béton clair préfabriqué (GBA, parapets, corniches) ----------
export function gbaTexture(THREE) {
  const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(11);
  c.fillStyle = '#c4c2bb'; c.fillRect(0, 0, S, S);
  speckle(c, S, S, 6000, ['rgba(90,88,82,0.25)', 'rgba(240,238,232,0.3)'], 0.6, 1.6, rand);
  blotches(c, S, S, 14, 'rgba(70,66,58,0.12)', 10, 50, rand);
  // salissure basse (pneus, eau)
  const g = c.createLinearGradient(0, S, 0, S * 0.45);
  g.addColorStop(0, 'rgba(30,29,27,0.6)'); g.addColorStop(1, 'rgba(30,29,27,0)');
  c.fillStyle = g; c.fillRect(0, S * 0.45, S, S * 0.55);
  // joints d'éléments tous les 2 m (texture couvrant 4 m)
  c.fillStyle = 'rgba(40,38,34,0.55)'; c.fillRect(0, 0, 3, S); c.fillRect(S / 2, 0, 3, S);
  return tex(THREE, cv);
}

// ---------- écrans antibruit (3 modèles, tuile 4 m × 4 m) ----------
export function noiseWallTextures(THREE) {
  const out = [];
  // 0 : panneaux métalliques vert sombre nervurés + poteaux HEA
  {
    const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(21);
    c.fillStyle = '#4d6a58'; c.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) { c.fillStyle = y % 16 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; c.fillRect(0, y, S, 4); }
    c.fillStyle = '#2e3a33'; c.fillRect(0, 0, 10, S); c.fillRect(S / 2, 0, 10, S);
    blotches(c, S, S, 12, 'rgba(30,30,25,0.18)', 10, 60, rand);
    const g = c.createLinearGradient(0, S, 0, S * 0.6); g.addColorStop(0, 'rgba(25,24,20,0.5)'); g.addColorStop(1, 'rgba(25,24,20,0)');
    c.fillStyle = g; c.fillRect(0, S * 0.6, S, S * 0.4);
    out.push(tex(THREE, cv));
  }
  // 1 : panneaux transparents (PMMA) teintés avec cadres verts — vus comme reflets bleutés
  {
    const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(22);
    const g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#8fa7b4'); g.addColorStop(1, '#5f7480');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.save(); c.translate(rand() * S, 0); c.rotate(0.5); c.fillRect(0, -40, 8 + rand() * 18, S * 1.6); c.restore(); }
    c.fillStyle = '#30553f'; c.fillRect(0, 0, 9, S); c.fillRect(S / 2, 0, 9, S); c.fillRect(0, S - 26, S, 26); c.fillRect(0, 0, S, 6);
    blotches(c, S, S, 10, 'rgba(60,60,50,0.18)', 10, 50, rand);
    out.push(tex(THREE, cv));
  }
  // 2 : bois-béton brun à cannelures
  {
    const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(23);
    c.fillStyle = '#7d6b58'; c.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 6) { c.fillStyle = x % 12 ? 'rgba(255,240,220,0.08)' : 'rgba(0,0,0,0.18)'; c.fillRect(x, 0, 3, S); }
    c.fillStyle = 'rgba(30,25,20,0.45)'; c.fillRect(0, 0, 4, S); c.fillRect(S / 2, 0, 4, S);
    speckle(c, S, S, 3000, ['rgba(40,30,20,0.25)', 'rgba(200,180,160,0.2)'], 0.8, 2, rand);
    out.push(tex(THREE, cv));
  }
  return out;
}

// ---------- végétation : talus enherbé / lierre (tuile) ----------
export function grassTexture(THREE) {
  const S = 512, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(31);
  c.fillStyle = '#56703f'; c.fillRect(0, 0, S, S);
  blotches(c, S, S, 60, 'rgba(110,130,60,0.25)', 20, 80, rand);
  blotches(c, S, S, 50, 'rgba(40,55,30,0.3)', 20, 70, rand);
  for (let i = 0; i < 26000; i++) {
    const x = rand() * S, y = rand() * S;
    c.strokeStyle = ['rgba(120,150,70,0.5)', 'rgba(60,85,40,0.6)', 'rgba(150,160,90,0.35)', 'rgba(90,110,55,0.5)'][(rand() * 4) | 0];
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rand() - 0.5) * 3, y - 2 - rand() * 4); c.stroke();
  }
  return tex(THREE, cv);
}
export function ivyTexture(THREE) {
  const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(32);
  c.fillStyle = '#2f4a26'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = ['#3e6230', '#4f7638', '#29421f', '#5e8442', '#35552a'][(rand() * 5) | 0];
    c.beginPath(); c.ellipse(rand() * S, rand() * S, 2 + rand() * 4, 1.5 + rand() * 3, rand() * 3, 0, Math.PI * 2); c.fill();
  }
  return tex(THREE, cv);
}

// ---------- sol urbain (trottoirs, terre-pleins) ----------
export function groundTexture(THREE) {
  const S = 512, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(41);
  c.fillStyle = '#8c8a84'; c.fillRect(0, 0, S, S);
  blotches(c, S, S, 50, 'rgba(60,58,52,0.2)', 20, 100, rand);
  speckle(c, S, S, 16000, ['rgba(60,60,58,0.3)', 'rgba(200,198,190,0.25)'], 0.8, 2, rand);
  return tex(THREE, cv);
}

// ============================================================
// Façades. Chaque texture couvre 4 travées × 4 niveaux (≈ 12,8 m × 12 m
// pour l'habitat). Carte jour + carte d'émission nocturne (fenêtres).
// ============================================================
export const FACADES = [
  { id: 'hbm', bay: 3.2, floor: 2.9 },        // HBM briques rouges (ceinture des Maréchaux)
  { id: 'haussmann', bay: 3.4, floor: 3.3 },  // pierre de taille, balcons filants
  { id: 'barre', bay: 2.8, floor: 2.7 },      // barre / tour 60-70
  { id: 'office', bay: 1.8, floor: 3.6 },     // bureaux mur-rideau
  { id: 'modern', bay: 3.0, floor: 3.0 },     // logements récents enduit + bardage
  { id: 'industry', bay: 6.0, floor: 6.0 },   // entrepôts, ateliers, équipements
];

export function facadeTextures(THREE) {
  const res = [];
  for (let v = 0; v < FACADES.length; v++) {
    const S = 512, day = cnv(S, S), d = day.getContext('2d');
    const glow = cnv(S / 2, S / 2), g = glow.getContext('2d');
    const rand = rng(900 + v);
    g.fillStyle = '#000'; g.fillRect(0, 0, S / 2, S / 2);
    const cell = S / 4;
    const lit = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x / 2, y / 2, w / 2, h / 2); };
    const warm = () => ['#ffd08a', '#ffe1ad', '#ffc070', '#f7e6c4', '#cfe0ff'][(rand() * 5) | 0];
    const id = FACADES[v].id;
    if (id === 'hbm') {
      // brique rouge-orangé, chaînages et bandeaux en pierre claire
      d.fillStyle = '#a8553a'; d.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 6) for (let x = (y / 6) % 2 ? 0 : 7; x < S; x += 14) {
        d.fillStyle = `rgba(${120 + rand() * 60},${50 + rand() * 30},${30 + rand() * 20},0.55)`; d.fillRect(x, y, 13, 5);
      }
      d.fillStyle = 'rgba(230,220,200,0.12)'; for (let y = 5; y < S; y += 6) d.fillRect(0, y, S, 1);
      for (let j = 0; j < 4; j++) {
        d.fillStyle = '#ddd2bd'; d.fillRect(0, j * cell + cell - 10, S, 8); // bandeau
        for (let i = 0; i < 4; i++) {
          const x = i * cell + cell * 0.28, y = j * cell + cell * 0.18, w = cell * 0.44, h = cell * 0.6;
          d.fillStyle = '#e7dfcf'; d.fillRect(x - 5, y - 5, w + 10, h + 10);   // encadrement
          d.fillStyle = '#3d4652'; d.fillRect(x, y, w, h);
          d.fillStyle = 'rgba(190,210,230,0.35)'; d.fillRect(x + 2, y + 2, w * 0.45, h * 0.5);
          d.fillStyle = '#f2efe8'; d.fillRect(x + w / 2 - 2, y, 4, h); d.fillRect(x, y + h * 0.33, w, 3);
          if (rand() < 0.35) { d.fillStyle = 'rgba(235,225,200,0.85)'; d.fillRect(x + 2, y + 2, w - 4, h * (0.2 + rand() * 0.5)); } // store
          if (rand() < 0.32) lit(x, y, w, h, warm());
        }
      }
    } else if (id === 'haussmann') {
      d.fillStyle = '#e3d6bd'; d.fillRect(0, 0, S, S);
      speckle(d, S, S, 5000, ['rgba(160,140,110,0.18)', 'rgba(255,250,240,0.25)'], 1, 2, rand);
      for (let y = 0; y < S; y += cell / 3) { d.fillStyle = 'rgba(150,130,100,0.25)'; d.fillRect(0, y, S, 1.5); }
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = i * cell + cell * 0.27, y = j * cell + cell * 0.1, w = cell * 0.46, h = cell * 0.72;
          d.fillStyle = '#d2c3a6'; d.fillRect(x - 6, y - 10, w + 12, 8);           // corniche de fenêtre
          d.fillStyle = '#353b45'; d.fillRect(x, y, w, h);
          d.fillStyle = 'rgba(210,225,240,0.28)'; d.fillRect(x + 3, y + 3, w * 0.4, h * 0.45);
          d.fillStyle = '#efe8da'; d.fillRect(x + w / 2 - 2, y, 4, h); for (let k = 1; k < 4; k++) d.fillRect(x, y + (h * k) / 4, w, 2);
          d.fillStyle = 'rgba(80,90,85,0.9)'; d.fillRect(x - 3, y, 5, h); d.fillRect(x + w - 2, y, 5, h); // volets
          if (rand() < 0.3) lit(x, y, w, h, warm());
        }
        // balcon filant en fer forgé (niveaux 1 et 3 de la tuile)
        if (j === 1 || j === 3) {
          const yb = j * cell + cell * 0.6;
          d.fillStyle = '#c9b996'; d.fillRect(0, yb + cell * 0.2, S, 6);
          d.fillStyle = '#1e2124'; d.fillRect(0, yb, S, 3); d.fillRect(0, yb + cell * 0.19, S, 3);
          for (let x = 0; x < S; x += 7) d.fillRect(x, yb, 1.5, cell * 0.2);
        } else {
          for (let i = 0; i < 4; i++) { // garde-corps individuels
            const x = i * cell + cell * 0.27, yb = j * cell + cell * 0.66;
            d.fillStyle = '#1e2124'; d.fillRect(x - 2, yb, cell * 0.5, 2); for (let k = 0; k < cell * 0.5; k += 6) d.fillRect(x - 2 + k, yb, 1.2, cell * 0.14);
          }
        }
      }
    } else if (id === 'barre') {
      d.fillStyle = '#c9c6bd'; d.fillRect(0, 0, S, S);
      blotches(d, S, S, 30, 'rgba(70,70,65,0.18)', 20, 90, rand);
      for (let j = 0; j < 4; j++) {
        d.fillStyle = '#b5b1a6'; d.fillRect(0, j * cell + cell - 14, S, 14); // nez de dalle
        for (let i = 0; i < 4; i++) {
          const loggia = i === 1;
          const x = i * cell + cell * 0.12, y = j * cell + cell * 0.2, w = cell * 0.76, h = cell * 0.55;
          d.fillStyle = loggia ? '#5d5a55' : '#3e4650'; d.fillRect(x, y, w, h);
          if (!loggia) { d.fillStyle = 'rgba(200,215,230,0.3)'; d.fillRect(x + 3, y + 3, w * 0.45, h * 0.45); d.fillStyle = '#dcdad4'; d.fillRect(x + w / 2 - 2, y, 4, h); }
          else { d.fillStyle = ['#c56b3c', '#4c7aa8', '#d9b443'][(rand() * 3) | 0]; d.fillRect(x, y + h * 0.55, w, h * 0.45); } // garde-corps coloré
          if (rand() < 0.4) lit(x, y, w, h * 0.55, warm());
        }
      }
    } else if (id === 'office') {
      const gr = d.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, '#6c8396'); gr.addColorStop(1, '#3f5466');
      d.fillStyle = gr; d.fillRect(0, 0, S, S);
      for (let j = 0; j < 4; j++) {
        d.fillStyle = '#26303a'; d.fillRect(0, j * cell + cell - 18, S, 18);   // allège
        for (let i = 0; i < 8; i++) {
          d.fillStyle = '#2b3540'; d.fillRect(i * (S / 8), j * cell, 3, cell);
          if (rand() < 0.45) lit(i * (S / 8) + 3, j * cell + 2, S / 8 - 4, cell - 22, rand() < 0.7 ? '#dfe9ff' : '#fff2d6');
        }
        d.fillStyle = 'rgba(255,255,255,0.10)'; d.fillRect(0, j * cell + 4, S, 6);
      }
    } else if (id === 'modern') {
      d.fillStyle = '#e2dccf'; d.fillRect(0, 0, S, S);
      blotches(d, S, S, 26, 'rgba(120,110,95,0.10)', 20, 90, rand);
      for (let j = 0; j < 4; j++) { d.fillStyle = 'rgba(150,140,125,0.35)'; d.fillRect(0, j * cell + cell - 6, S, 6); }
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = i * cell + cell * 0.15, y = j * cell + cell * 0.12, w = cell * (rand() < 0.5 ? 0.42 : 0.62), h = cell * 0.7;
          d.fillStyle = '#f4f1ea'; d.fillRect(x - 4, y - 4, w + 8, h + 8);       // tableau clair
          d.fillStyle = '#3a4350'; d.fillRect(x, y, w, h);
          d.fillStyle = 'rgba(200,215,230,0.32)'; d.fillRect(x + 3, y + 3, w * 0.4, h * 0.45);
          d.fillStyle = '#e9e6df'; d.fillRect(x + w / 2 - 2, y, 4, h);
          if (rand() < 0.4) { d.fillStyle = ['#b9805a', '#8a8f94', '#6b7b5a', '#c9a77c'][(rand() * 4) | 0]; d.fillRect(x + w + 8, y - 4, cell * 0.16, h + 8); } // bardage
          // garde-corps métallique devant la porte-fenêtre
          d.fillStyle = 'rgba(45,48,52,0.85)'; d.fillRect(x - 2, y + h * 0.58, w + 4, 3);
          for (let k = 0; k < w; k += 5) d.fillRect(x + k, y + h * 0.58, 1.2, h * 0.42);
          if (rand() < 0.35) lit(x, y, w, h, warm());
        }
      }
    } else { // industry
      d.fillStyle = '#9fa3a3'; d.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 10) { d.fillStyle = x % 20 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; d.fillRect(x, 0, 5, S); }
      blotches(d, S, S, 20, 'rgba(90,70,50,0.18)', 20, 90, rand);
      d.fillStyle = 'rgba(60,70,80,0.75)'; d.fillRect(0, S * 0.08, S, S * 0.07);
      lit(0, S * 0.08, S, S * 0.07, 'rgba(255,240,200,0.5)');
    }
    // salissure générale + vieillissement
    blotches(d, S, S, 18, 'rgba(40,35,30,0.10)', 20, 120, rand);
    res.push({ day: tex(THREE, day), glow: tex(THREE, glow), ...FACADES[v] });
  }
  return res;
}

// toits (zinc parisien / étanchéité / gravier)
export function roofTexture(THREE) {
  const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(51);
  c.fillStyle = '#6e7276'; c.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 12) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, 0, 2, S); }
  speckle(c, S, S, 5000, ['rgba(40,40,40,0.25)', 'rgba(200,200,200,0.2)'], 1, 2, rand);
  return tex(THREE, cv);
}

// halo additif (lampadaires, phares)
export function glowTexture(THREE, rgb = '255,214,160') {
  const cv = cnv(64, 64), c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, `rgba(${rgb},0.95)`);
  g.addColorStop(0.3, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return tex(THREE, cv, { repeat: false });
}

// feuillage (masque alpha pour couronnes d'arbres en billboards croisés)
export function foliageTexture(THREE) {
  const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(61);
  c.clearRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * S * 0.44;
    const x = S / 2 + Math.cos(a) * r, y = S * 0.48 + Math.sin(a) * r * 0.92;
    const shade = 0.55 + (1 - (y / S)) * 0.45;
    c.fillStyle = `rgba(${(70 + rand() * 40) * shade | 0},${(105 + rand() * 50) * shade | 0},${(45 + rand() * 25) * shade | 0},1)`;
    c.beginPath(); c.ellipse(x, y, 5 + rand() * 7, 4 + rand() * 5, rand() * 3, 0, Math.PI * 2); c.fill();
  }
  // tronc
  c.fillStyle = '#4a3b2c'; c.fillRect(S / 2 - 6, S * 0.82, 12, S * 0.18);
  return tex(THREE, cv, { repeat: false });
}

// feuillage dense (tuile) pour les couronnes d'arbres
export function leavesTexture(THREE) {
  const S = 256, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(71);
  c.fillStyle = '#5d7d45'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 1800; i++) {
    const x = rand() * S, y = rand() * S, r = 3 + rand() * 7;
    const l = rand();
    c.fillStyle = l < 0.33 ? 'rgba(38,58,28,0.75)' : l < 0.7 ? 'rgba(88,120,60,0.7)' : 'rgba(150,175,95,0.6)';
    c.beginPath(); c.ellipse(x, y, r, r * 0.7, rand() * 3, 0, Math.PI * 2); c.fill();
  }
  // trouées sombres (profondeur)
  blotches(c, S, S, 16, 'rgba(20,30,15,0.45)', 8, 24, rand);
  return tex(THREE, cv);
}

// carrelage gris clair des parois de couvertures et culées de ponts (tuile 3 m)
export function tilesTexture(THREE) {
  const S = 512, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(81);
  c.fillStyle = '#b9b8b2'; c.fillRect(0, 0, S, S);
  const n = 12, t = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = 172 + rand() * 26 | 0;
    c.fillStyle = `rgb(${v},${v - 1},${v - 5})`;
    c.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
  }
  c.fillStyle = 'rgba(70,68,62,0.55)';
  for (let k = 0; k <= n; k++) { c.fillRect(k * t - 1, 0, 2.5, S); c.fillRect(0, k * t - 1, S, 2.5); }
  // coulures et encrassement bas
  for (let i = 0; i < 18; i++) { const x = rand() * S, h = S * (0.2 + rand() * 0.6); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(40,40,36,0.35)'); g.addColorStop(1, 'rgba(40,40,36,0)'); c.fillStyle = g; c.fillRect(x, 0, 4 + rand() * 10, h); }
  const g2 = c.createLinearGradient(0, S, 0, S * 0.65); g2.addColorStop(0, 'rgba(30,29,26,0.55)'); g2.addColorStop(1, 'rgba(30,29,26,0)');
  c.fillStyle = g2; c.fillRect(0, S * 0.65, S, S * 0.35);
  blotches(c, S, S, 14, 'rgba(60,58,50,0.18)', 20, 70, rand);
  return tex(THREE, cv);
}

// écran antibruit en panneaux de briques entre poteaux béton à chapeau (tuile 4 m)
export function brickWallTexture(THREE) {
  const S = 512, cv = cnv(S, S), c = cv.getContext('2d'), rand = rng(91);
  c.fillStyle = '#8f4a36'; c.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 9) for (let x = (y / 9) % 2 ? 0 : 10; x < S; x += 20) {
    c.fillStyle = `rgba(${120 + rand() * 50},${55 + rand() * 25},${40 + rand() * 18},0.7)`; c.fillRect(x, y, 19, 8);
  }
  c.fillStyle = 'rgba(210,200,185,0.15)'; for (let y = 8; y < S; y += 9) c.fillRect(0, y, S, 1);
  // poteaux béton clairs (tous les 2 m) avec chapeau arrondi
  for (const x of [0, S / 2]) {
    c.fillStyle = '#c8c3b6'; c.fillRect(x, 0, 40, S);
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + 32, 0, 8, S);
  }
  // couronnement béton
  c.fillStyle = '#bdb7aa'; c.fillRect(0, 0, S, 22);
  // tags
  const cols = ['#2b2b2b', '#5a6fb0', '#e8e4dc', '#7b3fa0', '#2f7d5a'];
  for (let t = 0; t < 5; t++) {
    const x0 = 50 + rand() * 380, y0 = 260 + rand() * 180;
    c.strokeStyle = cols[(rand() * cols.length) | 0]; c.lineWidth = 3 + rand() * 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0);
    let x = x0;
    for (let k = 0; k < 12; k++) { x += 6 + rand() * 12; c.quadraticCurveTo(x - 6, y0 - 40 * rand(), x, y0 + (rand() - 0.5) * 50); }
    c.stroke();
  }
  const g = c.createLinearGradient(0, S, 0, S * 0.7); g.addColorStop(0, 'rgba(25,22,20,0.5)'); g.addColorStop(1, 'rgba(25,22,20,0)');
  c.fillStyle = g; c.fillRect(0, S * 0.7, S, S * 0.3);
  return tex(THREE, cv);
}
