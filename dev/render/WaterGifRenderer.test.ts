import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderWaterGifPreview } from './WaterGifRenderer';

const waterDeliverable: RenderDeliverable = {
  id: 'spotify-track:track-1',
  target: { kind: 'spotify-track', trackId: 'track-1' },
  title: 'Signal',
  artwork: { provider: 'cdbaby', assetKey: 'track-cover' },
  motion: { style: 'water', speed: 1.1, intensity: 0.9, loopBehavior: 'loop' },
  destination: {
    profileId: 'spotify-canvas-v1',
    name: 'Spotify Canvas',
    aspectRatio: { width: 9, height: 16 },
  },
  output: { width: 1080, height: 1920, durationSeconds: 8, format: 'gif' },
};

describe('renderWaterGifPreview', () => {
  it('encodes deterministic Water frames as a real animated GIF', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));

    const artifact = await renderWaterGifPreview(waterDeliverable, artwork, {
      maximumDimension: 64,
      framesPerSecond: 3,
      maximumDurationSeconds: 1,
    });
    const image = sharp(artifact.bytes, { animated: true }).ensureAlpha().raw();
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    const frameBytes = artifact.width * artifact.height * info.channels;

    expect(new TextDecoder().decode(artifact.bytes.slice(0, 6))).toBe('GIF89a');
    expect(artifact).toMatchObject({
      deliverableId: 'spotify-track:track-1',
      fileName: 'signal-preview.gif',
      contentType: 'image/gif',
      width: 36,
      height: 64,
      frameCount: 3,
    });
    expect(info).toMatchObject({ width: 36, height: 192, channels: 4 });
    expect(data.subarray(0, frameBytes).equals(data.subarray(frameBytes, frameBytes * 2))).toBe(
      false,
    );
    expect(artifact.bytes.byteLength).toBeGreaterThan(1_000);
  });

  it('rejects effects and formats it does not claim to support', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));

    await expect(renderWaterGifPreview({
      ...waterDeliverable,
      motion: { ...waterDeliverable.motion, style: 'drift' },
    }, artwork)).rejects.toThrow('only supports the Water effect');
    await expect(renderWaterGifPreview({
      ...waterDeliverable,
      output: { ...waterDeliverable.output, format: 'mp4' },
    }, artwork)).rejects.toThrow('only produces GIF previews');
  });
});
