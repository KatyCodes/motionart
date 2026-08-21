export interface MotionControls {
  speed: number;
  intensity: number;
}

export const motionControlLimits = {
  speed: { minimum: 0.5, maximum: 2 },
  intensity: { minimum: 0, maximum: 1.5 },
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeMotionControls(controls: MotionControls): MotionControls {
  if (!Number.isFinite(controls.speed) || !Number.isFinite(controls.intensity)) {
    throw new RangeError('Motion controls must be finite numbers.');
  }

  return {
    speed: clamp(controls.speed, motionControlLimits.speed.minimum, motionControlLimits.speed.maximum),
    intensity: clamp(
      controls.intensity,
      motionControlLimits.intensity.minimum,
      motionControlLimits.intensity.maximum,
    ),
  };
}
