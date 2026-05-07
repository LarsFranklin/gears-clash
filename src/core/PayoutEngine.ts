import type { SpinResult } from '../config/types';

/**
 * Hilfen für Anzeige (Highlights, Texte) aus dem Server-/Mock-Payload.
 *
 * WICHTIG: Keine Berechnung finaler Gewinne oder Bonus-Auszahlungen.
 * Alle Beträge und Linien kommen ausschließlich aus `SpinResult` (API).
 */
export class PayoutEngine {
  formatWinLine(result: SpinResult): string {
    if (result.winAmount <= 0) return '—';
    return String(result.winAmount);
  }
}
