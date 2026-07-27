import { describe, expect, it } from 'vitest';
import { getDestinationProfile, validateDestinationProfile } from './DestinationProfile';

describe('destination profiles', () => {
  it('provides a reusable profile for each available destination', () => {
    expect(getDestinationProfile('spotify-canvas-v1')).toMatchObject({
      id: 'spotify-canvas-v1',
      aspectRatio: { width: 9, height: 16 },
    });
  });

  it('rejects an unknown destination instead of silently using a default', () => {
    expect(() => getDestinationProfile('unknown-destination')).toThrow('Unknown destination profile');
  });

  it('rejects profiles whose aspect ratio cannot create a preview', () => {
    expect(() => validateDestinationProfile({
      id: 'invalid-v1',
      name: 'Invalid',
      aspectRatio: { width: 0, height: 1 },
      output: { width: 1080, height: 1080 },
    })).toThrow(RangeError);
  });
});
