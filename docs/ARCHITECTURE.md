# Architecture — Périph' Rush

PWA statique sans build : ES modules + Three.js r166 vendorisé
(`vendor/three.module.min.js`). Cible : 60 FPS sur iPhone récent.

## Vue d'ensemble

```
index.html            écrans (menu, garage, défis, réglages, pause, fin) + HUD
css/style.css         design (safe areas iOS, glassmorphism sombre)
sw.js                 service worker précache versionné (periph-vN)
manifest.webmanifest  PWA plein écran portrait
js/
  main.js         boot, machine à états, boucle, qualité adaptative, showroom garage
  config.js       constantes & équilibrage (voies, fenêtres de simulation, score…)
  utils.js        PRNG déterministe, fusion de géométries, maths de boucle
  track.js        tracé : spline GPS des portes → table s→(pos, tangente, courbure)
  world.js        streaming du décor par segments de 100 m
  weather.js      ambiances interpolées (jour/coucher/nuit/pluie/brouillard) + pluie
  vehicles.js     catalogue (35+ modèles) + fabrique procédurale
  plates.js       plaques SIV françaises + étrangères (canvas, pool partagé)
  signs.js        panneaux (sorties, portiques, PMV, cartouche, limitation)
  traffic.js      IA de trafic (IDM, voies, interfile, bouchons, sens opposé)
  events.js       chantiers & accidents (fermetures, obstacles, balisage)
  player.js       physique arcade, caméra 3ᵉ personne, phares, déformation
  game.js         orchestration d'une manche : collisions, frôlements, crash, HUD
  score.js        score/combos/multiplicateur/pièces
  progression.js  sauvegarde localStorage, déblocages, défis quotidiens
  audio.js        sons 100 % WebAudio (moteur, vent, pluie, crash, klaxons)
  hud.js          contrôleur DOM + entrées tactiles multi-touch et clavier
tools/
  devserver.py    serveur local no-store + endpoint POST /__snap__ (tests)
  carviewer.html  planches-contact des véhicules (dev)
  make-icons.js   génération des icônes PNG sans dépendance
```

## Le périphérique (`track.js`)

- 33 points d'ancrage = coordonnées GPS réelles des portes (+ points de forme
  dans le Bois de Boulogne), sens intérieur (horaire).
- Catmull-Rom fermée, échantillonnée tous les 4 m, recalée à **35 040 m**
  (longueur officielle) ; table `s → position, tangente, courbure`.
- Élévation : interpolation cosinus entre altitudes cibles par porte
  (tranchées < 0, viaducs > 0) + ondulation douce. Tunnels et ponts de la Seine
  déclarés par zones ; drapeaux d'ambiance par segment (Bois, canal, échangeur,
  murs antibruit, immeubles).
- Repère roulant : `worldPos(s, latéral, hauteur)` — tout le jeu raisonne en
  coordonnées piste (s, latéral), le monde 3D n'est qu'une projection.

## Streaming du monde (`world.js`)

- Segments de **100 m** construits/détruits autour du joueur
  (11 devant / 2 derrière), ≤ 1 construction par frame (anti à-coups).
- Chaque segment fusionne son décor en très peu de draw calls :
  1 ruban de chaussée texturé (2 chaussées + marquages), 1 mesh « béton »
  vertex-colors (GBA, glissières, murs, tunnels, ponts, portiques, lampadaires),
  1 mesh têtes de lampes, 1 sol, 1 mesh immeubles (texture façade + fenêtres
  émissives la nuit), 2 InstancedMesh arbres, panneaux.
- Monuments : silhouettes stylisées placées à leurs positions GPS réelles.
- Budget mesuré : **~270 draw calls, ~65 k triangles** en scène dense.

## Véhicules (`vehicles.js`)

- Chaque modèle = dimensions réelles + paramètres de silhouette (nez, capot,
  pare-brise, pavillon, hayon) → profil latéral extrudé avec passages de roue,
  congés nets aux cassures, recalé aux cotes exactes.
- Vitrage = quads de surface (pare-brise bombé, custodes, lunette) ;
  détails vertex-colors (roues, optiques par époque — rondes/ovales/félines/
  lamelles —, calandre sans logo, rétros, becquets sport, barres de toit,
  enseigne taxi…). Deux-roues : constructeurs dédiés maxi-scooter / trail
  avec pilote casqué.
- 3 matériaux partagés par véhicule (peinture par couleur+saleté, vitrage,
  détails) → 3-5 draw calls/PNJ. Géométries en cache par modèle,
  pool de véhicules recyclés par le trafic.
- Plaques : pool de 48 textures canvas SIV pondérées Île-de-France.

## Trafic (`traffic.js`)

- Suivi type **IDM** (interdistance, freinage confort), tri par abscisse,
  le joueur est un obstacle comme les autres.
- Changements de voie : envie (leader lent, agressivité) + créneau accepté,
  transition lissée 1,6 s avec lacet visible. Rabattement forcé avant fermeture.
- **Interfile** : les deux-roues remontent entre les voies 0-1/1-2 avec slalom.
- Densité = vagues lentes (parfois vide, parfois dense) × difficulté du tour ;
  **bouchons fantômes** qui remontent le flux, décalés par voie pour que ça
  rampe toujours (jamais > 10 s à l'arrêt), et se dissipent.
- Chauffards rares (RS 6, M5, C 63 S) à 80-110 km/h. Sens extérieur décoratif.
- Difficulté par tour : +14 % densité, +5 pts chauffards/motos, événements ×1,2.

## Collisions & dégâts (`game.js`, `player.js`)

- Rectangles orientés en espace piste (Δs, Δlatéral) : véhicules, cônes,
  balises, véhicules accidentés, glissières (butées latérales).
- Sévérité = vitesse relative + composante latérale → 3 niveaux narrés
  (accrochage/accident/gros accident), **déformation de sommets** au point
  d'impact (géométrie clonée du joueur), fissures (overlay), fumée/étincelles
  (sprites poolés), ralenti 0,22× pendant 1,15 s, vibration haptique, sons.
- Frôlement : passage < 85 cm à vitesse relative > 3,5 m/s → combo (×10 max).

## Ambiances (`weather.js`)

- Presets interpolés (ciel shader dégradé, brouillard, hémisphérique,
  directionnelle, exposition, lampes, fenêtres, pluie, mouillé).
- Séquence par tour : jour → coucher → nuit → nuit pluvieuse → brouillard →
  pluie. Fondu tunnel dédié (brouillard sombre, sodium).
- Pluie : InstancedMesh de gouttes autour de la caméra ; sol mouillé =
  spéculaire de la chaussée.

## Performance

- Fixe : fog + far réduits, matériaux Lambert/Phong pour le monde,
  Standard uniquement sur les véhicules (env map PMREM studio).
- **Qualité adaptative** : FPS lissé → 3 paliers (pixelRatio 2/1,6/1,15,
  densité trafic ×1/0,8/0,6), auto ou manuel dans Réglages.
- Pooling : véhicules, sprites de fumée, textures plaques/panneaux en cache,
  `dispose()` systématique des segments recyclés.

## Tests

- `?test` : la boucle tourne même onglet caché ; `__periph.step(n)` avance
  n frames de façon déterministe ; `__periph.snap()` renvoie une capture JPEG.
- `tools/devserver.py` accepte `POST /__snap__?name=x` → `tools/snaps/x.jpg`
  (planches de vérification visuelle).
- `tools/carviewer.html` : revue de tous les modèles sous 3 angles.
- Vérifié en headless : boot sans erreur, 60 FPS (0,7-1,2 ms/tick CPU),
  ~270 draw calls en scène dense, collisions → fin de manche + sauvegarde,
  tour complet → difficulté/ambiance, événements → fermetures + annonces HUD/PMV,
  garage (sélection/verrouillage/achat), défis quotidiens.

## Déploiement

GitHub Pages (branche `main`, racine). À chaque mise à jour :
incrémenter `CACHE` dans `sw.js` **et** les `?v=N` d'`index.html`
(le SW précache en `cache: 'reload'` et matche en `ignoreSearch`).
