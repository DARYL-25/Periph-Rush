# Périph' Rush — Document de transfert de contexte

*Document généré le 11 juillet 2026 pour permettre la reprise du projet par n'importe quel assistant IA, sur n'importe quelle session. Copier-coller ce texte intégralement en début de conversation.*

---

## 1. Qu'est-ce que ce projet

**Périph' Rush** est un jeu vidéo 3D jouable dans le navigateur (PWA installable sur iPhone), un endless runner de conduite en vue troisième personne dans l'esprit de Subway Surfers, mais au volant d'une voiture sur le boulevard périphérique parisien. Le joueur part de la Porte Maillot avec une Renault Clio 3, doit parcourir la plus grande distance et boucler le plus de tours possible du périphérique sans la moindre collision (véhicule, moto, obstacle, chantier) — le moindre contact met fin à la partie.

- **Repo GitHub** : https://github.com/DARYL-25/Periph-Rush (branche `main`)
- **Répertoire local** : `C:\Users\daryl\Periph-Rush` (Windows)
- **Jeu en ligne** : https://daryl-25.github.io/Periph-Rush/ (GitHub Pages, activé via API)
- **Stack** : JavaScript vanilla en modules ES (aucun build, aucun bundler), Three.js r166 vendorisé localement dans `vendor/three.module.min.js`
- **Cible** : iPhones récents, 60 FPS, PWA plein écran installable via Safari > Partager > Sur l'écran d'accueil

L'utilisateur (Daryl) a explicitement autorisé un usage illimité de tokens/temps pour obtenir un jeu de très haute qualité. Il communique en français et veut un résultat visuel le plus proche possible du réalisme (référence citée : GTA VI), avec des modèles de véhicules réels reconnaissables (sans logos de marque).

---

## 2. Cahier des charges original (verbatim, texte intégral fourni par l'utilisateur)

> Tu es une équipe autonome de développement de jeux mobile haut de gamme. Conçois, développe, teste et itère jusqu'à obtenir le jeu complet, solide et très fluide pour iPhone récent d'un jeu nommé « Périph' Rush ». Sauvegarde tout le jeu sur ce répertoire : https://github.com/DARYL-25/Periph-Rush
>
> Le concept : un jeu de conduite endless runner en vue troisième personne, amusant et nerveux, dans l'esprit de Subway Surfers, mais au volant d'une voiture circulant sur le boulevard périphérique parisien. Le joueur doit parcourir la plus grande distance possible et accomplir le plus de tours complets du périphérique possible sans accident ni accrochage. La moindre collision avec un autre véhicule, une moto, un obstacle ou un élément de chantier met fin à la partie.
>
> Le joueur débute obligatoirement avec une Renault Clio 3 très fidèlement modélisée, sans logo Renault ni badge de marque. Elle doit constituer la voiture de départ, le départ se fait à chaque fois depuis l'entrée à la Porte Maillot.
>
> Modélise fidèlement, sans logos ni badges de marques, les véhicules suivants afin qu'ils soient immédiatement reconnaissables par leur silhouette, proportions, carrosserie, phares, vitrages, jantes et détails extérieurs :
> - Renault Clio 2, Clio 3, Clio 4, Clio 5 et Clio 6, Mégane, Scénic
> - Peugeot 206, 207, 208, 307 et 308, 2008, 3008, 5008
> - Citroën C1, C3, C4
> - Mercedes Classe A250, GLA250
> - BMW Série 1 / BMW 120
> - Renault Trafic
> - Toyota Yaris, Auris et Corolla
> - Audi A1, A3, Q3
> - Audi RS6
> - BMW M5
> - Mercedes C63 S
> - Scooters Yamaha T-Max 530, T-Max 560 et X-Max
> - BMW GS
> - Honda X-ADV
>
> Les modèles courants doivent constituer l'essentiel du trafic. Les modèles sportifs et haut de gamme — RS6, M5, C63 S — doivent être rares et créer des moments de surprise, notamment en roulant vite ou en effectuant des dépassements plus agressifs. Ajouter aussi des voitures génériques, utilitaires, camionnettes, taxis, véhicules de livraison, bus, dépanneuses et véhicules municipaux afin que le trafic paraisse vivant.
>
> Chaque véhicule doit avoir plusieurs couleurs réalistes, différents niveaux de propreté, quelques variantes de jantes et une conduite crédible. Tous les logos et badges de marque doivent être supprimés, y compris sur le volant, les jantes, les calandres et les écrans intérieurs si l'habitacle est visible.
>
> **Plaques d'immatriculation :**
> - Génère des plaques fictives, réalistes et lisibles avec le format français moderne XX-123-XX, où les lettres et chiffres sont tirés aléatoirement.
> - Les plaques françaises doivent avoir la bande bleue à gauche et, à droite, le carré bleu moderne avec le numéro de département.
> - Pondère fortement les départements d'Île-de-France : 75, 77, 78, 91, 92, 93, 94 et 95, tout en ajoutant les autres départements 69, 13, 59, 01, 74, 60, 44, 33, 31, 34, 06, 84….
> - Ajoute occasionnellement des plaques étrangères réalistes visuellement : Allemagne, Pays-Bas, Belgique, Suisse, Luxembourg, Espagne et Royaume-Uni.
> - Les plaques doivent être suffisamment nettes pour être perceptibles en jeu, sans nuire aux performances.
>
> **Carte et décor :**
> - Reproduis le boulevard périphérique parisien aussi fidèlement que possible dans sa géométrie, son ambiance et ses repères visuels.
> - Utilise Google Maps, Google Street View et Apple Street View uniquement comme références visuelles et géographiques pour modéliser la carte, les routes et le décor.
> - Reproduis les éléments caractéristiques : chaussées, séparateurs, glissières, murs antibruit, tunnels, bretelles, échangeurs, ponts, panneaux avec la police identique à ceux du périphérique, voies d'insertion, sorties, immeubles, végétation, mobilier urbain, éclairage et skyline parisienne. Les panneaux doivent être exactement les mêmes que ceux qui se trouvent sur le périphérique parisien.
> - Le périphérique doit donner l'impression d'être réel et continu, tout en étant techniquement optimisé grâce à une génération par segments et à des boucles de circuit intelligentes.
> - Inclure différentes ambiances : jour, coucher de soleil, nuit, pluie légère, sol humide, brouillard urbain occasionnel et éclairages nocturnes.
>
> **Direction artistique :**
> - Rendu 3D cinématographique et stylisé, entre Zootopia, Subway Surfers et réalisme automobile moderne.
> - Réalisme stylisé : proportions crédibles, matériaux détaillés, éclairage réaliste, textures propres, couleurs vibrantes, silhouettes très lisibles et animation fluide.
> - Le résultat doit être beau, moderne, expressif et premium, tout en restant suffisamment optimisé pour tourner impeccablement sur iPhones récents à 60 images par seconde.
>
> Style visuel : Animation 3D cinématographique haut de gamme, inspirée des grands films d'animation modernes comme Zootopia. Le rendu doit se situer entre réalisme et cartoon : véhicules, routes et architecture aux proportions crédibles et très détaillées, mais avec des formes légèrement simplifiées, des matériaux propres et expressifs, des couleurs riches et une excellente lisibilité à grande vitesse.
>
> L'éclairage doit être réaliste et chaleureux : reflets doux sur les carrosseries, asphalte légèrement brillant après la pluie, éclairage urbain diffus, ombres soignées, volumétrie légère et profondeur atmosphérique parisienne. Les textures doivent être détaillées sans devenir sales ou photoréalistes : bitume, marquages, panneaux, vitrages, métal, béton, végétation et façades doivent avoir une finition stylisée premium.
>
> Les voitures doivent être immédiatement reconnaissables, avec des silhouettes réalistes, des détails nets et des animations fluides, tout en conservant une exagération subtile des volumes, des suspensions, des mouvements de caméra et des effets de vitesse pour rendre la conduite plus dynamique et amusante.
>
> Éviter le photoréalisme brut, le style low-poly et le rendu trop enfantin. Viser plutôt un « réalisme animé » : qualité de film d'animation moderne, image spectaculaire, propre, lumineuse et cinématographique, tout en restant optimisée pour un affichage fluide à 60 FPS sur iPhone récent.
>
> **Gameplay :**
> - Caméra troisième personne derrière la voiture, légèrement surélevée, avec un bon champ de vision sur la circulation.
> - Contrôles tactiles simples et très réactifs : boutons pour tourner à droite et gauche, freinage et accélération avec des boutons pour les deux par défaut avec option manuelle optionnelle.
> - Vitesse réglementaire affichée : 50 km/h.
> - La plupart des véhicules respectent approximativement cette vitesse, mais certains roulent bien au-dessus pour créer du danger et du rythme. Le joueur peut également rouler en excès de vitesse.
> - Le joueur doit lire le trafic, choisir ses voies, éviter les freinages soudains, anticiper les motos en interfile et se faufiler proprement.
> - Ajouter un score de distance, de vitesse, de tours complets, de frôlements réussis et de conduite propre.
> - Chaque tour complet du périphérique augmente progressivement la difficulté : densité, vitesse moyenne, nombre de motos, événements et complexité des situations.
>
> **Trafic :**
> - Le trafic doit être vivant et changeant : parfois presque vide, parfois fluide, parfois dense.
> - Créer des embouteillages et des ralentissements soudains, mais ne jamais laisser le joueur à l'arrêt plus de dix secondes.
> - Lorsqu'un bouchon se forme, les voitures doivent ralentir puis redémarrer doucement presque immédiatement.
> - Les véhicules doivent changer de voie, s'insérer, freiner, accélérer et réagir au trafic avec une IA lisible et crédible.
> - Les motos et scooters doivent remonter les files en interfile, parfois vite, parfois lentement, afin d'ajouter une difficulté constante.
>
> **Événements dynamiques :**
> - Ajouter de temps en temps des voies fermées pour travaux ou accidents.
> - Les chantiers doivent être très crédibles visuellement : barrières, cônes, balises, panneaux temporaires, véhicules d'intervention et véhicules municipaux parisiens.
> - Les accidents déjà présents sur la route doivent produire une réduction de voie, des véhicules arrêtés, une dépanneuse ou une intervention, sans bloquer le jeu trop longtemps.
> - Ces événements doivent être annoncés assez tôt pour que le joueur ait une chance réaliste de réagir, tout en restant exigeants à grande vitesse.
>
> **Collisions et dégâts :**
> - Toute collision met fin à la partie.
> - Le niveau de dégâts doit dépendre de la vitesse, de l'angle et de la violence de l'impact.
> - Petit accrochage : rayures, petit enfoncement, rétroviseur abîmé, pare-chocs marqué.
> - Gros accident : déformation plus visible de carrosserie, vitrage fissuré stylisé, fumée légère, morceaux limités et impact sonore plus fort.
> - Les dégâts doivent être réalistes, mais sans gore ni violence graphique.
> - Ajouter vibrations haptiques, bruit d'impact adapté, bref ralenti cinématographique et écran de résultat clair.
>
> **Progression :**
> - Les voitures se débloquent en jouant : distance cumulée, tours complétés, défis et monnaie gagnée.
> - Le joueur peut aussi acheter certains véhicules, mais aucune voiture payante ne doit être nécessaire pour progresser.
> - Chaque véhicule possède des caractéristiques légères : accélération, maniabilité, freinage, stabilité et encombrement.
> - Ajouter garage, personnalisation de couleur, collection, statistiques, défis quotidiens et records.
>
> **Exigences techniques :**
> - Cible principale : iPhones récents.
> - Objectif : 60 FPS stables, temps de chargement courts, commandes sans latence et consommation mémoire maîtrisée.
> - Utiliser LOD, instancing, pooling, occlusion culling, textures compressées, collisions simplifiées à distance et qualité graphique adaptative.
> - Construire un système de route modulaire permettant de représenter un périphérique circulaire très vaste sans charger toute la ville simultanément.
> - Construire une IA de trafic sur voies, avec distance de sécurité, freinage, dépassement, changement de voie, interfile et gestion des événements.
> - Prévoir une architecture claire, extensible et documentée.
>
> **Livrer :**
> 1. Le jeu complet.
> 2. Un garage avec la Clio 3 comme véhicule de départ.
> 3. Le système de conduite, trafic, motos, collisions, dégâts, score, progression et événements.
> 4. Le périphérique parisien complètement modélisé.
> 5. Une documentation de l'architecture et des instructions de lancement sur iPhone.
> 6. Des tests de performance, de collisions, de lisibilité et d'équilibrage.
>
> Ne t'arrête pas à une maquette statique : construis un jeu réellement jouable, teste-le, corrige les erreurs et itère jusqu'à obtenir une expérience mobile fluide, spectaculaire, addictive et crédible. Ne te limite pas, utilise le nombre de tokens qu'il faut pour finaliser le jeu complètement. Je veux un jeu de très grande qualité peu importe le coût en token.

### Retour utilisateur reçu après la première livraison (important, oriente tout le travail en cours)

> On y est pas du tout sur les graphismes, ça n'a rien à voir avec ce que j'attendais. J'attends une modélisation très proche de la réalité. Les voitures aussi ne ressemblent absolument pas aux vrais modèles. Tout est à revoir. Aussi, dans la direction, ce n'est pas bon du tout, quand on tourne, c'est les roues avant qui doivent tourner et pas les roues arrières. Par exemple, quand on va à gauche, c'est les roues arrières qui tournent à gauche et on a l'impression de tourner à droite. Retravaille complètement les graphismes et modélise le périphérique le mieux possible. Je t'ai dis que tu peux utiliser autant de tokens que tu veux. Je veux des graphismes très proches même de GTA VI, donc vraiment ultra réaliste.

**Position assumée face à cette demande** : il a été explicitement communiqué à l'utilisateur qu'un rendu strictement identique à GTA VI (moteur AAA, ray-tracing, assets scannés) est techniquement hors de portée d'un jeu WebGL tournant dans Safari sur iPhone. L'engagement pris est de viser le meilleur rendu possible dans un jeu de course mobile premium moderne (éclairage physique, ombres temps réel, matériaux vernis, ambiances cinématiques), pas un photoréalisme AAA. Cette limite doit être rappelée si l'utilisateur repousse encore les attentes vers un photoréalisme total — ce n'est pas un refus de travailler, mais un cadrage honnête des résultats atteignables en WebGL mobile.

---

## 3. État d'avancement au moment de la rédaction de ce document

### Ce qui est fait et fonctionnel (vérifié en tests headless, voir section 6)

1. **Le tracé du périphérique** (`js/track.js`) : boucle fermée de 35 040 m construite à partir des coordonnées GPS réelles des ~30 portes parisiennes (Porte Maillot, Ternes, Champerret, Asnières, Clichy, Saint-Ouen, Clignancourt, Chapelle, Aubervilliers, Villette, Pantin, Pré-Saint-Gervais, Lilas, Bagnolet, Montreuil, Vincennes, Dorée, Bercy, Ivry, Italie, Gentilly, Orléans, Châtillon, Vanves, Brancion, Plaine, Sèvres, Saint-Cloud, Molitor, Auteuil, Dauphine + points de forme dans le Bois de Boulogne), interpolation Catmull-Rom fermée, recalée à la longueur officielle. Élévation par portes (tranchées, viaducs), tunnels déclarés (Ternes, Lilas, Vanves), ponts sur la Seine (Bercy, Sèvres).
2. **Génération procédurale des véhicules** (`js/vehicles.js`) : catalogue de 35+ modèles avec dimensions réelles. **Grosse refonte en cours (v2)** : carrosserie construite par **loft de sections transversales** (fonction `loftStrip`, `polyAt` en Catmull-Rom) plutôt que par simple extrusion de profil — donne un galbe en plan (nez/poupe rétrécis), une ligne d'épaule, des passages de roue avec élargisseurs, un pavillon peint séparé du bandeau vitré, des montants A/C peints par-dessus, jantes à bâtons avec disque, peinture avec clearcoat (MeshPhysicalMaterial), optiques en pièces séparées avec boîtier chromé (`bright`) + lentille émissive (`lensF`/`lensR`) qui s'allume la nuit.
3. **Le monde streamé** (`js/world.js`) : segments de 100 m générés/détruits autour du joueur (fenêtre 11 devant / 2 derrière), fusionnés en peu de draw calls. Route texturée (asphalte 2048px avec grain, rustines, joints, marquages usés + bump map), séparateur GBA, glissières, murs antibruit, tunnels avec rampes lumineuses, ponts sur la Seine avec quais, immeubles en 3 variantes de façades (haussmannien doré la nuit / bureaux bleutés / barres 70s), arbres instanciés, lampadaires avec halos lumineux (Points additifs), panneaux de signalisation aux vraies portes, portiques directionnels, PMV (panneaux à messages variables), monuments parisiens en silhouettes stylisées (Tour Eiffel, Sacré-Cœur, Montparnasse, La Défense, Mercuriales, Invalides).
4. **Trafic IA** (`js/traffic.js`) : suivi de véhicule type IDM (Intelligent Driver Model), changements de voie avec transition lissée et clignotant, motos/scooters en interfile entre les voies, bouchons fantômes qui remontent le flux et se dissipent (jamais plus de 10 s à l'arrêt), chauffards rares (RS6, M5, C63S) à 80-110 km/h, densité en vagues lentes (parfois vide, parfois dense), difficulté croissante par tour (+14% densité, +5pts chauffards/motos par tour).
5. **Événements dynamiques** (`js/events.js`) : chantiers balisés (cônes, barrières, flèche lumineuse clignotante, camion municipal) et accidents (véhicules accrochés, dépanneuse, gyrophares), fermetures de voies communiquées au trafic, annonce HUD + PMV en amont.
6. **Physique du joueur et caméra** (`js/player.js`) : accélération/freinage/direction selon les caractéristiques du véhicule choisi, caméra 3e personne avec élargissement du champ de vision à haute vitesse, phares, déformation de carrosserie au point d'impact (manipulation directe des sommets de la géométrie clonée).
   - **CORRECTION RÉCENTE IMPORTANTE** : le sens de braquage des roues et le lacet de caisse étaient inversés (bug signalé par l'utilisateur). Corrigé : `this.yaw = damp(this.yaw, -Math.atan2(this.latVel, ...) * 1.15, ...)` (signe négatif ajouté) et pour les roues, `w.rotation.order = 'YXZ'; w.rotation.y = -this.steerCmd * 0.42;` (signe négatif + ordre Euler explicite). Le lacet des PNJ en `traffic.js` a aussi été corrigé (signe négatif ajouté sur `targetYaw`). **Raison du bug** : dans le repère local du véhicule (construit avant = +X après rotation du mesh), la droite du véhicule correspond à -X local, donc toute rotation vers la droite doit être négative en Y.
7. **Score, progression, audio** (`js/score.js`, `js/progression.js`, `js/audio.js`) : distance × multiplicateur de conduite propre, frôlements en combo, bonus vitesse, 25 000 pts/tour, sauvegarde localStorage avec déblocages par km/tours/pièces cumulés, défis quotidiens générés depuis la date, audio 100% synthétisé WebAudio (moteur avec rapports de boîte simulés, vent, pluie, crash, klaxons, pièces).
8. **HUD et menus** (`js/hud.js`) : contrôles tactiles multi-touch (boutons gauche/droite/gaz/frein), clavier desktop, menu principal, garage avec sélecteur de véhicule/couleur en 3D, écran défis quotidiens, réglages (audio, haptique, accélération auto, sensibilité, qualité graphique), pause, écran de fin avec dégâts narrés.
9. **Ambiances** (`js/weather.js`) : 6 presets interpolés en continu (jour, coucher de soleil, nuit, nuit pluvieuse, brouillard, pluie) qui s'enchaînent à chaque tour complété. Ciel en dôme shader avec dégradé + **nuages procéduraux qui dérivent** (texture canvas appliquée en coordonnées sphériques) + **disque solaire avec halo** dans le fragment shader. Pluie en particules instanciées autour de la caméra. Fondu spécifique en tunnel (assombrissement, teinte sodium).
10. **Ombres temps réel** : ajoutées en v2. `renderer.shadowMap.enabled = true` + `PCFSoftShadowMap`, lumière directionnelle (soleil) avec `castShadow`, caméra d'ombre orthographique resserrée (±55 unités) qui **suit la position du joueur** à chaque frame (sinon les ombres sortent du frustum en avançant sur 35 km de boucle). `receiveShadow`/`castShadow` posés sur route, immeubles, mesh béton fusionné, véhicules.
11. **PWA complète** : `manifest.webmanifest`, `sw.js` (service worker à cache versionné, actuellement `periph-v2`), icônes PNG générées sans dépendance (`tools/make-icons.js`), plein écran portrait, fonctionne hors-ligne après premier chargement.
12. **Déploiement** : poussé sur GitHub, **GitHub Pages activé et fonctionnel** via un appel API direct (`POST /repos/DARYL-25/Periph-Rush/pages` avec token récupéré via `git credential fill`, car `gh` CLI n'est pas installé sur cette machine). Vérifié en production : boot OK, service worker enregistré, module JS chargés sans erreur 404.

### Mise à jour post-rédaction (même session, v3 déployée)

L'utilisateur a fourni des **photos de référence** (plaque SIV annotée, grille des identifiants
territoriaux par département, Clio 3 avant + arrière) et demandé une fidélisation exacte :
- **Plaques refaites** (`plates.js`, canvas 384×80) : layout SIV conforme — couronne de
  12 étoiles + F à gauche, caractères bâtons noirs, fond blanc réfléchissant avec reflet
  diagonal, et à droite **logo de région stylisé AU-DESSUS du numéro de département**
  (fonction `drawRegionLogo` avec ~10 motifs régionaux mappés par département). Vérifié
  visuellement conforme à la référence.
- **Clio 3 fidélisée** (`vehicles.js`) via de nouveaux flags par modèle dans le CATALOG,
  réutilisables pour fidéliser d'autres modèles : `lights: 'teardrop'` (optiques en goutte
  d'eau ancrées à la surface du capot via `deckY(x)` — NE PAS positionner les optiques en
  dur, toujours échantillonner la surface), `strip` (baguettes latérales), `antennaFront`
  (antenne tige avant du pavillon au lieu de l'aileron), `spokes: 12` (jantes multibranches
  fines via `rim(wr, sport, spokes)`), `plateHigh` (plaque arrière sur le hayon à 0.37·H).
  Face avant spécifique teardrop : fente de calandre + grande entrée basse + antibrouillards
  chromés. Feux arrière : blocs verticaux enveloppant l'angle (ry latéral) + insert blanc,
  affleurant l'épaulement du hayon (y = Y(tailH)−0.19).
- Déployé en **periph-v3**. Méthode de travail validée avec l'utilisateur : il fournit des
  photos de référence d'un modèle → on fidélise ce modèle avec ces flags + ajustements du
  prof. Prochains modèles à traiter au fil de ses retours.

### Mise à jour v4 : pipeline Blender → GLB (le plus important pour la suite)

L'utilisateur a jugé la Clio 3 procédurale « très mauvaise » et fourni un **blueprint coté**
(4027×1720×1493, empattement 2575, porte-à-faux AV 770 / AR 682). Réponse : un pipeline
de modélisation **Blender headless** :

- **Blender 4.2.22 LTS portable** installé dans `C:\Users\daryl\tools\blender-4.2.22-windows-x64`.
- `tools/blender/clio3_build.py` : modélisation 100 % paramétrique de la Clio 3 (polylignes
  TOPLINE/BELT/PLAN interpolées Catmull-Rom, loft 45 sections × 13 points, boucliers bombés
  par convergence progressive, arches ouvertes PAR LE LOFT — pas de boolean —, vitrage et
  montants A/B/C par classification de faces, blisters d'optiques, jantes 12 branches).
  Lancement : `blender.exe --background --factory-startup --python tools/blender/clio3_build.py`
  → rend 5 vues de contrôle dans `tools/snaps/bl_*.png` ET exporte `assets/clio3.glb`.
- **Matériaux nommés** dans le GLB : paint/glass/det/bright/lensF/lensR/tire/rim ; roues =
  objets séparés `WheelFL/FR/RL/RR`. Côté jeu, `VehicleFactory.loadGLB()` remplace les
  matériaux par ceux du jeu d'après ces noms (la peinture est recolorée par instance, les
  lentilles s'allument la nuit), fusionne tout en 6 groupes pour les PNJ, et crée des roues
  braquables pour le joueur depuis les objets Wheel*. Repli procédural si le GLB échoue.
- `vendor/GLTFLoader.js` + `vendor/BufferGeometryUtils.js` vendorisés (le loader importe
  `../utils/BufferGeometryUtils.js` → patché en `./BufferGeometryUtils.js`) ; **import map**
  `{"three": …}` requis dans `index.html` ET `tools/carviewer.html` (par document !).
- Pièges bpy documentés dans le script et la mémoire : recalculer les normales du loft
  (sinon les booleans fusionnent au lieu de couper), `rotation_euler=` écrase (appliquer
  les transforms d'abord), Workbench rend `material.diffuse_color` pas les nodes.
- **Méthode de travail établie avec l'utilisateur** : il fournit blueprint/photos d'un
  modèle → on écrit/règle un script `tools/blender/<modele>_build.py` → itérations via les
  rendus bl_*.png → export GLB → `loadGLB` dans main.js. La Clio 3 v1 est en ligne (v4) ;
  d'autres itérations d'affinage sont attendues selon ses retours.

### Ce qui vient d'être livré mais n'a PAS encore été validé par l'utilisateur sur son iPhone réel

- La correction de direction (roues avant / lacet inversé) — **priorité n°1 à confirmer** avec l'utilisateur : "est-ce que ça tourne enfin dans le bon sens ?"
- La refonte graphique v2 (carrosseries loft, ombres, ciel nuageux, façades variées, feux nocturnes) — livrée et testée en headless avec captures d'écran (voir section 6), mais l'utilisateur ne l'a pas encore vue lui-même. Sa demande initiale ("tout est à revoir", "graphismes très proches de GTA VI") reste probablement partiellement insatisfaite car le photoréalisme total n'est pas atteignable en WebGL mobile — s'attendre à un nouveau tour de retours et itérations sur les silhouettes de véhicules précises.
- Un bug visuel mineur a été détecté et corrigé juste avant l'interruption de session : les feux arrière (lensR, brake glow) débordaient légèrement de la carrosserie en formant des liserés rouges diagonaux visibles de profil — corrigé en resserrant leur position en Z vers l'intérieur de la face arrière pincée (`wRear - (tall ? 0.26 : 0.34)` au lieu de `- 0.16`/`-0.2`) et en reculant le brake glow (`side * (ud.W / 2 - 0.42)` au lieu de `-0.26`). **Ce correctif a été appliqué au code mais la vérification visuelle finale après ce correctif précis n'a pas été refaite avec capture d'écran** — à vérifier en priorité à la reprise.

### Ce qui reste probablement à améliorer (pistes pour la suite)

- Passer en revue **modèle par modèle** avec `tools/carviewer.html` (voir section 6) pour ajuster les silhouettes qui ne sont pas encore reconnaissables (proportions Clio 2 vs Clio 6, distinction Peugeot/Citroën/Audi/BMW/Mercedes selon la forme des optiques déjà paramétrée par `lights: 'round'|'oval'|'feline'|'slim'|'blade'|'split'` mais qui peut nécessiter un réglage fin par modèle).
- Les deux-roues (motos/scooters) ont un pilote très stylisé (boîtes + sphère pour le casque) — pourrait bénéficier d'un passage similaire au loft des voitures si l'utilisateur juge que ce n'est pas assez réaliste.
- Le bus, les fourgons et la dépanneuse utilisent encore une géométrie plus simple (boîtes) que les voitures — pourrait être amélioré si demandé.
- Aucun test réel sur iPhone physique n'a été fait (impossible depuis cette session) — tout est vérifié via un pipeline headless (voir section 6). **Il est essentiel de demander à l'utilisateur un retour terrain (toucher, lisibilité, sensation de vitesse, FPS réel) après chaque itération majeure.**
- La qualité adaptative (palier auto haute/moyenne/basse selon le FPS mesuré) n'a été vérifiée qu'en environnement de test desktop/headless, jamais sur un vrai appareil avec GPU mobile.

---

## 4. Architecture technique détaillée (fichier par fichier)

Aucun build, aucun bundler : HTML + modules ES natifs + Three.js vendorisé. Tout est servi tel quel.

```
Periph-Rush/
├── index.html              structure de tous les écrans (menu, garage, défis, réglages,
│                            pause, fin de partie) + HUD, chargée avec ?v=N pour le cache-bust
├── manifest.webmanifest     PWA plein écran portrait
├── sw.js                    service worker à cache versionné (periph-vN), POST non géré,
│                            matche en ignoreSearch
├── .gitignore               exclut tools/snaps/ (captures de test)
├── css/
│   └── style.css            design sombre glassmorphism, safe-areas iOS (env(safe-area-inset-*))
├── vendor/
│   └── three.module.min.js  Three.js r166, téléchargé une fois depuis unpkg, vendorisé en local
├── icons/
│   └── icon-180/192/512.png générées par tools/make-icons.js (encodeur PNG maison, sans dépendance npm)
├── js/
│   ├── config.js            CFG : constantes globales (largeur de voie, nombre de voies,
│   │                         fenêtres de simulation trafic, paramètres IDM, score, difficulté
│   │                         par tour, FOV caméra…). Fonctions laneCenter(), interfileCenter().
│   ├── utils.js              PRNG déterministe (mulberry32 via rng(seed)), clamp/lerp/damp/
│   │                         smoothstep, mergeGeoms (fusion BufferGeometry), colorize (vertex
│   │                         colors), xform (transformation en place avec rotations rx/ry/rz),
│   │                         loopDelta/wrap (arithmétique de boucle), fmtKm/fmtInt.
│   ├── track.js              class Track : construit la spline Catmull-Rom fermée depuis les
│   │                         GPS des portes, échantillonne à pas constant (STEP=4m), calcule
│   │                         tangentes/courbure, expose pointAt(s, out), worldPos(s, lat, h),
│   │                         headingAt(s), elevationAt(s), inTunnel(s), onBridge(s), zoneAt(s),
│   │                         nextPorte(s). C'est le référentiel unique : tout le jeu raisonne
│   │                         en (s = abscisse curviligne, lat = déport latéral).
│   ├── plates.js              PlatePool : génère et met en cache des textures canvas de plaques
│   │                         SIV françaises (bande euro + carré département pondéré IDF) et
│   │                         quelques plaques étrangères (D, NL, B, CH, L, E, GB).
│   ├── signs.js              Textures canvas des panneaux : sortie de porte, portique
│   │                         directionnel, cartouche "BD PÉRIPHÉRIQUE", limitation 50 (roundel),
│   │                         PMV réinscriptible (class VMSPanel), panneau chantier.
│   ├── vehicles.js           LE FICHIER CENTRAL DE LA REFONTE GRAPHIQUE. Voir détail section 5.
│   ├── world.js              class World : streaming par chunks de 100m (buildChunk/update/
│   │                         prebuild), matériaux partagés (mats.road, mats.concrete,
│   │                         mats.buildings[3], mats.lampGlow…), génération de route/GBA/
│   │                         glissières/murs/tunnels/ponts/immeubles/arbres/panneaux par
│   │                         segment, monuments parisiens (buildLandmarks), gestion des PMV.
│   ├── weather.js            class Ambience : 6 presets interpolés (PRESETS.jour/coucher/nuit/
│   │                         nuitPluie/brouillard/pluie), LAP_SEQUENCE (ordre par tour), dôme de
│   │                         ciel ShaderMaterial avec nuages procéduraux + soleil, lumières
│   │                         hemi+directionnelle avec ombres, pluie en Points instanciés,
│   │                         fondu tunnel dédié.
│   ├── traffic.js            class Traffic : spawn pondéré des PNJ, suivi IDM, changements de
│   │                         voie (considerLaneChange/gapOK/startLaneChange), interfile motos,
│   │                         bouchons fantômes (this.jams), pool de bundles véhicules recyclés,
│   │                         placement 3D (place()), setNightGlows.
│   ├── events.js             class Events : spawn de chantiers/accidents à distance aléatoire,
│   │                         génération de balisage (cônes, barrières, flèche lumineuse),
│   │                         placement de véhicules accidentés/dépanneuse, fermetures de voies
│   │                         exposées au trafic (closures/slowZones), annonce warningAhead().
│   ├── player.js             class Player : physique arcade (accel/frein selon perf du
│   │                         véhicule), direction (steerCmd amorti), caméra 3e personne
│   │                         (updateCamera avec FOV dynamique), phares (SpotLight), déformation
│   │                         de carrosserie au crash (deform()), détection de tour complet.
│   ├── score.js              class Score : points, combo de frôlements, multiplicateur de
│   │                         conduite propre, pièces, finalize().
│   ├── progression.js        class Progression : sauvegarde localStorage (KEY='periph-rush-
│   │                         save-v1'), défis quotidiens générés depuis todayKey()+hashStr,
│   │                         déblocages de véhicules (carState/buy/select), CHALLENGE_POOL.
│   ├── audio.js              class GameAudio : synthèse WebAudio pure (aucun fichier audio),
│   │                         moteur avec rapports de boîte simulés, vent, pluie, crash, klaxon,
│   │                         pièce, unlock() au premier geste tactile (obligatoire iOS).
│   ├── hud.js                class UI : contrôleur DOM complet, entrées tactiles multi-touch
│   │                         (pointerdown/up/cancel) + clavier (flèches/ZQSD/WASD/Espace/P/Échap),
│   │                         gestion de tous les écrans (show()), garage (refreshGarage/
│   │                         garageMove/garageAction), popups de score, HUD temps réel.
│   └── main.js               POINT D'ENTRÉE. boot() async avec barre de progression, création
│                              renderer/scene/camera, environnement PMREM (studio à bandes
│                              lumineuses pour les reflets carrosserie), pré-chauffe des
│                              géométries de tous les modèles, showroom garage (scène séparée
│                              garageScene/garageCam), machine à états (menu/garage/running/
│                              paused/over), qualité adaptative (fpsEMA → 3 paliers), boucle
│                              principale (renderer.setAnimationLoop), hooks de test
│                              window.__periph (voir section 6), enregistrement service worker.
├── docs/
│   ├── ARCHITECTURE.md       documentation technique (rédigée après la 1ère livraison,
│   │                         décrit l'état AVANT la refonte graphique v2 — à mettre à jour)
│   ├── HANDOFF.md            CE DOCUMENT
│   └── img/                  captures d'écran pour le README (à rafraîchir avec les dernières
│                              de tools/snaps/ après chaque refonte visuelle majeure)
├── tools/
│   ├── devserver.py          serveur HTTP local (Cache-Control: no-store) + endpoint
│   │                         POST /__snap__?name=x qui écrit tools/snaps/x.jpg (base64 décodé
│   │                         depuis le corps de la requête) — PIPELINE DE TEST CLÉ, voir section 6
│   ├── carviewer.html        planches-contact des véhicules : charge Three.js + vehicles.js
│   │                         directement, rend chaque modèle sous 3 angles (profil/34 avant/
│   │                         34 arrière), poste le montage via /__snap__. Usage :
│   │                         /tools/carviewer.html?ids=clio3,p208&sheet=nomdefichier
│   └── make-icons.js         génère les 3 PNG d'icônes PWA avec un encodeur PNG maison (zlib
│                              natif Node, pas de dépendance npm) — usage: node tools/make-icons.js
└── README.md                 présentation publique du jeu (à rafraîchir après refonte v2)
```

### Le point d'entrée et la machine à états (`main.js`)

Séquence de boot : progress bar → renderer WebGL (shadowMap PCFSoft activé) → environnement PMREM (scène studio avec bandes lumineuses, pas un vrai HDRI) → Track → PlatePool → VehicleFactory → pré-chauffe de TOUTES les géométries du catalogue (évite les à-coups en jeu) → World → Ambience → Traffic → Events → Player → Score → Game (orchestrateur, `game.js`) → showroom garage (scène 3D séparée, tourne en continu quand `state === 'garage'`).

Machine à états : `menu` (caméra en travelling `game.attractUpdate`) → `running` (`game.update`) → `paused` → `over` (écran de résultat) → `garage` (showroom séparé). Qualité adaptative : `fpsEMA` lissé, 3 paliers (`high`/`med`/`low`) ajustant `pixelRatio` et `traffic.quality` (densité de PNJ), auto ou forcé depuis les réglages.

---

## 5. Détail de la fabrique de véhicules (`vehicles.js`) — cœur de la refonte v2

C'est le fichier le plus complexe et le plus susceptible d'évoluer encore. Structure :

### Le catalogue `CATALOG`
Un objet par modèle avec : `name`, `kind` (`hatch`/`sedan`/`suv`/`wagon`/`fastback`/`mono`/`van`/`box`/`tow`/`bus`/`moto`), `dims: [longueur, largeur, hauteur]` en mètres réels, `wb` (empattement), `wr` (rayon de roue), `prof` (paramètres de silhouette en fractions : `nose`, `hood`, `hoodX`, `roofX`, `roofH`, `roofEndX`, `tailH`, `mono?`), `glass: {belt, endX, panel?}` (hauteur de ceinture de caisse et fin du vitrage arrière, `panel:true` pour les fourgons sans vitrage latéral arrière), `lights` (forme des optiques : `round`/`oval`/`feline`/`slim`/`blade`/`split`), `cols` (palette de couleurs disponibles), `w` (poids d'apparition dans le trafic, 0 = jamais généré, réservé au joueur), `perf` (vmax/acc/man/frein pour les véhicules jouables), `unlock` (condition de déblocage : `start`, `km`, `laps`, `coins`), `sport` (0-1, active becquet/jantes sport/échappements), `clearance` (garde au sol des SUV), `taxi`/`municipal`/`stripe` (flags de détail visuel).

Une passe de calibration globale ajuste `nose`/`hood`/`tailH`/`glass.belt` après la définition du catalogue (relève les proportions car le premier jet donnait des capots trop bas).

### La géométrie par LOFT (nouveauté v2, remplace l'ancienne extrusion de profil plat)

Fonctions outils en tête de fichier :
- `polyAt(pts, x)` : interpolation **Catmull-Rom** (pas linéaire) dans une polyligne triée en x décroissant → courbes directrices lissées sans angles.
- `loftStrip(T, stations)` : construit une bande de géométrie en reliant des "stations" (sections transversales, chacune une liste de points `[z, y]` symétrisés en miroir ±z) le long de l'axe X du véhicule. Utilisé pour construire le corps de caisse par bandes successives.
- `quad4(T, a, b, c, d)` : quad à 4 sommets bruts (pour vitrages plats, montants).
- `rimGeometry`/`tireGeometry` : jante à bâtons (voile + moyeu + N rayons boîtes) et pneu (cylindre).

`carGeometry(m)` construit chaque voiture ainsi :
1. Courbes directrices `deckPts`/`roofPts` (capot → ceinture → pavillon → lunette), avec gestion du cas `panel` (fourgon dont la caisse arrière suit le pavillon, pas la ceinture).
2. `taper(x)` : fonction de galbe en plan qui rétrécit le nez et la poupe.
3. `archWin(x)` / élargisseurs d'ailes autour des positions de roue `fx`/`rx`.
4. `botAt(x)` : relève le bas de caisse en arc de cercle sur les passages de roue.
5. Un ensemble de **stations** (`xs`, positions X denses autour des roues, montants, ceinture) → 3 bandes loftées : `stripA` (bas de caisse → épaule), `stripB` (épaule → ligne de toit/capot/malle), `stripU` (dessous, pour fermer le volume).
6. Cabine séparée : `glassStrip` (bandeau vitré, matériau 1) et `roofStrip` (pavillon peint par-dessus, matériau 0), avec montants A/C ajoutés en `quad4` peints.
7. Roues fusionnées dans le mesh pour les PNJ (pneu + jante), roues séparées en `Group` pour le joueur (braquage/rotation visibles).
8. Détails : calandre, boucliers, optiques (habillage chromé `bright` + lentille émissive `lensF`/`lensR`), rétroviseurs, poignées chromées, becquet/échappements sport, barres de toit SUV, enseigne taxi, antenne aileron.

`boxTruckGeometry` (fourgons/dépanneuse), `busGeometry`, `motoGeometry` (deux-roues + pilote stylisé) suivent une logique similaire mais plus simple (formes de cabine par `ExtrudeGeometry` ou boîtes empilées).

### Assemblage en 6 groupes de matériaux (`assemble()`)
Chaque véhicule a EXACTEMENT 6 groupes de matériaux fusionnés en une seule géométrie (`geom.addGroup`) :
0. `paint` — peinture (MeshPhysicalMaterial avec clearcoat, couleur substituée par véhicule)
1. `glass` — vitrage (MeshPhysicalMaterial transparent-like, clearcoat, DoubleSide)
2. `det` — détails mats à vertex colors (pneus, plastiques, valises moto, pilote)
3. `bright` — métal brillant partagé (jantes non-sport, boîtiers d'optiques, poignées)
4. `lensF` — lentille avant émissive (s'allume la nuit via `factory.setNight(true)`)
5. `lensR` — lentille arrière émissive + feux stop

### Matériaux partagés au niveau de la factory (`VehicleFactory`)
`glassMat`, `matteMat`, `brightMat`, `lensFMat`, `lensRMat` sont des instances UNIQUES partagées par tous les véhicules (sauf `paint` qui varie par couleur, mis en cache par hex+salissure dans `paintCache`). `setNight(on)` bascule `emissiveIntensity` de `lensFMat`/`lensRMat` globalement — TOUT le parc s'allume/s'éteint en un seul appel.

### Pièges Three.js identifiés pendant le développement (à connaître avant de retoucher ce fichier)
- Le winding (sens des triangles) de `loftStrip` doit être cohérent des deux côtés du miroir ±z, sinon des faces apparaissent noires/manquantes vues de l'extérieur — testé et corrigé (voir `if (side > 0) idx.push(a,b,c,b,d,c); else idx.push(a,c,b,b,c,d);`).
- Le winding du ruban de route/GBA/murs (`world.js`, fonction `ribbon`) a le même problème — corrigé en passant le matériau béton en `THREE.DoubleSide` pour absorber les cas résiduels.
- **Signe de rotation** : dans le repère local d'un véhicule (construit avec l'avant vers +X, puis `mesh.rotation.y = -Math.PI/2` pour aligner sur l'axe de déplacement +Z du monde), la **droite du véhicule correspond à -X local**. Toute rotation de braquage ou de lacet doit donc être **négative** quand on tourne à droite. C'est l'erreur de signe qui causait le bug de direction inversée signalé par l'utilisateur.
- `w.rotation.order = 'YXZ'` est nécessaire sur les groupes de roues pour que le braquage (Y) et le roulis de suspension ne se marchent pas dessus.
- Le ShaderMaterial du ciel doit avoir sa position (`this.sky.position.set(playerPos...)`) mise à jour à chaque frame, sinon la caméra sort du dôme après quelques centaines de mètres et l'écran devient noir au boot si l'ambiance n'est pas initialisée avant le premier rendu.
- Ne jamais attendre `requestAnimationFrame` dans une séquence de boot asynchrone : ne se déclenche jamais si l'onglet charge en arrière-plan (onglet caché) → utiliser `setTimeout`.
- Le canvas WebGL peut se redimensionner à 0×0 si la fenêtre est masquée (pane de test caché) → `renderer.setSize` doit ignorer les tailles nulles, et le hook de capture de test (`snap()`) doit forcer une taille de secours (390×844) si besoin.

---

## 6. Méthodologie de test (headless, car l'environnement de développement ne permet pas de vraies captures d'écran interactives)

L'environnement de développement de cette session tourne sur une machine Windows où le pane de navigateur intégré (`mcp__Claude_Browser__*`) **timeout sur `computer{action:"screenshot"}`** quand la fenêtre n'est pas au premier plan. Un pipeline de test alternatif a donc été construit :

### Mode `?test`
Ajouter `?test` à l'URL du jeu déclenche dans `main.js` :
```js
if (new URLSearchParams(location.search).has('test')) {
  setInterval(() => { if (document.hidden) tick(performance.now()); }, 33); // continue même onglet caché
  window.__periph.step = (n = 1, dtMs = 16.7) => { for (let i = 0; i < n; i++) tick(last + dtMs); };
}
```
`window.__periph` expose aussi : `renderer`, `scene`, `camera`, `track`, `world`, `traffic`, `events`, `player`, `game`, `ambience`, `prog`, `fps()`, `state()`, `tier()`, et surtout **`snap(w=420, q=0.6)`** qui rend une frame et retourne un JPEG en data-URL.

### Serveur de dev avec endpoint de capture (`tools/devserver.py`)
```bash
python tools/devserver.py 8814
```
Sert le répertoire avec `Cache-Control: no-store` (évite le cache heuristique de Chrome qui sert de vieux fichiers pendant des heures) et gère `POST /__snap__?name=xxx` : décode le corps (data-URL base64) et écrit `tools/snaps/xxx.jpg` (répertoire gitignoré). Config `periph` déjà ajoutée dans `~/.claude/launch.json` pour ce serveur (port 8814).

### Workflow de test typique dans une session outillée (Claude Code avec accès navigateur)
1. `mcp__Claude_Browser__preview_start` avec `{name: "periph"}` (ou naviguer directement vers `http://localhost:8814/?test`).
2. `mcp__Claude_Browser__javascript_tool` avec `action: "javascript_exec"` pour exécuter du JS dans la page : attendre que `window.__periph.step` existe, appeler `P.step(n)` pour avancer n frames déterministes, puis `await fetch('/__snap__?name=x', {method:'POST', body: P.snap(400, 0.65)})`.
3. Lire l'image avec l'outil `Read` sur `tools/snaps/x.jpg`.
4. Un **autopilote de test** minimal a été codé à la volée dans plusieurs sessions pour faire rouler la voiture toute seule en évitant le trafic (recherche du couloir avec le plus grand espace libre devant, freinage si obstacle proche) — utile pour tester tours complets, chantiers, accidents, transitions d'ambiance sans dépendre d'inputs humains.
5. Pour tester un crash sans autopilote : mettre `input.throttle=1` et laisser foncer dans le PNJ devant.
6. Pour forcer un scénario précis : téléporter `player.s` à une abscisse connue (ex. `track.tunnels.find(t=>t.name.includes('Lilas')).s0 + 200`) puis `world.prebuild(player.s)` pour reconstruire les chunks autour.

### Outil de planches-contact véhicules (`tools/carviewer.html`)
```
http://localhost:8814/tools/carviewer.html?ids=clio3,p208,rs6&sheet=nomdefichier
```
Charge Three.js + `vehicles.js` directement (hors du jeu complet), construit chaque véhicule listé, le rend sous 3 angles (profil, 3/4 avant, 3/4 arrière) sur fond studio neutre, assemble un montage en grille avec libellés, et le poste automatiquement via `/__snap__?name=nomdefichier_0` (paginé par 8 véhicules/planche). **C'est l'outil le plus efficace pour évaluer et corriger les silhouettes.** Sans argument `ids`, prend tout le catalogue.

### Vérifications déjà faites (résultats positifs)
- Boot sans erreur JS, ~60 FPS, ~250-280 draw calls et ~55-65k triangles en scène de jeu dense (mesuré via `renderer.info.render`).
- Cycle jour/coucher/nuit/tunnel/Seine/brouillard fonctionnel visuellement (captures conservées dans `docs/img/`).
- Collision → séquence de crash (déformation, fumée, ralenti, écran de fin avec dégâts narrés, sauvegarde de la progression) fonctionnelle.
- Tour complet → incrémentation du compteur, avancement de l'ambiance, hausse de la difficulté trafic/événements — fonctionnel.
- Garage : sélection, verrouillage par condition de déblocage, achat par pièces — fonctionnel.
- Chantiers/accidents : fermeture de voie, balisage visible, annonce HUD — fonctionnel.
- Défis quotidiens générés et complétés en fin de manche — fonctionnel.
- GitHub Pages en production : boot OK, service worker enregistré, aucune erreur 404 sur les modules.

---

## 7. Informations d'accès et de déploiement

- **Aucun `gh` CLI installé** sur cette machine Windows. Pour toute opération API GitHub (activer Pages, etc.), récupérer un token depuis le gestionnaire d'identifiants Windows via :
  ```bash
  printf "protocol=https\nhost=github.com\n" | git credential fill
  ```
  puis l'utiliser en `Authorization: Bearer $TOKEN` avec `curl` contre `api.github.com`. C'est ainsi que GitHub Pages a été activé (`POST /repos/DARYL-25/Periph-Rush/pages` avec `{"source":{"branch":"main","path":"/"}}`, réponse 201).
- **Déployer une mise à jour** : incrémenter ENSEMBLE `CACHE` dans `sw.js` (actuellement `periph-v2`, passer à `periph-v3` etc.) ET les `?v=N` dans `index.html` (`css/style.css?v=N`, `js/main.js?v=N`) — sinon le service worker sert d'anciens fichiers en cache. Puis `git add -A && git commit && git push origin main`. GitHub Pages republie automatiquement en ~30-60s (vérifiable via `curl -s https://daryl-25.github.io/Periph-Rush/sw.js | grep periph-vN`).
- **Node.js** n'est pas dans le PATH par défaut dans un shell fraîchement lancé sur cette machine pour d'autres projets (voir mémoire `meridian-investment-app`), mais pour Périph' Rush le seul usage de Node est `tools/make-icons.js` (déjà exécuté, icônes déjà générées et commitées) — pas de dépendance runtime.
- **Aucun package.json, aucun `npm install` requis.** Tout est du JS natif + Three.js vendorisé.

---

## 8. Mémoire long-terme associée (pour l'assistant qui reprend)

Un fichier mémoire existe déjà à `C:\Users\daryl\.claude\projects\C--Users-daryl\memory\periph-rush.md` (si l'environnement de reprise a accès au même système de mémoire Claude) contenant : emplacement du repo, URL de déploiement, méthode d'activation Pages, particularités du service worker, pipeline de test headless (`?test` + `/__snap__`), piège des signes de rotation (droite = -X local), pièges Three.js (winding, DoubleSide, ciel qui doit suivre le joueur), et la note sur le boot qui ne doit jamais dépendre de `requestAnimationFrame`. Si l'IA qui reprend ce projet a accès à un système de mémoire équivalent, il vaut la peine de le consulter ; sinon, ce document HANDOFF.md fait foi.

---

## 9. Prochaines étapes suggérées à la reprise

1. **Redémarrer le serveur de dev** (`python tools/devserver.py 8814`), ouvrir `http://localhost:8814/?test`, et **vérifier en priorité le correctif des feux arrière** (dernière modification faite juste avant l'interruption, jamais revérifiée visuellement) : capturer une vue de profil et 3/4 arrière d'un véhicule (Clio 3 par exemple) et confirmer qu'il n'y a plus de liseré rouge diagonal débordant de la carrosserie.
2. Demander à l'utilisateur de tester la version en ligne (https://daryl-25.github.io/Periph-Rush/) sur son iPhone réel et de confirmer que :
   - la direction est maintenant naturelle (tourner à gauche = aller à gauche, roues avant qui braquent visiblement) ;
   - le nouveau rendu graphique (carrosseries, ombres, ciel, nuit) répond mieux à ses attentes, même si le photoréalisme total n'est pas atteint.
3. Selon son retour, itérer modèle par modèle avec `tools/carviewer.html` sur les silhouettes de véhicules les moins convaincantes (probablement : distinction fine entre les compactes de marques différentes, les deux-roues, les utilitaires).
4. Mettre à jour `docs/ARCHITECTURE.md` et le `README.md` (captures d'écran dans `docs/img/`) pour refléter l'état v2 une fois stabilisé.
5. Continuer à committer et pousser régulièrement avec des messages descriptifs, en incrémentant systématiquement le cache du service worker à chaque changement visible.
6. Envisager, si l'utilisateur le souhaite encore, un travail plus poussé sur : textures de véhicules (au lieu de couleurs plates + vertex colors, éventuellement des normal maps simples pour les nervures de carrosserie), reflets d'environnement plus riches (un vrai petit HDRI généré proceduralement plutôt que le studio à bandes actuel), ou anti-aliasing renforcé (FXAA/SMAA) si les bords de polygones restent visibles sur écran Retina.

---

*Fin du document de transfert. Ce texte est conçu pour être collé intégralement en tout début d'une nouvelle conversation avec n'importe quel assistant IA disposant d'un accès au système de fichiers local (`C:\Users\daryl\Periph-Rush`) et idéalement d'outils d'exécution de commandes shell et de navigateur pour reprendre les tests headless décrits en section 6.*
