import { describe, expect, it } from 'vitest';
import { getWaterFrame } from './WaterAnimation';

describe('getWaterFrame', () => {
  it('returns the same ripple state for the same time and settings', () => {
    const settings = { speed: 1.35, intensity: 0.9 };

    expect(getWaterFrame(6.25, settings)).toEqual(getWaterFrame(6.25, settings));
  });

  it('uses speed to advance the water timeline', () => {
    expect(getWaterFrame(3, { speed: 2, intensity: 1 })).toEqual(
      getWaterFrame(6, { speed: 1, intensity: 1 }),
    );
  });

  it('removes distortion and overscan when intensity is zero', () => {
    const frame = getWaterFrame(8, { speed: 1, intensity: 0 });

    expect(frame.zoom).toBe(1);
    expect(frame.displacementX).toBe(0);
    expect(frame.displacementY).toBe(0);
  });

  it('rejects invalid water settings', () => {
    expect(() => getWaterFrame(Number.NaN, { speed: 1, intensity: 1 })).toThrow(RangeError);
    expect(() => getWaterFrame(1, { speed: 0, intensity: 1 })).toThrow(RangeError);
    expect(() => getWaterFrame(1, { speed: 1, intensity: -0.1 })).toThrow(RangeError);
  });
});
