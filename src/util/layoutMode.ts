/**
 * Responsive Präsentation — Breakpoints laut `gears_clash_responsive_desktop_mobile_strategy.md`.
 * FX-Stufe leitet sich standardmäßig vom Layout ab (Mobile weniger Last).
 */

export type GcLayoutMode = 'compact' | 'standard' | 'wide' | 'ultrawide';

export type GcFxQuality = 'low' | 'medium' | 'high' | 'ultra';

export function resolveGcLayoutMode(containerWidthPx: number): GcLayoutMode {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx < 1) {
    return 'standard';
  }
  if (containerWidthPx < 640) return 'compact';
  if (containerWidthPx < 1024) return 'standard';
  if (containerWidthPx < 1600) return 'wide';
  return 'ultrawide';
}

export function defaultFxQualityForLayout(mode: GcLayoutMode): GcFxQuality {
  switch (mode) {
    case 'compact':
      return 'low';
    case 'standard':
      return 'medium';
    case 'wide':
      return 'high';
    case 'ultrawide':
      return 'ultra';
    default:
      return 'medium';
  }
}
