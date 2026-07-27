import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeArtwork } from './ArtworkSource';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL artwork loading', () => {
  it('explains that the host must allow browser CORS when fetch is blocked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(decodeArtwork(
      { type: 'url', url: 'https://cdn.example.test/cover.jpg' },
      new AbortController().signal,
    )).rejects.toThrow('must allow cross-origin image requests');
  });
});
