import { describe, expect, it } from 'vitest';
import { getDestinationProfile, validateDestinationProfile } from './DestinationProfile';

describe('destination profiles', () => {
  it('provides a reusable profile for each available destination', () => {
    expect(getDestinationProfile('spotify-canvas-v1')).toMatchObject({
      id: 'spotify-canvas-v1',
      aspectRatio: { width: 9, height: 16 },
    });
  });

  it('keeps Apple Music requirements separate from Spotify Canvas requirements', () => {
    expect(getDestinationProfile('apple-music-cover-art-v1')).toMatchObject({
      aspectRatio: { width: 1, height: 1 },
      pixelRequirements: { minWidth: 4000, minHeight: 4000 },
    });

    expect(getDestinationProfile('spotify-canvas-v1')).toMatchObject({
      durationSeconds: { min: 3, max: 8 },
      pixelRequirements: { minHeight: 720, maxHeight: 1080 },
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
      pixelRequirements: { minWidth: 1080, minHeight: 1080 },
      acceptedFormats: ['mp4'],
    })).toThrow(RangeError);
  });
});
