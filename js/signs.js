// ============================================================
// Périph' Rush — signalisation du périphérique
// Panneaux générés en canvas dans le style réel : cartouches bleus
// « sorties » (police L1/Caractères approchée par une sans-serif
// grasse condensée), portiques, PMV à texte variable, limitation 50.
// ============================================================

const texCache = new Map();

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

// Police proche des « Caractères L1 » : grasse, légèrement condensée
function signFont(px, condensed = 0.92) {
  return { font: `bold ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`, scaleX: condensed };
}

function drawText(ctx, text, x, y, px, color = '#fff', align = 'center', condensed = 0.92) {
  const f = signFont(px, condensed);
  ctx.save();
  ctx.font = f.font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.translate(x, y);
  ctx.scale(f.scaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Flèche de sortie (chevron incliné) façon signalisation française
function drawArrow(ctx, x, y, size, angle = Math.PI / 4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(0, -size * 0.45);
  ctx.moveTo(-size * 0.3, -size * 0.12);
  ctx.lineTo(0, -size * 0.48);
  ctx.lineTo(size * 0.3, -size * 0.12);
  ctx.stroke();
  ctx.restore();
}

function panelBase(ctx, w, h, bg = '#1b4faa') {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#f5f7fa';
  ctx.lineWidth = Math.max(3, h * 0.03);
  ctx.beginPath();
  ctx.roundRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2, h * 0.05);
  ctx.stroke();
}

// --- Panneau de sortie « Porte de X » avec n° de sortie ------------
export function exitPanelTexture(THREE, porteName, subtitle = '') {
  const key = `exit:${porteName}:${subtitle}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = makeCanvas(512, subtitle ? 224 : 160);
  const ctx = cv.getContext('2d');
  panelBase(ctx, cv.width, cv.height);
  drawArrow(ctx, 58, cv.height / 2, 56, Math.PI * 0.22);
  const name = porteName.replace('Porte ', 'Porte ');
  drawText(ctx, name, 60 + (cv.width - 90) / 2, subtitle ? 68 : cv.height / 2, name.length > 18 ? 42 : 50);
  if (subtitle) drawText(ctx, subtitle, 60 + (cv.width - 90) / 2, 150, 38, '#fff');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

// --- Grand panneau directionnel (portique) --------------------------
export function gantryPanelTexture(THREE, lines, opts = {}) {
  const key = `gantry:${lines.join('|')}:${opts.green ? 'g' : 'b'}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = makeCanvas(1024, 96 + lines.length * 96);
  const ctx = cv.getContext('2d');
  panelBase(ctx, cv.width, cv.height, opts.green ? '#0d7a45' : '#1b4faa');
  lines.forEach((ln, i) => {
    const y = 96 + i * 96;
    if (ln.arrow) drawArrow(ctx, 90, y, 52, ln.arrow === 'up' ? 0 : Math.PI * 0.25);
    drawText(ctx, ln.text, ln.arrow ? 130 : 60, y, ln.small ? 44 : 56, '#fff', 'left');
    if (ln.badge) { // cartouche type « A6b »
      const bw = 130, bx = cv.width - bw - 46, by = y - 34;
      ctx.fillStyle = '#c8102e';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 68, 10); ctx.fill();
      drawText(ctx, ln.badge, bx + bw / 2, y, 46);
    }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

// --- Panneau « BD PÉRIPHÉRIQUE » cartouche jaune/noir ---------------
export function peripheriqueCartouche(THREE) {
  const key = 'cartouche';
  if (texCache.has(key)) return texCache.get(key);
  const cv = makeCanvas(512, 112);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f7c600';
  ctx.beginPath(); ctx.roundRect(0, 0, 512, 112, 12); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(6, 6, 500, 100, 8); ctx.stroke();
  drawText(ctx, 'BD PÉRIPHÉRIQUE', 256, 58, 52, '#111', 'center', 0.88);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

// --- Limitation 50 (roundel) ----------------------------------------
export function speedLimitTexture(THREE, kmh = 50) {
  const key = `limit:${kmh}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = makeCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#f5f7fa';
  ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8102e';
  ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.arc(128, 128, 92, 0, Math.PI * 2, true); ctx.fill();
  ctx.fillStyle = '#14181c';
  ctx.font = 'bold 108px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(kmh), 128, 136);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

// --- Panneau à messages variables (PMV) — texture réinscriptible -----
export class VMSPanel {
  constructor(THREE) {
    this.cv = makeCanvas(512, 160);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.setText(['PERIPH FLUIDE', '']);
  }
  setText(lines) {
    const { ctx, cv } = this;
    ctx.fillStyle = '#14181a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#3a3f45'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cv.width - 6, cv.height - 6);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, cv.width / 2, 48 + i * 62));
    this.tex.needsUpdate = true;
  }
}

// --- Panneau chantier temporaire (jaune) ------------------------------
export function worksPanelTexture(THREE, text = 'TRAVAUX') {
  const key = `works:${text}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = makeCanvas(512, 160);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f7c600';
  ctx.beginPath(); ctx.roundRect(0, 0, 512, 160, 12); ctx.fill();
  ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.roundRect(8, 8, 496, 144, 8); ctx.stroke();
  drawText(ctx, text, 256, 84, 62, '#141414', 'center', 0.9);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
