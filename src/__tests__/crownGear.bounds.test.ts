import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Graphics, Sprite, Texture, TextureSource, TilingSprite } from 'pixi.js';
import { CABINET_ASSETS, cabinetFrameHeight, cabinetOpening } from '../renderer/cabinetLayout';
import { placeCabinetOrnaments, placeCabinetWindow } from '../renderer/cabinetPlacement';

const SCREENS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
] as const;

function pngSize(relUrl: string): { width: number; height: number } {
  const file = path.join(process.cwd(), 'public', relUrl.replace(/^\//, ''));
  const data = fs.readFileSync(file);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function textureOfSize(width: number, height: number): Texture {
  return new Texture({ source: new TextureSource({ width, height }) });
}

function spriteOfSize(width: number, height: number, anchor = 0.5): Sprite {
  const sprite = new Sprite(textureOfSize(width, height));
  sprite.anchor.set(anchor);
  return sprite;
}

/**
 * Baut dieselbe Platzierung wie der Schrank und misst Pixi-Weltbounds.
 * `Sprite.getBounds()` / `TilingSprite.getBounds()` — y wächst nach unten.
 */
function layoutCrownAndOpening(totalW: number, totalH: number): {
  gear: Sprite;
  opening: TilingSprite;
} {
  const gearSize = pngSize(CABINET_ASSETS.gearLarge);
  const plateSize = pngSize(CABINET_ASSETS.plate);
  const dummy = pngSize(CABINET_ASSETS.gearSmall);
  const frameH = cabinetFrameHeight(totalH);
  const short = Math.min(totalW, frameH);

  const openingPlate = new TilingSprite({
    texture: textureOfSize(plateSize.width, plateSize.height),
    width: 10,
    height: 10,
  });
  const glow = spriteOfSize(64, 64);
  const steamMask = new Graphics();
  placeCabinetWindow(openingPlate, glow, steamMask, totalW, cabinetOpening(totalW, totalH));

  const large = spriteOfSize(gearSize.width, gearSize.height);
  const medium = spriteOfSize(dummy.width, dummy.height);
  const small = spriteOfSize(dummy.width, dummy.height);
  const gauges = [spriteOfSize(dummy.width, dummy.height), spriteOfSize(dummy.width, dummy.height)];
  const needles = [spriteOfSize(8, 32), spriteOfSize(8, 32)];
  const vent = spriteOfSize(dummy.width, dummy.height);
  vent.anchor.set(0.5, 1);
  const pipes = [spriteOfSize(64, 16), spriteOfSize(64, 16)];
  placeCabinetOrnaments(
    [large, medium, small],
    gauges,
    needles,
    vent,
    pipes,
    totalW,
    totalH,
    frameH,
    short,
  );

  return { gear: large, opening: openingPlate };
}

describe('Kronenzahnrad — gerenderte Bounds', () => {
  it('hält gear.bottom <= opening.top in Bildschirmkoordinaten (Pixi getBounds)', () => {
    for (const screen of SCREENS) {
      const { gear, opening } = layoutCrownAndOpening(screen.width, screen.height);
      const gearBounds = gear.getBounds();
      const openingBounds = opening.getBounds();

      expect(gearBounds.bottom, `${screen.width}x${screen.height}`).toBeLessThanOrEqual(
        openingBounds.top,
      );

      gear.y += 1;
      const moved = gear.getBounds();
      expect(
        moved.bottom,
        `${screen.width}x${screen.height} +1px muss die Bedingung verletzen`,
      ).toBeGreaterThan(openingBounds.top);
    }
  });
});
