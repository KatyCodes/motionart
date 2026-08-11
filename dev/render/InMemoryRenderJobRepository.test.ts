import { describe, expect, it } from 'vitest';
import { createSubmittedRenderJob } from '../../src/render/RenderJob';
import type { RenderRequest } from '../../src/render/RenderRequest';
import { createInMemoryRenderJobRepository } from './InMemoryRenderJobRepository';

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-persistence',
  deliverables: [
    {
      id: 'apple-album',
      target: { kind: 'apple-album', albumId: 'album-1' },
      title: 'Night Drive',
      artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
      motion: { style: 'water', speed: 1, intensity: 0.7, loopBehavior: 'loop' },
      destination: {
        profileId: 'apple-music-cover-art-v1',
        name: 'Apple Music cover art',
        aspectRatio: { width: 1, height: 1 },
      },
      output: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
    },
  ],
};

describe('InMemoryRenderJobRepository', () => {
  it('saves and updates job records without exposing stored mutable state', async () => {
    const repository = createInMemoryRenderJobRepository();
    const job = createSubmittedRenderJob(request, 'render-1', '2026-08-11T12:00:00.000Z');
    await repository.save({ job, request });

    const firstRead = await repository.find('render-1');
    expect(firstRead).toEqual({ job, request });

    if (!firstRead) throw new Error('Expected the stored render job.');
    firstRead.job.status = 'processing';
    firstRead.request.deliverables[0].title = 'Changed outside the repository';

    await expect(repository.find('render-1')).resolves.toEqual({ job, request });

    await repository.save({
      ...firstRead,
      request,
    });
    await expect(repository.find('render-1')).resolves.toMatchObject({
      job: { status: 'processing' },
    });
  });

  it('returns undefined for an unknown job', async () => {
    const repository = createInMemoryRenderJobRepository();

    await expect(repository.find('missing')).resolves.toBeUndefined();
  });
});
