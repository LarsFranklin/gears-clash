/** Bonus-Modus-IDs (snake_case) — überall identisch verwenden. */
export type BonusId = 'gears_clash' | 'heist_run' | 'deadlock_mode';

export type SymbolKind = 'normal' | 'wild' | 'bonus';

export interface SymbolDef {
  /** Eindeutige Symbol-ID (z. B. in reelStops / API). */
  id: string;
  kind: SymbolKind;
  /** Anzeigename für HUD/Debug. */
  label: string;
  /** Nur bei kind === 'bonus': welcher Bonus ausgelöst wird. */
  bonusId?: BonusId;
}

export interface GridConfig {
  reels: number;
  rows: number;
}

export interface AnimationConfig {
  spinDurationMs: number;
  reelStopStaggerMs: number;
  /**
   * Wenn true: alle Spalten parallel mit kurzem Stagger (klassischer Turbo).
   * Wenn false: Spalten nacheinander (links → rechts), längere Rolle + Einrasten.
   */
  turbo?: boolean;
  /** Haupt-Ease pro Spalte im Normal-Modus (ms). */
  reelSequentialDurationMs?: number;
  /** Zusätzliche Reihen „von oben“ vor dem Ziel (nur Normal-Modus). */
  reelApproachExtraRows?: number;
  /** Wartende Spalten: Scroll-Geschwindigkeit (Symbol-Zeilen/Sek., nur Normal-Modus). */
  reelIdleScrollRowsPerSec?: number;
}

export interface SoundConfig {
  enabled: boolean;
  /** Basis-URL oder Prefix für Audio-Dateien (optional). */
  baseUrl?: string;
}

export interface GameConfig {
  grid: GridConfig;
  symbols: SymbolDef[];
  /** Map symbolId → relative weight (Mock / Server können daraus ableiten). */
  symbolWeights: Record<string, number>;
  /** Auszahlungs-/Linien-Referenz — nur zur Anzeige; finale Auswertung serverseitig. */
  payoutTable: Record<string, unknown>;
  bonusTriggers: {
    /** Symbol-IDs, die einen Bonus auslösen können (Server entscheidet final). */
    bonusSymbolIds: string[];
  };
  multiplierRanges: { min: number; max: number };
  freeSpinDefaults: { count: number };
  maxWin: number;
  animation: AnimationConfig;
  /** Pfade/Keys; echte Assets folgen später. */
  assets: { basePath: string };
  sound: SoundConfig;
}

/** Request an den Server — JSON-serialisierbar. */
export interface SpinRequest {
  bet: number;
  currency: string;
  mode: 'base' | string;
  /** Zusätzliche Host-Felder (optional). */
  meta?: Record<string, unknown>;
}

/**
 * Antwort des Servers / Mocks.
 *
 * WICHTIG: Der Client berechnet daraus keine finalen Gewinne oder Bonus-Ergebnisse.
 * `winAmount`, `bonus` usw. sind reine Anzeige-/State-Daten aus der API.
 */
/** Nur Darstellung: Zellen für Win-Glow (vom Server/Mock), keine Gewinnberechnung im Client. */
export interface SpinDisplayHighlight {
  reel: number;
  row: number;
}

export interface SpinResult {
  spinId: string;
  /** 5 Reels × 5 Rows — jeweils Symbol-ID als String (wie in der API-Doku). */
  reelStops: string[][];
  winAmount: number;
  balanceAfter: number;
  bonus: BonusSessionPayload | null;
  /** Optional: vom Host/Mock gelieferte Highlight-Positionen für Effekte. */
  displayHighlights?: SpinDisplayHighlight[];
}

export type BonusSessionPayload =
  | { type: 'gears_clash'; payload: Record<string, unknown> }
  | { type: 'heist_run'; payload: Record<string, unknown> }
  | { type: 'deadlock_mode'; payload: Record<string, unknown> };

export type GameEventName =
  | 'spin:start'
  | 'spin:end'
  | 'bonus:start'
  | 'bonus:end'
  | 'balance:update'
  | 'error'
  | 'ready';

export interface HostAdapter {
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onBalanceUpdate?: (balance: number) => void;
  locale?: string;
  currency?: string;
  userMeta?: Record<string, unknown>;
  /** Wenn true: Spin-Button / Eingabe sperren (z. B. Limits, Wartung). */
  disabled?: boolean;
  limits?: Record<string, unknown>;
}
