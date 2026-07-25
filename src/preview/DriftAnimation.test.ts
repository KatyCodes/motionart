import { describe, expect, it } from 'vitest';
import { getDriftFrame } from './DriftAnimation';

describe('getDriftFrame', () => {
  it('returns the same frame for the same time and settings', () => {
    const settings = { speed: 1.25, intensity: 0.8 };

    expect(getDriftFrame(12.5, settings)).toEqual(getDriftFrame(12.5, settings));
  });

  it('removes all motion when intensity is zero', () => {
    expect(getDriftFrame(8, { speed: 1, intensity: 0 })).toEqual({
      zoom: 1,
      offsetXRatio: 0,
      offsetYRatio: 0,
    });
  });

  it('rejects invalid motion settings', () => {
    expect(() => getDriftFrame(1, { speed: 0, intensity: 1 })).toThrow(RangeError);
    expect(() => getDriftFrame(1, { speed: 1, intensity: -0.1 })).toThrow(RangeError);
  });
});
