import { describe, expect, it } from 'vitest';
import { normalizeMotionControls } from './MotionControls';

describe('normalizeMotionControls', () => {
  it('keeps values that are already within the editor limits', () => {
    expect(normalizeMotionControls({ speed: 1.2, intensity: 0.8 })).toEqual({
      speed: 1.2,
      intensity: 0.8,
    });
  });

  it('clamps values to the limits exposed by the editor', () => {
    expect(normalizeMotionControls({ speed: 3, intensity: -1 })).toEqual({
      speed: 2,
      intensity: 0,
    });
  });

  it('rejects values that cannot represent animation settings', () => {
    expect(() => normalizeMotionControls({ speed: Number.NaN, intensity: 1 })).toThrow(RangeError);
  });
});
