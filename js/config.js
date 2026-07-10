// ============================================================
// Périph' Rush — configuration & équilibrage global
// Toutes les distances sont en mètres, vitesses en m/s (interne).
// ============================================================

export const CFG = {
  // --- Route ---------------------------------------------------
  LANE_WIDTH: 3.5,          // largeur d'une voie
  LANES: 4,                 // voies du sens intérieur (joueur)
  INNER_EDGE: 1.3,          // bord intérieur (côté séparateur) → x latéral min de la chaussée
  DIVIDER_HALF: 0.55,       // demi-largeur du séparateur GBA central
  OUTER_SHOULDER: 0.9,      // accotement extérieur avant la glissière
  ROAD_TEX_REPEAT: 10,      // le motif de marquage se répète tous les N mètres

  // --- Streaming du monde ---------------------------------------
  CHUNK_LEN: 100,           // longueur d'un segment généré
  CHUNKS_AHEAD: 11,         // segments chargés devant le joueur
  CHUNKS_BEHIND: 2,         // segments gardés derrière
  DRAW_DISTANCE: 1050,      // far du brouillard/caméra

  // --- Joueur ----------------------------------------------------
  PLAYER_START_PORTE: 'Porte Maillot',
  SPEED_LIMIT_KMH: 50,
  STEER_SPEED: 9.0,         // vitesse latérale max (m/s) à pleine consigne
  STEER_RESPONSE: 7.5,      // réactivité de la consigne latérale
  LATERAL_MIN: 1.95,        // butée latérale côté séparateur
  // butée extérieure calculée depuis la géométrie de chaussée

  // --- Trafic -----------------------------------------------------
  TRAFFIC_WINDOW_AHEAD: 420,   // simulation des PNJ devant
  TRAFFIC_WINDOW_BEHIND: 160,  // et derrière
  NPC_BASE_COUNT: 26,          // population visée (module la densité)
  ONCOMING_COUNT: 10,          // véhicules décoratifs sens extérieur
  IDM_T: 1.15,                 // temps de sécurité (s)
  IDM_S0: 2.2,                 // interdistance minimale (m)
  IDM_A: 2.2,                  // accélération confort (m/s²)
  IDM_B: 3.0,                  // freinage confort (m/s²)

  // --- Difficulté par tour ------------------------------------------
  LAP_DENSITY_GAIN: 0.14,      // +14 % de densité par tour
  LAP_SPEEDER_GAIN: 0.05,      // +5 pts de % de chauffards par tour
  LAP_MOTO_GAIN: 0.05,         // +5 pts de % de motos par tour
  LAP_EVENT_GAIN: 0.20,        // événements plus fréquents

  // --- Score -----------------------------------------------------
  SCORE_PER_METER: 1,
  NEAR_MISS_DIST: 0.85,        // marge latérale (m) pour un frôlement
  NEAR_MISS_RELSPEED: 3.5,     // vitesse relative mini (m/s)
  NEAR_MISS_SCORE: 250,
  LAP_SCORE: 25000,
  COIN_PER_KM: 14,
  COIN_PER_NEARMISS: 2,
  COIN_PER_LAP: 300,

  // --- Événements ---------------------------------------------------
  EVENT_MIN_GAP: 1800,         // distance min entre événements (m)
  EVENT_MAX_GAP: 3600,
  EVENT_WARN_DIST: 320,        // annonce (panneaux) en amont

  // --- Rendu -----------------------------------------------------
  PIXEL_RATIO_MAX: 2,
  FOV_BASE: 62,
  FOV_SPEED_GAIN: 14,          // élargissement du champ avec la vitesse
};

export const KMH = 3.6;                       // m/s → km/h
export const MS = (kmh) => kmh / 3.6;         // km/h → m/s

// Centre des voies (offset latéral depuis l'axe du séparateur, côté joueur)
export function laneCenter(lane) {
  return CFG.INNER_EDGE + CFG.LANE_WIDTH * (lane + 0.5);
}
export const ROAD_OUTER = CFG.INNER_EDGE + CFG.LANE_WIDTH * CFG.LANES + CFG.OUTER_SHOULDER; // glissière ext.
export const LATERAL_MAX = ROAD_OUTER - 0.72;

// Interfile : les motos remontent entre les voies 0-1 et 1-2
export function interfileCenter(gap) { // gap: 0 → entre v0 et v1, 1 → entre v1 et v2
  return CFG.INNER_EDGE + CFG.LANE_WIDTH * (gap + 1);
}
