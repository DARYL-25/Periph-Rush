// ============================================================
// Périph' Rush — atlas de textures répétables
// Plusieurs textures « tuile » regroupées dans une seule image ; chaque
// sommet porte l'attribut `tile` (offset.xy, échelle.zw) et le shader
// répète la tuile avec fract() + textureGrad (mip-maps corrects).
// Permet de dessiner murs, DBA, écrans, talus, sol… ou toutes les
// façades d'un segment en UN seul draw call.
// ============================================================

export function makeAtlas(T, entries, cell = 512, cols = 4) {
  const rowsN = Math.ceil(entries.length / cols);
  const W = cell * cols, H = cell * rowsN;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const pad = 3;
  const tiles = {};
  entries.forEach(({ name, image }, i) => {
    const cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
    // copie avec marge répétée (limite les fuites de filtrage entre tuiles)
    c.drawImage(image, cx, cy, cell, cell);
    tiles[name] = [(cx + pad) / W, 1 - (cy + cell - pad) / H, (cell - 2 * pad) / W, (cell - 2 * pad) / H];
  });
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
  return { tex, tiles, canvas: cv };
}

// même disposition, autre contenu (ex. carte d'émission nocturne des façades)
export function makeAtlasLike(T, atlas, entries, cell = 512, cols = 4, srgb = true) {
  const W = atlas.canvas.width, H = atlas.canvas.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  entries.forEach(({ image }, i) => {
    if (!image) return;
    c.drawImage(image, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
  });
  const tex = new T.CanvasTexture(cv);
  if (srgb) tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
  return tex;
}

// patch d'un matériau standard three.js pour échantillonner l'atlas
export function atlasify(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tile;\nvarying vec4 vTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTile;\nvec4 atlasSample(sampler2D t, vec2 uv) {\n  vec2 a = vTile.xy + fract(uv) * vTile.zw;\n  return textureGrad(t, a, dFdx(uv) * vTile.zw, dFdy(uv) * vTile.zw);\n}')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= atlasSample(map, vMapUv);\n#endif')
      .replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\n  totalEmissiveRadiance *= atlasSample(emissiveMap, vEmissiveMapUv).rgb;\n#endif');
  };
  mat.customProgramCacheKey = () => 'atlas';
  return mat;
}
