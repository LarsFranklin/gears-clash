import { Container, Graphics, Text } from 'pixi.js';
import type { GameConfig, GearsClashPayload } from '../config/types';

export interface GearsClashAnimationCallbacks {
  onComplete?: () => void;
  onSound?: (id: string) => void;
}

/**
 * Gears Clash Battle-Animation:
 * 1. VS-Symbol highlighted
 * 2. Two gears appear with multipliers
 * 3. Battle animation (sparks/collision)
 * 4. Winner announced
 * 5. Full-Reel-Wild expansion
 */
export class GearsClashAnimation {
  private container: Container;
  private root: Container;
  private config: GameConfig;
  private cellSize = 80;
  private gap = 8;
  private rows = 5;
  private animationFrame = 0;
  private phase: 'intro' | 'battle' | 'winner' | 'expand' | 'done' = 'intro';
  private phaseTimer = 0;
  private callbacks: GearsClashAnimationCallbacks = {};
  
  constructor(root: Container, config: GameConfig) {
    this.root = root;
    this.config = config;
    this.rows = config.grid.rows;
    this.container = new Container();
    this.container.visible = false;
    this.container.zIndex = 40;
    this.root.addChild(this.container);
  }

  /**
   * Layout-Parameter setzen (wird vom Renderer bei Resize aufgerufen)
   */
  setLayout(cellSize: number, gap: number, gridOriginX: number, gridOriginY: number): void {
    this.cellSize = cellSize;
    this.gap = gap;
    this.container.position.set(gridOriginX, gridOriginY);
  }

  getView(): Container {
    return this.container;
  }

  /**
   * Startet die Battle-Animation für ein VS-Symbol
   */
  start(
    payload: GearsClashPayload,
    reelIndex: number,
    callbacks?: GearsClashAnimationCallbacks,
  ): void {
    this.clear();
    this.callbacks = callbacks ?? {};
    this.container.visible = true;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.animationFrame = 0;

    // Position berechnen (über der Reel)
    const x = reelIndex * (this.cellSize + this.gap);
    const y = -this.cellSize * 0.5; // Über dem Grid

    // Hintergrund-Overlay
    const overlay = new Graphics();
    overlay.rect(
      x - this.gap,
      0,
      this.cellSize + this.gap * 2,
      this.rows * (this.cellSize + this.gap),
    );
    overlay.fill({ color: 0x000000, alpha: 0.6 });
    this.container.addChild(overlay);

    // VS Box
    const vsBox = new Graphics();
    vsBox.roundRect(x, y, this.cellSize, this.cellSize * 2, 8);
    vsBox.fill({ color: 0x1a1a2e });
    vsBox.stroke({ color: 0xf39c12, width: 3 });
    this.container.addChild(vsBox);

    // Gear A (links)
    const gearABox = this.createGearBox(
      x + this.cellSize * 0.15,
      y + this.cellSize * 0.3,
      payload.gearA.multiplier,
      0xe74c3c, // rot
    );
    this.container.addChild(gearABox);

    // VS Text (mitte)
    const vsText = new Text({
      text: 'VS',
      style: {
        fontSize: this.cellSize * 0.3,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    vsText.anchor.set(0.5);
    vsText.x = x + this.cellSize * 0.5;
    vsText.y = y + this.cellSize;
    this.container.addChild(vsText);

    // Gear B (rechts)
    const gearBBox = this.createGearBox(
      x + this.cellSize * 0.15,
      y + this.cellSize * 1.4,
      payload.gearB.multiplier,
      0x3498db, // blau
    );
    this.container.addChild(gearBBox);

    this.callbacks.onSound?.('gears_clash_intro');
  }

  private createGearBox(x: number, y: number, multiplier: number, color: number): Container {
    const box = new Container();
    
    // Gear Icon (vereinfacht als Kreis mit Zähnen)
    const gear = new Graphics();
    const radius = this.cellSize * 0.15;
    gear.circle(x + radius * 2, y + radius, radius);
    gear.fill({ color });
    
    // Zähne (stark vereinfacht)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tx = x + radius * 2 + Math.cos(angle) * (radius * 1.2);
      const ty = y + radius + Math.sin(angle) * (radius * 1.2);
      gear.circle(tx, ty, radius * 0.3);
      gear.fill({ color });
    }
    
    box.addChild(gear);

    // Multiplier Text
    const text = new Text({
      text: `×${multiplier}`,
      style: {
        fontSize: this.cellSize * 0.25,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    text.x = x + radius * 4.5;
    text.y = y;
    box.addChild(text);

    return box;
  }

  /**
   * Update-Schleife für die Animation
   */
  update(deltaMs: number): void {
    if (!this.container.visible) return;

    this.animationFrame++;
    this.phaseTimer += deltaMs;

    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer > 1000) {
          this.phase = 'battle';
          this.phaseTimer = 0;
          this.callbacks.onSound?.('gears_clash_battle');
        }
        break;

      case 'battle':
        // Shake-Effekt
        const shake = Math.sin(this.animationFrame * 0.5) * 2;
        this.container.x = shake;
        
        if (this.phaseTimer > 1500) {
          this.phase = 'winner';
          this.phaseTimer = 0;
          this.container.x = 0;
        }
        break;

      case 'winner':
        if (this.phaseTimer > 800) {
          this.phase = 'expand';
          this.phaseTimer = 0;
          this.callbacks.onSound?.('gears_clash_expand');
        }
        break;

      case 'expand':
        // Expansion-Effekt könnte hier animiert werden
        if (this.phaseTimer > 600) {
          this.phase = 'done';
          this.complete();
        }
        break;
    }
  }

  private complete(): void {
    this.container.visible = false;
    this.callbacks.onComplete?.();
  }

  clear(): void {
    this.container.removeChildren();
    this.container.visible = false;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.animationFrame = 0;
  }

  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
  }
}
