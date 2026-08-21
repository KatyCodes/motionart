import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { describe, expect, it } from 'vitest';
import type { MotionStyleId } from '../../src/model/AlbumMotionProject';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderMotionPreview } from './MotionPreviewRenderer';

const spotifyDeliverable: RenderDeliverable = {
  id: 'spotify-track:track-1',
  target: { kind: 'spotify-track', trackId: 'track-1' },
  title: 'Signal',
  artwork: { provider: 'cdbaby', assetKey: 'track-cover' },
  motion: { style: 'drift', speed: 1, intensity: 0.8, loopBehavior: 'loop' },
  destination: {
    profileId: 'spotify-canvas-v1',
    name: 'Spotify Canvas',
    aspectRatio: { width: 9, height: 16 },
  },
  output: { width: 540, height: 960, durationSeconds: 8, format: 'mp4' },
};

describe('renderMotionPreview', () => {
  it.each<MotionStyleId>(['drift', 'water'])(
    'encodes %s frames as a real MP4 preview',
    async (style) => {
      const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));
      const artifact = await renderMotionPreview({
        ...spotifyDeliverable,
        motion: { ...spotifyDeliverable.motion, style },
      }, artwork, {
        maximumDimension: 64,
        framesPerSecond: 2,
        maximumDurationSeconds: 1,
      });

      expect(artifact).toMatchObject({
        deliverableId: 'spotify-track:track-1',
        fileName: 'signal-preview.mp4',
        contentType: 'video/mp4',
        width: 36,
        height: 64,
        frameCount: 2,
      });
      expect(new TextDecoder().decode(artifact.bytes.slice(4, 8))).toBe('ftyp');
      expect(artifact.bytes.byteLength).toBeGreaterThan(1_000);
      expectMp4ToDecode(artifact.bytes);
    },
  );

  it('keeps GIF available through the same format-dispatch boundary', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));
    const artifact = await renderMotionPreview({
      ...spotifyDeliverable,
      output: { ...spotifyDeliverable.output, format: 'gif' },
    }, artwork, {
      maximumDimension: 32,
      framesPerSecond: 2,
      maximumDurationSeconds: 1,
    });

    expect(artifact.contentType).toBe('image/gif');
    expect(new TextDecoder().decode(artifact.bytes.slice(0, 6))).toBe('GIF89a');
  });

  it('rejects an output format with no encoder', async () => {
    const artwork = await readFile(new URL('../../src/assets/sample-cover.svg', import.meta.url));

    await expect(renderMotionPreview({
      ...spotifyDeliverable,
      output: { ...spotifyDeliverable.output, format: 'webm' },
    }, artwork)).rejects.toThrow('Unsupported preview format: webm');
  });
});

function expectMp4ToDecode(bytes: Uint8Array): void {
  if (!ffmpegPath) throw new Error('The test requires the bundled FFmpeg binary.');

  const result = spawnSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-f', 'null',
    'pipe:1',
  ], {
    input: bytes,
  });

  expect(result.status, result.stderr.toString()).toBe(0);
}
