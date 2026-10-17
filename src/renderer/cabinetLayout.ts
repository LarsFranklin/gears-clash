/**
 * Maße des zusammengesetzten Walzen-Schranks.
 * Die Innenöffnung liegt innerhalb der Eckblöcke, damit die Symbole frei bleiben.
 */

export const CABINET_FRAME_ASPECT = 1.16;

/** Unterer Konsolenstreifen, Anteil der gesamten Canvas-Höhe. */
export const CABINET_CONSOLE_FRAC = 0.2;

/** Gesamt-Canvas: Rahmen plus eingebaute Konsole. */
export const CABINET_ASPECT = CABINET_FRAME_ASPECT * (1 - CABINET_CONSOLE_FRAC);

/** Eck-Sprite relativ zur kürzeren Rahmenkante, klein genug, dass die Ecken die Symbole nicht zudecken. */
export const CABINET_CORNER_OF_SHORT = 0.36;

/** Obere Messingleiste: Anteil der kürzeren Rahmenkante. */
export const CABINET_TOP_RAIL_Y_OF_SHORT = 0.004;
export const CABINET_TOP_RAIL_H_OF_SHORT = 0.07;
export const CABINET_TOP_RAIL_W_OF_TOTAL = 0.7;

/** Kronenzahnrad: längste Kante relativ zur kürzeren Rahmenkante. */
export const CABINET_CROWN_GEAR_OF_SHORT = 0.16;

export const CABINET_ASSETS = {
  cornerTl: '/assets/cabinet/corner_tl.png',
  cornerTr: '/assets/cabinet/corner_tr.png',
  cornerBl: '/assets/cabinet/corner_bl.png',
  cornerBr: '/assets/cabinet/corner_br.png',
  edgeTop: '/assets/cabinet/edge_top.png',
  edgeBottom: '/assets/cabinet/edge_bottom.png',
  edgeLeft: '/assets/cabinet/edge_left.png',
  edgeRight: '/assets/cabinet/edge_right.png',
  dividerH: '/assets/cabinet/divider_h.png',
  dividerV: '/assets/cabinet/divider_v.png',
  rivet: '/assets/cabinet/rivet.png',
  plate: '/assets/cabinet/plate.png',
  glow: '/assets/cabinet/glow.png',
  gearLarge: '/assets/cabinet/gear_large.png',
  gearMedium: '/assets/cabinet/gear_medium.png',
  gearSmall: '/assets/cabinet/gear_small.png',
  gaugeFace: '/assets/cabinet/gauge_face.png',
  gaugeNeedle: '/assets/cabinet/gauge_needle.png',
  vent: '/assets/cabinet/vent.png',
  steamA: '/assets/cabinet/steam_a.png',
  steamB: '/assets/cabinet/steam_b.png',
  pipe: '/assets/cabinet/pipe.png',
} as const;

export const CABINET_ASSET_PATHS = Object.values(CABINET_ASSETS);

/** Drehpunkt des Zeigers in der getrimmten Nadel-Textur. */
export const GAUGE_NEEDLE_ANCHOR_Y = 0.806;

export interface CabinetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotCabinetGrid {
  reels: number;
  rows: number;
  cellSize: number;
  gap: number;
  offsetX: number;
  offsetY: number;
  rowGap: number;
  rowPitch: number;
}

export function cabinetCanvasSize(rawWidth: number): { totalW: number; totalH: number; frameH: number } {
  const totalW = Math.max(260, Math.floor(rawWidth));
  const frameH = Math.max(180, Math.ceil(totalW / CABINET_FRAME_ASPECT));
  const totalH = Math.max(frameH + 80, Math.ceil(frameH / (1 - CABINET_CONSOLE_FRAC)));
  return { totalW, totalH, frameH };
}

export function cabinetFrameHeight(totalH: number): number {
  return Math.round(totalH * (1 - CABINET_CONSOLE_FRAC));
}

export function cabinetOpening(totalW: number, totalH: number): CabinetRect {
  const frameH = cabinetFrameHeight(totalH);
  const x = Math.round(totalW * 0.055);
  const y = Math.round(frameH * 0.048);
  const bottom = Math.round(frameH * 0.028);
  return {
    x,
    y,
    w: Math.max(1, totalW - x * 2),
    h: Math.max(1, frameH - y - bottom),
  };
}

export function cabinetWell(totalW: number, totalH: number): CabinetRect {
  return cabinetOpening(totalW, totalH);
}

export function cabinetShortEdge(totalW: number, totalH: number): number {
  return Math.min(totalW, cabinetFrameHeight(totalH));
}

/** Obere Leiste vor der Maske — die sichtbare Messingkante endet an der Öffnung. */
export function cabinetTopRailRect(totalW: number, totalH: number): CabinetRect {
  const short = cabinetShortEdge(totalW, totalH);
  const w = totalW * CABINET_TOP_RAIL_W_OF_TOTAL;
  return {
    x: (totalW - w) / 2,
    y: short * CABINET_TOP_RAIL_Y_OF_SHORT,
    w,
    h: short * CABINET_TOP_RAIL_H_OF_SHORT,
  };
}

/**
 * Untere Messingkante der oberen Leiste, geklemmt auf die Öffnungsoberkante.
 * Das Kronenzahnrad sitzt auf dieser Kante und bleibt oberhalb der Öffnung.
 */
export function cabinetTopRailBrassY(totalW: number, totalH: number): number {
  const rail = cabinetTopRailRect(totalW, totalH);
  const opening = cabinetOpening(totalW, totalH);
  return Math.min(rail.y + rail.h, opening.y);
}

export function cabinetCrownGearRect(totalW: number, totalH: number): CabinetRect {
  const size = cabinetShortEdge(totalW, totalH) * CABINET_CROWN_GEAR_OF_SHORT;
  const bottom = cabinetTopRailBrassY(totalW, totalH);
  return {
    x: totalW * 0.5 - size / 2,
    y: bottom - size,
    w: size,
    h: size,
  };
}
