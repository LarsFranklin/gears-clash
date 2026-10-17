import { describe, expect, it } from 'vitest';
import { cabinetCanvasSize } from '../renderer/cabinetLayout';
import {
  CONTROL_KEY_PX,
  PLAYER_STAGE_MAX_WIDTH,
  layoutCabinetInViewport,
  spinKeySizePx,
} from '../renderer/cabinetViewport';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
] as const;

function assertFitsViewport(
  layout: ReturnType<typeof layoutCabinetInViewport>,
  viewportHeight: number,
): void {
  expect(layout.cabinet.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(layout.console.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(layout.spin.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(layout.opening.top).toBeGreaterThanOrEqual(0);
  expect(layout.opening.bottom).toBeLessThanOrEqual(viewportHeight);
}

describe('Schrank-Viewport-Bounds', () => {
  it('hält Konsole und Spin bei 1920×1080 und 1366×768 im Viewport', () => {
    for (const vp of VIEWPORTS) {
      const layout = layoutCabinetInViewport(vp);
      assertFitsViewport(layout, vp.height);
      expect(layout.cabinet.top).toBeGreaterThanOrEqual(0);
      expect(layout.cabinet.left).toBeGreaterThanOrEqual(0);
      expect(layout.cabinet.right).toBeLessThanOrEqual(vp.width);
    }
  });

  it('skaliert gleichmäßig — kein Strecken gegenüber dem Intrinsic-Maß', () => {
    const intrinsic = cabinetCanvasSize(PLAYER_STAGE_MAX_WIDTH);
    const layout = layoutCabinetInViewport({ width: 1366, height: 768 });
    expect(layout.cabinet.width / intrinsic.totalW).toBeCloseTo(
      layout.cabinet.height / intrinsic.totalH,
      2,
    );
    expect(layout.fit.scale).toBeLessThan(1);
  });

  it('lässt Spin bei 1366×768 klar größer als die übrigen Tasten', () => {
    const spin = spinKeySizePx(1366);
    expect(spin).toBeGreaterThan(CONTROL_KEY_PX * 1.25);
  });

  it('Gegenprobe: Breite-only ragt bei 1366×768 über den Viewport', () => {
    const legacy = layoutCabinetInViewport(
      { width: 1366, height: 768 },
      { widthOnly: true },
    );
    expect(legacy.cabinet.height).toBeGreaterThan(768);
    expect(legacy.console.bottom <= 768).toBe(false);
    expect(legacy.spin.bottom <= 768).toBe(false);
    expect(() => {
      expect(legacy.console.bottom).toBeLessThanOrEqual(768);
    }).toThrow();
    expect(() => {
      expect(legacy.spin.bottom).toBeLessThanOrEqual(768);
    }).toThrow();
  });

  it('Gegenprobe: unskalierter Schrank passt nicht in 800×500', () => {
    const tooSmall = { width: 800, height: 500 };
    const unscaled = layoutCabinetInViewport(tooSmall, { widthOnly: true });
    expect(unscaled.console.bottom).toBeGreaterThan(tooSmall.height);
    expect(unscaled.spin.bottom).toBeGreaterThan(tooSmall.height);

    const fitted = layoutCabinetInViewport(tooSmall);
    assertFitsViewport(fitted, tooSmall.height);
  });
});
