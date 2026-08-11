import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderMotionGifPreview } from './MotionGifRenderer';

const deliverable: RenderDeliverable = {
  id: 'apple-album',
  target: { kind: 'apple-album', albumId: 'album-1' },
  title: 'Night Drive',
  artwork: { provider: 'cdbaby', assetKey: 'cover' },
  motion: { style: 'drift', speed: 1, intensity: 0.7, loopBehavior: 'loop' },
  destination: {
    profileId: 'apple',
    name: 'Apple',
    aspectRatio: { width: 1, height: 1 },
  },
  output: { width: 100, height: 100, durationSeconds: 1, format: 'gif' },
};

describe('renderMotionGifPreview', () => {
  it('dispatches both configured motion styles through one render entry point', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));
    const options = { maximumDimension: 32, framesPerSecond: 2, maximumDurationSeconds: 1 };

    const drift = await renderMotionGifPreview(deliverable, artwork, options);
    const water = await renderMotionGifPreview({
      ...deliverable,
      motion: { ...deliverable.motion, style: 'water' },
    }, artwork, options);

    expect(drift.frameCount).toBe(2);
    expect(water.frameCount).toBe(2);
    expect(drift.bytes).not.toEqual(water.bytes);
  });
});
