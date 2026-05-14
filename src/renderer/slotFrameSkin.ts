/**
 * === SLOT FRAME SKIN CONFIGURATION ===
 *
 * Alle Werte sind normiert (0–1) relativ zur Canvas-Größe.
 *
 * Feintuning-Reihenfolge:
 * 1. SLOT_FRAME_GRID_NORM → Innenfläche (wo Background + Atmosphäre liegen)
 * 2. SLOT_FRAME_GRID_NUDGE_NORM → Feinverschiebung nur für das Walzen-Raster
 * 3. SLOT_GRID_SYMBOL_SCALE → Zellgröße relativ zum Maximum
 * 4. SLOT_SYMBOL_MARGIN_NORM → Abstand um jedes Symbol herum (innerhalb der Zelle)
 */

/**
 * Innenrechteck für das 5×5-Raster.
 * `x`, `y` = linke obere Ecke; `w`, `h` = Breite/Höhe.
 */
export const SLOT_FRAME_GRID_NORM = {
  x: 0.085,
  y: 0.148,
  w: 0.83,
  h: 0.78,
} as const;

/**
 * Feinversatz nur für das Walzen-Raster (nicht Background/Atmosphäre).
 * Positiv `dx` → nach rechts, positiv `dy` → nach unten.
 * Typische Werte: 0.000–0.025
 */
export const SLOT_FRAME_GRID_NUDGE_NORM = {
  dx: 0.0,
  dy: 0.008,
} as const;

/**
 * Zellgröße relativ zum maximal passenden Wert (0.85–1.0).
 * Kleiner = mehr Luft zwischen Symbol und Zellrand.
 */
export const SLOT_GRID_SYMBOL_SCALE = 0.92;

/**
 * Margin um jedes Symbol innerhalb seiner Zelle (0–1, relativ zur Zellgröße).
 * 0.04 = 4% Abstand auf jeder Seite → Symbol nutzt 92% der Zellfläche.
 */
export const SLOT_SYMBOL_MARGIN_NORM = 0.04;
