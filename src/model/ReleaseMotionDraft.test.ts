import { describe, expect, it } from 'vitest';
import {
  createReleaseMotionDraft,
  getSelectedDeliverables,
  updateDeliverableProject,
  type DeliverableTarget,
} from './ReleaseMotionDraft';
import type { ReleaseOrder } from './ReleaseOrder';

const release: ReleaseOrder = {
  schemaVersion: 1,
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: { provider: 'catalog', assetKey: 'album-art' },
  },
  tracks: [
    { id: 'track-1', title: 'Signal', artwork: { provider: 'catalog', assetKey: 'signal-art' } },
    { id: 'track-2', title: 'Afterglow', artwork: { provider: 'catalog', assetKey: 'afterglow-art' } },
  ],
  selections: { appleAlbum: true, spotifyTrackIds: ['track-1', 'track-2'] },
};

describe('release motion drafts', () => {
  it('creates one Apple project and a separate project for every Spotify track', () => {
    const draft = createReleaseMotionDraft(release);

    expect(draft.appleAlbum.destination).toBe('apple-music-cover-art-v1');
    expect(draft.appleAlbum.artwork.assetKey).toBe('album-art');
    expect(draft.spotifyTracks['track-1'].destination).toBe('spotify-canvas-v1');
    expect(draft.spotifyTracks['track-1'].artwork.assetKey).toBe('signal-art');
    expect(draft.spotifyTracks['track-2'].artwork.assetKey).toBe('afterglow-art');
  });

  it('updates one track without changing Apple or another track', () => {
    const draft = createReleaseMotionDraft(release);
    const target: DeliverableTarget = { kind: 'spotify-track', trackId: 'track-1' };
    const updated = updateDeliverableProject(draft, target, {
      ...draft.spotifyTracks['track-1'],
      speed: 1.75,
    });

    expect(updated.spotifyTracks['track-1'].speed).toBe(1.75);
    expect(updated.spotifyTracks['track-2'].speed).toBe(1);
    expect(updated.appleAlbum.speed).toBe(1);
  });

  it('returns only deliverables selected for this purchase', () => {
    expect(getSelectedDeliverables(release)).toEqual([
      { kind: 'apple-album' },
      { kind: 'spotify-track', trackId: 'track-1' },
      { kind: 'spotify-track', trackId: 'track-2' },
    ]);
  });

  it('is serializable for storage in the host database', () => {
    const draft = createReleaseMotionDraft(release);

    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft);
  });
});
