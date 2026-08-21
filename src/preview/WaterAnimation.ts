import type { MotionControls } from '../model/MotionControls';

export interface WaterFrame {
  zoom: number;
  displacementX: number;
  displacementY: number;
  mapOffsetX: number;
  mapOffsetY: number;
}

export interface WaterDisplacementSample {
  horizontal: number;
  vertical: number;
}

export const defaultWaterSettings: MotionControls = {
  speed: 1,
  intensity: 1,
};

const displacementMapSize = 256;

/** Returns deterministic ripple settings for a specific point on the timeline. */
export function getWaterFrame(
  timeSeconds: number,
  settings: MotionControls = defaultWaterSettings,
): WaterFrame {
  if (!Number.isFinite(timeSeconds)) {
    throw new RangeError('Animation time must be a finite number.');
  }

  if (settings.speed <= 0 || settings.intensity < 0) {
    throw new RangeError('Water speed must be positive and intensity cannot be negative.');
  }

  const adjustedTime = timeSeconds * settings.speed;
  const intensity = settings.intensity;
  const pulse = (Math.sin(adjustedTime * 0.62) + 1) / 2;

  return {
    zoom: 1 + 0.05 * intensity,
    displacementX: (10 + pulse * 10) * intensity,
    displacementY: (15 + (1 - pulse) * 13) * intensity,
    mapOffsetX: wrap(adjustedTime * 19, displacementMapSize),
    mapOffsetY: wrap(adjustedTime * 11, displacementMapSize),
  };
}

/** The repeating waveform encoded into the PixiJS displacement texture. */
export function getWaterDisplacementSample(
  normalizedX: number,
  normalizedY: number,
): WaterDisplacementSample {
  const x = wrap(normalizedX, 1);
  const y = wrap(normalizedY, 1);

  return {
    horizontal: Math.sin(y * Math.PI * 8)
      + Math.sin((x + y) * Math.PI * 4) * 0.45,
    vertical: Math.cos(x * Math.PI * 6)
      + Math.cos((x - y) * Math.PI * 4) * 0.45,
  };
}

function wrap(value: number, range: number): number {
  return ((value % range) + range) % range;
}
