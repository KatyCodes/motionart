import { describe, expect, it } from 'vitest';
import type { RenderRequest } from '../src/render/RenderRequest';
import { createFakeRenderService } from '../src/render/RenderService';
import { createLocalRenderApi } from './LocalRenderApi';
import { createInMemoryArtworkStore } from './render/InMemoryArtworkStore';

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-local',
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

describe('LocalRenderApi', () => {
  it('submits and polls a render through the HTTP-shaped route contract', async () => {
    const api = createLocalRenderApi(
      createFakeRenderService({ createJobId: () => 'local-render-1' }),
    );

    const submitted = await api.handle({ method: 'POST', path: '/render-jobs', body: request });
    const processing = await api.handle({ method: 'GET', path: '/render-jobs/local-render-1' });
    const completed = await api.handle({ method: 'GET', path: '/render-jobs/local-render-1' });

    expect(submitted).toMatchObject({
      status: 201,
      body: { id: 'local-render-1', status: 'submitted' },
    });
    expect(processing).toMatchObject({ status: 200, body: { status: 'processing' } });
    expect(completed).toMatchObject({
      status: 200,
      body: {
        status: 'completed',
        outputs: [{ deliverableId: 'apple-album', fileName: 'night-drive.gif' }],
      },
    });
  });

  it('returns a stable client error for an invalid render request', async () => {
    const api = createLocalRenderApi(createFakeRenderService());

    const response = await api.handle({
      method: 'POST',
      path: '/render-jobs',
      body: { schemaVersion: 1, launchId: '', deliverables: [] },
    });

    expect(response).toMatchObject({
      status: 400,
      body: { code: 'INVALID_RENDER_REQUEST' },
    });
  });

  it('returns a stable not-found error for an unknown job', async () => {
    const api = createLocalRenderApi(createFakeRenderService());

    const response = await api.handle({
      method: 'GET',
      path: '/render-jobs/missing-job',
    });

    expect(response).toEqual({
      status: 404,
      body: {
        code: 'RENDER_JOB_NOT_FOUND',
        message: 'Unknown render job: missing-job',
      },
    });
  });

  it('serves a rendered artifact as binary data', async () => {
    const bytes = new TextEncoder().encode('GIF89a-download');
    const api = createLocalRenderApi(createFakeRenderService(), {
      getArtifact(jobId, fileName) {
        if (jobId !== 'render-1' || fileName !== 'night-drive-preview.gif') return undefined;
        return {
          deliverableId: 'apple-album',
          fileName,
          contentType: 'image/gif',
          width: 320,
          height: 320,
          frameCount: 16,
          bytes,
        };
      },
    });

    const response = await api.handle({
      method: 'GET',
      path: '/render-files/render-1/night-drive-preview.gif',
    });

    expect(response).toEqual({
      status: 200,
      body: bytes,
      contentType: 'image/gif',
      fileName: 'night-drive-preview.gif',
    });
  });

  it('registers artwork bytes under a durable reference', async () => {
    const artworkStore = createInMemoryArtworkStore();
    const api = createLocalRenderApi(createFakeRenderService(), undefined, artworkStore);
    const bytes = new Uint8Array([4, 5, 6]);

    const response = await api.handle({
      method: 'PUT',
      path: '/render-assets/customer%20catalog/albums%2Fone%2Fcover/version%202',
      body: bytes,
    });

    expect(response).toMatchObject({ status: 201 });
    await expect(artworkStore.resolve({
      provider: 'customer catalog',
      assetKey: 'albums/one/cover',
      version: 'version 2',
    })).resolves.toEqual(bytes);
  });
});
