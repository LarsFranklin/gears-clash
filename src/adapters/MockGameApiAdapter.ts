import { defaultGameConfig } from '../config/defaultGameConfig';
import type {
  BonusSessionPayload,
  GameConfig,
  SpinRequest,
  SpinResult,
} from '../config/types';
import { mulberry32 } from '../util/random';
import type { GameApiAdapter } from './GameApiAdapter';

export interface MockGameApiAdapterOptions {
  /** Optional: reproduzierbare Spins für Tests/Debug. */
  seed?: number;
  /** Startguthaben (Social Coins). */
  initialBalance?: number;
  config?: GameConfig;
}

/**
 * NUR Demo / lokale Entwicklung.
 *
 * WICHTIG: Kein Ersatz für regulierte Glücksspiel- oder Echtgeld-Logik.
 * Der Client berechnet hier keine finalen Gewinne — Werte dienen nur Darstellung & Tests.
 */
export class MockGameApiAdapter implements GameApiAdapter {
  private balance: number;
  private readonly rng: () => number;
  private readonly symbolIds: string[];
  private spinCounter = 0;

  constructor(private readonly options: MockGameApiAdapterOptions = {}) {
    this.balance = options.initialBalance ?? 10_000;
    const cfg = options.config ?? defaultGameConfig;
    this.symbolIds = cfg.symbols.map((s) => s.id);
    this.rng =
      options.seed !== undefined
        ? mulberry32(options.seed)
        : () => Math.random();
  }

  async getBalance(): Promise<number> {
    await this.delay(40);
    return this.balance;
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    await this.delay(120 + this.rng() * 120);
    const bet = Math.max(0, Math.min(request.bet, this.balance));
    const cfg = this.options.config ?? defaultGameConfig;
    const { reels, rows } = cfg.grid;
    const reelStops: string[][] = [];
    for (let r = 0; r < reels; r++) {
      const col: string[] = [];
      for (let row = 0; row < rows; row++) {
        col.push(this.pickSymbolId());
      }
      reelStops.push(col);
    }

    const winAmount = Math.floor(this.rng() * 500 * (bet / 100));
    this.balance = Math.max(0, Math.round(this.balance - bet + winAmount));

    const spinId = `mock-${++this.spinCounter}-${Math.floor(this.rng() * 1e9)}`;

    let bonus: BonusSessionPayload | null = null;
    if (this.rng() < 0.06) {
      const roll = this.rng();
      bonus =
        roll < 0.33
          ? { type: 'gears_clash', payload: {} }
          : roll < 0.66
            ? { type: 'heist_run', payload: {} }
            : { type: 'deadlock_mode', payload: {} };
    }

    const displayHighlights =
      winAmount > 0 && this.rng() < 0.85
        ? middleRowHighlights(cfg.grid.reels)
        : undefined;

    return {
      spinId,
      reelStops,
      winAmount,
      balanceAfter: this.balance,
      bonus,
      ...(displayHighlights ? { displayHighlights } : {}),
    };
  }

  private pickSymbolId(): string {
    const idx = Math.floor(this.rng() * this.symbolIds.length);
    return this.symbolIds[idx] ?? this.symbolIds[0]!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

function middleRowHighlights(reels: number): { reel: number; row: number }[] {
  const row = 2;
  return Array.from({ length: reels }, (_, reel) => ({ reel, row }));
}
