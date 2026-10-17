import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Container, Texture, TextureSource } from 'pixi.js';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { CABINET_ASSETS, cabinetOpening } from '../renderer/cabinetLayout';
import { SlotCabinet } from '../renderer/SlotCabinet';
import { ROW_GAP } from '../renderer/ReelColumn';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
] as const;

function pngSize(relUrl: string): { width: number; height: number } {
  const file = path.join(process.cwd(), 'public', relUrl.replace(/^\//, ''));
  const data = fs.readFileSync(file);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function texturesFromCabinetFiles(): Map<string, Texture> {
  const textures = new Map<string, Texture>();
  for (const url of Object.values(CABINET_ASSETS)) {
    const { width, height } = pngSize(url);
    textures.set(url, new Texture({ source: new TextureSource({ width, height }) }));
  }
  return textures;
}

function gridForOpening(
  opening: { x: number; y: number; w: number; h: number },
): Parameters<SlotCabinet['layout']>[3] {
  const { reels, rows } = defaultGameConfig.grid;
  const gap = 4;
  const cellSize = Math.max(40, Math.floor((opening.w - gap * (reels - 1)) / reels));
  const rowPitch = Math.max(44, Math.floor(opening.h / rows));
  const gridW = reels * cellSize + (reels - 1) * gap;
  const gridH = rows * rowPitch;
  return {
    reels,
    rows,
    cellSize,
    gap,
    offsetX: opening.x + Math.floor((opening.w - gridW) / 2),
    offsetY: opening.y + Math.floor((opening.h - gridH) / 2),
    rowGap: ROW_GAP,
    rowPitch,
  };
}

describe('Kronenzahnrad — gerenderte Bounds', () => {
  it('hält gear.bottom <= opening.top nach SlotCabinet.layout (Pixi getBounds)', () => {
    const cabinet = SlotCabinet.fromTextures(texturesFromCabinetFiles());
    const stage = new Container();
    stage.addChild(cabinet.back);
    stage.addChild(cabinet.front);

    try {
      for (const viewport of VIEWPORTS) {
        const opening = cabinetOpening(viewport.width, viewport.height);
        const grid = gridForOpening(opening);
        cabinet.layout(viewport.width, viewport.height, opening, grid);

        const gear = cabinet.crownGearSprite();
        const plate = cabinet.windowOpeningSprite();
        const gearBounds = gear.getBounds();
        const plateBounds = plate.getBounds();
        const label = `${viewport.width}x${viewport.height}`;

        expect(plateBounds.x, `${label} plate.x`).toBe(opening.x);
        expect(plateBounds.y, `${label} plate.y`).toBe(opening.y);
        expect(plateBounds.width, `${label} plate.width`).toBe(opening.w);
        expect(plateBounds.height, `${label} plate.height`).toBe(opening.h);

        expect(gearBounds.bottom, label).toBeLessThanOrEqual(plateBounds.top);
        expect(gearBounds.bottom, `${label} Reihe 1`).toBeLessThanOrEqual(grid.offsetY);

        const originalY = gear.y;
        const overlapBottom = plateBounds.top + 1;
        gear.y += overlapBottom - gearBounds.bottom;
        const moved = gear.getBounds();
        expect(moved.bottom, `${label} bounds.bottom = opening.top + 1`).toBe(plateBounds.top + 1);
        expect(moved.bottom, `${label} Negativfall`).toBeGreaterThan(plateBounds.top);
        gear.y = originalY;
      }
    } finally {
      cabinet.destroy();
    }
  });
});
