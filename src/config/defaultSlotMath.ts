import type { SlotMathConfig, SlotPaylineDefinition } from './types';

/**
 * Demo-/Referenz-Auswertung — 20 Premium-Paylines über 5×5, Links-nach-Rechts.
 * Gewinn ab 3 übereinstimmenden Walzen (Wild zählt mit → z. B. 2× Symbol + Wild = 3er).
 *
 * `lineMultipliersBySymbolId`: skaliert so, dass `floor(mult * bet / referenceBet)`
 * der Paytable aus `gears_clash_slot_design_analysis_and_gameplay_direction.md` entspricht
 * (Tiers siehe `gears_clash_symbol_tier_structure_final.md`: 5 LOW / 3 MID / 2 HIGH).
 * (Werte × Linieneinsatz = totalBet/20 bei referenceBet 100).
 *
 * Winlines basieren auf dem 5×5 Grid-Schema (docs/5x5 Grid + editierbare 20 Winlines.md):
 * [01][02][03][04][05]  → Row 0
 * [06][07][08][09][10]  → Row 1
 * [11][12][13][14][15]  → Row 2 (Center)
 * [16][17][18][19][20]  → Row 3
 * [21][22][23][24][25]  → Row 4
 */
const LINES = 20;

/**
 * 20 Gewinnlinien — jede Linie hat genau 5 Positionen (eine pro Spalte).
 * `rows[i]` gibt die 0-basierte Zeilenposition für Spalte `i` an.
 */
const paylines: readonly SlotPaylineDefinition[] = [
  { id: 'L01', name: 'Top Line', type: 'straight', rows: [0, 0, 0, 0, 0] },
  { id: 'L02', name: 'Upper Mid', type: 'straight', rows: [1, 1, 1, 1, 1] },
  { id: 'L03', name: 'Center Line', type: 'straight', rows: [2, 2, 2, 2, 2] },
  { id: 'L04', name: 'Lower Mid', type: 'straight', rows: [3, 3, 3, 3, 3] },
  { id: 'L05', name: 'Bottom Line', type: 'straight', rows: [4, 4, 4, 4, 4] },
  { id: 'L06', name: 'Downward Diagonal', type: 'diagonal', rows: [0, 1, 2, 3, 4] },
  { id: 'L07', name: 'Upward Diagonal', type: 'diagonal', rows: [4, 3, 2, 1, 0] },
  { id: 'L08', name: 'Soft Wave Upper', type: 'zigzag', rows: [1, 2, 1, 2, 1] },
  { id: 'L09', name: 'Soft Wave Lower', type: 'zigzag', rows: [3, 2, 3, 2, 3] },
  { id: 'L10', name: 'Center V', type: 'v', rows: [2, 1, 2, 1, 2] },
  { id: 'L11', name: 'Center Inverted V', type: 'v', rows: [2, 3, 2, 3, 2] },
  { id: 'L12', name: 'Upper Aggressive Zigzag', type: 'zigzag', rows: [0, 1, 0, 1, 0] },
  { id: 'L13', name: 'Lower Aggressive Zigzag', type: 'zigzag', rows: [4, 3, 4, 3, 4] },
  { id: 'L14', name: 'Upper M Pattern', type: 'zigzag', rows: [1, 0, 1, 0, 1] },
  { id: 'L15', name: 'Lower W Pattern', type: 'zigzag', rows: [3, 4, 3, 4, 3] },
  { id: 'L16', name: 'Crusher Pattern', type: 'industrial', rows: [1, 2, 3, 2, 1] },
  { id: 'L17', name: 'Reverse Crusher', type: 'industrial', rows: [3, 2, 1, 2, 3] },
  { id: 'L18', name: 'Gear Rotation Left', type: 'industrial', rows: [2, 1, 0, 1, 2] },
  { id: 'L19', name: 'Gear Rotation Right', type: 'industrial', rows: [2, 3, 4, 3, 2] },
  { id: 'L20', name: 'Core Reactor', type: 'hero', rows: [0, 1, 2, 1, 2] },
];

export const defaultSlotMath: SlotMathConfig = {
  minMatchLength: 3,
  referenceBet: 100,
  scatterMinBonus: 3,
  scatterBonusResolutionOrder: [
    'gears_clash',
    'heist_run',
    'deadlock_mode',
  ],
  paylines,
  /** [3 OAK, 4 OAK, 5 OAK] — Demo skaliert mit Faktor referenceBet / LINES zur Paytable × Linieneinsatz */
  lineMultipliersBySymbolId: (() => {
    const s = (a: number, b: number, c: number) =>
      [
        (100 * a) / LINES,
        (100 * b) / LINES,
        (100 * c) / LINES,
      ] as const;
    return {
      bolt: s(0.02, 0.1, 0.2),
      nut: s(0.02, 0.1, 0.2),
      fuse: s(0.02, 0.1, 0.2),
      valve: s(0.02, 0.1, 0.2),
      cable: s(0.02, 0.1, 0.2),
      steam_piston: s(0.1, 0.5, 1.0),
      fuel_canister: s(0.1, 0.5, 1.0),
      reactor_pipe: s(0.1, 0.5, 1.0),
      overdrive_core: s(0.2, 1.0, 2.0),
      quantum_chamber: s(0.4, 2.0, 4.0),
      wild_gear: s(1.0, 2.5, 4.0),
      /**
       * gears_vs ist Feature-Trigger, kein normales Pay-Symbol.
       * Server-Logik entscheidet über Expand; hier sehr niedrige Basispay
       * als Fallback falls Server es doch regulär bewertet.
       */
      gears_vs: s(0.01, 0.05, 0.1),
    };
  })(),
};
