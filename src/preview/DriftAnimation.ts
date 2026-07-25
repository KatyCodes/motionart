export interface DriftFrame {
  zoom: number;
  offsetXRatio: number;
  offsetYRatio: number;
}

export interface DriftSettings {
  speed: number;
  intensity: number;
}

export const defaultDriftSettings: DriftSettings = {
  speed: 1,
  intensity: 1,
};

/** Returns the same animation state for the same timestamp on every renderer. */
export function getDriftFrame(
  timeSeconds: number,
  settings: DriftSettings = defaultDriftSettings,
): DriftFrame {
  if (!Number.isFinite(timeSeconds)) {
    throw new RangeError('Animation time must be a finite number.');
  }

  if (settings.speed <= 0 || settings.intensity < 0) {
    throw new RangeError('Drift speed must be positive and intensity cannot be negative.');
  }

  const adjustedTime = timeSeconds * settings.speed;
  const intensity = settings.intensity;

  return {
    zoom: 1 + (Math.sin(adjustedTime * 0.38) + 1) * 0.018 * intensity,
    offsetXRatio: Math.sin(adjustedTime * 0.24) * 0.018 * intensity,
    offsetYRatio: Math.cos(adjustedTime * 0.19) * 0.014 * intensity,
  };
}
