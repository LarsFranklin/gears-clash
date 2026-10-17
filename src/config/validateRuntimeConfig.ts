import type { GameConfig } from './types';

export class GameConfigRuntimeError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`GameConfig ist unbrauchbar:\n- ${issues.join('\n- ')}`);
    this.name = 'GameConfigRuntimeError';
    this.issues = issues;
  }
}

/**
 * Schlanke Startprüfung der effektiven Config — deckt genau die Fälle ab, die sonst
 * erst mitten im Spin als kaputtes Raster oder stille Null-Auswertung auffallen.
 *
 * Bewusst ohne JSON-Schema/ajv, damit der Laufzeit-Pfad des Packages leichtgewichtig bleibt.
 * Vollständige Schemaprüfung: `validateGameConfig` (Tooling/Build).
 */
export function validateRuntimeConfig(config: GameConfig): void {
  const issues: string[] = [];
  const { reels, rows } = config.grid ?? { reels: 0, rows: 0 };

  if (!Number.isInteger(reels) || reels < 1) {
    issues.push(`grid.reels muss eine positive Ganzzahl sein (ist: ${String(reels)}).`);
  }
  if (!Number.isInteger(rows) || rows < 1) {
    issues.push(`grid.rows muss eine positive Ganzzahl sein (ist: ${String(rows)}).`);
  }

  if (!Array.isArray(config.symbols) || config.symbols.length === 0) {
    issues.push('symbols darf nicht leer sein.');
  } else {
    const seen = new Set<string>();
    for (const sym of config.symbols) {
      if (!sym?.id) {
        issues.push('Ein Symbol ohne id gefunden.');
        continue;
      }
      if (seen.has(sym.id)) {
        issues.push(`Symbol-ID "${sym.id}" ist doppelt vergeben.`);
      }
      seen.add(sym.id);
      if (sym.kind === 'bonus' && !sym.bonusId) {
        issues.push(`Bonus-Symbol "${sym.id}" hat keine bonusId.`);
      }
    }

    const weights = config.symbolWeights ?? {};
    for (const sym of config.symbols) {
      const w = weights[sym.id];
      if (w === undefined) {
        issues.push(`symbolWeights fehlt ein Eintrag für "${sym.id}".`);
      } else if (!Number.isFinite(w) || w < 0) {
        issues.push(`symbolWeights["${sym.id}"] muss eine Zahl >= 0 sein.`);
      }
    }
    const totalWeight = config.symbols.reduce(
      (sum, sym) => sum + (Number(weights[sym.id]) || 0),
      0,
    );
    if (totalWeight <= 0) {
      issues.push('Die Summe aller symbolWeights ist 0 — es kann kein Symbol gezogen werden.');
    }
  }

  const math = config.slotMath;
  if (math) {
    if (!Array.isArray(math.paylines) || math.paylines.length === 0) {
      issues.push('slotMath.paylines darf nicht leer sein.');
    } else {
      for (const line of math.paylines) {
        if (!Array.isArray(line.rows) || line.rows.length !== reels) {
          issues.push(
            `Payline "${line.id}" hat ${line.rows?.length ?? 0} Positionen, erwartet ${reels} (grid.reels).`,
          );
          continue;
        }
        const outOfRange = line.rows.some(
          (r: number) => !Number.isInteger(r) || r < 0 || r >= rows,
        );
        if (outOfRange) {
          issues.push(`Payline "${line.id}" verweist auf Zeilen außerhalb von 0…${rows - 1}.`);
        }
      }
    }
    if (!Number.isFinite(math.referenceBet) || math.referenceBet <= 0) {
      issues.push('slotMath.referenceBet muss > 0 sein.');
    }
    if (!Number.isInteger(math.minMatchLength) || math.minMatchLength < 2) {
      issues.push('slotMath.minMatchLength muss >= 2 sein.');
    }
  }

  if (!Number.isFinite(config.maxWin) || config.maxWin <= 0) {
    issues.push('maxWin muss > 0 sein.');
  }

  if (config.betLevels !== undefined) {
    if (!Array.isArray(config.betLevels) || config.betLevels.length === 0) {
      issues.push('betLevels muss ein nicht-leeres Array sein, wenn gesetzt.');
    } else if (config.betLevels.some((b) => !Number.isFinite(b) || b <= 0)) {
      issues.push('betLevels darf nur Zahlen > 0 enthalten.');
    }
  }

  if (issues.length > 0) {
    throw new GameConfigRuntimeError(issues);
  }
}
