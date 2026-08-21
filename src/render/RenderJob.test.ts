import { describe, expect, it } from 'vitest';
import type { RenderRequest } from './RenderRequest';
import { createFakeRenderService } from './RenderService';

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-123',
  deliverables: [
    {
      id: 'spotify-track:track-1',
      target: { kind: 'spotify-track', trackId: 'track-1' },
      title: 'Signal',
      artwork: { provider: 'cdbaby', assetKey: 'signal-cover' },
      motion: { style: 'water', speed: 1.25, intensity: 0.8, loopBehavior: 'loop' },
      destination: {
        profileId: 'spotify-canvas-v1',
        name: 'Spotify Canvas',
        aspectRatio: { width: 9, height: 16 },
      },
      output: { width: 540, height: 960, durationSeconds: 8, format: 'mp4' },
    },
  ],
};

describe('FakeRenderService', () => {
  it('moves a job from submitted to processing to completed', async () => {
    const service = createFakeRenderService({
      createJobId: () => 'render-1',
      now: () => '2026-08-04T12:00:00.000Z',
    });

    const submitted = await service.submit(request);
    const processing = await service.get(submitted.id);
    const completed = await service.get(submitted.id);

    expect(submitted).toMatchObject({
      schemaVersion: 1,
      id: 'render-1',
      launchId: 'checkout-123',
      status: 'submitted',
      progress: { completed: 0, total: 1 },
    });
    expect(processing).toMatchObject({
      status: 'processing',
      progress: { completed: 0, total: 1 },
    });
    expect(completed).toMatchObject({
      status: 'completed',
      progress: { completed: 1, total: 1 },
      outputs: [
        {
          deliverableId: 'spotify-track:track-1',
          fileName: 'signal.mp4',
        },
      ],
    });
    expect(await service.get(submitted.id)).toEqual(completed);
  });

  it('represents a backend failure without throwing away the job', async () => {
    const service = createFakeRenderService({
      createJobId: () => 'render-failed',
      finalStatus: 'failed',
    });
    const submitted = await service.submit(request);

    await service.get(submitted.id);
    const failed = await service.get(submitted.id);

    expect(failed).toMatchObject({
      id: 'render-failed',
      status: 'failed',
      failure: {
        code: 'DEMO_RENDER_FAILED',
        retryable: true,
      },
    });
  });

  it('rejects an unknown job ID', async () => {
    const service = createFakeRenderService();

    await expect(service.get('missing-job')).rejects.toThrow('Unknown render job');
  });
});
