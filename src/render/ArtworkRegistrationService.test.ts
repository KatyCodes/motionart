import { describe, expect, it, vi } from 'vitest';
import type { ArtworkReference } from '../model/ArtworkReference';
import {
  createHttpArtworkRegistrationService,
  registerRenderRequestArtwork,
} from './ArtworkRegistrationService';
import type { RenderRequest } from './RenderRequest';

const albumArtwork: ArtworkReference = {
  provider: 'customer catalog',
  assetKey: 'albums/night drive/cover',
  version: 'final 2',
};

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'launch-1',
  deliverables: [
    {
      id: 'apple-album',
      target: { kind: 'apple-album', albumId: 'album-1' },
      title: 'Night Drive',
      artwork: albumArtwork,
      motion: { style: 'drift', speed: 1, intensity: 0.5, loopBehavior: 'loop' },
      destination: {
        profileId: 'apple',
        name: 'Apple',
        aspectRatio: { width: 1, height: 1 },
      },
      output: { width: 100, height: 100, durationSeconds: 1, format: 'gif' },
    },
    {
      id: 'spotify-track:track-1',
      target: { kind: 'spotify-track', trackId: 'track-1' },
      title: 'Signal',
      artwork: albumArtwork,
      motion: { style: 'drift', speed: 1, intensity: 0.5, loopBehavior: 'loop' },
      destination: {
        profileId: 'spotify',
        name: 'Spotify',
        aspectRatio: { width: 9, height: 16 },
      },
      output: { width: 90, height: 160, durationSeconds: 1, format: 'gif' },
    },
  ],
};

describe('HTTP artwork registration', () => {
  it('uploads resolved image bytes under an encoded durable reference', async () => {
    const fetchRequest = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response(null, { status: 201 }));
    const service = createHttpArtworkRegistrationService({
      baseUrl: '/api/company-tbd',
      fetch: fetchRequest,
    });
    const source = {
      type: 'blob' as const,
      blob: new Blob(['actual-image'], { type: 'image/png' }),
    };

    await service.register(albumArtwork, source);

    expect(fetchRequest).toHaveBeenCalledOnce();
    const [url, init] = fetchRequest.mock.calls[0];
    expect(url).toBe(
      '/api/company-tbd/render-assets/customer%20catalog/albums%2Fnight%20drive%2Fcover/final%202',
    );
    expect(init).toMatchObject({ method: 'PUT' });
    expect(new Headers(init?.headers).get('Content-Type')).toBe('image/png');
    expect(await new Response(init?.body).text()).toBe('actual-image');
  });

  it('rejects non-image sources before sending them', async () => {
    const fetchRequest = vi.fn();
    const service = createHttpArtworkRegistrationService({ fetch: fetchRequest });

    await expect(service.register(albumArtwork, {
      type: 'blob',
      blob: new Blob(['not-an-image'], { type: 'text/plain' }),
    })).rejects.toThrow('must be an image');
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it('rejects an empty image before sending it', async () => {
    const fetchRequest = vi.fn();
    const service = createHttpArtworkRegistrationService({ fetch: fetchRequest });

    await expect(service.register(albumArtwork, {
      type: 'blob',
      blob: new Blob([], { type: 'image/png' }),
    })).rejects.toThrow('cannot be empty');
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});

describe('registerRenderRequestArtwork', () => {
  it('registers a shared reference only once', async () => {
    const source = { type: 'blob' as const, blob: new Blob(['image'], { type: 'image/png' }) };
    const resolveArtwork = vi.fn(() => source);
    const register = vi.fn(async () => undefined);

    await registerRenderRequestArtwork(request, resolveArtwork, { register });

    expect(resolveArtwork).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith(albumArtwork, source, undefined);
  });
});
