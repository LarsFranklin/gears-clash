import { Container, Graphics, Text } from 'pixi.js';
import type { GameConfig, SymbolDef } from '../config/types';
import { SymbolRegistry } from '../core/SymbolRegistry';
import { drawProceduralSymbol } from './proceduralSymbol';
import { paletteFor } from './symbolCard';

const STRIP_LEN = 30;
const ROW_GAP = 3;

export class SymbolSlot extends Container {
  readonly rim = new Graphics();
  readonly face = new Graphics();
  readonly icon = new Graphics();
  readonly glow = new Graphics();
  readonly winRing = new Graphics();
  readonly microLabel = new Text({
    text: '',
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 8,
      fontWeight: '600',
      fill: 0x9898a8,
      letterSpacing: 0.5,
    },
  });

  private cs = 48;
  private y0 = 0;

  constructor() {
    super();
    this.microLabel.anchor.set(0.5, 1);
    this.addChild(this.rim, this.face, this.glow, this.icon, this.winRing, this.microLabel);
  }

  layout(cellSize: number, pitch: number): void {
    this.cs = cellSize;
    this.y0 = (pitch - cellSize) / 2;
    for (const g of [this.rim, this.face, this.glow, this.icon, this.winRing]) {
      g.position.set(0, this.y0);
    }
    this.microLabel.position.set(cellSize / 2, this.y0 + cellSize - 3);
    this.microLabel.style.fontSize = Math.max(7, Math.floor(cellSize * 0.11));
  }

  paint(
    symbolId: string,
    registry: SymbolRegistry,
    timeSec: number,
    opts: { winHighlight: boolean; winPulse: number; frozen: boolean },
  ): void {
    const def = registry.get(symbolId);
    const cs = this.cs;
    const radius = Math.max(5, Math.floor(cs * 0.12));
    const rimW = Math.max(2, Math.floor(cs * 0.04));
    const pal = paletteFor(def, symbolId);

    this.rim.clear();
    this.rim.roundRect(0, 0, cs, cs, radius);
    this.rim.fill({ color: pal.rim });
    this.rim.stroke({
      width: pal.rimStrokeW,
      color: pal.rimStroke,
      alignment: 0,
    });

    const inset = rimW;
    this.face.clear();
    this.face.roundRect(
      inset,
      inset,
      cs - inset * 2,
      cs - inset * 2,
      Math.max(3, radius - 2),
    );
    this.face.fill({ color: pal.face });
    if (pal.faceStrokeA > 0) {
      this.face.stroke({
        width: 1,
        color: pal.faceStroke,
        alpha: pal.faceStrokeA,
      });
    }

    drawProceduralSymbol(this.icon, symbolId, def, cs, opts.frozen ? 0 : timeSec);

    this.glow.clear();
    if (def?.kind === 'bonus' && !opts.frozen) {
      const throb = 0.35 + 0.65 * Math.sin(timeSec * 6);
      this.glow.roundRect(1, 1, cs - 2, cs - 2, radius);
      this.glow.stroke({
        width: 2 + throb * 2,
        color: pal.rimStroke,
        alpha: 0.25 + throb * 0.35,
      });
    }

    this.winRing.clear();
    if (opts.winHighlight) {
      const p = opts.winPulse;
      const a = 0.45 + 0.55 * Math.sin(p * Math.PI * 2);
      const y = this.y0;
      this.winRing.roundRect(-2, y - 2, cs + 4, cs + 4, radius + 2);
      this.winRing.stroke({
        width: 3 + a * 2,
        color: 0xffcc44,
        alpha: 0.35 + a * 0.45,
      });
    }

    const short = shortLabel(def, symbolId);
    this.microLabel.text = short;
    this.microLabel.style.fill = pal.text;
  }
}

function shortLabel(def: SymbolDef | undefined, symbolId: string): string {
  const raw = def?.label ?? symbolId;
  return raw.length <= 5 ? raw : raw.slice(0, 4) + '…';
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

  setStripY(y: number): void {
    this.strip.y = y;
  }

  layout(colIndex: number, cellSize: number, colGap: number, visibleH: number): void {
    this.cellSize = cellSize;
    this.pitch = cellSize + ROW_GAP;
    this.view.removeChildren();
    this.view.addChild(this.bg, this.maskShape, this.strip);
    this.strip.mask = this.maskShape;

    const w = cellSize;
    const h = visibleH;
    const shade = 0x101218 + (colIndex % 2) * 0x020203;
    this.bg.clear();
    this.bg.roundRect(0, 0, w, h, 6);
    this.bg.fill({ color: shade });
    this.bg.stroke({
      width: 1,
      color: colIndex < this.config.grid.reels - 1 ? 0x1a1a22 : 0x14141a,
      alpha: 0.9,
    });

    this.maskShape.clear();
    this.maskShape.roundRect(0, 0, w, h, 5);
    this.maskShape.fill({ color: 0xffffff });

    this.strip.removeChildren();
    this.slots = [];
    this.stripSymbols = Array.from({ length: STRIP_LEN }, () =>
      pickRandomId(this.registry),
    );
    for (let i = 0; i < STRIP_LEN; i++) {
      const slot = new SymbolSlot();
      slot.layout(cellSize, this.pitch);
      slot.position.set(0, i * this.pitch);
      slot.paint(this.stripSymbols[i]!, this.registry, 0, {
        winHighlight: false,
        winPulse: 0,
        frozen: false,
      });
      this.strip.addChild(slot);
      this.slots.push(slot);
    }

    this.view.x = colIndex * (cellSize + colGap);
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
    const wrap = this.pitch * 22;
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
      winPulse: 0,
      frozen: false,
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
      this.compactStrip(column);
      const maxTravel = Math.max(5, maxFocus - this.focusIndex);
      spinTravel = Math.min(
        travelMin + Math.floor(Math.random() * travelSpan),
        maxTravel,
      );
      focusEnd = this.focusIndex + spinTravel;
    }
    for (let r = 0; r < this.rows; r++) {
      this.setStripSymbolAt(focusEnd + r, column[r] ?? column[0]!);
    }
    for (let i = 0; i < this.stripSymbols.length; i++) {
      if (i < focusEnd || i >= focusEnd + this.rows) {
        this.setStripSymbolAt(i, pickRandomId(this.registry));
      }
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

  paintAll(
    timeSec: number,
    flags: {
      highlightRows: Set<number>;
      winPulse: number;
      frozen: boolean;
    },
  ): void {
    for (let i = 0; i < this.slots.length; i++) {
      const id = this.stripSymbols[i]!;
      const row = i - this.focusIndex;
      const winH =
        row >= 0 &&
        row < this.rows &&
        flags.highlightRows.has(row);
      this.slots[i]?.paint(id, this.registry, timeSec, {
        winHighlight: winH,
        winPulse: flags.winPulse,
        frozen: flags.frozen,
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
        this.stripSymbols[i] = pickRandomId(this.registry);
      }
    }
    this.focusIndex = newFocus;
    this.idleScrollOffsetPx = 0;
    this.strip.y = -newFocus * this.pitch;
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i]?.paint(this.stripSymbols[i]!, this.registry, 0, {
        winHighlight: false,
        winPulse: 0,
        frozen: false,
      });
    }
  }
}

function pickRandomId(registry: SymbolRegistry): string {
  const ids = registry.allIds;
  return ids[Math.floor(Math.random() * ids.length)]!;
}
