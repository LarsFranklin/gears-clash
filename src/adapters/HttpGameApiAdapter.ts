import type {
  BonusSessionMeta,
  BonusSessionPayload,
  DeadlockCollectedSymbol,
  DeadlockModePayload,
  GearsClashPayload,
  HeistRunPayload,
  HeistRunStickyWild,
  SpinRequest,
  SpinResult,
} from '../config/types';
import {
  InsufficientBalanceError,
  InvalidResponseError,
  NetworkError,
} from './errors';
import type { GameApiAdapter } from './GameApiAdapter';

const VALID_BONUS_TYPES = ['gears_clash', 'heist_run', 'deadlock_mode'] as const;

export interface HttpGameApiAdapterOptions {
  spinEndpoint: string;
  balanceEndpoint?: string;
  /** Zusätzliche fetch-Optionen (Headers, credentials). */
  fetchInit?: RequestInit;
  /**
   * Timeout pro Request in Millisekunden. Standard: 15000 (15 s).
   * `0` deaktiviert den Timeout — dann gilt nur `fetchInit.signal`.
   */
  timeoutMs?: number;
  /**
   * Optional: Mapping von HTTP-Status / API-Code auf InsufficientBalanceError.
   * Beispiel: status 402 oder 409, oder body { code: "INSUFFICIENT_FUNDS" }.
   */
  insufficientBalance?: {
    httpStatuses?: number[];
    bodyCodes?: string[];
    /** JSON-Pfad oder Custom-Extractor — v1: prüft body.code */
    match?: (status: number, body: unknown) => boolean;
  };
  mapSpinResponse?: (raw: unknown) => SpinResult;
}

function defaultMapSpinResponse(raw: unknown): SpinResult {
  if (!isPlain(raw)) {
    throw new InvalidResponseError('Spin-Antwort ist kein JSON-Objekt.');
  }
  const spinId = String(raw.spinId ?? '');
  const reelStops = raw.reelStops;
  // Number(null) ist 0 — leere Felder dürfen keinen Kontostand von 0 vortäuschen.
  const balanceAfter =
    raw.balanceAfter === null || raw.balanceAfter === undefined
      ? Number.NaN
      : Number(raw.balanceAfter);
  const winAmount = raw.winAmount === null ? Number.NaN : Number(raw.winAmount ?? 0);

  if (!spinId || !Array.isArray(reelStops)) {
    throw new InvalidResponseError('Spin-Antwort fehlt spinId oder reelStops.');
  }
  if (reelStops.length === 0) {
    throw new InvalidResponseError('reelStops darf nicht leer sein.');
  }
  let rowCount = -1;
  const stops = reelStops.map((col, index) => {
    if (!Array.isArray(col)) {
      throw new InvalidResponseError('reelStops muss string[][] sein.');
    }
    if (rowCount === -1) rowCount = col.length;
    if (col.length !== rowCount) {
      throw new InvalidResponseError(
        `reelStops[${index}] hat ${col.length} Zeilen, erwartet ${rowCount} — Raster ist nicht rechteckig.`,
      );
    }
    if (col.length === 0) {
      throw new InvalidResponseError('reelStops-Spalten dürfen nicht leer sein.');
    }
    return col.map((cell) => String(cell));
  });
  if (!Number.isFinite(balanceAfter)) {
    throw new InvalidResponseError('balanceAfter ist keine endliche Zahl.');
  }
  if (!Number.isFinite(winAmount) || winAmount < 0) {
    throw new InvalidResponseError('winAmount muss eine endliche Zahl >= 0 sein.');
  }

  const bonus = validateBonusPayload(raw.bonus, stops.length, rowCount);

  const inGrid = (reel: number, row: number): boolean =>
    Number.isInteger(reel) &&
    Number.isInteger(row) &&
    reel >= 0 &&
    reel < stops.length &&
    row >= 0 &&
    row < rowCount;

  const highlights = raw.displayHighlights;
  let displayHighlights: SpinResult['displayHighlights'] = undefined;
  if (Array.isArray(highlights)) {
    displayHighlights = highlights
      .map((h) => {
        if (!isPlain(h)) return null;
        const reel = Number(h.reel);
        const row = Number(h.row);
        if (!inGrid(reel, row)) return null;
        return { reel, row };
      })
      .filter((x): x is { reel: number; row: number } => x !== null);
  }

  const winLines = raw.displayWinLines;
  let displayWinLines: SpinResult['displayWinLines'] = undefined;
  if (Array.isArray(winLines)) {
    const parsed: NonNullable<SpinResult['displayWinLines']> = [];
    for (const line of winLines) {
      if (!isPlain(line) || !Array.isArray(line.points)) continue;
      const amount = Number(line.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const points: { reel: number; row: number }[] = [];
      for (const p of line.points) {
        if (!isPlain(p)) continue;
        const reel = Number(p.reel);
        const row = Number(p.row);
        if (!inGrid(reel, row)) continue;
        points.push({ reel, row });
      }
      if (points.length < 2) continue;
      parsed.push({
        id: line.id !== undefined ? String(line.id) : undefined,
        points,
        amount,
        label:
          line.label !== undefined && line.label !== null
            ? String(line.label)
            : undefined,
      });
    }
    displayWinLines = parsed;
  }

  return {
    spinId,
    reelStops: stops,
    winAmount,
    balanceAfter,
    bonus,
    ...(displayHighlights && displayHighlights.length > 0
      ? { displayHighlights }
      : {}),
    ...(displayWinLines && displayWinLines.length > 0 ? { displayWinLines } : {}),
  };
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireFiniteNumber(value: unknown, path: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new InvalidResponseError(`${path} muss eine endliche Zahl sein.`);
  }
  return n;
}

function requireGridIndex(
  value: unknown,
  path: string,
  max: number,
): number {
  const n = requireFiniteNumber(value, path);
  if (!Number.isInteger(n) || n < 0 || n >= max) {
    throw new InvalidResponseError(`${path} liegt außerhalb von 0…${max - 1}.`);
  }
  return n;
}

function validateGearsClashPayload(p: Record<string, unknown>, reels: number): GearsClashPayload {
  const gearA = p.gearA;
  const gearB = p.gearB;
  if (!isPlain(gearA) || !isPlain(gearB)) {
    throw new InvalidResponseError('gears_clash braucht gearA und gearB als Objekte.');
  }
  const out: GearsClashPayload = {
    gearA: { multiplier: requireFiniteNumber(gearA.multiplier, 'gearA.multiplier') },
    gearB: { multiplier: requireFiniteNumber(gearB.multiplier, 'gearB.multiplier') },
  };
  if (p.winnerReel !== undefined && p.winnerReel !== null) {
    out.winnerReel = requireGridIndex(p.winnerReel, 'bonus.payload.winnerReel', reels);
  }
  if (p.winnerMultiplier !== undefined && p.winnerMultiplier !== null) {
    out.winnerMultiplier = requireFiniteNumber(
      p.winnerMultiplier,
      'bonus.payload.winnerMultiplier',
    );
  }
  return out;
}

function validateHeistRunPayload(
  p: Record<string, unknown>,
  reels: number,
  rows: number,
): HeistRunPayload {
  const freeSpinsAwarded = requireFiniteNumber(
    p.freeSpinsAwarded,
    'bonus.payload.freeSpinsAwarded',
  );
  if (!Number.isInteger(freeSpinsAwarded) || freeSpinsAwarded < 0) {
    throw new InvalidResponseError(
      'bonus.payload.freeSpinsAwarded muss eine Ganzzahl >= 0 sein.',
    );
  }
  const out: HeistRunPayload = { freeSpinsAwarded };
  if (p.currentSpin !== undefined && p.currentSpin !== null) {
    out.currentSpin = requireFiniteNumber(p.currentSpin, 'bonus.payload.currentSpin');
  }
  if (p.stickyWilds !== undefined && p.stickyWilds !== null) {
    if (!Array.isArray(p.stickyWilds)) {
      throw new InvalidResponseError('bonus.payload.stickyWilds muss ein Array sein.');
    }
    out.stickyWilds = p.stickyWilds.map((w, i) => {
      if (!isPlain(w)) {
        throw new InvalidResponseError(`stickyWilds[${i}] muss ein Objekt sein.`);
      }
      const cell: HeistRunStickyWild = {
        reel: requireGridIndex(w.reel, `stickyWilds[${i}].reel`, reels),
        row: requireGridIndex(w.row, `stickyWilds[${i}].row`, rows),
      };
      if (w.multiplier !== undefined && w.multiplier !== null) {
        cell.multiplier = requireFiniteNumber(
          w.multiplier,
          `stickyWilds[${i}].multiplier`,
        );
      }
      return cell;
    });
  }
  return out;
}

function validateDeadlockPayload(
  p: Record<string, unknown>,
  reels: number,
  rows: number,
): DeadlockModePayload {
  const phase = p.phase;
  if (phase !== 'collection' && phase !== 'overdrive') {
    throw new InvalidResponseError(
      `bonus.payload.phase muss "collection" oder "overdrive" sein, erhielt: ${String(phase)}.`,
    );
  }
  const out: DeadlockModePayload = { phase };
  if (p.lives !== undefined && p.lives !== null) {
    out.lives = requireFiniteNumber(p.lives, 'bonus.payload.lives');
  }
  if (p.remainingSpins !== undefined && p.remainingSpins !== null) {
    out.remainingSpins = requireFiniteNumber(
      p.remainingSpins,
      'bonus.payload.remainingSpins',
    );
  }
  if (p.collectedSymbols !== undefined && p.collectedSymbols !== null) {
    if (!Array.isArray(p.collectedSymbols)) {
      throw new InvalidResponseError(
        'bonus.payload.collectedSymbols muss ein Array sein.',
      );
    }
    out.collectedSymbols = p.collectedSymbols.map((c, i) => {
      if (!isPlain(c) || typeof c.symbolId !== 'string' || !c.symbolId) {
        throw new InvalidResponseError(
          `collectedSymbols[${i}] braucht eine symbolId.`,
        );
      }
      const entry: DeadlockCollectedSymbol = {
        reel: requireGridIndex(c.reel, `collectedSymbols[${i}].reel`, reels),
        row: requireGridIndex(c.row, `collectedSymbols[${i}].row`, rows),
        symbolId: c.symbolId,
      };
      if (c.multiplier !== undefined && c.multiplier !== null) {
        entry.multiplier = requireFiniteNumber(
          c.multiplier,
          `collectedSymbols[${i}].multiplier`,
        );
      }
      return entry;
    });
  }
  return out;
}

function validateSessionMeta(raw: unknown): BonusSessionMeta | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlain(raw)) {
    throw new InvalidResponseError('bonus.session muss ein Objekt sein.');
  }
  const meta: BonusSessionMeta = {
    remainingSpins: requireFiniteNumber(
      raw.remainingSpins,
      'bonus.session.remainingSpins',
    ),
    totalSpins: requireFiniteNumber(raw.totalSpins, 'bonus.session.totalSpins'),
    roundsPlayed: requireFiniteNumber(
      raw.roundsPlayed,
      'bonus.session.roundsPlayed',
    ),
    bankedWin: requireFiniteNumber(raw.bankedWin, 'bonus.session.bankedWin'),
    complete: Boolean(raw.complete),
  };
  if (raw.retriggerAwarded !== undefined && raw.retriggerAwarded !== null) {
    meta.retriggerAwarded = requireFiniteNumber(
      raw.retriggerAwarded,
      'bonus.session.retriggerAwarded',
    );
  }
  return meta;
}

/**
 * Prüft Bonus-Daten feldweise gegen den Payload-Vertrag statt sie blind zu casten.
 * Kaputte Server-Daten sollen als `InvalidResponseError` auffallen, nicht später
 * als undefined-Zugriff im Renderer.
 */
function validateBonusPayload(
  bonus: unknown,
  reels: number,
  rows: number,
): BonusSessionPayload | null {
  if (bonus === null || bonus === undefined) {
    return null;
  }
  if (!isPlain(bonus)) {
    throw new InvalidResponseError('bonus muss ein Objekt oder null sein.');
  }
  const type = bonus.type;
  if (
    typeof type !== 'string' ||
    !VALID_BONUS_TYPES.includes(type as (typeof VALID_BONUS_TYPES)[number])
  ) {
    throw new InvalidResponseError(
      `bonus.type muss einer von ${VALID_BONUS_TYPES.join(', ')} sein, erhielt: ${String(type)}.`,
    );
  }
  const payload = bonus.payload;
  if (!isPlain(payload)) {
    throw new InvalidResponseError('bonus.payload muss ein Objekt sein.');
  }
  const session = validateSessionMeta(bonus.session);

  switch (type) {
    case 'gears_clash':
      return {
        type,
        payload: validateGearsClashPayload(payload, reels),
        ...(session ? { session } : {}),
      };
    case 'heist_run':
      return {
        type,
        payload: validateHeistRunPayload(payload, reels, rows),
        ...(session ? { session } : {}),
      };
    default:
      return {
        type: 'deadlock_mode',
        payload: validateDeadlockPayload(payload, reels, rows),
        ...(session ? { session } : {}),
      };
  }
}

export class HttpGameApiAdapter implements GameApiAdapter {
  constructor(private readonly options: HttpGameApiAdapterOptions) {}

  async getBalance(): Promise<number> {
    const url = this.options.balanceEndpoint;
    if (!url) {
      throw new InvalidResponseError(
        'getBalance: balanceEndpoint ist nicht gesetzt.',
      );
    }
    const res = await this.safeFetch(url, {
      ...this.options.fetchInit,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(this.options.fetchInit?.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      throw new InvalidResponseError(`Balance-Request fehlgeschlagen (${res.status}).`, {
        status: res.status,
      });
    }
    const raw = await this.parseJson(res);
    if (!isPlain(raw) || typeof raw.balance !== 'number') {
      throw new InvalidResponseError(
        'Balance-Antwort erwartet { balance: number }.',
        { status: res.status, bodySnippet: JSON.stringify(raw).slice(0, 200) },
      );
    }
    return raw.balance;
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    const res = await this.safeFetch(this.options.spinEndpoint, {
      ...this.options.fetchInit,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.options.fetchInit?.headers as Record<string, string>),
      },
      body: JSON.stringify(request),
    });

    const rawText = await res.text();
    let raw: unknown;
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      throw new InvalidResponseError('Spin-Antwort ist kein gültiges JSON.', {
        status: res.status,
        bodySnippet: rawText.slice(0, 200),
        cause: e,
      });
    }

    if (!res.ok) {
      if (this.isInsufficientBalance(res.status, raw)) {
        throw new InsufficientBalanceError('Nicht genügend Guthaben.', {
          status: res.status,
          apiCode: isPlain(raw) ? String(raw.code ?? '') : undefined,
        });
      }
      throw new InvalidResponseError(`Spin fehlgeschlagen (${res.status}).`, {
        status: res.status,
        bodySnippet: rawText.slice(0, 400),
      });
    }

    try {
      const mapper = this.options.mapSpinResponse ?? defaultMapSpinResponse;
      return mapper(raw);
    } catch (e) {
      if (e instanceof InvalidResponseError) throw e;
      throw new InvalidResponseError(
        e instanceof Error ? e.message : 'Unbekannter Mapping-Fehler',
        { status: res.status, cause: e },
      );
    }
  }

  private isInsufficientBalance(status: number, body: unknown): boolean {
    const cfg = this.options.insufficientBalance;
    if (cfg?.httpStatuses?.includes(status)) return true;
    if (cfg?.match?.(status, body)) return true;
    if (cfg?.bodyCodes && isPlain(body) && typeof body.code === 'string') {
      return cfg.bodyCodes.includes(body.code);
    }
    return false;
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    let timedOut = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs)
        : null;

    const userSignal = init.signal ?? null;
    const onUserAbort = () => controller.abort();
    if (userSignal) {
      if (userSignal.aborted) controller.abort();
      else userSignal.addEventListener('abort', onUserAbort, { once: true });
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e as { name?: string } | null)?.name === 'AbortError';
      if (aborted && timedOut) {
        throw new NetworkError('Timeout beim Request.', {
          cause: e,
          kind: 'timeout',
        });
      }
      throw new NetworkError('Netzwerkfehler beim Request.', {
        cause: e,
        kind: 'transport',
      });
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
    }
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new InvalidResponseError('Antwort ist kein gültiges JSON.', {
        status: res.status,
        bodySnippet: text.slice(0, 200),
        cause: e,
      });
    }
  }
}
