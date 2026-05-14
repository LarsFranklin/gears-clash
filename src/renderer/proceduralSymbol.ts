import type { SymbolDef } from '../config/types';
import type { SymbolPalette } from './symbolCard';

const HIGH_IDS = new Set(['overdrive_core', 'quantum_chamber', 'wild_gear']);

export interface DrawProceduralSymbolVisualOpts {
  /** true: Bonus/Wild pulsieren und glühen (Win-Highlight, Bonus-Reveal). Idle: dezent statisch. */
  emphasizeSpecial?: boolean;
}

export function isHighSymbol(symbolId: string): boolean {
  return HIGH_IDS.has(symbolId);
}

interface IconColors {
  primary: number;
  secondary: number;
  highlight: number;
  shadow: number;
}

function getIconColors(symbolId: string, pal: SymbolPalette | undefined): IconColors {
  const mat = pal?.material ?? 'steel';
  switch (mat) {
    case 'brass':
      return { primary: 0xa89058, secondary: 0x786838, highlight: 0xc8b070, shadow: 0x4a3820 };
    case 'copper':
      return { primary: 0xa07060, secondary: 0x705040, highlight: 0xc09080, shadow: 0x402820 };
    case 'iron':
      return { primary: 0x687078, secondary: 0x485058, highlight: 0x889098, shadow: 0x303840 };
    case 'gold':
      return { primary: 0xf0d878, secondary: 0xc9a227, highlight: 0xfff0a0, shadow: 0x8a6020 };
    case 'steel':
    default:
      return { primary: 0x9898a8, secondary: 0x707080, highlight: 0xc0c0d0, shadow: 0x404050 };
  }
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
  pal?: SymbolPalette,
  visualOpts?: DrawProceduralSymbolVisualOpts,
): void {
  g.clear();
  const emphasize = visualOpts?.emphasizeSpecial === true;
  const cx = size * 0.5;
  const cy = size * 0.52;
  const hi = isHighSymbol(symbolId) || def?.kind === 'bonus' || def?.kind === 'wild';
  const pulse =
    emphasize && def?.kind === 'bonus'
      ? 0.55 + 0.45 * Math.sin(timeSec * 5.5)
      : 1;
  const r =
    size *
    (hi ? 0.3 : 0.24) *
    (def?.kind === 'bonus' && emphasize ? 0.92 + 0.08 * pulse : 1);
  const colors = getIconColors(symbolId, pal);

  if (def?.kind === 'wild') {
    drawWildStar(g, cx, cy, r * 1.35, timeSec, pal, emphasize);
    return;
  }
  if (def?.kind === 'bonus') {
    drawBonusDiamond(g, cx, cy, r * 1.1, symbolId, timeSec, pal, emphasize);
    return;
  }

  switch (symbolId) {
    case 'bolt':
      drawBolt(g, cx, cy, r, colors);
      break;
    case 'nut':
      drawNut(g, cx, cy, r * 0.95, colors);
      break;
    case 'fuse':
      drawFuse(g, cx, cy, r, colors);
      break;
    case 'steam_piston':
      drawPiston(g, cx, cy, r, colors);
      break;
    case 'fuel_canister':
      drawFuelCanister(g, cx, cy, r, colors);
      break;
    case 'reactor_pipe':
      drawReactorPipe(g, cx, cy, r, colors);
      break;
    case 'cable':
      drawCable(g, cx, cy, r, colors);
      break;
    case 'valve':
      drawValve(g, cx, cy, r, colors);
      break;
    case 'overdrive_core':
      drawReactor(g, cx, cy, r, timeSec, colors);
      break;
    case 'quantum_chamber':
      drawSteamCoreSymbol(g, cx, cy, r, timeSec, colors);
      break;
    case 'gears_vs':
      drawVsSymbol(g, cx, cy, r, timeSec);
      break;
    default:
      drawGenericBolt(g, cx, cy, r * 0.85, colors);
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
  pal: SymbolPalette | undefined,
  emphasize: boolean,
): void {
  const wobble = emphasize ? Math.sin(t * 3) * 0.02 : 0;
  const rot = emphasize ? t * 0.15 + wobble : 0;
  const spikes = 8;
  const inner = rad * 0.42;
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? rad : inner;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }

  for (let layer = 3; layer >= 0; layer--) {
    const layerPts: number[] = [];
    const scale = 1 + layer * 0.08;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]!, py = pts[i + 1]!;
      layerPts.push(cx + (px - cx) * scale, cy + (py - cy) * scale);
    }
    g.poly(layerPts, true);
    g.fill({ color: 0xf0d060, alpha: 0.08 * (4 - layer) });
  }

  g.poly(pts, true);
  g.fill({ color: 0xf5d878, alpha: 0.95 });

  g.poly(pts, true);
  g.stroke({ width: 1.5, color: 0xffe8a0, alpha: 0.6, alignment: 0 });
  g.stroke({ width: 2.5, color: 0x8a6020, alpha: 0.4, alignment: 1 });

  g.circle(cx, cy, inner * 0.55);
  g.fill({ color: 0xfff8e0, alpha: 0.4 });

  const specX = cx - rad * 0.25;
  const specY = cy - rad * 0.3;
  g.ellipse(specX, specY, rad * 0.18, rad * 0.12);
  g.fill({ color: pal?.specular ?? 0xfff8e0, alpha: pal?.specularA ?? 0.45 });
}

function drawBonusDiamond(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  symbolId: string,
  t: number,
  pal: SymbolPalette | undefined,
  emphasize: boolean,
): void {
  const wobble = emphasize ? Math.sin(t * 6) * 0.04 * rad : 0;
  const pulse = emphasize ? 0.5 + 0.5 * Math.sin(t * 5.5) : 0.72;
  const pts = [cx, cy - rad - wobble, cx + rad, cy, cx, cy + rad, cx - rad, cy];

  let fill = 0xe88820;
  if (symbolId.includes('heist')) fill = 0x38b8f0;
  else if (symbolId.includes('deadlock')) fill = 0xd050a0;
  const glowColor = pal?.glowColor ?? fill;

  for (let layer = 4; layer >= 0; layer--) {
    const layerPts: number[] = [];
    const scale = 1 + layer * 0.1;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]!, py = pts[i + 1]!;
      layerPts.push(cx + (px - cx) * scale, cy + (py - cy) * scale);
    }
    g.poly(layerPts, true);
    g.fill({ color: glowColor, alpha: (0.06 + pulse * 0.04) * (5 - layer) });
  }

  g.poly(pts, true);
  g.fill({ color: fill, alpha: 0.92 });

  g.poly(pts, true);
  g.stroke({ width: 1.5, color: pal?.bevelLight ?? 0xffffff, alpha: 0.5, alignment: 0 });
  g.stroke({ width: 2, color: pal?.bevelDark ?? 0x000000, alpha: 0.35, alignment: 1 });

  const innerPts = pts.map((v, i) => {
    const offset = i % 2 === 0 ? cx : cy;
    return offset + (v - offset) * 0.6;
  });
  g.poly(innerPts, true);
  g.fill({ color: 0xffffff, alpha: 0.12 + pulse * 0.08 });

  const specX = cx - rad * 0.2;
  const specY = cy - rad * 0.35;
  g.ellipse(specX, specY, rad * 0.15, rad * 0.1);
  g.fill({ color: pal?.specular ?? 0xffffff, alpha: pal?.specularA ?? 0.35 });
}

function drawBolt(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  g.roundRect(cx - rad * 0.35, cy - rad * 1.1, rad * 0.7, rad * 1.35, rad * 0.15);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.4, alignment: 0 });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.5, alignment: 1 });

  drawHex(g, cx, cy - rad * 0.85, rad * 0.55, 6);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.3, alignment: 0 });

  g.ellipse(cx - rad * 0.15, cy - rad * 0.95, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.35 });
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

function drawNut(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  drawHex(g, cx, cy, rad, 6);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.35, alignment: 0 });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.45, alignment: 1 });

  g.circle(cx, cy, rad * 0.35);
  g.fill({ color: c.shadow });

  g.ellipse(cx - rad * 0.2, cy - rad * 0.25, rad * 0.15, rad * 0.1);
  g.fill({ color: c.highlight, alpha: 0.3 });
}

/** Glas-/Keramik-Sicherung, LOW-Tier (Fallback wenn kein PNG). */
function drawFuse(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  const w = rad * 0.85;
  const h = rad * 0.38;
  g.roundRect(cx - w, cy - h, w * 2, h * 2, h * 0.35);
  g.fill({ color: 0x8898a8, alpha: 0.35 });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.28 });
  g.roundRect(cx - w * 0.72, cy - h * 0.55, w * 1.44, h * 1.1, h * 0.25);
  g.fill({ color: 0xc8d8e8, alpha: 0.55 });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.35 });
  g.rect(cx - w * 0.12, cy - h * 0.15, w * 0.24, h * 0.3);
  g.fill({ color: 0xd04030, alpha: 0.85 });
  g.roundRect(cx - w * 0.95, cy - h * 0.65, w * 0.22, h * 1.3, 2);
  g.fill({ color: c.primary });
  g.roundRect(cx + w * 0.73, cy - h * 0.65, w * 0.22, h * 1.3, 2);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.25 });
}

function drawGear(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  rot: number,
  c: IconColors,
): void {
  const teeth = 10;
  const pts: number[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = rot + (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? rad : rad * 0.72;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.poly(pts, true);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.3, alignment: 0 });
  g.stroke({ width: 1.5, color: c.shadow, alpha: 0.4, alignment: 1 });

  g.circle(cx, cy, rad * 0.45);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.25, alignment: 0 });

  g.circle(cx, cy, rad * 0.18);
  g.fill({ color: c.shadow });

  g.ellipse(cx - rad * 0.15, cy - rad * 0.2, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.35 });
}

function drawCoil(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  const rings = [0.88, 0.62, 0.38] as const;
  for (let i = 0; i < rings.length; i++) {
    const r = rad * rings[i]!;
    g.circle(cx, cy, r);
    g.stroke({ width: 2.5 - i * 0.4, color: c.primary, alpha: 0.8 - i * 0.15 });
    g.circle(cx - r * 0.15, cy - r * 0.15, r);
    g.stroke({ width: 1, color: c.highlight, alpha: 0.2 - i * 0.05 });
  }
  g.ellipse(cx - rad * 0.25, cy - rad * 0.3, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.3 });
}

function drawPiston(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  g.roundRect(cx - rad * 0.45, cy - rad * 0.9, rad * 0.9, rad * 1.25, rad * 0.12);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.35, alignment: 0 });
  g.stroke({ width: 1.5, color: c.shadow, alpha: 0.45, alignment: 1 });

  g.rect(cx - rad * 0.55, cy + rad * 0.15, rad * 1.1, rad * 0.35);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.4 });

  g.ellipse(cx - rad * 0.15, cy - rad * 0.6, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.35 });
}

function drawFuelCanister(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  g.roundRect(cx - rad * 0.45, cy - rad * 0.95, rad * 0.9, rad * 1.38, rad * 0.14);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.34, alignment: 0 });
  g.stroke({ width: 1.2, color: c.shadow, alpha: 0.45, alignment: 1 });
  g.rect(cx - rad * 0.32, cy - rad * 0.18, rad * 0.64, rad * 0.14);
  g.fill({ color: 0xb83828, alpha: 0.88 });
  g.rect(cx - rad * 0.32, cy + rad * 0.02, rad * 0.64, rad * 0.12);
  g.fill({ color: c.primary, alpha: 0.92 });
  g.ellipse(cx - rad * 0.18, cy - rad * 0.68, rad * 0.1, rad * 0.06);
  g.fill({ color: c.highlight, alpha: 0.32 });
}

function drawReactorPipe(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  drawCable(g, cx, cy + rad * 0.05, rad, c);
  g.roundRect(cx - rad * 0.18, cy - rad * 0.82, rad * 0.36, rad * 0.55, 3);
  g.fill({ color: 0x38a0c8, alpha: 0.5 });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.35 });
}

function drawPipe(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  const hw = rad * 1.05;
  const hh = rad * 0.28;
  g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, rad * 0.12);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.28, alignment: 0 });
  g.stroke({ width: 1.2, color: c.shadow, alpha: 0.45, alignment: 1 });

  g.rect(cx - rad * 0.12, cy - rad * 0.85, rad * 0.24, rad * 0.55);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.35 });

  g.ellipse(cx - rad * 0.35, cy, rad * 0.1, rad * 0.06);
  g.fill({ color: c.highlight, alpha: 0.25 });
}

function drawReactor(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  t: number,
  c: IconColors,
): void {
  drawCoil(g, cx, cy, rad * 0.92, c);
  const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
  g.circle(cx, cy, rad * 0.32);
  g.fill({ color: c.highlight, alpha: 0.25 + 0.2 * pulse });
  g.circle(cx, cy, rad * 0.18);
  g.fill({ color: 0xff9040, alpha: 0.35 + 0.25 * pulse });
}

function drawSteamCoreSymbol(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  t: number,
  c: IconColors,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
  g.circle(cx, cy, rad * 0.78);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1.5, color: 0x48c8f0, alpha: 0.35 + 0.2 * pulse, alignment: 0 });
  g.circle(cx, cy, rad * 0.52);
  g.fill({ color: c.primary });
  g.circle(cx, cy, rad * 0.28);
  g.fill({ color: 0x90e8ff, alpha: 0.45 + 0.2 * pulse });
  g.ellipse(cx - rad * 0.2, cy - rad * 0.22, rad * 0.12, rad * 0.08);
  g.fill({ color: 0xffffff, alpha: 0.35 });
}

function drawOverdriveEngine(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  t: number,
  c: IconColors,
): void {
  drawGear(g, cx, cy, rad * 0.88, t * 0.5, c);
  g.roundRect(cx - rad * 0.22, cy - rad * 0.22, rad * 0.44, rad * 0.44, rad * 0.08);
  g.fill({ color: 0xffa030, alpha: 0.55 });
  g.stroke({ width: 1, color: 0xfff0a0, alpha: 0.5 });
}

function drawCable(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  const w = rad * 1.2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = cx - w / 2 + (i / 4) * w;
    const y = cy + Math.sin(i * 0.9) * rad * 0.25;
    pts.push([x, y]);
  }

  g.moveTo(pts[0]![0] - 1, pts[0]![1] - 1);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]![0] - 1, pts[i]![1] - 1);
  }
  g.stroke({ width: 4, color: c.highlight, alpha: 0.25, cap: 'round' });

  g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]![0], pts[i]![1]);
  }
  g.stroke({ width: 3.5, color: c.primary, cap: 'round' });

  g.moveTo(pts[0]![0] + 1, pts[0]![1] + 1);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]![0] + 1, pts[i]![1] + 1);
  }
  g.stroke({ width: 2, color: c.shadow, alpha: 0.35, cap: 'round' });
}

function drawValve(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  g.circle(cx, cy, rad * 0.85);
  g.fill({ color: c.secondary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.25, alignment: 0 });
  g.stroke({ width: 1.5, color: c.shadow, alpha: 0.4, alignment: 1 });

  g.rect(cx - rad * 0.12, cy - rad * 1.15, rad * 0.24, rad * 0.55);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.3, alignment: 0 });

  g.ellipse(cx - rad * 0.25, cy - rad * 0.25, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.3 });
}

function drawGenericBolt(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  c: IconColors,
): void {
  drawHex(g, cx, cy, rad, 6);
  g.fill({ color: c.primary });
  g.stroke({ width: 1, color: c.highlight, alpha: 0.3, alignment: 0 });
  g.stroke({ width: 1, color: c.shadow, alpha: 0.4, alignment: 1 });

  g.ellipse(cx - rad * 0.2, cy - rad * 0.25, rad * 0.12, rad * 0.08);
  g.fill({ color: c.highlight, alpha: 0.3 });
}

/**
 * VS Gears (gears_vs) — zwei Zahnräder, die ineinander krachen.
 * Mock-Visualisierung: zwei Kreise (rot/blau) + "VS" Schriftzug-Andeutung.
 */
function drawVsSymbol(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  t: number,
): void {
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  // Outer ring
  g.circle(cx, cy, rad * 1.05);
  g.fill({ color: 0x141422 });
  g.stroke({ width: 2, color: 0xf39c12, alpha: 0.6 + 0.3 * pulse, alignment: 0 });

  // Linke (rote) Gear
  const leftX = cx - rad * 0.35;
  const rightX = cx + rad * 0.35;
  const gearR = rad * 0.55;

  drawGearTeeth(g, leftX, cy, gearR, 0xe74c3c, t * 1.2);
  drawGearTeeth(g, rightX, cy, gearR, 0x3498db, -t * 1.2);

  // Mittlerer "Funken"-Kreis pulsiert
  g.circle(cx, cy, rad * 0.18 * pulse);
  g.fill({ color: 0xfff2a6, alpha: 0.85 });
  g.circle(cx, cy, rad * 0.12 * pulse);
  g.fill({ color: 0xffffff, alpha: 0.95 });
}

function drawGearTeeth(
  g: import('pixi.js').Graphics,
  cx: number,
  cy: number,
  rad: number,
  color: number,
  rot: number,
): void {
  // Vereinfachtes Zahnrad: Kreis + Zähne als kleine Kreise
  g.circle(cx, cy, rad * 0.65);
  g.fill({ color });
  g.stroke({ width: 1.2, color: 0x000000, alpha: 0.4, alignment: 0 });

  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2 + rot;
    const tx = cx + Math.cos(angle) * rad * 0.85;
    const ty = cy + Math.sin(angle) * rad * 0.85;
    g.circle(tx, ty, rad * 0.18);
    g.fill({ color });
  }

  // Zentraler dunkler Punkt
  g.circle(cx, cy, rad * 0.2);
  g.fill({ color: 0x141422 });
}
