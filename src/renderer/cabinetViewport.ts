/**
 * Viewport-Fit für den Desktop-Schrank (Spieleransicht).
 * Rein geometrisch — kein DOM, kein Pixi, node-testbar.
 */

import {
  CABINET_CONSOLE_FRAC,
  cabinetCanvasSize,
  cabinetOpening,
  fitCabinetToBox,
  type FittedCabinet,
} from './cabinetLayout';

/** Maximale Bühnenbreite der Spieleransicht (`.gc-demo-page--player .gc-demo-page__stage`). */
export const PLAYER_STAGE_MAX_WIDTH = 920;

/** Overlay-Konsole — Anteile von `.gc-machine-deck`. */
export const MACHINE_DECK_HEIGHT_FRAC = 0.165;
export const MACHINE_DECK_BOTTOM_FRAC = 0.014;
export const MACHINE_DECK_INSET_X_FRAC = 0.07;

/** Taste neben Spin (`.gc-controls-bar__btn`). */
export const CONTROL_KEY_PX = 32;

const SPIN_MIN_REM = 2.8;
const SPIN_MAX_REM = 3.6;
const SPIN_VW = 0.07;
const ROOT_FONT_PX = 16;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CabinetViewportOptions {
  maxWidth?: number;
  /** Altes Verhalten: nur Breite, Höhe darf über den Viewport ragen. */
  widthOnly?: boolean;
  rootFontPx?: number;
}

export interface BoundsBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface CabinetViewportLayout {
  viewport: ViewportSize;
  fit: FittedCabinet;
  cabinet: BoundsBox;
  frame: BoundsBox;
  opening: BoundsBox;
  console: BoundsBox;
  deck: BoundsBox;
  spin: BoundsBox;
}

function bounds(x: number, y: number, width: number, height: number): BoundsBox {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
  };
}

/** Spin-Taste: `clamp(2.8rem, 7vw, 3.6rem)` aus `.gc-machine-deck .gc-button--spin`. */
export function spinKeySizePx(viewportWidth: number, rootFontPx = ROOT_FONT_PX): number {
  const minPx = SPIN_MIN_REM * rootFontPx;
  const maxPx = SPIN_MAX_REM * rootFontPx;
  const vwPx = viewportWidth * SPIN_VW;
  return Math.min(maxPx, Math.max(minPx, vwPx));
}

/**
 * Schrank, Konsole und Spin im Viewport platzieren.
 * Zentriert; freie Fläche bleibt der Hallen-Hintergrund.
 */
export function layoutCabinetInViewport(
  viewport: ViewportSize,
  options: CabinetViewportOptions = {},
): CabinetViewportLayout {
  const maxWidth = options.maxWidth ?? PLAYER_STAGE_MAX_WIDTH;
  const boxW = Math.max(1, Math.min(maxWidth, Math.floor(viewport.width)));
  const boxH = Math.max(1, Math.floor(viewport.height));
  const fit = options.widthOnly
    ? { ...cabinetCanvasSize(boxW), scale: 1 }
    : fitCabinetToBox(boxW, boxH);

  const x = (viewport.width - fit.totalW) / 2;
  const y = (viewport.height - fit.totalH) / 2;
  const cabinet = bounds(x, y, fit.totalW, fit.totalH);

  const frameH = fit.frameH;
  const frame = bounds(x, y, fit.totalW, frameH);

  const open = cabinetOpening(fit.totalW, fit.totalH);
  const opening = bounds(x + open.x, y + open.y, open.w, open.h);

  const consoleH = fit.totalH * CABINET_CONSOLE_FRAC;
  const console = bounds(x, y + fit.totalH - consoleH, fit.totalW, consoleH);

  const deckH = fit.totalH * MACHINE_DECK_HEIGHT_FRAC;
  const deckBottomPad = fit.totalH * MACHINE_DECK_BOTTOM_FRAC;
  const deckX = x + fit.totalW * MACHINE_DECK_INSET_X_FRAC;
  const deckW = fit.totalW * (1 - MACHINE_DECK_INSET_X_FRAC * 2);
  const deckY = y + fit.totalH - deckBottomPad - deckH;
  const deck = bounds(deckX, deckY, deckW, deckH);

  const spinSize = spinKeySizePx(viewport.width, options.rootFontPx);
  const hudH = 34;
  const controlsH = CONTROL_KEY_PX + 8;
  const gap = 2.4;
  const contentH = hudH + gap + spinSize + gap + controlsH;
  const groupTop = deck.y + Math.max(0, (deck.height - contentH) / 2);
  let spinY = groupTop + hudH + gap;
  if (spinY + spinSize > deck.bottom) spinY = deck.bottom - spinSize;
  if (spinY < deck.y) spinY = deck.y;
  const spinX = deck.x + (deck.width - spinSize) / 2;
  const spin = bounds(spinX, spinY, spinSize, spinSize);

  return { viewport, fit, cabinet, frame, opening, console, deck, spin };
}
