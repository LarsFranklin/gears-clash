import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CABINET_ASSET_PATHS,
  CABINET_ASPECT,
  cabinetCanvasSize,
  cabinetOpening,
  fitCabinetToBox,
} from '../renderer/cabinetLayout';
import { PLAYER_STAGE_MAX_WIDTH } from '../renderer/cabinetViewport';

describe('Slot-Schrank', () => {
  it('legt jede Schrankdatei unter /assets/cabinet/', () => {
    expect(CABINET_ASSET_PATHS.length).toBeGreaterThan(10);
    for (const url of CABINET_ASSET_PATHS) {
      expect(url.startsWith('/assets/cabinet/')).toBe(true);
      expect(url.endsWith('.png')).toBe(true);
      const file = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
      expect(fs.existsSync(file), file).toBe(true);
    }
  });

  it('hält die Innenöffnung bei Beispielbreite im Canvas', () => {
    const { totalW, totalH } = cabinetCanvasSize(1000);
    const opening = cabinetOpening(totalW, totalH);
    expect(totalW / totalH).toBeCloseTo(CABINET_ASPECT, 1);
    expect(opening.x).toBeGreaterThan(0);
    expect(opening.y).toBeGreaterThan(0);
    expect(opening.w).toBeGreaterThan(totalW * 0.5);
    expect(opening.h).toBeGreaterThan(totalH * 0.5);
    expect(opening.x + opening.w).toBeLessThan(totalW);
    expect(opening.y + opening.h).toBeLessThan(totalH);
  });

  it('skaliert gleichmäßig, wenn die Box niedriger ist als der Schrank', () => {
    const intrinsic = cabinetCanvasSize(PLAYER_STAGE_MAX_WIDTH);
    const fitted = fitCabinetToBox(PLAYER_STAGE_MAX_WIDTH, 768);
    expect(fitted.totalH).toBeLessThanOrEqual(768);
    expect(fitted.totalW).toBeLessThan(intrinsic.totalW);
    expect(fitted.totalW / fitted.totalH).toBeCloseTo(
      intrinsic.totalW / intrinsic.totalH,
      2,
    );
    expect(fitted.scale).toBeCloseTo(768 / intrinsic.totalH, 5);
  });

  it('lässt eine ausreichend hohe Box unverändert', () => {
    const intrinsic = cabinetCanvasSize(PLAYER_STAGE_MAX_WIDTH);
    const fitted = fitCabinetToBox(PLAYER_STAGE_MAX_WIDTH, 1080);
    expect(fitted.totalW).toBe(intrinsic.totalW);
    expect(fitted.totalH).toBe(intrinsic.totalH);
    expect(fitted.scale).toBe(1);
  });
});
