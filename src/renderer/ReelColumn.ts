import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { GameConfig, SymbolDef } from '../config/types';
import { SymbolRegistry } from '../core/SymbolRegistry';
import { drawProceduralSymbol } from './proceduralSymbol';
import { pickWeightedSymbolId } from '../util/pickWeightedSymbolId';
import { paletteFor, type SymbolPalette } from './symbolCard';
import { SLOT_SYMBOL_MARGIN_NORM } from './slotFrameSkin';

const STRIP_LEN = 30;
/** Enge Reel-Dichte (Design: wenig Leerraum zwischen Symbolzeilen). */
export const ROW_GAP = 2;

export class SymbolSlot extends Container {
  readonly rim = new Graphics();
  readonly face = new Graphics();
  readonly bevel = new Graphics();
  readonly spec = new Graphics();
  readonly icon = new Graphics();
  private iconSprite: Sprite | null = null;
  readonly glow = new Graphics();
  readonly winRing = new Graphics();

  private cs = 48;
  private y0 = 0;
  private lastSymbolId: string | null = null;
  private lastIconTimeBucket = -1;
  private lastIconEmphasize: boolean | null = null;
  private lastPal: SymbolPalette | null = null;
  private _popScale = 1;
  private popStartTime = 0;
  private popDuration = 0;

  constructor() {
    super();
    this.addChild(this.rim, this.face, this.bevel, this.spec, this.glow, this.icon, this.winRing);
  }

  triggerPop(duration = 320): void {
    this._popScale = 1;
    this.popStartTime = performance.now();
    this.popDuration = duration;
  }

  private updatePopScale(): void {
    if (this.popDuration <= 0) return;
    const elapsed = performance.now() - this.popStartTime;
    if (elapsed >= this.popDuration) {
      this._popScale = 1;
      this.popDuration = 0;
      return;
    }
    const u = elapsed / this.popDuration;
    /** Kurzer ~5%-„Pulse“ für Gewinn-Highlights (dezent, kein starkes Bounce). */
    const peak = 1.05;
    if (u < 0.35) {
      this._popScale = 1 + (peak - 1) * (u / 0.35);
    } else if (u < 0.65) {
      this._popScale = peak - (peak - 1) * 0.55 * ((u - 0.35) / 0.3);
    } else {
      this._popScale = 1 + (peak - 1) * 0.45 * (1 - (u - 0.65) / 0.35);
    }
  }

  layout(cellSize: number, pitch: number): void {
    this.cs = cellSize;
    this.y0 = (pitch - cellSize) / 2;
    for (const g of [this.rim, this.face, this.bevel, this.spec, this.glow, this.icon, this.winRing]) {
      g.position.set(0, this.y0);
    }
    if (this.iconSprite) {
      this.iconSprite.position.set(cellSize / 2, this.y0 + cellSize / 2);
    }
    /** Skalierung von der Zellenmitte aus (Pop-Animation), Position setzt weiterhin der Strip. */
    this.pivot.set(cellSize / 2, pitch / 2);
    this.scale.set(1);
    this._popScale = 1;
    this.popDuration = 0;
    this.lastSymbolId = null;
    this.lastIconTimeBucket = -1;
    this.lastIconEmphasize = null;
    this.lastPal = null;
  }

  paint(
    symbolId: string,
    registry: SymbolRegistry,
    timeSec: number,
    opts: {
      winHighlight: boolean;
      bonusRevealHighlight: boolean;
      winPulse: number;
      frozen: boolean;
      symbolTextures?: ReadonlyMap<string, Texture> | null;
    },
  ): void {
    const def = registry.get(symbolId);
    const cs = this.cs;
    const radius = Math.max(5, Math.floor(cs * 0.12));
    const pal = paletteFor(def, symbolId);

    const symbolChanged = symbolId !== this.lastSymbolId;

    if (symbolChanged) {
      // Nur Symbole — kein Karten-/Slot-Rahmen (Rim/Face/Bevel/Specular).
      this.rim.clear();
      this.face.clear();
      this.bevel.clear();
      this.spec.clear();

      this.lastSymbolId = symbolId;
      this.lastPal = pal;
      this.lastIconTimeBucket = -1;
      this.lastIconEmphasize = null;
    }

    const iconTime = opts.frozen ? 0 : timeSec;
    const iconBucket = Math.floor(iconTime * 30);
    const emphasizeSpecial =
      opts.winHighlight || opts.bonusRevealHighlight;
    const tex = opts.symbolTextures?.get(symbolId) ?? null;

    if (
      symbolChanged ||
      iconBucket !== this.lastIconTimeBucket ||
      this.lastIconEmphasize !== emphasizeSpecial ||
      (tex && this.iconSprite?.texture !== tex)
    ) {
      if (tex) {
        this.icon.clear();
        this.icon.visible = false;
        if (!this.iconSprite) {
          this.iconSprite = new Sprite();
          this.iconSprite.anchor.set(0.5, 0.5);
          const idx = this.getChildIndex(this.winRing);
          this.addChildAt(this.iconSprite, idx);
        }
        this.iconSprite.texture = tex;
        this.iconSprite.visible = true;
        const pad = cs * SLOT_SYMBOL_MARGIN_NORM;
        const inner = Math.max(1, cs - pad * 2);
        const sc = inner / Math.max(tex.width, tex.height);
        this.iconSprite.scale.set(sc);
        this.iconSprite.position.set(cs / 2, this.y0 + cs / 2);
        this.lastIconTimeBucket = iconBucket;
        this.lastIconEmphasize = emphasizeSpecial;
      } else {
        if (this.iconSprite) {
          this.iconSprite.visible = false;
        }
        this.icon.visible = true;
        drawProceduralSymbol(this.icon, symbolId, def, cs, iconTime, this.lastPal ?? undefined, {
          emphasizeSpecial,
        });
        this.lastIconTimeBucket = iconBucket;
        this.lastIconEmphasize = emphasizeSpecial;
      }
    }

    this.glow.clear();
    if (emphasizeSpecial && !opts.frozen) {
      /** Wild/Bonus pulsieren kräftiger; normale Gewinnsymbole bekommen denselben Effekt dezenter. */
      const special = def?.kind === 'bonus' || def?.kind === 'wild';
      const throb = 0.35 + 0.65 * Math.sin(timeSec * (special ? 6 : 4.2));
      const glowColor = pal.glowColor ?? pal.rimStroke;
      this.glow.roundRect(0, 0, cs, cs, radius);
      this.glow.stroke({
        width: (special ? 2 : 1.2) + throb * (special ? 1.5 : 0.9),
        color: glowColor,
        alpha: (special ? 0.35 : 0.2) + throb * (special ? 0.4 : 0.26),
      });
    }

    this.winRing.clear();
    if (opts.winHighlight) {
      const p = opts.winPulse;
      const a = 0.45 + 0.55 * Math.sin(p * Math.PI * 2);
      const y = this.y0;
      this.winRing.roundRect(-2, y - 2, cs + 4, cs + 4, radius + 2);
      this.winRing.stroke({
        width: 2 + a * 2,
        color: 0xffcc44,
        alpha: 0.45 + a * 0.45,
      });
    }

    this.updatePopScale();
    this.scale.set(this._popScale);
  }
}

export class ReelColumn {
  readonly view = new Container();
  private readonly config: GameConfig;
  private readonly registry: SymbolRegistry;
  private readonly bg = new Graphics();
  private readonly maskShape = new Graphics();
  private readonly strip = new Container();
  private slots: SymbolSlot[] = [];
  private stripSymbols: string[] = [];
  private pitch = 52;
  private cellSize = 48;
  private rows = 5;
  private symbolTextures: ReadonlyMap<string, Texture> | null = null;
  /** Index des obersten sichtbaren Strip-Slots. */
  private focusIndex = 10;
  /** Nur Darstellung: Offset während Wartephase (Normal-Spin), px nach unten entlang dem Strip. */
  private idleScrollOffsetPx = 0;

  constructor(config: GameConfig, registry: SymbolRegistry) {
    this.config = config;
    this.registry = registry;
    this.rows = config.grid.rows;
    this.view.addChild(this.bg, this.maskShape, this.strip);
    this.strip.mask = this.maskShape;
  }

  get focus(): number {
    return this.focusIndex;
  }

  get stripY(): number {
    return this.strip.y;
  }

  setSymbolTextures(map: ReadonlyMap<string, Texture> | null): void {
    this.symbolTextures = map;
  }

  get minStripY(): number {
    return -(this.stripSymbols.length - this.rows) * this.pitch;
  }

  setStripY(y: number): void {
    this.strip.y = y;
  }

  layout(
    colIndex: number,
    cellSize: number,
    colGap: number,
    visibleH: number,
    columnWidth = cellSize,
    rowPitch = cellSize + ROW_GAP,
  ): void {
    this.cellSize = columnWidth;
    this.pitch = rowPitch;
    this.view.removeChildren();
    this.view.addChild(this.bg, this.maskShape, this.strip);
    this.strip.mask = this.maskShape;

    const icon = Math.min(cellSize, rowPitch - ROW_GAP);
    const w = columnWidth;
    const h = visibleH;
    this.bg.clear();

    this.maskShape.clear();
    this.maskShape.roundRect(0, 0, w, h, 5);
    this.maskShape.fill({ color: 0xffffff });

    this.strip.removeChildren();
    this.slots = [];
    this.stripSymbols = Array.from({ length: STRIP_LEN }, () =>
      pickRandomWeightedId(this.registry, this.config),
    );
    for (let i = 0; i < STRIP_LEN; i++) {
      const slot = new SymbolSlot();
      slot.layout(icon, this.pitch);
      slot.position.set(w / 2, i * this.pitch + this.pitch / 2);
      slot.paint(this.stripSymbols[i]!, this.registry, 0, {
        winHighlight: false,
        bonusRevealHighlight: false,
        winPulse: 0,
        frozen: false,
        symbolTextures: this.symbolTextures,
      });
      this.strip.addChild(slot);
      this.slots.push(slot);
    }

    this.view.x = colIndex * (w + colGap);
    this.focusIndex = Math.min(10, STRIP_LEN - this.rows - 4);
    this.idleScrollOffsetPx = 0;
    this.strip.y = -this.focusIndex * this.pitch;
  }

  /** Vor echter Roll-Animation: Idle-Scroll zurück, Strip an Fokus ausrichten. */
  resetIdleScrollBeforePrepare(): void {
    this.idleScrollOffsetPx = 0;
    this.strip.y = -this.focusIndex * this.pitch;
  }

  /** Wartende Spalte: Strip weiterbewegen — gleiche Richtung wie Haupt-Roll (oben → unten). */
  advanceIdleScroll(dtMs: number, rowsPerSec: number): void {
    if (rowsPerSec <= 0 || dtMs <= 0) return;
    this.idleScrollOffsetPx += (this.pitch * rowsPerSec * dtMs) / 1000;
    // Nur so weit scrollen, wie oberhalb des Fokus echte Slots vorhanden sind.
    // Sonst rutscht der Strip aus der Maske und die Rolle wirkt kurz "leer".
    const wrap = this.pitch * Math.max(1, this.focusIndex);
    if (this.idleScrollOffsetPx >= wrap) {
      this.idleScrollOffsetPx -= wrap;
    }
    this.strip.y = -this.focusIndex * this.pitch + this.idleScrollOffsetPx;
  }

  setStripSymbolAt(index: number, id: string): void {
    if (index < 0 || index >= this.stripSymbols.length) return;
    this.stripSymbols[index] = id;
    this.slots[index]?.paint(id, this.registry, 0, {
      winHighlight: false,
      bonusRevealHighlight: false,
      winPulse: 0,
      frozen: false,
      symbolTextures: this.symbolTextures,
    });
  }

  getStripSymbolAt(index: number): string {
    return this.stripSymbols[index] ?? this.registry.allIds[0]!;
  }

  prepareSpinTargets(
    column: string[],
    opts?: { turbo?: boolean },
  ): {
    y0: number;
    y1: number;
    focusEnd: number;
    spinTravel: number;
  } {
    const fast = opts?.turbo === true;
    const travelMin = fast ? 9 : 14;
    const travelSpan = fast ? 7 : 9;
    const maxFocus = this.stripSymbols.length - this.rows - 2;
    let spinTravel = travelMin + Math.floor(Math.random() * travelSpan);
    let focusEnd = this.focusIndex + spinTravel;
    let guard = 0;
    while (focusEnd > maxFocus && guard++ < 8) {
      this.compactStrip(this.captureVisibleColumn());
      const maxTravel = Math.max(5, maxFocus - this.focusIndex);
      spinTravel = Math.min(
        travelMin + Math.floor(Math.random() * travelSpan),
        maxTravel,
      );
      focusEnd = this.focusIndex + spinTravel;
    }

    const visibleStart = this.focusIndex;
    const visibleEnd = this.focusIndex + this.rows;
    const targetStart = focusEnd;
    const targetEnd = focusEnd + this.rows;

    for (let r = 0; r < this.rows; r++) {
      this.setStripSymbolAt(targetStart + r, column[r] ?? column[0]!);
    }

    for (let i = 0; i < this.stripSymbols.length; i++) {
      if (i >= visibleStart && i < visibleEnd) continue;
      if (i >= targetStart && i < targetEnd) continue;
      this.setStripSymbolAt(i, pickRandomWeightedId(this.registry, this.config));
    }

    const y0 = -this.focusIndex * this.pitch;
    const y1 = -focusEnd * this.pitch;
    return { y0, y1, focusEnd, spinTravel };
  }

  commitFocus(focusEnd: number): void {
    this.focusIndex = focusEnd;
  }

  /** Sichtbare 5 Symbole auf `column` setzen (ohne Scroll-Animation). */
  syncVisibleColumn(column: string[]): void {
    for (let r = 0; r < this.rows; r++) {
      this.setStripSymbolAt(this.focusIndex + r, column[r] ?? column[0]!);
    }
  }

  triggerSymbolPop(row: number): void {
    const slotIndex = this.focusIndex + row;
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      this.slots[slotIndex]?.triggerPop();
    }
  }

  paintAll(
    timeSec: number,
    flags: {
      highlightRows: Set<number>;
      bonusRevealRows: Set<number>;
      winPulse: number;
      frozen: boolean;
    },
  ): void {
    /**
     * Nur die Slots im Maskenfenster (plus je eine Pufferzeile) neu zeichnen —
     * der Rest des Strips liegt außerhalb der Maske und kostet sonst jeden Frame.
     */
    const first = Math.max(0, Math.floor(-this.strip.y / this.pitch) - 1);
    const last = Math.min(this.slots.length - 1, first + this.rows + 1);

    for (let i = first; i <= last; i++) {
      const id = this.stripSymbols[i]!;
      const row = i - this.focusIndex;
      const winH =
        row >= 0 &&
        row < this.rows &&
        flags.highlightRows.has(row);
      const bonusH =
        row >= 0 &&
        row < this.rows &&
        flags.bonusRevealRows.has(row);
      this.slots[i]?.paint(id, this.registry, timeSec, {
        winHighlight: winH,
        bonusRevealHighlight: bonusH,
        winPulse: flags.winPulse,
        frozen: flags.frozen,
        symbolTextures: this.symbolTextures,
      });
    }
  }

  private compactStrip(visibleColumn: string[]): void {
    const newFocus = 8;
    for (let r = 0; r < this.rows; r++) {
      this.stripSymbols[newFocus + r] = visibleColumn[r] ?? visibleColumn[0]!;
    }
    for (let i = 0; i < this.stripSymbols.length; i++) {
      if (i < newFocus || i >= newFocus + this.rows) {
        this.stripSymbols[i] = pickRandomWeightedId(this.registry, this.config);
      }
    }
    this.focusIndex = newFocus;
    this.idleScrollOffsetPx = 0;
    this.strip.y = -newFocus * this.pitch;
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i]?.paint(this.stripSymbols[i]!, this.registry, 0, {
        winHighlight: false,
        bonusRevealHighlight: false,
        winPulse: 0,
        frozen: false,
        symbolTextures: this.symbolTextures,
      });
    }
  }

  private captureVisibleColumn(): string[] {
    const out: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      out.push(this.getStripSymbolAt(this.focusIndex + r));
    }
    return out;
  }

  destroy(): void {
    for (const slot of this.slots) {
      slot.destroy({ children: true });
    }
    this.slots = [];
    this.bg.destroy();
    this.maskShape.destroy();
    this.strip.destroy({ children: true });
    this.view.destroy({ children: false });
    this.symbolTextures = null;
  }
}

function pickRandomWeightedId(registry: SymbolRegistry, config: GameConfig): string {
  return pickWeightedSymbolId(registry.allIds, config.symbolWeights, Math.random);
}
