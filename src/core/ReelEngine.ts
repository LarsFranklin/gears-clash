import type { GameConfig } from '../config/types';

/** Reine Grid-Hilfen — keine Zufallsgenerierung. */
export class ReelEngine {
  constructor(private readonly config: GameConfig) {}

  get dimensions(): { reels: number; rows: number } {
    return { reels: this.config.grid.reels, rows: this.config.grid.rows };
  }

  /** Prüft, ob reelStops zur Grid-Größe passen. */
  validateStops(reelStops: string[][]): boolean {
    const { reels, rows } = this.config.grid;
    if (reelStops.length !== reels) return false;
    return reelStops.every((col) => col.length === rows);
  }
}
