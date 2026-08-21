import { describe, expect, it } from 'vitest';
import type { RenderJob } from './RenderJob';
import type { RenderRequest } from './RenderRequest';
import {
  createHttpRenderService,
  type RenderFetch,
  type RenderServiceHttpError,
} from './HttpRenderService';

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

const submittedJob: RenderJob = {
  schemaVersion: 1,
  id: 'render-1',
  launchId: request.launchId,
  status: 'submitted',
  progress: { completed: 0, total: 1 },
  outputs: [],
  failure: null,
  submittedAt: '2026-08-04T12:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z',
};

describe('HttpRenderService', () => {
  it('posts a versioned render request with fresh host authentication', async () => {
    let capturedInput: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetch: RenderFetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return jsonResponse(submittedJob, 201);
    };
    const service = createHttpRenderService({
      baseUrl: 'https://api.company-tbd.example/v1/',
      fetch,
      getHeaders: async () => ({ Authorization: 'Bearer fresh-token' }),
    });

    await expect(service.submit(request)).resolves.toEqual(submittedJob);
    expect(String(capturedInput)).toBe('https://api.company-tbd.example/v1/render-jobs');
    expect(capturedInit?.method).toBe('POST');
    expect(new Headers(capturedInit?.headers).get('authorization')).toBe('Bearer fresh-token');
    expect(new Headers(capturedInit?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(capturedInit?.body))).toEqual(request);
  });

  it('encodes the job ID and forwards cancellation when polling', async () => {
    let capturedInput: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetch: RenderFetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return jsonResponse({ ...submittedJob, id: 'render/job 1' });
    };
    const service = createHttpRenderService({
      baseUrl: '/company-tbd-api',
      fetch,
    });
    const controller = new AbortController();

    await service.get('render/job 1', { signal: controller.signal });

    expect(String(capturedInput)).toBe('/company-tbd-api/render-jobs/render%2Fjob%201');
    expect(capturedInit?.method).toBe('GET');
    expect(capturedInit?.signal).toBe(controller.signal);
  });

  it('turns a non-success response into a typed retryable error', async () => {
    const fetch: RenderFetch = async () => jsonResponse(
      {
        code: 'RENDERER_UNAVAILABLE',
        message: 'Renderer is temporarily unavailable.',
      },
      503,
    );
    const service = createHttpRenderService({ baseUrl: '/api', fetch });

    await expect(service.submit(request)).rejects.toEqual(expect.objectContaining({
      name: 'RenderServiceHttpError',
      status: 503,
      code: 'RENDERER_UNAVAILABLE',
      retryable: true,
      message: 'Renderer is temporarily unavailable.',
    } satisfies Partial<RenderServiceHttpError>));
  });

  it('rejects malformed success data before it reaches React', async () => {
    const fetch: RenderFetch = async () => jsonResponse({ ...submittedJob, id: '' });
    const service = createHttpRenderService({ baseUrl: '/api', fetch });

    await expect(service.get('render-1')).rejects.toThrow('Render job requires a job ID');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
