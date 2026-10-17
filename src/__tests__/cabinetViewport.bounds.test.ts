import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cabinetCanvasSize } from '../renderer/cabinetLayout';
import {
  CABINET_FIT_MARGIN_BOTTOM_PX,
  CABINET_FIT_MARGIN_TOP_PX,
  CABINET_RENDER_ASPECT,
  CONTROL_KEY_PX,
  MACHINE_DECK_BOTTOM_PCT,
  MACHINE_DECK_HEIGHT_PCT,
  MACHINE_DECK_INSET_X_PCT,
  PLAYER_STAGE_MAX_HEIGHT,
  PLAYER_STAGE_MAX_WIDTH,
  cabinetCssVars,
  layoutCabinetInViewport,
  spinKeySizePx,
} from '../renderer/cabinetViewport';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
] as const;

function assertFitsViewport(
  layout: ReturnType<typeof layoutCabinetInViewport>,
  vp: { width: number; height: number },
): void {
  expect(layout.cabinet.bottom).toBeLessThanOrEqual(vp.height);
  expect(layout.console.bottom).toBeLessThanOrEqual(vp.height);
  expect(layout.spin.bottom).toBeLessThanOrEqual(vp.height);
  expect(layout.opening.top).toBeGreaterThanOrEqual(0);
  expect(layout.opening.bottom).toBeLessThanOrEqual(vp.height);
  expect(layout.keyRow.bottom).toBeLessThanOrEqual(layout.plate.bottom);
  expect(layout.keyRow.left).toBeGreaterThanOrEqual(layout.plate.left);
  expect(layout.keyRow.right).toBeLessThanOrEqual(layout.plate.right);
}

describe('Schrank-Viewport-Bounds', () => {
  it('hält Konsole, Spin und Tastenreihe bei 1920×1080 und 1366×768 im Viewport', () => {
    for (const vp of VIEWPORTS) {
      const layout = layoutCabinetInViewport(vp);
      assertFitsViewport(layout, vp);
      expect(layout.cabinet.top).toBeGreaterThanOrEqual(0);
      expect(layout.cabinet.left).toBeGreaterThanOrEqual(0);
      expect(layout.cabinet.right).toBeLessThanOrEqual(vp.width);
    }
  });

  it('hält bei 1366×768 16 px Luft oben und unten', () => {
    const layout = layoutCabinetInViewport({ width: 1366, height: 768 });
    expect(layout.cabinet.top).toBeGreaterThanOrEqual(CABINET_FIT_MARGIN_TOP_PX);
    expect(layout.cabinet.bottom).toBeLessThanOrEqual(
      768 - CABINET_FIT_MARGIN_BOTTOM_PX,
    );
  });

  it('lässt den 1920×1080-Rand größer als 16 px', () => {
    const layout = layoutCabinetInViewport({ width: 1920, height: 1080 });
    expect(layout.cabinet.top).toBeGreaterThan(CABINET_FIT_MARGIN_TOP_PX);
    expect(layout.fit.scale).toBe(1);
  });

  it('skaliert gleichmäßig — kein Strecken gegenüber dem Intrinsic-Maß', () => {
    const intrinsic = cabinetCanvasSize(PLAYER_STAGE_MAX_WIDTH);
    const layout = layoutCabinetInViewport({ width: 1366, height: 768 });
    expect(layout.cabinet.width / intrinsic.totalW).toBeCloseTo(
      layout.cabinet.height / intrinsic.totalH,
      2,
    );
    expect(layout.scale).toBeLessThan(1);
  });

  it('nutzt das gerenderte Aspect 920/993, nicht 0.928', () => {
    expect(PLAYER_STAGE_MAX_HEIGHT).toBe(993);
    expect(CABINET_RENDER_ASPECT).toBeCloseTo(920 / 993, 10);
    expect(cabinetCssVars()['--gc-cabinet-aspect']).toBe('920 / 993');
  });

  it('lässt Spin bei 1366×768 klar größer als die übrigen Tasten', () => {
    const layout = layoutCabinetInViewport({ width: 1366, height: 768 });
    const spin = spinKeySizePx(layout.fit.totalW, layout.scale);
    expect(spin).toBeGreaterThan(CONTROL_KEY_PX * layout.scale * 1.25);
  });

  it('Gegenprobe: Breite-only ragt bei 1366×768 über den Viewport', () => {
    const legacy = layoutCabinetInViewport(
      { width: 1366, height: 768 },
      { widthOnly: true },
    );
    expect(legacy.cabinet.height).toBeGreaterThan(768);
    expect(legacy.console.bottom <= 768).toBe(false);
    expect(legacy.spin.bottom <= 768).toBe(false);
    expect(legacy.cabinet.top >= 16).toBe(false);
    expect(legacy.keyRow.bottom <= 768).toBe(false);
    expect(() => {
      expect(legacy.console.bottom).toBeLessThanOrEqual(768);
    }).toThrow();
    expect(() => {
      expect(legacy.spin.bottom).toBeLessThanOrEqual(768);
    }).toThrow();
    expect(() => {
      expect(legacy.cabinet.top).toBeGreaterThanOrEqual(16);
    }).toThrow();
    expect(() => {
      expect(legacy.keyRow.bottom).toBeLessThanOrEqual(legacy.plate.bottom);
      expect(legacy.keyRow.bottom).toBeLessThanOrEqual(768);
    }).toThrow();
  });

  it('Gegenprobe: ohne Fit-Rand sitzt der Rahmen bei 1366 auf der Kante', () => {
    const flush = layoutCabinetInViewport(
      { width: 1366, height: 768 },
      { noMargin: true },
    );
    expect(flush.cabinet.top).toBeLessThan(CABINET_FIT_MARGIN_TOP_PX);
    expect(flush.cabinet.bottom).toBeGreaterThan(768 - CABINET_FIT_MARGIN_BOTTOM_PX);
    expect(() => {
      expect(flush.cabinet.top).toBeGreaterThanOrEqual(16);
    }).toThrow();
    expect(() => {
      expect(flush.cabinet.bottom).toBeLessThanOrEqual(752);
    }).toThrow();
  });

  it('Gegenprobe: unskalierter Schrank passt nicht in 800×500', () => {
    const tooSmall = { width: 800, height: 500 };
    const unscaled = layoutCabinetInViewport(tooSmall, { widthOnly: true });
    expect(unscaled.console.bottom).toBeGreaterThan(tooSmall.height);
    expect(unscaled.spin.bottom).toBeGreaterThan(tooSmall.height);

    const fitted = layoutCabinetInViewport(tooSmall);
    assertFitsViewport(fitted, tooSmall);
  });
});

describe('CSS-Fallbacks = TS-Konstanten', () => {
  const demoCss = fs.readFileSync(
    path.join(process.cwd(), 'src/styles/demo.css'),
    'utf8',
  );
  const machineCss = fs.readFileSync(
    path.join(process.cwd(), 'src/styles/machine.css'),
    'utf8',
  );

  it('hält Aspect, Max-Breite und Fit-Ränder in demo.css', () => {
    expect(demoCss).toMatch(
      new RegExp(`--gc-cabinet-max-width:\\s*${PLAYER_STAGE_MAX_WIDTH}px`),
    );
    expect(demoCss).toMatch(
      /--gc-cabinet-aspect:\s*calc\(\s*920\s*\/\s*993\s*\)/,
    );
    expect(demoCss).toMatch(
      new RegExp(`--gc-fit-margin-top:\\s*${CABINET_FIT_MARGIN_TOP_PX}px`),
    );
    expect(demoCss).toMatch(
      new RegExp(`--gc-fit-margin-bottom:\\s*${CABINET_FIT_MARGIN_BOTTOM_PX}px`),
    );
  });

  it('hält Deck-Anteile und Tastenmaße in machine.css', () => {
    expect(machineCss).toMatch(
      new RegExp(
        `--gc-deck-inset-x,\\s*${MACHINE_DECK_INSET_X_PCT}%`.replace(
          '.',
          '\\.',
        ),
      ),
    );
    expect(machineCss).toMatch(
      new RegExp(
        `--gc-deck-bottom,\\s*${MACHINE_DECK_BOTTOM_PCT}%`.replace('.', '\\.'),
      ),
    );
    expect(machineCss).toMatch(
      new RegExp(
        `--gc-deck-height,\\s*${MACHINE_DECK_HEIGHT_PCT}%`.replace('.', '\\.'),
      ),
    );
    expect(machineCss).toMatch(/--gc-control-key,\s*32px/);
    expect(machineCss).toMatch(/--gc-spin-min,\s*2\.8rem/);
    expect(machineCss).toMatch(/--gc-spin-max,\s*3\.6rem/);
    expect(machineCss).toMatch(/--gc-font-min,\s*12px/);
  });
});
