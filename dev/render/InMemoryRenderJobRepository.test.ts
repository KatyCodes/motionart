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
  it('creates and updates versioned records without exposing stored mutable state', async () => {
    const repository = createInMemoryRenderJobRepository();
    const job = createSubmittedRenderJob(request, 'render-1', '2026-08-11T12:00:00.000Z');
    const created = await repository.create({ job, request });

    const firstRead = await repository.find('render-1');
    expect(created).toEqual({ job, request, revision: 0 });
    expect(firstRead).toEqual(created);

    if (!firstRead) throw new Error('Expected the stored render job.');
    firstRead.job.status = 'processing';
    firstRead.request.deliverables[0].title = 'Changed outside the repository';

    await expect(repository.find('render-1')).resolves.toEqual({ job, request, revision: 0 });

    const updated = await repository.update({
      ...firstRead,
      request,
    });
    expect(updated.revision).toBe(1);
    await expect(repository.find('render-1')).resolves.toMatchObject({
      job: { status: 'processing' },
      revision: 1,
    });
  });

  it('rejects duplicate creates', async () => {
    const repository = createInMemoryRenderJobRepository();
    const job = createSubmittedRenderJob(request, 'render-1', '2026-08-11T12:00:00.000Z');

    await repository.create({ job, request });

    await expect(repository.create({ job, request })).rejects.toThrow(
      'Render job already exists: render-1',
    );
  });

  it('rejects a stale update without overwriting the current record', async () => {
    const repository = createInMemoryRenderJobRepository();
    const job = createSubmittedRenderJob(request, 'render-1', '2026-08-11T12:00:00.000Z');
    const original = await repository.create({ job, request });
    const current = await repository.update({
      ...original,
      job: { ...original.job, status: 'processing' },
    });

    await expect(repository.update(original)).rejects.toThrow(
      'Render job revision conflict: render-1',
    );
    await expect(repository.find('render-1')).resolves.toEqual(current);
  });

  it('returns undefined for an unknown job', async () => {
    const repository = createInMemoryRenderJobRepository();

    await expect(repository.find('missing')).resolves.toBeUndefined();
  });
});
