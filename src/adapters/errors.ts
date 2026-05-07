/** Netzwerk-/Transportfehler (keine Antwort, Timeout, CORS, etc.). */
export class NetworkError extends Error {
  readonly code = 'NETWORK_ERROR' as const;
  override readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'NetworkError';
    this.cause = options?.cause;
  }
}

/** Antwort nicht parsebar oder kein gültiges SpinResult. */
export class InvalidResponseError extends Error {
  readonly code = 'INVALID_RESPONSE' as const;
  readonly status?: number;
  readonly bodySnippet?: string;
  constructor(
    message: string,
    options?: { status?: number; bodySnippet?: string; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'InvalidResponseError';
    this.status = options?.status;
    this.bodySnippet = options?.bodySnippet;
  }
}

/** Server signalisiert unzureichendes Guthaben (Business-Code / HTTP). */
export class InsufficientBalanceError extends Error {
  readonly code = 'INSUFFICIENT_BALANCE' as const;
  readonly status?: number;
  readonly apiCode?: string;
  constructor(
    message: string,
    options?: { status?: number; apiCode?: string; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'InsufficientBalanceError';
    this.status = options?.status;
    this.apiCode = options?.apiCode;
  }
}
