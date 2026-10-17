import { Assets, Container, Graphics, NineSliceSprite, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { BonusId } from '../config/types';
import type { GcFxQuality } from '../util/layoutMode';
import {
  CABINET_ASSETS,
  cabinetFrameHeight,
  cabinetWell,
  GAUGE_NEEDLE_ANCHOR_Y,
  type CabinetRect,
  type SlotCabinetGrid,
} from './cabinetLayout';
import {
  fitUniform,
  mixColor,
  placeCabinetConsole,
  placeCabinetLattice,
  placeCabinetOrnaments,
  placeCabinetShell,
  placeCabinetWindow,
  rail,
  spriteOf,
} from './cabinetPlacement';

const STEAM_POOL = 8;

const GLOW_TINT: Record<BonusId | 'base', number> = {
  base: 0xd08020,
  gears_clash: 0xff8a2b,
  heist_run: 0x2bb6ff,
  deadlock_mode: 0xc03adf,
};

const STEAM_TINT: Record<BonusId | 'base', number> = {
  base: 0xc8c4bc,
  gears_clash: 0xffc070,
  heist_run: 0x9adfff,
  deadlock_mode: 0xd090ff,
};

interface SpinningGear {
  sprite: Sprite;
  speed: number;
}

interface SteamWisp {
  sprite: Sprite;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  active: boolean;
}

/**
 * Zusammengesetzter Schrank: Platte, Leisten, Ecken, Gitter und bewegte Teile.
 * `back` liegt unter den Walzen, `front` darÃ¼ber.
 */
export class SlotCabinet {
  readonly back = new Container();
  readonly front = new Container();

  private readonly plate: TilingSprite;
  private readonly consolePlate: TilingSprite;
  private readonly consoleLip: Sprite;
  private readonly glow: Sprite;
  private readonly steamBack = new Container();
  private readonly steamBackMask = new Graphics();
  private readonly lattice = new Container();
  private readonly shell = new Container();
  private readonly shellMask = new Graphics();
  private readonly rails: Record<'top' | 'bottom' | 'left' | 'right', NineSliceSprite>;
  private readonly corners: Sprite[];
  private readonly pipes: Sprite[];
  private readonly gauges: Sprite[];
  private readonly needles: Sprite[];
  private readonly vent: Sprite;
  private readonly dividerH: Texture;
  private readonly dividerV: Texture;
  private readonly rivetTex: Texture;
  private readonly steamFront = new Container();
  private readonly gears: SpinningGear[];
  private readonly wisps: SteamWisp[];
  private readonly urls: string[];

  private spawns: { x: number; y: number; front: boolean }[] = [];
  private steamCap = 4;
  private steamEvery = 0.48;
  private steamTimer = 0;
  private reducedMotion = false;
  private glowTint = GLOW_TINT.base;
  private steamTint = STEAM_TINT.base;
  private targetGlow = GLOW_TINT.base;
  private targetSteam = STEAM_TINT.base;
  private destroyed = false;

  private constructor(textures: Map<string, Texture>, urls: string[]) {
    this.urls = urls;
    this.back.eventMode = 'none';
    this.front.eventMode = 'none';
    this.lattice.eventMode = 'none';
    this.steamBack.eventMode = 'none';
    this.steamFront.eventMode = 'none';

    const tex = (key: keyof typeof CABINET_ASSETS) => textures.get(CABINET_ASSETS[key])!;
    const plateTex = tex('plate');
    plateTex.source.style.addressMode = 'repeat';
    this.plate = new TilingSprite({ texture: plateTex, width: 10, height: 10 });
    this.consolePlate = new TilingSprite({ texture: plateTex, width: 10, height: 10 });
    this.consoleLip = spriteOf(tex('edgeBottom'));
    this.consoleLip.anchor.set(0, 0);
    this.glow = spriteOf(tex('glow'));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0.42;

    this.rails = {
      top: rail(tex('edgeTop'), 0.08, 0.06),
      bottom: rail(tex('edgeBottom'), 0.08, 0.06),
      left: rail(tex('edgeLeft'), 0.08, 0.1),
      right: rail(tex('edgeRight'), 0.08, 0.1),
    };

    this.corners = [
      spriteOf(tex('cornerTl')),
      spriteOf(tex('cornerTr')),
      spriteOf(tex('cornerBl')),
      spriteOf(tex('cornerBr')),
    ];
    this.corners[0]!.anchor.set(0, 0);
    this.corners[1]!.anchor.set(1, 0);
    this.corners[2]!.anchor.set(0, 1);
    this.corners[3]!.anchor.set(1, 1);

    this.pipes = [spriteOf(tex('pipe')), spriteOf(tex('pipe'))];
    for (const pipe of this.pipes) pipe.anchor.set(0.5);

    const face = tex('gaugeFace');
    const needleTex = tex('gaugeNeedle');
    this.gauges = [spriteOf(face), spriteOf(face)];
    this.needles = [spriteOf(needleTex), spriteOf(needleTex)];
    for (const gauge of this.gauges) gauge.anchor.set(0.5);
    for (const needle of this.needles) needle.anchor.set(0.5, GAUGE_NEEDLE_ANCHOR_Y);

    this.vent = spriteOf(tex('vent'));
    this.vent.anchor.set(0.5, 1);
    this.dividerH = tex('dividerH');
    this.dividerV = tex('dividerV');
    this.rivetTex = tex('rivet');

    const gearLarge = spriteOf(tex('gearLarge'));
    const gearMedium = spriteOf(tex('gearMedium'));
    const gearSmall = spriteOf(tex('gearSmall'));
    for (const gear of [gearLarge, gearMedium, gearSmall]) gear.anchor.set(0.5);
    this.gears = [
      { sprite: gearLarge, speed: 0.22 },
      { sprite: gearMedium, speed: -0.48 },
      { sprite: gearSmall, speed: 0.85 },
    ];

    this.wisps = [];
    const steamTextures = [tex('steamA'), tex('steamB')];
    for (let i = 0; i < STEAM_POOL; i++) {
      const sprite = spriteOf(steamTextures[i % steamTextures.length]!);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 0;
      this.wisps.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, active: false });
    }

    this.shell.eventMode = 'none';
    this.shellMask.eventMode = 'none';
    this.shell.addChild(
      this.rails.top,
      this.rails.bottom,
      this.rails.left,
      this.rails.right,
      ...this.corners,
      ...this.pipes,
      ...this.gauges,
      ...this.needles,
      this.vent,
      gearMedium,
      gearSmall,
      gearLarge,
    );
    this.shell.mask = this.shellMask;

    this.back.addChild(this.plate, this.glow, this.steamBack, this.consolePlate);
    this.steamBack.addChild(this.steamBackMask);
    this.steamBack.mask = this.steamBackMask;

    this.front.addChild(this.lattice, this.shell, this.shellMask, this.consoleLip, this.steamFront);

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  static async load(): Promise<SlotCabinet | null> {
    const urls = Object.values(CABINET_ASSETS);
    const textures = new Map<string, Texture>();
    try {
      for (const url of urls) {
        textures.set(url, await Assets.load<Texture>(url));
      }
      return new SlotCabinet(textures, urls);
    } catch (err) {
      console.warn('[SlotCabinet] Teile nicht geladen â€” Layout ohne Bild-Rahmen.', err);
      for (const url of urls) {
        void Assets.unload(url);
      }
      return null;
    }
  }

  setFxQuality(q: GcFxQuality): void {
    const map = {
      low: { steam: 2, every: 0.7 },
      medium: { steam: 4, every: 0.48 },
      high: { steam: 6, every: 0.36 },
      ultra: { steam: STEAM_POOL, every: 0.28 },
    }[q];
    this.steamCap = map.steam;
    this.steamEvery = map.every;
  }

  setBonusMood(bonusId: BonusId | null): void {
    const key = bonusId ?? 'base';
    this.targetGlow = GLOW_TINT[key];
    this.targetSteam = STEAM_TINT[key];
  }

  layout(totalW: number, totalH: number, opening: CabinetRect, grid: SlotCabinetGrid): void {
    const frameH = cabinetFrameHeight(totalH);
    const short = Math.min(totalW, frameH);
    placeCabinetWindow(this.plate, this.glow, this.steamBackMask, totalW, cabinetWell(totalW, totalH));
    placeCabinetShell(this.corners, this.rails, totalW, totalH, frameH, short);
    placeCabinetOrnaments(
      this.gears.map((gear) => gear.sprite),
      this.gauges,
      this.needles,
      this.vent,
      this.pipes,
      totalW,
      frameH,
      short,
    );
    placeCabinetConsole(this.consolePlate, this.consoleLip, totalW, totalH, frameH);
    this.clipShellToOpening(totalW, totalH, opening);
    placeCabinetLattice(this.lattice, this.dividerH, this.dividerV, this.rivetTex, grid);
    this.spawns = [
      { x: totalW * 0.5, y: frameH - short * 0.04, front: true },
      { x: totalW * 0.3, y: short * 0.05, front: true },
      { x: totalW * 0.7, y: short * 0.05, front: true },
    ];
  }

  private clipShellToOpening(totalW: number, totalH: number, opening: CabinetRect): void {
    const mask = this.shellMask;
    mask.clear();
    mask.rect(0, 0, totalW, totalH);
    mask.fill({ color: 0xffffff });
    mask.rect(opening.x, opening.y, opening.w, opening.h);
    mask.cut();
  }

  tick(timeSec: number, dtSec: number): void {
    const blend = Math.min(1, dtSec * 2.2);
    this.glowTint = mixColor(this.glowTint, this.targetGlow, blend);
    this.steamTint = mixColor(this.steamTint, this.targetSteam, blend);
    this.glow.tint = this.glowTint;
    if (this.reducedMotion) {
      this.vent.alpha = 0.9;
      return;
    }
    for (const gear of this.gears) {
      gear.sprite.rotation += gear.speed * dtSec;
    }
    this.needles.forEach((needle, index) => {
      const direction = index === 0 ? 1 : -1;
      const speed = index === 0 ? 0.52 : 0.86;
      const phase = index === 0 ? 0.2 : 1.7;
      needle.rotation = direction * (-0.25 + Math.sin(timeSec * speed + phase) * 0.48);
    });
    this.vent.alpha = 1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.back.destroy({ children: true });
    this.front.destroy({ children: true });
    for (const url of this.urls) {
      void Assets.unload(url);
    }
  }

  private tickSteam(dtSec: number): void {
    this.steamTimer += dtSec;
    const active = this.wisps.filter((w) => w.active).length;
    if (this.steamTimer >= this.steamEvery && active < this.steamCap && this.spawns.length > 0) {
      this.steamTimer = 0;
      this.spawnSteam();
    }
    for (const wisp of this.wisps) {
      if (!wisp.active) continue;
      wisp.life -= dtSec;
      wisp.sprite.x += wisp.vx * dtSec;
      wisp.sprite.y += wisp.vy * dtSec;
      const u = Math.max(0, wisp.life / wisp.maxLife);
      wisp.sprite.alpha = Math.sin(u * Math.PI) * 0.42;
      wisp.sprite.tint = this.steamTint;
      if (wisp.life <= 0) {
        wisp.active = false;
        wisp.sprite.visible = false;
      }
    }
  }

  private spawnSteam(): void {
    const wisp = this.wisps.find((w) => !w.active);
    const spawn = this.spawns[Math.floor(Math.random() * this.spawns.length)];
    if (!wisp || !spawn) return;
    const parent = spawn.front ? this.steamFront : this.steamBack;
    parent.addChild(wisp.sprite);
    wisp.active = true;
    wisp.sprite.visible = true;
    wisp.sprite.position.set(spawn.x, spawn.y);
    wisp.maxLife = 2.2 + Math.random() * 1.4;
    wisp.life = wisp.maxLife;
    wisp.vx = (Math.random() - 0.5) * 18;
    wisp.vy = -28 - Math.random() * 36;
    const size = 36 + Math.random() * 48;
    fitUniform(wisp.sprite, size);
  }
}
