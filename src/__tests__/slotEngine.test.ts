import { describe, expect, it } from 'vitest';
import { SlotEngine } from '../core/SlotEngine';

describe('SlotEngine State Machine', () => {
  it('startet in idle', () => {
    const e = new SlotEngine();
    expect(e.getState()).toBe('idle');
    expect(e.canSpin()).toBe(true);
  });

  it('Übergang idle → spinning → resolving → idle', () => {
    const e = new SlotEngine();
    expect(e.beginSpin()).toBe(true);
    expect(e.getState()).toBe('spinning');
    e.enterResolving();
    expect(e.getState()).toBe('resolving');
    e.finishRound();
    expect(e.getState()).toBe('idle');
  });

  it('zweites beginSpin blockiert während spinning', () => {
    const e = new SlotEngine();
    expect(e.beginSpin()).toBe(true);
    expect(e.beginSpin()).toBe(false);
    expect(e.getState()).toBe('spinning');
  });

  it('canSpin false während spinning oder resolving', () => {
    const e = new SlotEngine();
    e.beginSpin();
    expect(e.canSpin()).toBe(false);
    e.enterResolving();
    expect(e.canSpin()).toBe(false);
  });

  it('canSpin false bei hostDisabled', () => {
    const e = new SlotEngine();
    expect(e.canSpin(true)).toBe(false);
    expect(e.canSpin(false)).toBe(true);
  });

  it('error-State bleibt bestehen ohne resetError', () => {
    const e = new SlotEngine();
    e.beginSpin();
    e.setError();
    expect(e.getState()).toBe('error');
    expect(e.canSpin()).toBe(false);
  });

  it('resetError führt error → idle zurück', () => {
    const e = new SlotEngine();
    e.setError();
    e.resetError();
    expect(e.getState()).toBe('idle');
    expect(e.canSpin()).toBe(true);
  });

  it('resetError ist No-Op außerhalb error', () => {
    const e = new SlotEngine();
    e.beginSpin();
    e.resetError();
    expect(e.getState()).toBe('spinning');
  });

  it('Übergang spinning → bonus → idle', () => {
    const e = new SlotEngine();
    e.beginSpin();
    e.enterResolving();
    expect(e.enterBonus()).toBe(true);
    expect(e.getState()).toBe('bonus');
    e.finishRound();
    expect(e.getState()).toBe('idle');
  });

  it('enterBonus blockiert aus idle', () => {
    const e = new SlotEngine();
    expect(e.enterBonus()).toBe(false);
    expect(e.getState()).toBe('idle');
  });

  it('enterBonus blockiert aus error', () => {
    const e = new SlotEngine();
    e.setError();
    expect(e.enterBonus()).toBe(false);
    expect(e.getState()).toBe('error');
  });

  it('enterBonus erlaubt aus spinning', () => {
    const e = new SlotEngine();
    e.beginSpin();
    expect(e.enterBonus()).toBe(true);
    expect(e.getState()).toBe('bonus');
  });
});

/** Baut eine Engine bis in den Zustand `bonus_session` auf. */
function engineInSession(): SlotEngine {
  const e = new SlotEngine();
  e.beginSpin();
  e.enterResolving();
  e.enterBonus();
  e.beginBonusSession();
  e.finishRound();
  return e;
}

describe('SlotEngine Session-Lock', () => {
  it('beginBonusSession nur aus bonus heraus', () => {
    const e = new SlotEngine();
    expect(e.beginBonusSession()).toBe(false);
    e.beginSpin();
    expect(e.beginBonusSession()).toBe(false);
    e.enterBonus();
    expect(e.beginBonusSession()).toBe(true);
    expect(e.isBonusSessionActive()).toBe(true);
  });

  it('finishRound landet in bonus_session statt idle', () => {
    expect(engineInSession().getState()).toBe('bonus_session');
  });

  it('sperrt Base-Spins während der Session', () => {
    const e = engineInSession();
    expect(e.canSpin()).toBe(false);
    expect(e.beginSpin()).toBe(false);
    expect(e.getState()).toBe('bonus_session');
  });

  it('erlaubt Fortsetzungsrunden und kehrt danach in bonus_session zurück', () => {
    const e = engineInSession();
    expect(e.canSpinBonusRound()).toBe(true);
    expect(e.beginBonusRound()).toBe(true);
    expect(e.getState()).toBe('spinning');
    expect(e.beginSpin()).toBe(false);
    e.finishRound();
    expect(e.getState()).toBe('bonus_session');
  });

  it('blockiert Fortsetzungsrunden bei hostDisabled und außerhalb der Session', () => {
    const e = engineInSession();
    expect(e.canSpinBonusRound(true)).toBe(false);
    expect(new SlotEngine().beginBonusRound()).toBe(false);
  });

  it('endBonusSession gibt Base-Spins wieder frei', () => {
    const e = engineInSession();
    e.endBonusSession();
    expect(e.isBonusSessionActive()).toBe(false);
    expect(e.getState()).toBe('idle');
    expect(e.beginSpin()).toBe(true);
  });

  it('resetError löst auch eine hängende Session', () => {
    const e = engineInSession();
    e.setError();
    e.resetError();
    expect(e.isBonusSessionActive()).toBe(false);
    expect(e.canSpin()).toBe(true);
  });
});
