export type WinTier = 'small' | 'medium' | 'big' | 'mega';

/** Gewinnstufe aus Verhältnis Gewinn/Einsatz — reine Anzeige-Logik, keine Auszahlung. */
export function getWinTier(winAmount: number, betAmount: number): WinTier {
  if (betAmount <= 0) return 'small';
  const ratio = winAmount / betAmount;
  if (ratio >= 50) return 'mega';
  if (ratio >= 15) return 'big';
  if (ratio >= 5) return 'medium';
  return 'small';
}
