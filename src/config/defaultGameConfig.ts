import type { GameConfig } from './types';

/**
 * Standard-Konfiguration — JSON-kompatibel, für Filament/Laravel als JSON speicherbar.
 */
export const defaultGameConfig: GameConfig = {
  grid: { reels: 5, rows: 5 },
  symbols: [
    { id: 'bolt', kind: 'normal', label: 'Bolt' },
    { id: 'nut', kind: 'normal', label: 'Nut' },
    { id: 'gear', kind: 'normal', label: 'Gear' },
    { id: 'coil', kind: 'normal', label: 'Coil' },
    { id: 'piston', kind: 'normal', label: 'Piston' },
    { id: 'wrench', kind: 'normal', label: 'Wrench' },
    { id: 'rivet', kind: 'normal', label: 'Rivet' },
    { id: 'plate', kind: 'normal', label: 'Plate' },
    { id: 'cable', kind: 'normal', label: 'Cable' },
    { id: 'valve', kind: 'normal', label: 'Valve' },
    { id: 'wild_gear', kind: 'wild', label: 'Wild' },
    {
      id: 'bonus_gears_clash',
      kind: 'bonus',
      label: 'Gears Clash',
      bonusId: 'gears_clash',
    },
    {
      id: 'bonus_heist_run',
      kind: 'bonus',
      label: 'Heist Run',
      bonusId: 'heist_run',
    },
    {
      id: 'bonus_deadlock_mode',
      kind: 'bonus',
      label: 'Deadlock',
      bonusId: 'deadlock_mode',
    },
  ],
  symbolWeights: {
    bolt: 10,
    nut: 10,
    gear: 10,
    coil: 10,
    piston: 10,
    wrench: 10,
    rivet: 10,
    plate: 10,
    cable: 10,
    valve: 10,
    wild_gear: 2,
    bonus_gears_clash: 1,
    bonus_heist_run: 1,
    bonus_deadlock_mode: 1,
  },
  payoutTable: {
    note: 'Nur Referenz / Anzeige — Auszahlung serverseitig.',
  },
  bonusTriggers: {
    bonusSymbolIds: [
      'bonus_gears_clash',
      'bonus_heist_run',
      'bonus_deadlock_mode',
    ],
  },
  multiplierRanges: { min: 2, max: 10 },
  freeSpinDefaults: { count: 8 },
  maxWin: 50000,
  animation: {
    spinDurationMs: 2600,
    reelStopStaggerMs: 175,
    turbo: false,
    reelSequentialDurationMs: 760,
    reelApproachExtraRows: 5,
    reelIdleScrollRowsPerSec: 6,
  },
  assets: { basePath: '/assets' },
  sound: { enabled: false },
};
