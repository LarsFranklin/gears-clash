/**
 * Viewport-Fit für den Desktop-Schrank — eine Quelle für Maße, CSS-Variablen und Tests.
 * Rein geometrisch (kein Pixi); DOM nur in `applyCabinetCssVars`.
 */

import {
  CABINET_CONSOLE_FRAC,
  cabinetCanvasSize,
  cabinetOpening,
  fitCabinetToBox,
  type FittedCabinet,
} from './cabinetLayout';

/** Maximale Bühnenbreite der Spieleransicht. */
export const PLAYER_STAGE_MAX_WIDTH = 920;

/** Intrinsic-Höhe zu `PLAYER_STAGE_MAX_WIDTH` (920 → 993, Aspect 920/993). */
export const PLAYER_STAGE_MAX_HEIGHT = cabinetCanvasSize(PLAYER_STAGE_MAX_WIDTH).totalH;

/** Gerendertes Aspect (Breite/Höhe), nicht das theoretische `CABINET_ASPECT` 0.928. */
export const CABINET_RENDER_ASPECT =
  PLAYER_STAGE_MAX_WIDTH / PLAYER_STAGE_MAX_HEIGHT;

/**
 * Aktuelles Kronenzahnrad: Mitte bei `short * 0.055`, Kante `short * 0.16` →
 * Überstand über den Rahmen `short * 0.025` (~15 px bei 1366).
 * PR #9 (`cabinetCrownGearRect`) klemmt `y` auf >= 0; ungeklemmt auf der
 * Messingkante wären es ~0.16*short − opening.y. Wir kopieren #9 nicht.
 */
export const CABINET_CROWN_CENTER_Y_OF_SHORT = 0.055;
export const CABINET_CROWN_SIZE_OF_SHORT = 0.16;
export const CABINET_CROWN_PROTRUSION_OF_SHORT =
  CABINET_CROWN_SIZE_OF_SHORT / 2 - CABINET_CROWN_CENTER_Y_OF_SHORT;

/** Oberer Viewport-Rand: mindestens 16 px, deckt den aktuellen Überstand. */
export const CABINET_FIT_MARGIN_TOP_PX = 16;
export const CABINET_FIT_MARGIN_BOTTOM_PX = 16;

export const MACHINE_DECK_HEIGHT_PCT = 16.5;
export const MACHINE_DECK_BOTTOM_PCT = 1.4;
export const MACHINE_DECK_INSET_X_PCT = 7;
export const MACHINE_DECK_HEIGHT_FRAC = MACHINE_DECK_HEIGHT_PCT / 100;
export const MACHINE_DECK_BOTTOM_FRAC = MACHINE_DECK_BOTTOM_PCT / 100;
export const MACHINE_DECK_INSET_X_FRAC = MACHINE_DECK_INSET_X_PCT / 100;

export const CONTROL_KEY_PX = 32;
export const SPIN_MIN_REM = 2.8;
export const SPIN_MAX_REM = 3.6;
export const SPIN_VW = 0.07;
export const ROOT_FONT_PX = 16;
export const CONSOLE_FONT_MIN_PX = 12;
export const MACHINE_HUD_H_PX = 34;
export const MACHINE_DECK_GAP_PX = 2.4;
/** Konsolenplatte in `placeCabinetConsole` beginnt `frameH - 6`. */
export const CONSOLE_PLATE_OVERLAP_PX = 6;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CabinetViewportOptions {
  maxWidth?: number;
  /** Altes Verhalten: nur Breite, Höhe darf über den Viewport ragen. */
  widthOnly?: boolean;
  /** Gegenprobe: ohne 16-px-Rand. */
  noMargin?: boolean;
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
  scale: number;
  cabinet: BoundsBox;
  frame: BoundsBox;
  opening: BoundsBox;
  console: BoundsBox;
  plate: BoundsBox;
  deck: BoundsBox;
  spin: BoundsBox;
  keyRow: BoundsBox;
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

export function cabinetDesignScale(cabinetWidth: number): number {
  return cabinetWidth / PLAYER_STAGE_MAX_WIDTH;
}

/** Spin-Taste, skaliert mit dem Schrank (nicht mit dem Viewport). */
export function spinKeySizePx(
  cabinetWidth: number,
  scale = cabinetDesignScale(cabinetWidth),
  rootFontPx = ROOT_FONT_PX,
): number {
  const minPx = SPIN_MIN_REM * rootFontPx * scale;
  const maxPx = SPIN_MAX_REM * rootFontPx * scale;
  const ofCabinet = cabinetWidth * SPIN_VW;
  return Math.min(maxPx, Math.max(minPx, ofCabinet));
}

export function controlKeySizePx(scale: number): number {
  return CONTROL_KEY_PX * scale;
}

/**
 * Schrank, Konsole, Platte, Spin und Tastenreihe im Viewport.
 * Zentriert, mit mindestens `CABINET_FIT_MARGIN_*` oben/unten.
 */
export function layoutCabinetInViewport(
  viewport: ViewportSize,
  options: CabinetViewportOptions = {},
): CabinetViewportLayout {
  const maxWidth = options.maxWidth ?? PLAYER_STAGE_MAX_WIDTH;
  const marginTop = options.noMargin || options.widthOnly ? 0 : CABINET_FIT_MARGIN_TOP_PX;
  const marginBottom =
    options.noMargin || options.widthOnly ? 0 : CABINET_FIT_MARGIN_BOTTOM_PX;
  const boxW = Math.max(1, Math.min(maxWidth, Math.floor(viewport.width)));
  const boxH = Math.max(
    1,
    Math.floor(viewport.height) - marginTop - marginBottom,
  );
  const fit = options.widthOnly
    ? { ...cabinetCanvasSize(boxW), scale: 1 }
    : fitCabinetToBox(boxW, boxH);

  const scale = cabinetDesignScale(fit.totalW);
  const x = (viewport.width - fit.totalW) / 2;
  const centeredY = (viewport.height - fit.totalH) / 2;
  const y = options.widthOnly ? centeredY : Math.max(marginTop, centeredY);
  const cabinet = bounds(x, y, fit.totalW, fit.totalH);

  const frameH = fit.frameH;
  const frame = bounds(x, y, fit.totalW, frameH);

  const open = cabinetOpening(fit.totalW, fit.totalH);
  const opening = bounds(x + open.x, y + open.y, open.w, open.h);

  const consoleH = fit.totalH * CABINET_CONSOLE_FRAC;
  const console = bounds(x, y + fit.totalH - consoleH, fit.totalW, consoleH);

  const plateH = fit.totalH - frameH + CONSOLE_PLATE_OVERLAP_PX;
  const plate = bounds(x, y + frameH - CONSOLE_PLATE_OVERLAP_PX, fit.totalW, plateH);

  const deckH = fit.totalH * MACHINE_DECK_HEIGHT_FRAC;
  const deckBottomPad = fit.totalH * MACHINE_DECK_BOTTOM_FRAC;
  const deckX = x + fit.totalW * MACHINE_DECK_INSET_X_FRAC;
  const deckW = fit.totalW * (1 - MACHINE_DECK_INSET_X_FRAC * 2);
  const deckY = y + fit.totalH - deckBottomPad - deckH;
  const deck = bounds(deckX, deckY, deckW, deckH);

  const spinSize = spinKeySizePx(fit.totalW, scale, options.rootFontPx);
  const keySize = controlKeySizePx(scale);
  const hudH = MACHINE_HUD_H_PX * scale;
  const gap = MACHINE_DECK_GAP_PX * scale;
  const keyRowH = keySize + CONSOLE_FONT_MIN_PX * scale;
  const contentH = hudH + gap + spinSize + gap + keyRowH;
  const groupTop = deck.y + Math.max(0, (deck.height - contentH) / 2);

  let spinY = groupTop + hudH + gap;
  if (spinY + spinSize > deck.bottom - keyRowH) {
    spinY = Math.max(deck.y, deck.bottom - keyRowH - gap - spinSize);
  }
  const spinX = deck.x + (deck.width - spinSize) / 2;
  const spin = bounds(spinX, spinY, spinSize, spinSize);

  const keyRowY = Math.min(spin.bottom + gap, deck.bottom - keyRowH);
  const keyRow = bounds(deck.x, keyRowY, deck.width, keyRowH);

  return {
    viewport,
    fit,
    scale,
    cabinet,
    frame,
    opening,
    console,
    plate,
    deck,
    spin,
    keyRow,
  };
}

export function cabinetCssVars(
  layout?: Pick<CabinetViewportLayout, 'fit' | 'scale'>,
): Record<string, string> {
  const designW = PLAYER_STAGE_MAX_WIDTH;
  const designH = PLAYER_STAGE_MAX_HEIGHT;
  const fit = layout?.fit ?? { ...cabinetCanvasSize(designW), scale: 1 };
  const scale = layout?.scale ?? cabinetDesignScale(fit.totalW);
  return {
    '--gc-cabinet-aspect': `${designW} / ${designH}`,
    '--gc-cabinet-max-width': `${designW}px`,
    '--gc-cabinet-width': `${fit.totalW}px`,
    '--gc-cabinet-scale': String(scale),
    '--gc-deck-height': `${MACHINE_DECK_HEIGHT_PCT}%`,
    '--gc-deck-bottom': `${MACHINE_DECK_BOTTOM_PCT}%`,
    '--gc-deck-inset-x': `${MACHINE_DECK_INSET_X_PCT}%`,
    '--gc-control-key': `${CONTROL_KEY_PX}px`,
    '--gc-spin-min': `${SPIN_MIN_REM}rem`,
    '--gc-spin-max': `${SPIN_MAX_REM}rem`,
    '--gc-spin-vw-frac': String(SPIN_VW),
    '--gc-font-min': `${CONSOLE_FONT_MIN_PX}px`,
    '--gc-fit-margin-top': `${CABINET_FIT_MARGIN_TOP_PX}px`,
    '--gc-fit-margin-bottom': `${CABINET_FIT_MARGIN_BOTTOM_PX}px`,
  };
}

export function applyCabinetCssVars(
  el: HTMLElement,
  layout?: Pick<CabinetViewportLayout, 'fit' | 'scale'>,
): void {
  const vars = cabinetCssVars(layout);
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value);
  }
}
