import type { GameConfig, SymbolDef } from '../config/types';

export class SymbolRegistry {
  private byId = new Map<string, SymbolDef>();

  constructor(config: GameConfig) {
    for (const s of config.symbols) {
      this.byId.set(s.id, s);
    }
  }

  get(id: string): SymbolDef | undefined {
    return this.byId.get(id);
  }

  get all(): SymbolDef[] {
    return [...this.byId.values()];
  }

  get allIds(): string[] {
    return [...this.byId.keys()];
  }
}
