import type { Graphics, Text } from 'pixi.js';
import type { GameConfig } from '../config/types';
import type { BigWinLayer } from './BigWinLayer';
import type { EffectsLayer } from './EffectsLayer';
import type { ReelColumn } from './ReelColumn';

export interface PixiSlotRendererHooks {
  onSound?: (id: string) => void;
  /** Leichtes Shake am Host (CSS-Klasse). */
  onShake?: (kind: 'light' | 'medium') => void;
}

/**
 * Schmale Sicht auf den Renderer-Kern für `SpinChoreographer` und `WinPresentation`.
 *
 * Beide Teile brauchen dieselben Bühnenobjekte (Walzen, Effekt-Layer, Maße, Spin-Token),
 * sollen den Renderer aber nicht besitzen — deshalb dieser Lesezugriff plus wenige
 * Rückrufe statt einer wechselseitigen Abhängigkeit.
 */
export interface RendererStage {
  readonly config: GameConfig;
  readonly reels: ReelColumn[];
  readonly effects: EffectsLayer | null;
  readonly bigWin: BigWinLayer | null;
  readonly canvas: HTMLCanvasElement | null;
  readonly winlinePath: Graphics | null;
  readonly winlineLabel: Text | null;
  readonly highlightRowsByReel: Map<number, Set<number>>;
  readonly bonusRevealRowsByReel: Map<number, Set<number>>;
  readonly cellSize: number;
  readonly gap: number;
  readonly currentBet: number;
  /** Laufende Spin-Generation — jede Animation bricht ab, wenn sie sich ändert. */
  readonly spinToken: number;
  readonly destroyed: boolean;

  setWinPulse(value: number): void;
  setAnimating(value: boolean): void;
  tickVisuals(): void;
  flushPendingResize(): void;
  setGridFromStops(reelStops: string[][]): void;
  isBonusSymbol(symbolId: string): boolean;
}
