import { describe, expect, it } from 'vitest';
import { createHostEditorSession, type HostLaunchConfig } from './HostLaunchConfig';
import type { DestinationProfile } from '../model/DestinationProfile';
import { parseReleaseDraft, serializeReleaseDraft } from '../persistence/ReleaseDraftCodec';
import { createRenderRequest } from '../render/RenderRequest';

const customerProfiles: readonly DestinationProfile[] = [
  {
    id: 'customer-apple-v2',
    name: 'Customer Apple square',
    aspectRatio: { width: 4, height: 4 },
    pixelRequirements: { minWidth: 2400, minHeight: 2400 },
    acceptedFormats: ['mp4'],
    renderDefaults: { width: 2400, height: 2400, durationSeconds: 7, format: 'mp4' },
  },
  {
    id: 'customer-spotify-v2',
    name: 'Customer Spotify portrait',
    aspectRatio: { width: 9, height: 16 },
    pixelRequirements: { minWidth: 720, minHeight: 1280 },
    durationSeconds: { min: 3, max: 8 },
    acceptedFormats: ['mp4'],
    renderDefaults: { width: 720, height: 1280, durationSeconds: 6, format: 'mp4' },
  },
];

const config: HostLaunchConfig = {
  schemaVersion: 2,
  launchId: 'custom-profile-checkout',
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: {
      reference: { provider: 'customer', assetKey: 'album-cover' },
      source: { type: 'url', url: 'https://cdn.example.test/album.jpg' },
    },
  },
  tracks: [
    {
      id: 'track-1',
      title: 'Signal',
      artwork: {
        reference: { provider: 'customer', assetKey: 'track-cover' },
        source: { type: 'url', url: 'https://cdn.example.test/track.jpg' },
      },
    },
  ],
  deliverables: [
    { kind: 'apple-album' },
    { kind: 'spotify-track', trackId: 'track-1' },
  ],
  destinationProfileIds: {
    appleAlbum: 'customer-apple-v2',
    spotifyTrack: 'customer-spotify-v2',
  },
};

describe('configurable destination flow', () => {
  it('keeps the host profile IDs through launch, persistence, and rendering', () => {
    const session = createHostEditorSession(config);

    expect(session.draft.appleAlbum.destination).toBe('customer-apple-v2');
    expect(session.draft.spotifyTracks['track-1'].destination).toBe('customer-spotify-v2');

    const saved = parseReleaseDraft(serializeReleaseDraft({
      schemaVersion: 1,
      release: session.release,
      motion: session.draft,
    }));
    const request = createRenderRequest({
      launchId: session.launchId,
      release: saved.release,
      draft: saved.motion,
      destinationProfiles: customerProfiles,
    });

    expect(request.deliverables.map((item) => item.destination.profileId)).toEqual([
      'customer-apple-v2',
      'customer-spotify-v2',
    ]);
  });
});
