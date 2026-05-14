import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import schema from '../config/gameConfig.schema.json';
import { defaultGameConfig } from '../config/defaultGameConfig';

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

describe('JSON-Schema Bonus-Required-Logik', () => {
  it('kind=bonus ohne bonusId schlägt fehl', () => {
    const validate = makeValidator();
    const cfg = {
      ...defaultGameConfig,
      symbols: defaultGameConfig.symbols.map((s) =>
        s.id === 'bonus_gears_clash' ? { id: s.id, kind: s.kind, label: s.label } : s,
      ),
    };
    expect(validate(cfg)).toBe(false);
  });

  it('kind=normal mit bonusId schlägt fehl (bonusId nur bei bonus erlaubt)', () => {
    const validate = makeValidator();
    const cfg = {
      ...defaultGameConfig,
      symbols: [
        ...defaultGameConfig.symbols,
        {
          id: 'extra_normal',
          kind: 'normal',
          label: 'extra',
          bonusId: 'gears_clash',
        },
      ],
    };
    expect(validate(cfg)).toBe(false);
  });

  it('Symbols-Liste mit weniger als 14 Items schlägt fehl', () => {
    const validate = makeValidator();
    const cfg = {
      ...defaultGameConfig,
      symbols: defaultGameConfig.symbols.slice(0, 5),
    };
    expect(validate(cfg)).toBe(false);
  });

  it('14 valide Symbole + Bonus mit bonusId passieren', () => {
    const validate = makeValidator();
    expect(validate(defaultGameConfig)).toBe(true);
  });
});
