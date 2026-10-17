/**
 * Symbolfläche innerhalb einer Zelle.
 * Die Schrank-Öffnung selbst liegt in `cabinetLayout.ts`.
 */

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
