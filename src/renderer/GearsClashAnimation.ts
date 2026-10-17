import { Container, Graphics, Text } from 'pixi.js';
import type { GameConfig, GearsClashPayload } from '../config/types';
import { ROW_GAP } from './ReelColumn';

export interface GearsClashAnimationCallbacks {
  onComplete?: () => void;
  onSound?: (id: string) => void;
}

type Phase = 'intro' | 'battle' | 'winner' | 'expand' | 'done';

const PHASE_MS: Record<Exclude<Phase, 'done'>, number> = {
  intro: 900,
  battle: 1400,
  winner: 900,
  expand: 700,
};

const COLOR_GEAR_A = 0xe74c3c;
const COLOR_GEAR_B = 0x3498db;
const COLOR_ACCENT = 0xf39c12;

/**
 * Battle-Animation für `gears_clash`.
 *
 * Ablauf: Intro (beide Zahnräder) → Battle (Shake, Funken) → Winner (Sieger-Badge
 * mit Multiplier) → Expand (Full-Reel-Wild-Säule wächst über die Walze).
 *
 * Reine Darstellung: Sieger und Multiplier kommen aus dem Server-Payload.
 */
export class GearsClashAnimation {
  private container: Container;
  private root: Container;
  private config: GameConfig;
  private cellSize = 80;
  private colGap = 8;
  private originX = 0;
  private originY = 0;
  private rows = 5;
  private elapsed = 0;
  private phase: Phase = 'intro';
  private phaseTimer = 0;
  private callbacks: GearsClashAnimationCallbacks = {};

  private readonly overlay = new Graphics();
  private readonly sparks = new Graphics();
  private readonly expandG = new Graphics();
  private readonly gearA = new Container();
  private readonly gearB = new Container();
  private readonly winnerBadge = new Container();
  private winnerText: Text | null = null;
  private vsText: Text | null = null;
  private payload: GearsClashPayload | null = null;
  private reelIndex = 0;

  constructor(root: Container, config: GameConfig) {
    this.root = root;
    this.config = config;
    this.rows = config.grid.rows;
    this.container = new Container();
    this.container.visible = false;
    this.container.zIndex = 40;
    this.container.addChild(
      this.overlay,
      this.expandG,
      this.gearA,
      this.gearB,
      this.sparks,
      this.winnerBadge,
    );
    this.root.addChild(this.container);
  }

  /** Layout-Parameter setzen (wird vom Renderer bei Resize aufgerufen). */
  setLayout(
    cellSize: number,
    colGap: number,
    gridOriginX: number,
    gridOriginY: number,
  ): void {
    this.cellSize = cellSize;
    this.colGap = colGap;
    this.originX = gridOriginX;
    this.originY = gridOriginY;
    this.container.position.set(gridOriginX, gridOriginY);
    if (this.container.visible && this.payload) {
      this.build(this.payload, this.reelIndex);
    }
  }

  getView(): Container {
    return this.container;
  }

  private get rowPitch(): number {
    return this.cellSize + ROW_GAP;
  }

  private get gridHeight(): number {
    return this.rows * this.rowPitch - ROW_GAP;
  }

  start(
    payload: GearsClashPayload,
    reelIndex: number,
    callbacks?: GearsClashAnimationCallbacks,
  ): void {
    // Eine noch laufende Animation muss ihren Warter freigeben, sonst hängt der Aufrufer.
    this.completePending();
    this.clear();
    this.callbacks = callbacks ?? {};
    this.payload = payload;
    this.reelIndex = reelIndex;
    this.container.visible = true;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.elapsed = 0;
    this.build(payload, reelIndex);
    this.callbacks.onSound?.('gears_clash_intro');
  }

  private build(payload: GearsClashPayload, reelIndex: number): void {
    const colPitch = this.cellSize + this.colGap;
    const x = reelIndex * colPitch;
    const h = this.gridHeight;

    this.overlay.clear();
    this.overlay.rect(0, 0, this.config.grid.reels * colPitch - this.colGap, h);
    this.overlay.fill({ color: 0x05070c, alpha: 0.62 });
    this.overlay.roundRect(x - 4, 0, this.cellSize + 8, h, 10);
    this.overlay.stroke({ color: COLOR_ACCENT, width: 3, alpha: 0.9 });

    this.buildGear(this.gearA, payload.gearA.multiplier, COLOR_GEAR_A);
    this.buildGear(this.gearB, payload.gearB.multiplier, COLOR_GEAR_B);

    const cx = x + this.cellSize * 0.5;
    this.gearA.position.set(cx, h * 0.3);
    this.gearB.position.set(cx, h * 0.7);

    this.vsText?.destroy();
    this.vsText = new Text({
      text: 'VS',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(14, this.cellSize * 0.32),
        fill: 0xfff0c0,
        fontWeight: '900',
        letterSpacing: 2,
      },
    });
    this.vsText.anchor.set(0.5);
    this.vsText.position.set(cx, h * 0.5);
    this.container.addChild(this.vsText);

    destroyChildren(this.winnerBadge);
    this.winnerBadge.visible = false;
    this.winnerBadge.alpha = 1;
    this.expandG.clear();
    this.sparks.clear();
  }

  private buildGear(target: Container, multiplier: number, color: number): void {
    destroyChildren(target);
    const radius = this.cellSize * 0.3;

    const gear = new Graphics();
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      gear.circle(
        Math.cos(angle) * radius * 1.05,
        Math.sin(angle) * radius * 1.05,
        radius * 0.26,
      );
      gear.fill({ color });
    }
    gear.circle(0, 0, radius);
    gear.fill({ color });
    gear.circle(0, 0, radius * 0.42);
    gear.fill({ color: 0x0b0d14 });
    target.addChild(gear);

    const text = new Text({
      text: `×${multiplier}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(12, this.cellSize * 0.26),
        fill: 0xfff8e0,
        fontWeight: '900',
        stroke: { color: 0x14100a, width: 4, join: 'round' },
      },
    });
    text.anchor.set(0.5);
    target.addChild(text);
    target.alpha = 0;
  }

  update(deltaMs: number): void {
    if (!this.container.visible) return;

    this.elapsed += deltaMs;
    this.phaseTimer += deltaMs;

    switch (this.phase) {
      case 'intro':
        this.paintIntro(this.progress('intro'));
        if (this.phaseTimer > PHASE_MS.intro) this.enter('battle');
        break;
      case 'battle':
        this.paintBattle(this.progress('battle'));
        if (this.phaseTimer > PHASE_MS.battle) this.enter('winner');
        break;
      case 'winner':
        this.paintWinner(this.progress('winner'));
        if (this.phaseTimer > PHASE_MS.winner) this.enter('expand');
        break;
      case 'expand':
        this.paintExpand(this.progress('expand'));
        if (this.phaseTimer > PHASE_MS.expand) {
          this.phase = 'done';
          this.complete();
        }
        break;
    }
  }

  private progress(phase: Exclude<Phase, 'done'>): number {
    return Math.min(1, this.phaseTimer / PHASE_MS[phase]);
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    // Shake ist relativ zum Grid-Ursprung — absolute Werte würden das Raster versetzen.
    this.container.x = this.originX;
    if (phase === 'battle') this.callbacks.onSound?.('gears_clash_battle');
    if (phase === 'winner') {
      this.buildWinnerBadge();
      this.callbacks.onSound?.('gears_clash_winner');
    }
    if (phase === 'expand') this.callbacks.onSound?.('gears_clash_expand');
  }

  private paintIntro(u: number): void {
    const ease = 1 - Math.pow(1 - u, 3);
    this.gearA.alpha = ease;
    this.gearB.alpha = ease;
    this.gearA.scale.set(0.7 + 0.3 * ease);
    this.gearB.scale.set(0.7 + 0.3 * ease);
    this.gearA.rotation = ease * 1.4;
    this.gearB.rotation = -ease * 1.4;
    if (this.vsText) this.vsText.alpha = ease;
  }

  private paintBattle(u: number): void {
    const intensity = Math.sin(u * Math.PI);
    this.container.x = this.originX + Math.sin(this.elapsed * 0.05) * 4 * intensity;
    this.gearA.rotation += 0.09 * intensity;
    this.gearB.rotation -= 0.09 * intensity;

    const clashY = this.gridHeight * 0.5;
    const cx = this.gearA.x;
    this.sparks.clear();
    const sparkCount = Math.round(6 + intensity * 8);
    for (let i = 0; i < sparkCount; i++) {
      const a = (i / sparkCount) * Math.PI * 2 + this.elapsed * 0.004;
      const r = this.cellSize * (0.2 + 0.4 * ((i % 3) / 3 + intensity * 0.4));
      this.sparks.circle(
        cx + Math.cos(a) * r,
        clashY + Math.sin(a) * r * 0.6,
        Math.max(1, this.cellSize * 0.03),
      );
      this.sparks.fill({ color: 0xffd070, alpha: 0.35 + 0.5 * intensity });
    }
  }

  private buildWinnerBadge(): void {
    const p = this.payload;
    if (!p) return;
    const winnerIsA = p.gearA.multiplier >= p.gearB.multiplier;
    const multiplier = p.winnerMultiplier ?? (winnerIsA ? p.gearA.multiplier : p.gearB.multiplier);
    const color = winnerIsA ? COLOR_GEAR_A : COLOR_GEAR_B;

    destroyChildren(this.winnerBadge);
    const w = this.cellSize * 1.5;
    const h = this.cellSize * 0.62;
    const plate = new Graphics();
    plate.roundRect(-w / 2, -h / 2, w, h, 10);
    plate.fill({ color: 0x120e08, alpha: 0.92 });
    plate.stroke({ color, width: 3 });
    this.winnerBadge.addChild(plate);

    this.winnerText = new Text({
      text: `×${multiplier}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(16, this.cellSize * 0.34),
        fill: 0xfff2c8,
        fontWeight: '900',
        stroke: { color: 0x14100a, width: 4, join: 'round' },
      },
    });
    this.winnerText.anchor.set(0.5);
    this.winnerBadge.addChild(this.winnerText);

    this.winnerBadge.position.set(this.gearA.x, this.gridHeight * 0.5);
    this.winnerBadge.visible = true;
  }

  private paintWinner(u: number): void {
    const p = this.payload;
    if (!p) return;
    const winnerIsA = p.gearA.multiplier >= p.gearB.multiplier;
    const loser = winnerIsA ? this.gearB : this.gearA;
    const winner = winnerIsA ? this.gearA : this.gearB;

    loser.alpha = 1 - u;
    loser.scale.set(Math.max(0.1, 1 - u * 0.6));
    winner.alpha = Math.max(0, 1 - u * 1.6);
    if (this.vsText) this.vsText.alpha = Math.max(0, 1 - u * 2);

    const pop = u < 0.4 ? 0.6 + (u / 0.4) * 0.55 : 1.15 - (u - 0.4) * 0.25;
    this.winnerBadge.scale.set(pop);
    this.sparks.clear();
  }

  private paintExpand(u: number): void {
    const colPitch = this.cellSize + this.colGap;
    const x = this.reelIndex * colPitch;
    const h = this.gridHeight;
    const grown = h * Math.min(1, u * 1.15);

    this.expandG.clear();
    this.expandG.roundRect(x, (h - grown) / 2, this.cellSize, grown, 8);
    this.expandG.fill({ color: 0xffc850, alpha: 0.22 + 0.18 * (1 - u) });
    this.expandG.stroke({ color: 0xffe9a8, width: 2, alpha: 0.85 });

    this.winnerBadge.alpha = 1 - Math.max(0, (u - 0.6) / 0.4);
    this.overlay.alpha = 1 - u * 0.8;
  }

  private complete(): void {
    this.container.visible = false;
    const done = this.callbacks.onComplete;
    this.callbacks = {};
    done?.();
  }

  /** Löst einen noch offenen `onComplete`-Warter aus, ohne die Szene anzufassen. */
  private completePending(): void {
    const done = this.callbacks.onComplete;
    this.callbacks = {};
    done?.();
  }

  clear(): void {
    this.container.visible = false;
    this.container.x = this.originX;
    this.container.y = this.originY;
    this.overlay.clear();
    this.overlay.alpha = 1;
    this.sparks.clear();
    this.expandG.clear();
    destroyChildren(this.gearA);
    destroyChildren(this.gearB);
    destroyChildren(this.winnerBadge);
    this.winnerBadge.visible = false;
    this.winnerBadge.alpha = 1;
    this.vsText?.destroy();
    this.vsText = null;
    this.winnerText = null;
    this.payload = null;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.elapsed = 0;
  }

  destroy(): void {
    // Wichtig: erst den Warter freigeben, sonst hängt `playGearsClashAnimationAsync`.
    this.completePending();
    this.clear();
    this.container.destroy({ children: true });
  }
}

function destroyChildren(target: Container): void {
  for (const child of target.removeChildren()) {
    child.destroy();
  }
}
