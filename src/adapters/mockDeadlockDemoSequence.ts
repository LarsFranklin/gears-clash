import type { DeadlockModePayload } from '../config/types';

/**
 * Deterministische Demo-Schritte nach dem ersten Deadlock-Trigger (nur Mock).
 * Schritt 0 = Startpayload direkt am Trigger; diese Liste liefert Fortsetzung 1…n.
 */
export const MOCK_DEADLOCK_DEMO_SEQUENCE: readonly DeadlockModePayload[] = [
  {
    phase: 'collection',
    lives: 3,
    remainingSpins: 4,
    collectedSymbols: [
      { reel: 2, row: 2, symbolId: 'wild_gear', multiplier: 2 },
    ],
  },
  {
    phase: 'collection',
    lives: 3,
    remainingSpins: 3,
    collectedSymbols: [
      { reel: 2, row: 2, symbolId: 'wild_gear', multiplier: 2 },
      { reel: 0, row: 1, symbolId: 'reactor_pipe', multiplier: 3 },
    ],
  },
  {
    phase: 'collection',
    lives: 2,
    remainingSpins: 2,
    collectedSymbols: [
      { reel: 2, row: 2, symbolId: 'wild_gear', multiplier: 2 },
      { reel: 0, row: 1, symbolId: 'reactor_pipe', multiplier: 3 },
    ],
  },
  {
    phase: 'collection',
    lives: 3,
    remainingSpins: 1,
    collectedSymbols: [
      { reel: 2, row: 2, symbolId: 'wild_gear', multiplier: 2 },
      { reel: 0, row: 1, symbolId: 'reactor_pipe', multiplier: 3 },
      { reel: 4, row: 3, symbolId: 'quantum_chamber', multiplier: 4 },
    ],
  },
  {
    phase: 'overdrive',
    remainingSpins: 1,
    collectedSymbols: [
      { reel: 2, row: 2, symbolId: 'wild_gear', multiplier: 2 },
      { reel: 0, row: 1, symbolId: 'reactor_pipe', multiplier: 3 },
      { reel: 4, row: 3, symbolId: 'quantum_chamber', multiplier: 4 },
    ],
  },
];
