import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import schema from '../config/gameConfig.schema.json';
import { defaultGameConfig } from '../config/defaultGameConfig';

describe('defaultGameConfig vs. gameConfig.schema.json', () => {
  it('defaultGameConfig validiert gegen das JSON-Schema', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(defaultGameConfig);
    if (!ok) {
      throw new Error(
        `Schema-Validation fehlgeschlagen: ${JSON.stringify(validate.errors, null, 2)}`,
      );
    }
    expect(ok).toBe(true);
  });

  it('Bonus-IDs im Schema-enum entsprechen den Default-Bonus-Symbolen', () => {
    const symbolsSchema = (schema.properties as Record<string, unknown>).symbols as Record<
      string,
      unknown
    >;
    const items = symbolsSchema.items as Record<string, unknown>;
    const props = items.properties as Record<string, Record<string, unknown>>;
    const enumVals = (props.bonusId as Record<string, unknown>).enum as string[];
    expect(enumVals.sort()).toEqual(['deadlock_mode', 'gears_clash', 'heist_run']);

    const defaultBonusIds = defaultGameConfig.symbols
      .filter((s) => s.kind === 'bonus')
      .map((s) => s.bonusId)
      .sort() as string[];
    expect(defaultBonusIds).toEqual(['deadlock_mode', 'gears_clash', 'heist_run']);
  });
});
