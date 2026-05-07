/** Nur Darstellung — Easing für Reel-Bewegung. */

export function easeOutQuart(t: number): number {
  const x = 1 - Math.max(0, Math.min(1, t));
  return 1 - x * x * x * x;
}

export function easeOutCubic(t: number): number {
  const x = 1 - Math.max(0, Math.min(1, t));
  return 1 - x * x * x;
}

export function easeInCubic(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u;
}

/** Leichter Overshoot (0→1). */
export function easeOutBack(t: number, s = 1.4): number {
  const x = Math.max(0, Math.min(1, t));
  const x1 = x - 1;
  return 1 + x1 * x1 * ((s + 1) * x1 + s);
}

export function bounceOffset(
  elapsedAfterStop: number,
  amplitude: number,
  frequency = 0.022,
  decay = 0.0045,
): number {
  if (elapsedAfterStop <= 0) return 0;
  return (
    amplitude *
    Math.sin(elapsedAfterStop * frequency) *
    Math.exp(-elapsedAfterStop * decay)
  );
}
