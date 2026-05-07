import type { SymbolDef } from '../config/types';

export function paletteFor(
  def: SymbolDef | undefined,
  symbolId: string,
): {
  rim: number;
  face: number;
  rimStroke: number;
  rimStrokeW: number;
  faceStroke: number;
  faceStrokeA: number;
  text: number;
} {
  if (def?.kind === 'wild') {
    return {
      rim: 0x2a2210,
      face: 0x1f180c,
      rimStroke: 0xc9a227,
      rimStrokeW: 3,
      faceStroke: 0xf0d060,
      faceStrokeA: 0.28,
      text: 0xf5e6b8,
    };
  }
  if (def?.kind === 'bonus') {
    const bid = def.bonusId;
    if (bid === 'gears_clash') {
      return {
        rim: 0x4a2808,
        face: 0x321808,
        rimStroke: 0xe88820,
        rimStrokeW: 2,
        faceStroke: 0xffb060,
        faceStrokeA: 0.22,
        text: 0xffd8a8,
      };
    }
    if (bid === 'heist_run') {
      return {
        rim: 0x0c3048,
        face: 0x081f30,
        rimStroke: 0x48c8f0,
        rimStrokeW: 2,
        faceStroke: 0x90f0ff,
        faceStrokeA: 0.24,
        text: 0xc8f4ff,
      };
    }
    if (bid === 'deadlock_mode') {
      return {
        rim: 0x3a0c38,
        face: 0x240818,
        rimStroke: 0xd04088,
        rimStrokeW: 2,
        faceStroke: 0xff80c0,
        faceStrokeA: 0.22,
        text: 0xf8d0f0,
      };
    }
    return {
      rim: 0x3a2028,
      face: 0x241018,
      rimStroke: 0x886070,
      rimStrokeW: 2,
      faceStroke: 0xffffff,
      faceStrokeA: 0.08,
      text: 0xe8dce0,
    };
  }
  void symbolId;
  return {
    rim: 0x1c1c24,
    face: 0x24242e,
    rimStroke: 0x4a4a5c,
    rimStrokeW: 2,
    faceStroke: 0xffffff,
    faceStrokeA: 0.06,
    text: 0xd0d0dc,
  };
}
