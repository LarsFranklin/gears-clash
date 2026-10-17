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
  /**
   * Multiplikator für die Idle-Bewegung noch nicht gestoppter Walzen, wenn Scatter-Anticipation
   * aktiv ist. Typisch **> 1** (schnelleres „Tease“), **< 1** bewusst langsamer.
   */
  scatterAnticipationPendingReelSpeedMul?: number;
  /**
   * Zeitkonstante (ms) zum sanften Hoch-/Runterfahren des Idle-Multiplikators bei Scatter-Jagd
   * (vermeidet harten Sprung 1 → Zielgeschwindigkeit).
   */
  scatterAnticipationIdleRampMs?: number;
  /**
   * Normal-Modus: Faktor auf `reelSequentialDurationMs`, wenn ab Walze 3 Scatter-Jagd aktiv ist
   * (längere Rolle vor dem Einrasten).
   */
  scatterAnticipationSequentialStopStretch?: number;
  /**
   * Anteil (0–1) am Ende einer Jagd-Walze mit extra langsamem „Zeitlupen“-Einlaufen vor dem Stop.
   */
  scatterAnticipationTerminalSlowFraction?: number;
  /**
   * Zusätzliche Stop-Dauer (ms) pro betroffener Walze im **Turbo**-Modus, wenn nach Walze 1–2
   * bereits Scatter-Jagd gilt (Prefix mit ≥2 gleichen Bonussymbolen).
   */
  scatterAnticipationTurboExtraStopMs?: number;
}

export interface SoundConfig {
  enabled: boolean;
  /** Basis-URL oder Prefix für Audio-Dateien (optional). */
  baseUrl?: string;
}

/**
 * Basis-Spiel-/Demo-Mathe: Paylines, Linksnach-Rechts-Zählung, Scatter-Schwelle.
 * Hosts sollten Produkt-Spins serverseitig auswerten; dieselbe Datenstruktur kann
 * Abgleich/Debug mit dem Demo-Adapter (`MockGameApiAdapter`) ermöglichen.
 */
/** Payline-Typen für visuelle Kategorisierung im Info-Modal. */
export type PaylineType =
  | 'straight'
  | 'diagonal'
  | 'zigzag'
  | 'v'
  | 'industrial'
  | 'hero';

export interface SlotPaylineDefinition {
  id: string;
  /** Anzeigename (z. B. "Center Line", "Gear Rotation Left"). */
  name?: string;
  /** Visuelle Kategorie für Info-Modal-Darstellung. */
  type?: PaylineType;
  /**
   * Linie abschaltbar (Default `true`). Deaktivierte Linien werden weder
   * ausgewertet noch im Info-Modal gezeigt.
   */
  enabled?: boolean;
  /** Pro Walze eine Zeilenindexierung (Länge = `grid.reels`, 0-basiert). */
  rows: number[];
}

export interface SlotMathConfig {
  /**
   * Mindestlänge der Trefferkette von links (typisch 3). Wild zählt als gleiches Symbol
   * (z. B. Symbol+Symbol+Wild = 3 Walzen Treffer).
   */
  minMatchLength: number;
  /**
   * Münzgewinn einer Linie: `floor(multiplier[slot] * bet / referenceBet)` mit
   * `slot = runLen - minMatchLength` (geklammert auf Tabellenlänge), z. B. minMatch 3 →
   * drei Tabellenstufen [3 OAK, 4 OAK, 5 OAK].
   */
  referenceBet: number;
  /** Scatter mindestens diese Anzahl löst Bonus-ID aus (welche, siehe Auflösung). */
  scatterMinBonus: number;
  /** Bei gleicher maximaler Scatter-Zahl hier früheres Element gewinnt. */
  scatterBonusResolutionOrder: readonly BonusId[];
  /** Auszuwertende Gewinnpfade über das Raster (links nach rechts). */
  paylines: readonly SlotPaylineDefinition[];
  /**
   * Multiplikatoren relativ `referenceBet`, Index `runLen - minMatchLength`.
   * Bonussymbole entfallen hier.
   */
  lineMultipliersBySymbolId: Record<string, readonly number[]>;
}

export interface GameConfig {
  /** Optionaler Schema-/Config-Versions-Marker (z. B. `"1.0"`), siehe `gameConfig.schema.json`. */
  version?: string;
  grid: GridConfig;
  symbols: SymbolDef[];
  /** Map symbolId → relative weight (Mock / Server können daraus ableiten). */
  symbolWeights: Record<string, number>;
  /** Auszahlungs-/Linien-Referenz — nur zur Anzeige; finale Auswertung serverseitig. */
  payoutTable: Record<string, unknown>;
  /**
   * Optionale lokale/demo Auswertung — wenn gesetzt nutzt der `MockGameApiAdapter`
   * diese Logik statt Fantasiedaten für Win-Betrag, Win-Lines und Bonus-Scatter.
   */
  slotMath?: SlotMathConfig;
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
  /** Verfügbare Einsatzstufen. */
  betLevels?: number[];
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

/** Optionale Detailanzeige pro Winline (rein visuell; Gewinn bleibt serverseitig maßgeblich). */
export interface SpinDisplayWinLine {
  id?: string;
  /** Positionen auf der Gewinnlinie, typischerweise je Reel ein Punkt. */
  points: SpinDisplayHighlight[];
  /** Gewinnbetrag dieser Linie. */
  amount: number;
  /** Optionaler Kurztext (z. B. "3x Bolt"). */
  label?: string;
}

export interface SpinResult {
  spinId: string;
  /** 2D-Array [reel][row] — Dimensionen abhängig von grid.reels/rows. */
  reelStops: string[][];
  winAmount: number;
  balanceAfter: number;
  bonus: BonusSessionPayload | null;
  /** Optional: vom Host/Mock gelieferte Highlight-Positionen für Effekte. */
  displayHighlights?: SpinDisplayHighlight[];
  /** Optional: vom Host/Mock gelieferte Winlines für sequenzielle Anzeige. */
  displayWinLines?: SpinDisplayWinLine[];
}

/**
 * `gears_clash` — zwei Multiplier-Gears battlen; der Winner-Multiplier wird auf
 * eine komplette Reel als Full-Reel-Wild angewendet. Der Client visualisiert
 * nur, der Server liefert den finalen Outcome.
 */
export interface GearsClashPayload {
  gearA: { multiplier: number };
  gearB: { multiplier: number };
  /** 0-basierter Reel-Index, der zur Full-Reel-Wild wird (optional). */
  winnerReel?: number;
  /** Multiplier auf der Winner-Reel (Server-final). */
  winnerMultiplier?: number;
}

/** Eine Sticky-Wild-Zelle in einem Heist-Run (kann optional einen Multiplier tragen). */
export interface HeistRunStickyWild {
  reel: number;
  row: number;
  /** Optional: Multiplier, den dieser Sticky-Wild trägt. */
  multiplier?: number;
}

/**
 * `heist_run` — Free Spins mit Sticky Wilds. Visualisierungs-Daten kommen vom
 * Server; der Client malt die Sticky-Positionen und optionalen Multiplier.
 */
export interface HeistRunPayload {
  /** Anzahl gewährter Free Spins (Gesamtbudget der Bonus-Runde). */
  freeSpinsAwarded: number;
  /** Aktueller Free-Spin-Zähler (1-basiert). */
  currentSpin?: number;
  /** Sticky-Wilds nach Server-Berechnung — Position + optional Multiplier. */
  stickyWilds?: HeistRunStickyWild[];
}

export type DeadlockPhase = 'collection' | 'overdrive';

export interface DeadlockCollectedSymbol {
  reel: number;
  row: number;
  symbolId: string;
  /** Optional: Multiplier-Wert, in Overdrive auf Gewinne angewendet. */
  multiplier?: number;
}

/**
 * `deadlock_mode` — Phase 1 (Collection) sammelt Multiplier/Gear/Wild-Symbole
 * im Overdrive Storage; Phase 2 (Overdrive) verteilt sie und fährt einen
 * finalen Reveal-Spin. Lives: 3 Reset bei Treffer, sonst -1.
 *
 * Client zeigt nur an, was der Server liefert.
 */
export interface DeadlockModePayload {
  phase: DeadlockPhase;
  /** Lives in der Collection-Phase (0–3). */
  lives?: number;
  /** Bisher gesammelte Symbole (Server-Sicht). */
  collectedSymbols?: DeadlockCollectedSymbol[];
  /** Verbleibende Spins in der aktuellen Phase. */
  remainingSpins?: number;
}

/**
 * Session-Buchhaltung, die für alle Bonus-Modi gleich aussieht — Server-final.
 *
 * Der Client rechnet daraus nichts aus, er zeigt die Werte an und leitet daraus
 * die Events `bonus:spin`, `bonus:retrigger` und `bonus:summary` ab.
 */
export interface BonusSessionMeta {
  /** Verbleibende Runden nach dieser Antwort. */
  remainingSpins: number;
  /** Gesamtbudget inklusive aller bisherigen Retrigger. */
  totalSpins: number;
  /** Bereits gespielte Runden. */
  roundsPlayed: number;
  /** In dieser Runde zusätzlich gewährte Spins; fehlt oder 0, wenn kein Retrigger. */
  retriggerAwarded?: number;
  /** Bonusbank: Summe aller Session-Gewinne bis inklusive dieser Runde. */
  bankedWin: number;
  /** True in der Antwort, die die Session abschließt — hier erfolgt die Gutschrift. */
  complete: boolean;
}

export type BonusSessionPayload =
  | {
      type: 'gears_clash';
      payload: GearsClashPayload;
      session?: BonusSessionMeta;
    }
  | { type: 'heist_run'; payload: HeistRunPayload; session?: BonusSessionMeta }
  | {
      type: 'deadlock_mode';
      payload: DeadlockModePayload;
      session?: BonusSessionMeta;
    };

export type GameEventName =
  | 'spin:start'
  | 'spin:end'
  | 'bonus:start'
  | 'bonus:spin'
  | 'bonus:retrigger'
  | 'bonus:summary'
  | 'bonus:end'
  | 'balance:update'
  | 'error'
  | 'ready';

/** Payload von `bonus:retrigger` — zusätzliche Free Spins innerhalb einer Session. */
export interface BonusRetriggerEvent {
  bonusId: BonusId;
  /** Gewährte zusätzliche Spins (Produktregel: +4 pro Ereignis). */
  awarded: number;
  /** Verbleibende Spins nach dem Retrigger. */
  remaining: number;
}

/** Payload von `bonus:summary` — Abschluss einer Bonus-Session vor der Gutschrift. */
export interface BonusSummaryEvent {
  bonusId: BonusId;
  /** Summe aller Gewinne der Session (Bonusbank). */
  totalWin: number;
  /** Anzahl gespielter Runden inklusive Retrigger. */
  roundsPlayed: number;
  /** Kontostand nach Gutschrift der Bonusbank. */
  balanceAfter: number;
}

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
