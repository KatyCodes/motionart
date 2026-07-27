import { describe, expect, it } from 'vitest';
import {
  getPurchaseItems,
  selectAppleAlbum,
  selectSpotifyTrack,
  type ReleaseOrder,
} from './ReleaseOrder';

const release: ReleaseOrder = {
  schemaVersion: 1,
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: { provider: 'customer-catalog', assetKey: 'album-cover-1' },
  },
  tracks: [
    { id: 'track-1', title: 'Signal', artwork: { provider: 'customer-catalog', assetKey: 'track-1' } },
    { id: 'track-2', title: 'Afterglow', artwork: { provider: 'customer-catalog', assetKey: 'track-2' } },
  ],
  selections: { appleAlbum: false, spotifyTrackIds: [] },
};

describe('release purchase selections', () => {
  it('creates one Apple item for the album, not one item for every track', () => {
    const selected = selectAppleAlbum(release, true);

    expect(getPurchaseItems(selected)).toEqual([
      { kind: 'apple-album', albumId: 'album-1', profileId: 'apple-music-cover-art-v1' },
    ]);
  });

  it('creates one Spotify item for each selected track', () => {
    const withFirstTrack = selectSpotifyTrack(release, 'track-1', true);
    const selected = selectSpotifyTrack(withFirstTrack, 'track-2', true);

    expect(getPurchaseItems(selected)).toEqual([
      { kind: 'spotify-track', trackId: 'track-1', profileId: 'spotify-canvas-v1' },
      { kind: 'spotify-track', trackId: 'track-2', profileId: 'spotify-canvas-v1' },
    ]);
  });

  it('allows Apple and selected Spotify tracks in the same purchase', () => {
    const withApple = selectAppleAlbum(release, true);
    const selected = selectSpotifyTrack(withApple, 'track-2', true);

    expect(getPurchaseItems(selected)).toHaveLength(2);
  });

  it('refuses a Spotify selection for a track outside this release', () => {
    expect(() => selectSpotifyTrack(release, 'not-on-this-release', true)).toThrow('Unknown track');
  });
});
