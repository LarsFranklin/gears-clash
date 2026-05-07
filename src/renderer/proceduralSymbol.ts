import type { SymbolDef } from '../config/types';

const HIGH_IDS = new Set(['bolt', 'gear', 'piston', 'wild_gear']);

export function isHighSymbol(symbolId: string): boolean {
  return HIGH_IDS.has(symbolId);
}

/**
 * Prozedurales Icon in lokalem Koordinatensystem (0,0)–(size,size).
 */
export function drawProceduralSymbol(
  g: import('pixi.js').Graphics,
  symbolId: string,
  def: SymbolDef | undefined,
  size: number,
  timeSec: number,
): void {
  g.clear();
  const cx = size * 0.5;
  const cy = size * 0.52;
  const hi = isHighSymbol(symbolId) || def?.kind === 'bonus' || def?.kind === 'wild';
  const pulse =
    def?.kind === 'bonus' ? 0.55 + 0.45 * Math.sin(timeSec * 5.5) : 1;
  const r = size * (hi ? 0.3 : 0.24) * (def?.kind === 'bonus' ? 0.92 + 0.08 * pulse : 1);

  if (def?.kind === 'wild') {
    drawWildStar(g, cx, cy, r * 1.35, timeSec);
    return;
  }
  if (def?.kind === 'bonus') {
    drawBonusDiamond(g, cx, cy, r * 1.1, symbolId, timeSec);
    return;
  }

  switch (symbolId) {
    case 'bolt':
      drawBolt(g, cx, cy, r);
      break;
    case 'nut':
      drawHex(g, cx, cy, r * 0.95, 6);
      g.fill({ color: 0x9898a8 });
      break;
    case 'gear':
      drawGear(g, cx, cy, r * 1.05, timeSec * 0.35);
      break;
    case 'coil':
      drawCoil(g, cx, cy, r);
      break;
    case 'piston':
      drawPiston(g, cx, cy, r);
      break;
    case 'wrench':
      drawWrench(g, cx, cy, r);
      break;
    case 'rivet':
      drawRivet(g, cx, cy, r * 0.5);
      break;
    case 'plate':
      drawPlate(g, cx, cy, r * 1.1);
      break;
    case 'cable':
      drawCable(g, cx, cy, r);
      break;
    case 'valve':
      drawValve(g, cx, cy, r);
      break;
    default:
      drawGenericBolt(g, cx, cy, r * 0.85);
  }

  if (hi && def?.kind === 'normal') {
    g.stroke({ width: 1.2, color: 0xc9a227, alpha: 0.35 * pulse });
  }
}

function drawWildStar(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  t: number,
): void {
  const rot = t * 0.6;
  const spikes = 8;
  const inner = rad * 0.42;
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? rad : inner;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.poly(pts, true);
  g.fill({ color: 0xf5d878, alpha: 0.95 });
  g.stroke({ width: 2.2, color: 0xffeeaa, alpha: 0.9 });
  g.circle(cx, cy, inner * 0.55);
  g.fill({ color: 0xfff8e0, alpha: 0.35 });
}

function drawBonusDiamond(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  symbolId: string,
  t: number,
): void {
  const wobble = Math.sin(t * 6) * 0.04 * rad;
  const pts = [cx, cy - rad - wobble, cx + rad, cy, cx, cy + rad, cx - rad, cy];
  g.poly(pts, true);
  let fill = 0xe88820;
  if (symbolId.includes('heist')) fill = 0x38b8f0;
  else if (symbolId.includes('deadlock')) fill = 0xd050a0;
  g.fill({ color: fill, alpha: 0.92 });
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
}

function drawBolt(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.roundRect(cx - rad * 0.35, cy - rad * 1.1, rad * 0.7, rad * 1.35, rad * 0.15);
  g.fill({ color: 0xc8c8d8 });
  drawHex(g, cx, cy - rad * 0.85, rad * 0.55, 6);
  g.fill({ color: 0xa8a8b8 });
}

function drawHex(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  n: number,
): void {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.poly(pts, true);
}

function drawGear(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  rot: number,
): void {
  const teeth = 10;
  const pts: number[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = rot + (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? rad : rad * 0.72;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.poly(pts, true);
  g.fill({ color: 0x8898a8 });
  g.circle(cx, cy, rad * 0.45);
  g.fill({ color: 0x5a6878 });
  g.circle(cx, cy, rad * 0.18);
  g.fill({ color: 0x2a3238 });
}

function drawCoil(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  const rings = [0.88, 0.62, 0.38] as const;
  for (let i = 0; i < rings.length; i++) {
    g.circle(cx, cy, rad * rings[i]!);
    g.stroke({
      width: 2 - i * 0.35,
      color: 0x708090,
      alpha: 0.75 - i * 0.18,
    });
  }
}

function drawPiston(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.roundRect(cx - rad * 0.45, cy - rad * 0.9, rad * 0.9, rad * 1.25, rad * 0.12);
  g.fill({ color: 0x708090 });
  g.rect(cx - rad * 0.55, cy + rad * 0.15, rad * 1.1, rad * 0.35);
  g.fill({ color: 0x4a5860 });
}

function drawWrench(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.roundRect(cx - rad * 0.15, cy - rad * 1.05, rad * 0.3, rad * 1.5, rad * 0.08);
  g.fill({ color: 0x9098a8 });
  g.circle(cx, cy + rad * 0.55, rad * 0.35);
  g.fill({ color: 0x787888 });
}

function drawRivet(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.circle(cx, cy, rad);
  g.fill({ color: 0x888898 });
  g.circle(cx, cy, rad * 0.45);
  g.fill({ color: 0x505058 });
}

function drawPlate(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.roundRect(cx - rad, cy - rad * 0.55, rad * 2, rad * 1.1, rad * 0.12);
  g.fill({ color: 0x686878 });
  g.roundRect(cx - rad * 0.75, cy - rad * 0.35, rad * 1.5, rad * 0.7, rad * 0.08);
  g.fill({ color: 0x484858 });
}

function drawCable(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  const w = rad * 1.2;
  for (let i = 0; i < 5; i++) {
    const x = cx - w / 2 + (i / 4) * w;
    const y = cy + Math.sin(i * 0.9) * rad * 0.25;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke({ width: 3, color: 0x607080, cap: 'round' });
}

function drawValve(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  g.circle(cx, cy, rad * 0.85);
  g.fill({ color: 0x586878 });
  g.rect(cx - rad * 0.12, cy - rad * 1.15, rad * 0.24, rad * 0.55);
  g.fill({ color: 0x9098a8 });
}

function drawGenericBolt(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
): void {
  drawHex(g, cx, cy, rad, 6);
  g.fill({ color: 0x787888 });
}
