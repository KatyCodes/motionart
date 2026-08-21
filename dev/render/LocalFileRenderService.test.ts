import { describe, expect, it } from 'vitest';
import type { RenderRequest } from '../../src/render/RenderRequest';
import { createInMemoryRenderArtifactStore } from './InMemoryRenderArtifactStore';
import { createInMemoryRenderJobRepository } from './InMemoryRenderJobRepository';
import { createLocalFileRenderService } from './LocalFileRenderService';

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-local-file',
  deliverables: [
    {
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
    },
  ],
};

describe('LocalFileRenderService', () => {
  it('attaches a downloadable preview artifact when rendering completes', async () => {
    const bytes = new TextEncoder().encode('GIF89a-real-preview');
    const artifactStore = createInMemoryRenderArtifactStore();
    const jobRepository = createInMemoryRenderJobRepository();
    const service = createLocalFileRenderService({
      apiBaseUrl: '/api/company-tbd',
      artifactStore,
      jobRepository,
      createJobId: () => 'local-file-1',
      now: () => '2026-08-11T12:00:00.000Z',
      async renderDeliverable(deliverable) {
        return {
          deliverableId: deliverable.id,
          fileName: 'night-drive-preview.gif',
          contentType: 'image/gif',
          width: 320,
          height: 320,
          frameCount: 16,
          bytes,
        };
      },
    });

    const submitted = await service.submit(request);
    const processing = await service.get(submitted.id);
    const completed = await service.get(submitted.id);

    expect(processing.status).toBe('processing');
    expect(completed).toMatchObject({
      status: 'completed',
      outputs: [
        {
          deliverableId: 'apple-album',
          fileName: 'night-drive-preview.gif',
          artifact: {
            kind: 'preview',
            contentType: 'image/gif',
            downloadUrl: '/api/company-tbd/render-files/local-file-1/night-drive-preview.gif',
            width: 320,
            height: 320,
          },
        },
      ],
    });
    await expect(service.getArtifact('local-file-1', 'night-drive-preview.gif')).resolves
      .toMatchObject({ bytes });
    await expect(jobRepository.find('local-file-1')).resolves.toMatchObject({
      job: { status: 'completed' },
      request: { launchId: 'checkout-local-file' },
    });
  });

  it('turns an unsupported render into a non-retryable failed job', async () => {
    const service = createLocalFileRenderService({
      apiBaseUrl: '/api/company-tbd',
      async renderDeliverable() {
        throw new Error('The preview renderer only produces GIF previews.');
      },
    });
    const submitted = await service.submit(request);

    await service.get(submitted.id);
    const failed = await service.get(submitted.id);

    expect(failed).toMatchObject({
      status: 'failed',
      failure: {
        code: 'LOCAL_PREVIEW_RENDER_FAILED',
        message: 'The preview renderer only produces GIF previews.',
        retryable: false,
      },
    });
  });
});
