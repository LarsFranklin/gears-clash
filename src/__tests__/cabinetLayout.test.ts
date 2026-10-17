import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CABINET_ASSET_PATHS,
  CABINET_ASPECT,
  cabinetCanvasSize,
  cabinetCrownGearRect,
  cabinetOpening,
  cabinetTopRailBrassY,
} from '../renderer/cabinetLayout';

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

  it('hält die Unterkante des Kronenzahnrads auf der Messingkante, nicht in der Öffnung', () => {
    const desktopWidths = [1280, 1366, 1440, 1600, 1920];
    for (const rawWidth of desktopWidths) {
      const { totalW, totalH } = cabinetCanvasSize(rawWidth);
      const opening = cabinetOpening(totalW, totalH);
      const crown = cabinetCrownGearRect(totalW, totalH);
      const brassY = cabinetTopRailBrassY(totalW, totalH);
      const crownBottom = crown.y + crown.h;

      expect(crownBottom, `${rawWidth}px`).toBeLessThanOrEqual(opening.y);
      expect(crownBottom, `${rawWidth}px`).toBeCloseTo(brassY, 5);
      expect(brassY, `${rawWidth}px`).toBeLessThanOrEqual(opening.y);
    }
  });
});
