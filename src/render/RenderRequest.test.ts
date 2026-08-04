import { describe, expect, it } from 'vitest';
import { destinationProfiles, type DestinationProfile } from '../model/DestinationProfile';
import {
  createReleaseMotionDraft,
  updateDeliverableProject,
} from '../model/ReleaseMotionDraft';
import type { ReleaseOrder } from '../model/ReleaseOrder';
import { createRenderRequest, validateRenderRequest } from './RenderRequest';

const release: ReleaseOrder = {
  schemaVersion: 1,
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
  },
  tracks: [
    {
      id: 'track-1',
      title: 'Signal',
      artwork: { provider: 'cdbaby', assetKey: 'signal-cover' },
    },
  ],
  selections: { appleAlbum: true, spotifyTrackIds: ['track-1'] },
};

describe('render requests', () => {
  it('creates one self-contained render item for each selected deliverable', () => {
    const initialDraft = createReleaseMotionDraft(release);
    const draft = updateDeliverableProject(initialDraft, { kind: 'apple-album' }, {
      ...initialDraft.appleAlbum,
      motionStyle: 'water',
      speed: 1.25,
      intensity: 0.8,
    });

    const request = createRenderRequest({
      launchId: 'checkout-123',
      release,
      draft,
      destinationProfiles,
    });

    expect(request).toMatchObject({
      schemaVersion: 1,
      launchId: 'checkout-123',
      deliverables: [
        {
          id: 'apple-album',
          target: { kind: 'apple-album', albumId: 'album-1' },
          title: 'Night Drive',
          artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
          motion: { style: 'water', speed: 1.25, intensity: 0.8, loopBehavior: 'loop' },
          destination: { profileId: 'apple-music-cover-art-v1', name: 'Apple Music cover art' },
          output: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
        },
        {
          id: 'spotify-track:track-1',
          target: { kind: 'spotify-track', trackId: 'track-1' },
          title: 'Signal',
          artwork: { provider: 'cdbaby', assetKey: 'signal-cover' },
          destination: { profileId: 'spotify-canvas-v1', name: 'Spotify Canvas' },
          output: { width: 540, height: 960, durationSeconds: 8, format: 'mp4' },
        },
      ],
    });
  });

  it('uses the host profile render defaults without hard-coding a platform', () => {
    const customProfile: DestinationProfile = {
      id: 'client-video-v1',
      name: 'Client portrait video',
      aspectRatio: { width: 4, height: 5 },
      pixelRequirements: { minWidth: 1200, minHeight: 1500 },
      durationSeconds: { min: 4, max: 10 },
      acceptedFormats: ['mp4'],
      renderDefaults: { width: 1200, height: 1500, durationSeconds: 6, format: 'mp4' },
    };
    const initialDraft = createReleaseMotionDraft({
      ...release,
      selections: { appleAlbum: true, spotifyTrackIds: [] },
    });
    const draft = updateDeliverableProject(initialDraft, { kind: 'apple-album' }, {
      ...initialDraft.appleAlbum,
      destination: customProfile.id,
    });

    const request = createRenderRequest({
      launchId: 'custom-456',
      release: { ...release, selections: { appleAlbum: true, spotifyTrackIds: [] } },
      draft,
      destinationProfiles: [customProfile],
    });

    expect(request.deliverables[0].destination.profileId).toBe('client-video-v1');
    expect(request.deliverables[0].output).toEqual(customProfile.renderDefaults);
  });

  it('rejects an invalid request before checkout', () => {
    const request = createRenderRequest({
      launchId: 'checkout-123',
      release,
      draft: createReleaseMotionDraft(release),
      destinationProfiles,
    });
    const invalidRequest = {
      ...request,
      deliverables: [request.deliverables[0], request.deliverables[0]],
    };

    expect(() => validateRenderRequest(invalidRequest)).toThrow('Duplicate render deliverable');
  });

  it('contains durable artwork references but no preview URLs', () => {
    const request = createRenderRequest({
      launchId: 'checkout-123',
      release,
      draft: createReleaseMotionDraft(release),
      destinationProfiles,
    });
    const serialized = JSON.stringify(request);

    expect(serialized).toContain('album-cover');
    expect(serialized).not.toContain('http');
  });
});
