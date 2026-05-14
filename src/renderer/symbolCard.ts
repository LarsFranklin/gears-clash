import type { SymbolDef } from '../config/types';

export type MaterialType = 'steel' | 'brass' | 'copper' | 'iron' | 'gold' | 'bonus';

export interface SymbolPalette {
  rim: number;
  face: number;
  rimStroke: number;
  rimStrokeW: number;
  faceStroke: number;
  faceStrokeA: number;
  text: number;
  bevelLight: number;
  bevelDark: number;
  specular: number;
  specularA: number;
  material: MaterialType;
  glowColor?: number;
}

const STEEL_SYMBOLS = new Set(['bolt', 'nut', 'fuse', 'valve', 'cable']);
const BRASS_SYMBOLS = new Set(['steam_piston', 'fuel_canister', 'reactor_pipe']);
const GOLD_HIGH_SYMBOLS = new Set(['overdrive_core', 'quantum_chamber']);

function getMaterial(symbolId: string): MaterialType {
  if (GOLD_HIGH_SYMBOLS.has(symbolId)) return 'gold';
  if (STEEL_SYMBOLS.has(symbolId)) return 'steel';
  if (BRASS_SYMBOLS.has(symbolId)) return 'brass';
  return 'steel';
}

export function paletteFor(
  def: SymbolDef | undefined,
  symbolId: string,
): SymbolPalette {
  if (def?.kind === 'wild') {
    return {
      rim: 0x2a2210,
      face: 0x1f180c,
      rimStroke: 0xc9a227,
      rimStrokeW: 3,
      faceStroke: 0xf0d060,
      faceStrokeA: 0.28,
      text: 0xf5e6b8,
      bevelLight: 0xffe8a0,
      bevelDark: 0x1a1008,
      specular: 0xfff8e0,
      specularA: 0.45,
      material: 'gold',
      glowColor: 0xf0d060,
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
        bevelLight: 0xffc070,
        bevelDark: 0x1a0c04,
        specular: 0xffe0a0,
        specularA: 0.35,
        material: 'bonus',
        glowColor: 0xe88820,
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
        bevelLight: 0xa0f0ff,
        bevelDark: 0x041018,
        specular: 0xc0ffff,
        specularA: 0.4,
        material: 'bonus',
        glowColor: 0x48c8f0,
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
        bevelLight: 0xffa0d0,
        bevelDark: 0x180410,
        specular: 0xffc0e0,
        specularA: 0.35,
        material: 'bonus',
        glowColor: 0xd04088,
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
      bevelLight: 0xa08090,
      bevelDark: 0x100808,
      specular: 0xffffff,
      specularA: 0.2,
      material: 'bonus',
      glowColor: 0x886070,
    };
  }

  const mat = getMaterial(symbolId);

  switch (mat) {
    case 'brass':
      return {
        rim: 0x2a2414,
        face: 0x302818,
        rimStroke: 0x8a7a48,
        rimStrokeW: 2,
        faceStroke: 0xc9a860,
        faceStrokeA: 0.12,
        text: 0xe8d8b8,
        bevelLight: 0xd0b870,
        bevelDark: 0x1a1408,
        specular: 0xffe8a0,
        specularA: 0.3,
        material: 'brass',
      };
    case 'copper':
      return {
        rim: 0x2a1c18,
        face: 0x2e201a,
        rimStroke: 0x8a5848,
        rimStrokeW: 2,
        faceStroke: 0xb87860,
        faceStrokeA: 0.12,
        text: 0xe8c8b8,
        bevelLight: 0xd09878,
        bevelDark: 0x180c08,
        specular: 0xffc8a0,
        specularA: 0.28,
        material: 'copper',
      };
    case 'iron':
      return {
        rim: 0x1e1e24,
        face: 0x28282e,
        rimStroke: 0x505868,
        rimStrokeW: 2,
        faceStroke: 0x889098,
        faceStrokeA: 0.1,
        text: 0xc8c8d8,
        bevelLight: 0x909098,
        bevelDark: 0x101014,
        specular: 0xd8d8e0,
        specularA: 0.22,
        material: 'iron',
      };
    case 'steel':
    default:
      return {
        rim: 0x1c1c24,
        face: 0x24242e,
        rimStroke: 0x4a4a5c,
        rimStrokeW: 2,
        faceStroke: 0x9898a8,
        faceStrokeA: 0.08,
        text: 0xd0d0dc,
        bevelLight: 0x808088,
        bevelDark: 0x0c0c10,
        specular: 0xe0e0e8,
        specularA: 0.2,
        material: 'steel',
      };
  }
}
