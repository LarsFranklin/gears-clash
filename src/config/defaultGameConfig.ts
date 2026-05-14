import type { GameConfig } from './types';
import { defaultSlotMath } from './defaultSlotMath';

/**
 * Standard-Konfiguration — JSON-kompatibel, für Filament/Laravel als JSON speicherbar.
 */
export const defaultGameConfig: GameConfig = {
  grid: { reels: 5, rows: 5 },
  symbols: [
    { id: 'bolt', kind: 'normal', label: 'Bolt' },
    { id: 'nut', kind: 'normal', label: 'Nut' },
    { id: 'fuse', kind: 'normal', label: 'Fuse' },
    { id: 'valve', kind: 'normal', label: 'Valve' },
    { id: 'cable', kind: 'normal', label: 'Cable' },
    { id: 'steam_piston', kind: 'normal', label: 'Steam Piston' },
    { id: 'fuel_canister', kind: 'normal', label: 'Fuel Canister' },
    { id: 'reactor_pipe', kind: 'normal', label: 'Reactor Pipe' },
    { id: 'overdrive_core', kind: 'normal', label: 'Overdrive Core' },
    { id: 'quantum_chamber', kind: 'normal', label: 'Quantum Chamber' },
    { id: 'wild_gear', kind: 'wild', label: 'Overdrive Gear' },
    /**
     * Gears Clash VS-Symbol — Feature-Trigger (kein normales Pay-Symbol).
     * Landet im Basisspiel; Server entscheidet, ob Expand/Battle-Animation startet.
     * Wird zu Full-Reel-Wild mit Multiplier wenn in Win-Line-Konstellation.
     * Siehe docs/bonuses/gears-clash.md §3.
     */
    { id: 'gears_vs', kind: 'normal', label: 'VS Gears' },
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
    bolt: 11,
    nut: 11,
    fuse: 11,
    valve: 11,
    cable: 11,
    steam_piston: 8,
    fuel_canister: 8,
    reactor_pipe: 8,
    overdrive_core: 5,
    quantum_chamber: 4,
    wild_gear: 2,
    gears_vs: 1.5,
    /** Bewusst selten für Base-Strip / Mock-Ziehung — Verteilung nutzt Gewichte (nicht gleichverteilt). */
    bonus_gears_clash: 0.55,
    bonus_heist_run: 0.55,
    bonus_deadlock_mode: 0.55,
  },
  payoutTable: {
    note:
      'Referenz. Demoauswertung nutzt `slotMath` analog zu einem Produkt-Rechner; finale Beträge liefert live die API.',
  },
  slotMath: defaultSlotMath,
  bonusTriggers: {
    bonusSymbolIds: [
      'bonus_gears_clash',
      'bonus_heist_run',
      'bonus_deadlock_mode',
    ],
  },
  multiplierRanges: { min: 2, max: 10 },
  freeSpinDefaults: { count: 8 },
  /** Demo-Obergrenze — Ziel ~12.500× Einsatz laut Gameplay-Dokumentation. */
  maxWin: 1_250_000,
  animation: {
    spinDurationMs: 2600,
    reelStopStaggerMs: 175,
    turbo: false,
    reelSequentialDurationMs: 760,
    reelApproachExtraRows: 11,
    reelIdleScrollRowsPerSec: 11,
    scatterAnticipationPendingReelSpeedMul: 1.48,
    scatterAnticipationIdleRampMs: 420,
    scatterAnticipationSequentialStopStretch: 1.22,
    scatterAnticipationTerminalSlowFraction: 0.22,
    scatterAnticipationTurboExtraStopMs: 620,
  },
  assets: { basePath: '/assets' },
  sound: { enabled: false },
  betLevels: [10, 25, 50, 100, 250],
};
