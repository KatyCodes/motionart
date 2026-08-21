import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderDriftGifPreview } from './DriftGifRenderer';

const driftDeliverable: RenderDeliverable = {
  id: 'apple-album',
  target: { kind: 'apple-album', albumId: 'album-1' },
  title: 'Night Drive',
  artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
  motion: { style: 'drift', speed: 1, intensity: 0.6, loopBehavior: 'loop' },
  destination: {
    profileId: 'apple-music-cover-art-v1',
    name: 'Apple Music cover art',
    aspectRatio: { width: 1, height: 1 },
  },
  output: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
};

describe('renderDriftGifPreview', () => {
  it('encodes deterministic Drift frames as a real animated GIF', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));

    const artifact = await renderDriftGifPreview(driftDeliverable, artwork, {
      maximumDimension: 64,
      framesPerSecond: 3,
      maximumDurationSeconds: 1,
    });
    const metadata = await sharp(artifact.bytes, { animated: true }).metadata();

    expect(new TextDecoder().decode(artifact.bytes.slice(0, 6))).toBe('GIF89a');
    expect(artifact).toMatchObject({
      deliverableId: 'apple-album',
      fileName: 'night-drive-preview.gif',
      contentType: 'image/gif',
      width: 64,
      height: 64,
      frameCount: 3,
    });
    expect(metadata).toMatchObject({
      format: 'gif',
      width: 64,
      height: 192,
      pageHeight: 64,
      pages: 3,
    });
    expect(artifact.bytes.byteLength).toBeGreaterThan(1_000);
  });

  it('rejects effects and formats this first renderer does not claim to support', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));

    await expect(renderDriftGifPreview({
      ...driftDeliverable,
      motion: { ...driftDeliverable.motion, style: 'water' },
    }, artwork)).rejects.toThrow('only supports the Drift effect');
    await expect(renderDriftGifPreview({
      ...driftDeliverable,
      output: { ...driftDeliverable.output, format: 'mp4' },
    }, artwork)).rejects.toThrow('only produces GIF previews');
  });
});
