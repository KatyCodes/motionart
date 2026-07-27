import { describe, expect, it } from 'vitest';
import {
  createHostEditorSession,
  type HostLaunchConfig,
} from './HostLaunchConfig';

const albumArtworkUrl = 'https://cdn.example.test/releases/album-1.jpg?temporary=token';

function createConfig(
  deliverables: HostLaunchConfig['deliverables'],
): HostLaunchConfig {
  return {
    schemaVersion: 1,
    launchId: 'checkout-123',
    album: {
      id: 'album-1',
      title: 'Night Drive',
      artwork: {
        reference: { provider: 'cdbaby', assetKey: 'album-1-cover' },
        source: { type: 'url', url: albumArtworkUrl },
      },
    },
    tracks: [
      {
        id: 'track-1',
        title: 'Signal',
        artwork: {
          reference: { provider: 'cdbaby', assetKey: 'track-1-cover' },
          source: { type: 'url', url: 'https://cdn.example.test/releases/track-1.jpg' },
        },
      },
    ],
    deliverables,
  };
}

describe('CD Baby host launch configuration', () => {
  it('automatically selects Apple when the host requests the album deliverable', () => {
    const session = createHostEditorSession(createConfig([{ kind: 'apple-album' }]));

    expect(session.release.selections).toEqual({
      appleAlbum: true,
      spotifyTrackIds: [],
    });
    expect(session.draft.appleAlbum.destination).toBe('apple-music-cover-art-v1');
  });

  it('automatically selects the supplied Spotify track', () => {
    const session = createHostEditorSession(createConfig([
      { kind: 'spotify-track', trackId: 'track-1' },
    ]));

    expect(session.release.selections).toEqual({
      appleAlbum: false,
      spotifyTrackIds: ['track-1'],
    });
    expect(session.draft.spotifyTracks['track-1'].destination).toBe('spotify-canvas-v1');
  });

  it('supports a purchase containing both Apple and Spotify deliverables', () => {
    const session = createHostEditorSession(createConfig([
      { kind: 'apple-album' },
      { kind: 'spotify-track', trackId: 'track-1' },
    ]));

    expect(session.release.selections).toEqual({
      appleAlbum: true,
      spotifyTrackIds: ['track-1'],
    });
  });

  it('resolves a URL for preview without storing that temporary URL in the draft', () => {
    const session = createHostEditorSession(createConfig([{ kind: 'apple-album' }]));
    const source = session.resolveArtwork(session.release.album.artwork);

    expect(source).toEqual({ type: 'url', url: albumArtworkUrl });
    expect(JSON.stringify(session.draft)).not.toContain(albumArtworkUrl);
  });

  it('accepts an uploaded Blob through the same host configuration boundary', () => {
    const config = createConfig([{ kind: 'apple-album' }]);
    const upload = new Blob(['image bytes'], { type: 'image/jpeg' });
    config.album.artwork.source = { type: 'blob', blob: upload };

    const session = createHostEditorSession(config);

    expect(session.resolveArtwork(config.album.artwork.reference)).toEqual({
      type: 'blob',
      blob: upload,
    });
  });

  it('rejects a Spotify request for a track the host did not provide', () => {
    expect(() => createHostEditorSession(createConfig([
      { kind: 'spotify-track', trackId: 'missing-track' },
    ]))).toThrow('Unknown Spotify track');
  });
});
