# Périph' Rush 🏁

**Endless runner de conduite sur le boulevard périphérique parisien.**
Départ Porte Maillot au volant d'une Clio 3 : parcours la plus grande distance,
boucle le plus de tours du périph, frôle le trafic… sans jamais toucher personne.
La moindre collision met fin à la partie.

Jouable directement dans le navigateur, installable en PWA plein écran sur iPhone.

| Jour | Coucher | Nuit | Tunnel |
|---|---|---|---|
| ![jour](docs/img/jour.jpg) | ![coucher](docs/img/coucher.jpg) | ![nuit](docs/img/nuit.jpg) | ![tunnel](docs/img/tunnel.jpg) |

## 🎮 Jouer

- **En ligne** : https://daryl-25.github.io/Periph-Rush/
- **Sur iPhone (recommandé)** :
  1. Ouvre l'URL dans **Safari**.
  2. Bouton **Partager** → **« Sur l'écran d'accueil »**.
  3. Lance « Périph' Rush » depuis l'icône : plein écran, 60 FPS, hors-ligne.

### Commandes
- **◀ / ▶** : direction (gauche de l'écran)
- **GAZ / FREIN** : pédales (droite de l'écran) — accélération automatique activable dans Réglages
- Clavier (desktop) : flèches ou ZQSD/WASD, Espace = frein, P/Échap = pause

## 🚗 Le jeu

- **Périphérique réel (données OpenStreetMap)** : axe exact du sens intérieur
  (34,95 km), nombre de voies réel (sections à 2, 3 et 4 voies, voies
  d'entrecroisement), 35 couvertures et passages sous les portes, viaducs, les deux
  franchissements de la Seine (Bercy, Garigliano), profil en long tranchée/remblai/viaduc.
- **Abords relevés sur Street View (v12)** : tour complet du sens intérieur (100 points de vue,
  `docs/SURVEY-v12.md`) — tranchées en meulière à balustrade (Italie), pierre de taille (Vanves,
  Versailles), dalles claires (Dauphine), talus boisés (bois de Boulogne), garde-corps verts à barreaudage,
  écrans antibruit relevés (beige, blanc tagué, briques, tôle, lames inclinées, médaillons), TPC planté,
  candélabres à crosse en rive et en Y, couvertures au sodium, pont-rail de Clichy avec sa rame,
  passerelles, échangeur de Bagnolet, Zénith, station-service de la Villette, panneaux publicitaires fictifs.
- **72 bretelles réelles** : voies de décélération/accélération, musoirs avec
  atténuateurs de choc, zébras, rampes qui remontent vers les portes.
- **Signalisation française** : présignalisation et portiques d'affectation
  (fond blanc pour les portes, bleu pour les autoroutes, vert pour les itinéraires
  principaux, cartouches A/N rouges et D jaunes) avec les textes réels des panneaux,
  panneaux de musoir, PMV à LED ambre affichant les temps de parcours, losanges de
  la voie réservée au covoiturage, 50 répétés, radars, bornes SOS, plaques PR,
  signaux d'affectation verts dans les couvertures.
- **Ouvrages** : séparateur béton (DBA) avec candélabres doubles et halos au sol la
  nuit, murs de tranchée en béton (coulures, tags, lierre), couvertures éclairées
  sur poteaux, parapets et piles de viaducs, talus, écrans antibruit (métal, verre,
  bois-béton).
- **Abords réels** : ~7 000 bâtiments OSM avec hauteurs (HBM en brique, haussmannien,
  barres, bureaux, logements récents, entrepôts), bois de Boulogne et de Vincennes,
  parcs, terrains de sport, voies ferrées, Seine et canaux, Tribunal de Paris,
  tours Duo, Triangle, Mercuriales, Hyatt Porte Maillot ; ligne d'horizon (Tour Eiffel,
  Sacré-Cœur, Montparnasse, La Défense, Invalides, Parc des Princes, Stade de France).
- **35+ véhicules** modélisés procéduralement, sans logos : Clio 2→6, Mégane, Scénic,
  Trafic, 206→5008, C1/C3/C4, A 250, GLA, C 63 S, Série 1, M5, Yaris/Auris/Corolla,
  A1/A3/Q3, RS 6, T-Max 530/560, X-Max, GS 1250, X-ADV + génériques, taxis, bus,
  fourgons, dépanneuses, véhicules municipaux.
- **Trafic vivant** : IA de suivi (IDM), changements de voie clignotant à l'appui,
  motos en interfile, chauffards rares (RS 6, M5, C 63 S), vagues de densité,
  bouchons fantômes qui redémarrent, insertions aux portes.
- **Événements** : chantiers balisés (cônes, flèche lumineuse, barrières, camion
  municipal) et accidents (véhicules arrêtés, dépanneuse, gyrophares) annoncés
  par panneaux et PMV.
- **Plaques françaises SIV** générées (bande euro + département, Île-de-France
  majoritaire) et plaques étrangères occasionnelles (D, NL, B, CH, L, E, GB).
- **Ambiances** : jour, coucher de soleil, nuit, pluie nocturne, brouillard, pluie —
  l'heure avance à chaque tour, la difficulté aussi (densité, vitesse, motos, événements).
- **Score** : distance × multiplicateur de conduite propre, frôlements en combo,
  bonus vitesse, 25 000 pts par tour. Pièces → déblocage de tout le garage en jouant.
- **Défis quotidiens**, records, statistiques, personnalisation des couleurs.

![véhicules](docs/img/vehicules.jpg)

## 🛠 Développement

Aucun build : HTML/CSS/JS modules + Three.js vendorisé.

```bash
python tools/devserver.py 8814     # http://localhost:8814 (Cache-Control: no-store)
```

- `?test` : mode test (boucle pilotable hors focus + `__periph.step(n)`)
- `tools/carviewer.html` : planches-contact des véhicules
- Architecture détaillée : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### Déployer une mise à jour

1. Incrémenter `CACHE` dans `sw.js` (`periph-vN`) **et** les `?v=N` de `index.html`.
2. `git push` (GitHub Pages sert `main` à la racine).

### Régénérer les données du périphérique

Les extraits OpenStreetMap sont dans `data/` ; `python3 tools/build_periph_data.py`
régénère `js/periph-data.js`.

## 📄 Licence

Jeu original créé avec Claude. Three.js © MIT. Police des panneaux : Barlow Semi
Condensed (SIL OFL, `fonts/`). **Tracé, voies, ouvrages, bâtiments et occupation du
sol : © contributeurs OpenStreetMap, sous licence ODbL** (https://www.openstreetmap.org/copyright). Aucune affiliation avec les
constructeurs automobiles : silhouettes stylisées sans logos ni badges.
