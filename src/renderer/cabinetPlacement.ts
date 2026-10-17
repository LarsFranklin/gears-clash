import { Container, Graphics, NineSliceSprite, Sprite, Texture, TilingSprite } from 'pixi.js';
import { CABINET_CORNER_OF_SHORT, type CabinetRect, type SlotCabinetGrid } from './cabinetLayout';

export function spriteOf(texture: Texture): Sprite {
  const sprite = new Sprite(texture);
  sprite.eventMode = 'none';
  return sprite;
}

export function rail(texture: Texture, capX: number, capY: number): NineSliceSprite {
  const slice = new NineSliceSprite({
    texture,
    leftWidth: Math.max(4, Math.round(texture.width * capX)),
    rightWidth: Math.max(4, Math.round(texture.width * capX)),
    topHeight: Math.max(4, Math.round(texture.height * capY)),
    bottomHeight: Math.max(4, Math.round(texture.height * capY)),
    width: texture.width,
    height: texture.height,
  });
  slice.eventMode = 'none';
  return slice;
}

export function fitUniform(sprite: Sprite, maxSize: number): void {
  const longest = Math.max(sprite.texture.width, sprite.texture.height, 1);
  sprite.scale.set(maxSize / longest);
}

export function mixColor(from: number, to: number, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  return (
    ((Math.round(fr + (tr - fr) * u) & 0xff) << 16) |
    ((Math.round(fg + (tg - fg) * u) & 0xff) << 8) |
    (Math.round(fb + (tb - fb) * u) & 0xff)
  );
}

export function placeCabinetWindow(
  plate: TilingSprite,
  glow: Sprite,
  steamBackMask: Graphics,
  totalW: number,
  opening: CabinetRect,
): void {
  plate.position.set(opening.x, opening.y);
  plate.width = opening.w;
  plate.height = opening.h;
  const texW = Math.max(1, plate.texture.width);
  const texH = Math.max(1, plate.texture.height);
  plate.tileScale.set(opening.w / texW, opening.h / texH);
  plate.tilePosition.set(0, 0);

  glow.position.set(totalW * 0.5, opening.y + opening.h * 0.42);
  fitUniform(glow, opening.w * 0.85);

  steamBackMask.clear();
  steamBackMask.rect(opening.x, opening.y, opening.w, opening.h);
  steamBackMask.fill({ color: 0xffffff });
}

export function placeCabinetShell(
  corners: Sprite[],
  rails: Record<'top' | 'bottom' | 'left' | 'right', NineSliceSprite>,
  totalW: number,
  totalH: number,
  frameH: number,
  short: number,
): void {
  const corner = short * CABINET_CORNER_OF_SHORT;
  const spots: [number, number][] = [
    [0, 0],
    [totalW, 0],
    [0, totalH],
    [totalW, totalH],
  ];
  corners.forEach((sprite, i) => {
    fitUniform(sprite, corner);
    const [x, y] = spots[i]!;
    sprite.position.set(x, y);
  });

  sizeRail(rails.top, totalW * 0.7, short * 0.07, 0.08, 0.06);
  rails.top.position.set((totalW - rails.top.width) / 2, short * 0.004);

  sizeRail(rails.bottom, totalW * 0.7, short * 0.055, 0.08, 0.06);
  rails.bottom.position.set((totalW - rails.bottom.width) / 2, frameH - rails.bottom.height * 0.35);

  const sideH = totalH * 0.86;
  sizeRail(rails.left, short * 0.065, sideH, 0.08, 0.1);
  rails.left.position.set(short * 0.004, (totalH - rails.left.height) / 2);

  sizeRail(rails.right, short * 0.065, sideH, 0.08, 0.1);
  rails.right.position.set(totalW - rails.right.width - short * 0.004, (totalH - rails.right.height) / 2);
}

export function placeCabinetOrnaments(
  gears: Sprite[],
  gauges: Sprite[],
  needles: Sprite[],
  vent: Sprite,
  pipes: Sprite[],
  totalW: number,
  frameH: number,
  short: number,
): void {
  const [large, medium, small] = gears;
  fitUniform(large!, short * 0.16);
  large!.position.set(totalW * 0.5, short * 0.055);
  fitUniform(medium!, short * 0.075);
  medium!.position.set(short * 0.07, frameH * 0.2);
  fitUniform(small!, short * 0.058);
  small!.position.set(totalW - short * 0.065, frameH * 0.78);

  const gaugeSize = short * 0.1;
  const gaugeX = [totalW * 0.03, totalW - totalW * 0.03];
  gauges.forEach((gauge, i) => {
    fitUniform(gauge, gaugeSize);
    gauge.position.set(gaugeX[i]!, frameH * 0.5);
    const needle = needles[i]!;
    needle.position.copyFrom(gauge.position);
    needle.scale.set((gaugeSize * 0.7) / needle.texture.height);
  });

  fitUniform(vent, short * 0.22);
  vent.position.set(totalW * 0.5, frameH - 2);

  const pipeW = short * 0.13;
  pipes.forEach((pipe, i) => {
    pipe.scale.set(pipeW / pipe.texture.width);
    pipe.position.set(i === 0 ? totalW * 0.28 : totalW * 0.72, short * 0.04);
  });
}

export function placeCabinetConsole(
  plate: TilingSprite,
  lip: Sprite,
  totalW: number,
  totalH: number,
  frameH: number,
): void {
  plate.position.set(0, frameH - 6);
  plate.width = totalW;
  plate.height = totalH - frameH + 6;
  const texW = Math.max(1, plate.texture.width);
  const texH = Math.max(1, plate.texture.height);
  plate.tileScale.set(totalW / texW, plate.height / texH);
  plate.tilePosition.set(0, 0);

  const lipScale = totalW / Math.max(1, lip.texture.width);
  lip.scale.set(lipScale, Math.min(lipScale, 28 / Math.max(1, lip.texture.height)));
  lip.position.set(0, frameH - lip.height * 0.45);
}

export function placeCabinetLattice(
  lattice: Container,
  dividerH: Texture,
  dividerV: Texture,
  rivetTex: Texture,
  grid: SlotCabinetGrid,
): void {
  for (const child of lattice.removeChildren()) child.destroy();
  const bar = Math.max(3, Math.round(grid.cellSize * 0.028));
  const gridW = grid.reels * grid.cellSize + (grid.reels - 1) * grid.gap;
  const gridH = grid.rows * grid.rowPitch;

  for (let r = 1; r < grid.rows; r++) {
    const y = grid.offsetY + r * grid.rowPitch;
    const divider = new Sprite(dividerH);
    divider.anchor.set(0, 0.5);
    divider.position.set(grid.offsetX, y);
    divider.width = gridW;
    divider.height = bar;
    lattice.addChild(divider);
  }
  for (let c = 1; c < grid.reels; c++) {
    const x = grid.offsetX + c * grid.cellSize + (c - 1) * grid.gap + grid.gap / 2;
    const divider = new Sprite(dividerV);
    divider.anchor.set(0.5, 0);
    divider.position.set(x, grid.offsetY);
    divider.width = bar;
    divider.height = gridH;
    lattice.addChild(divider);
  }
  const rivetSize = bar * 2.3;
  for (let c = 1; c < grid.reels; c++) {
    for (let r = 1; r < grid.rows; r++) {
      const x = grid.offsetX + c * grid.cellSize + (c - 1) * grid.gap + grid.gap / 2;
      const y = grid.offsetY + r * grid.rowPitch;
      const rivet = new Sprite(rivetTex);
      rivet.anchor.set(0.5);
      rivet.position.set(x, y);
      fitUniform(rivet, rivetSize);
      lattice.addChild(rivet);
    }
  }
}

function sizeRail(
  slice: NineSliceSprite,
  width: number,
  height: number,
  capX: number,
  capY: number,
): void {
  const tex = slice.texture;
  slice.leftWidth = Math.max(2, Math.min(Math.round(tex.width * capX), Math.floor(width * 0.22)));
  slice.rightWidth = slice.leftWidth;
  slice.topHeight = Math.max(2, Math.min(Math.round(tex.height * capY), Math.floor(height * 0.22)));
  slice.bottomHeight = slice.topHeight;
  slice.width = Math.max(slice.leftWidth + slice.rightWidth + 1, width);
  slice.height = Math.max(slice.topHeight + slice.bottomHeight + 1, height);
}
