export interface DriftFrame {
  zoom: number;
  offsetXRatio: number;
  offsetYRatio: number;
}

/** Returns the same animation state for the same timestamp on every renderer. */
export function getDriftFrame(timeSeconds: number): DriftFrame {
  if (!Number.isFinite(timeSeconds)) {
    throw new RangeError('Animation time must be a finite number.');
  }

  return {
    zoom: 1 + (Math.sin(timeSeconds * 0.38) + 1) * 0.018,
    offsetXRatio: Math.sin(timeSeconds * 0.24) * 0.018,
    offsetYRatio: Math.cos(timeSeconds * 0.19) * 0.014,
  };
}
