import Ajv2020 from 'ajv/dist/2020.js';
import schema from './gameConfig.schema.json';
import type { GameConfig } from './types';

export class GameConfigValidationError extends Error {
  readonly ajvErrors: unknown;

  constructor(ajvErrors: unknown) {
    super('GameConfig entspricht nicht gameConfig.schema.json');
    this.name = 'GameConfigValidationError';
    this.ajvErrors = ajvErrors;
  }
}

/** Validiert eine Config gegen `gameConfig.schema.json` — wirft bei Verstoß. */
export function validateGameConfig(config: GameConfig): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(config);
  if (!ok) {
    throw new GameConfigValidationError(validate.errors);
  }
}
