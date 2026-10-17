/**
 * Maße des zusammengesetzten Walzen-Schranks.
 * Die Innenöffnung liegt innerhalb der Eckblöcke, damit die Symbole frei bleiben.
 */

export const CABINET_ASPECT = 1.16;

/** Eck-Sprite relativ zur kürzeren Canvas-Kante. */
export const CABINET_CORNER_OF_SHORT = 0.5;

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
}

export function cabinetCanvasSize(rawWidth: number): { totalW: number; totalH: number } {
  const totalW = Math.max(260, Math.floor(rawWidth));
  const totalH = Math.max(220, Math.ceil(totalW / CABINET_ASPECT));
  return { totalW, totalH };
}

export function cabinetOpening(totalW: number, totalH: number): CabinetRect {
  const top = Math.round(totalH * 0.09);
  const bottom = Math.round(totalH * 0.085);
  const span = Math.min(totalH - top - bottom, Math.round(totalW * 0.84));
  const size = Math.max(1, span);
  return {
    x: Math.round((totalW - size) / 2),
    y: top,
    w: size,
    h: size,
  };
}
