import { describe, expect, it } from 'vitest';
import { createReleaseMotionDraft } from '../model/ReleaseMotionDraft';
import type { ReleaseOrder } from '../model/ReleaseOrder';
import {
  parseReleaseDraft,
  serializeReleaseDraft,
  type SavedReleaseDraft,
} from './ReleaseDraftCodec';

const release: ReleaseOrder = {
  schemaVersion: 1,
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: { provider: 'catalog', assetKey: 'album-art' },
  },
  tracks: [
    { id: 'track-1', title: 'Signal', artwork: { provider: 'catalog', assetKey: 'signal-art' } },
  ],
  selections: { appleAlbum: true, spotifyTrackIds: ['track-1'] },
};

const savedDraft: SavedReleaseDraft = {
  schemaVersion: 1,
  release,
  motion: createReleaseMotionDraft(release),
};

describe('release draft persistence', () => {
  it('round-trips a valid release through JSON', () => {
    expect(parseReleaseDraft(serializeReleaseDraft(savedDraft))).toEqual(savedDraft);
  });

  it('round-trips the water motion style', () => {
    const waterDraft = structuredClone(savedDraft);
    (waterDraft.motion.appleAlbum as { motionStyle: string }).motionStyle = 'water';

    expect(parseReleaseDraft(JSON.stringify(waterDraft))).toEqual(waterDraft);
  });

  it('migrates the previous draft field name into the current schema', () => {
    const legacyJson = JSON.stringify({
      schemaVersion: 0,
      release,
      draft: savedDraft.motion,
    });

    expect(parseReleaseDraft(legacyJson)).toEqual(savedDraft);
  });

  it('rejects selected tracks that are not part of the release', () => {
    const invalid = structuredClone(savedDraft);
    invalid.release.selections.spotifyTrackIds = ['missing-track'];

    expect(() => parseReleaseDraft(JSON.stringify(invalid))).toThrow('selected Spotify track');
  });

  it('rejects a release whose track motion project is missing', () => {
    const invalid = structuredClone(savedDraft);
    delete invalid.motion.spotifyTracks['track-1'];

    expect(() => parseReleaseDraft(JSON.stringify(invalid))).toThrow('motion project');
  });

  it('rejects unsupported future schemas instead of guessing', () => {
    expect(() => parseReleaseDraft(JSON.stringify({ schemaVersion: 99 }))).toThrow('Unsupported release draft schema');
  });

  it('reports malformed JSON at the storage boundary', () => {
    expect(() => parseReleaseDraft('{not-json')).toThrow('valid JSON');
  });
});
