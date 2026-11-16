// Sundown Plaza: a business-park square at dusk, built for long sniper sightlines. The Gentlemen
// come in from the south between the restaurant and the club; the Night Shift hold the north,
// in front of the school, the office tower and the clinic. Four scaffold towers (stairs up to a
// railed deck five metres high) watch the plaza, crates and container stacks break it into
// lanes, and the glitter charge goes down at site A (by the school) or site B (by the clinic).
// Every solid thing is a box: [x0, z0, x1, z1, top, kind, bottom].

export const BOUNDS = { x0: -60, z0: -46, x1: 60, z1: 46 };

const raw = [
  // Perimeter fence.
  [-61, -47, 61, -46, 10, 'perimeter'],
  [-61, 46, 61, 47, 10, 'perimeter'],
  [-61, -47, -60, 47, 10, 'perimeter'],
  [60, -47, 61, 47, 10, 'perimeter'],
  // Buildings round the square.
  [-58, -46, -40, -34, 9, 'school'],
  [40, -46, 58, -36, 8, 'clinic'],
  [-8, -46, 8, -38, 14, 'office'],
  [-58, 36, -42, 46, 7, 'restaurant'],
  [42, 34, 58, 46, 7, 'club'],
  [-8, 43, 8, 46, 6, 'bank'],
  // The middle of the plaza.
  [-16, 2, -6, 10, 5, 'cafe'],
  [6, -10, 14, -3, 4, 'kiosk'],
  // The founder's monument blocks the long look straight down the middle.
  [-2.5, -2.5, 2.5, 2.5, 7, 'monument'],
  // Screens in front of each spawn, a gap in the middle of each.
  [-12, 32, -2, 33, 3, 'screen'],
  [2, 32, 12, 33, 3, 'screen'],
  [-12, -27, -2, -26, 3, 'screen'],
  [2, -27, 12, -26, 3, 'screen'],
  [-30, 8, -20, 9, 1.2, 'hedge'],
  [20, 10, 30, 11, 1.2, 'hedge'],
  [-26, -6, -24, 4, 1.2, 'hedge'],
  [24, -4, 26, 6, 1.2, 'hedge'],
  // Container stacks.
  [-46, 10, -40, 12.6, 5.2, 'container2'],
  [40, 8, 46, 10.6, 5.2, 'container2'],
  [-10, 22, -4, 24.6, 2.6, 'container'],
  [12, 20, 18, 22.6, 2.6, 'container'],
  [30, -30, 36, -27.4, 2.6, 'container'],
  [-36, -32, -30, -29.4, 2.6, 'container'],
  // Site A crates.
  [-40, -22, -38.4, -20.4, 1.3, 'crate'],
  [-33, -15, -31.4, -13.4, 1.3, 'crate'],
  [-37, -12, -35.4, -10.4, 2.6, 'crate2'],
  // Site B crates.
  [38, -20, 39.6, -18.4, 1.3, 'crate'],
  [31, -13, 32.6, -11.4, 1.3, 'crate'],
  [35, -10, 36.6, -8.4, 2.6, 'crate2'],
  // Crates scattered over the plaza.
  [-20, 20, -18.4, 21.6, 1.3, 'crate'],
  [22, 24, 23.6, 25.6, 1.3, 'crate'],
  [-6, -20, -4.4, -18.4, 1.3, 'crate'],
  [8, 16, 9.6, 17.6, 1.3, 'crate'],
  [-48, -6, -46.4, -4.4, 1.3, 'crate'],
  [47, -2, 48.6, -0.4, 1.3, 'crate'],
  [-14, -26, -12.4, -24.4, 1.3, 'crate'],
  [16, -28, 17.6, -26.4, 1.3, 'crate'],
];

/** A scaffold tower: a 4 x 4 m deck at 5 m, stairs running off one side, a rail round the rest. */
const TOWER_TOP = 5;
const STEPS = 10;
const STEP_RUN = 0.77;
export const TOWERS = [
  { id: 'T1', x: -24, z: -30, stairs: 1, side: 'def' },
  { id: 'T2', x: 24, z: -30, stairs: -1, side: 'def' },
  { id: 'T3', x: -26, z: 30, stairs: 1, side: 'atk' },
  { id: 'T4', x: 26, z: 30, stairs: -1, side: 'atk' },
];

for (const t of TOWERS) {
  raw.push([t.x - 2, t.z - 2, t.x + 2, t.z + 2, TOWER_TOP, 'tower']);
  // Stairs along the deck's edge nearest the middle of the map, climbing toward the deck.
  const zEdge = t.z < 0 ? t.z - 2 : t.z + 0.6;
  for (let i = 0; i < STEPS; i++) {
    const near = t.stairs > 0 ? t.x + 2 + i * STEP_RUN : t.x - 2 - (i + 1) * STEP_RUN;
    raw.push([near, zEdge, near + STEP_RUN, zEdge + 1.4, TOWER_TOP - i * (TOWER_TOP / STEPS), 'step']);
  }
  // Rails: chest-high, so a crouched sniper hides and a standing one sees over.
  const rail = TOWER_TOP + 1.05;
  raw.push([t.x - 2, t.z - 2, t.x + 2, t.z - 1.8, rail, 'rail', TOWER_TOP]);
  raw.push([t.x - 2, t.z + 1.8, t.x + 2, t.z + 2, rail, 'rail', TOWER_TOP]);
  if (t.stairs > 0) raw.push([t.x - 2, t.z - 2, t.x - 1.8, t.z + 2, rail, 'rail', TOWER_TOP]);
  else raw.push([t.x + 1.8, t.z - 2, t.x + 2, t.z + 2, rail, 'rail', TOWER_TOP]);
  // The stair side keeps a rail beside the stairs' landing, open over the stairs.
  if (t.z < 0) {
    if (t.stairs > 0) raw.push([t.x + 1.8, t.z - 0.6, t.x + 2, t.z + 2, rail, 'rail', TOWER_TOP]);
    else raw.push([t.x - 2, t.z - 0.6, t.x - 1.8, t.z + 2, rail, 'rail', TOWER_TOP]);
  } else if (t.stairs > 0) raw.push([t.x + 1.8, t.z - 2, t.x + 2, t.z + 0.6, rail, 'rail', TOWER_TOP]);
  else raw.push([t.x - 2, t.z - 2, t.x - 1.8, t.z + 0.6, rail, 'rail', TOWER_TOP]);
}

export const SOLIDS = raw.map(([x0, z0, x1, z1, h, kind, y0], id) => ({ id, x0, z0, x1, z1, h, kind, y0: y0 || 0 }));

export const SITES = {
  A: { id: 'A', name: 'Schoolyard', x: -36, z: -17 },
  B: { id: 'B', name: 'Clinic court', x: 36, z: -15 },
};

export const SPAWNS = {
  atk: [
    [-4, 38, 0],
    [0, 39.5, 0],
    [4, 38, 0],
  ],
  def: [
    [-4, -31, Math.PI],
    [0, -32.5, Math.PI],
    [4, -31, Math.PI],
  ],
};

/** Waypoints [x, z, floor height] the bots route on, and the lanes that join them. */
export const NODES = {
  S: [0, 36, 0], SW: [-20, 34, 0], SE: [20, 34, 0],
  T3b: [-15.4, 31.3, 0], T3t: [-25, 30.4, 5], T4b: [15.4, 31.3, 0], T4t: [25, 30.4, 5],
  W0: [-50, 30, 0], W1: [-50, 8, 0], W2: [-50, -12, 0], A1: [-46, -20, 0], Asite: [-36, -18, 0],
  MW0: [-28, 22, 0], MW1: [-32, 0, 0], MW2: [-28, -14, 0],
  C0: [0, 28, 0], C1: [0, 12, 0], C2: [-5, 0, 0], C3: [-2, -12, 0], C4: [0, -24, 0],
  ME0: [28, 22, 0], ME1: [32, 2, 0], ME2: [28, -14, 0],
  E0: [50, 30, 0], E1: [50, 6, 0], E2: [50, -10, 0], B1: [46, -20, 0], Bsite: [36, -16, 0],
  D: [0, -30, 0], T1b: [-13.5, -31.3, 0], T1t: [-24, -30.4, 5], T2b: [13.5, -31.3, 0], T2t: [24, -30.4, 5],
  DW2: [-24, -25, 0], DE2: [24, -25, 0], MWa: [-14, 27, 0], MEa: [14, 25, 0],
};

export const LINKS = [
  ['S', 'SW'], ['S', 'SE'], ['S', 'C0'], ['SW', 'T3b'], ['T3b', 'T3t'], ['SE', 'T4b'], ['T4b', 'T4t'],
  ['SW', 'W0'], ['W0', 'W1'], ['W1', 'W2'], ['W2', 'Asite'], ['W2', 'A1'], ['A1', 'Asite'],
  ['T3b', 'MWa'], ['MWa', 'MW0'], ['MW0', 'MW1'], ['MW1', 'MW2'], ['MW2', 'Asite'], ['MW0', 'C1'],
  ['C0', 'C1'], ['C1', 'C2'], ['C2', 'C3'], ['C3', 'C4'], ['C4', 'D'], ['C3', 'MW2'], ['C3', 'ME2'],
  ['SE', 'E0'], ['E0', 'E1'], ['E1', 'E2'], ['E2', 'Bsite'], ['E2', 'B1'], ['B1', 'Bsite'],
  ['T4b', 'MEa'], ['MEa', 'ME0'], ['ME0', 'ME1'], ['ME1', 'ME2'], ['ME2', 'Bsite'], ['ME0', 'C1'],
  ['D', 'T1b'], ['D', 'T2b'], ['T1b', 'T1t'], ['T2b', 'T2t'],
  ['T1b', 'DW2'], ['DW2', 'Asite'], ['T2b', 'DE2'], ['DE2', 'B1'], ['DE2', 'Bsite'],
];

/** The lanes the Gentlemen push down toward each site. */
export const ROUTES = {
  A: [
    ['SW', 'W0', 'W1', 'W2', 'Asite'],
    ['T3b', 'MWa', 'MW0', 'MW1', 'MW2', 'Asite'],
    ['C0', 'C1', 'C2', 'C3', 'MW2', 'Asite'],
  ],
  B: [
    ['SE', 'E0', 'E1', 'E2', 'Bsite'],
    ['T4b', 'MEa', 'ME0', 'ME1', 'ME2', 'Bsite'],
    ['C0', 'C1', 'C2', 'C3', 'ME2', 'Bsite'],
  ],
};

/** Posts: [x, z, floor height, look-at x, look-at z]. */
export const HOLDS = {
  A: [
    [-24, -30.4, 5, -40, 0],
    [-39.2, -24, 0, -50, 8],
    [-35, -9.4, 0, -28, 22],
  ],
  B: [
    [24, -30.4, 5, 40, 0],
    [40.6, -21, 0, 50, 6],
    [33, -11, 0, 28, 22],
  ],
  mid: [
    [0, -26, 0, 0, 12],
    [-5.2, -17.4, 0, -5, 10],
  ],
  atkTowers: [
    [-25, 30.4, 5, -30, -10],
    [25, 30.4, 5, 30, -10],
  ],
};

/** Decorations the renderer draws; they block nothing. */
export const DECOR = {
  lamps: [[-30, 14], [30, 15], [-44, -14], [44, -12], [0, -16], [0, 18], [-20, 40], [20, 40], [-52, 20], [52, 20]],
  trees: [[-54, 24], [-54, -2], [54, 22], [54, -4], [-22, 14], [22, 16], [-12, 40], [12, 40]],
  benches: [[-10, -14, 0], [10, 12, 1], [-36, 4, 1], [36, 0, 0]],
};
