import type { AlbumMotionProject } from './AlbumMotionProject';
import type { ArtworkReference } from './ArtworkReference';
import {
  defaultReleaseDestinationProfileIds,
  type DestinationProfileId,
  type ReleaseDestinationProfileIds,
} from './DestinationProfile';
import type { ReleaseOrder } from './ReleaseOrder';

export interface ReleaseMotionDraft {
  schemaVersion: 1;
  appleAlbum: AlbumMotionProject;
  spotifyTracks: Record<string, AlbumMotionProject>;
}

export type DeliverableTarget =
  | { kind: 'apple-album' }
  | { kind: 'spotify-track'; trackId: string };

export function createReleaseMotionDraft(
  release: ReleaseOrder,
  destinationProfileIds: ReleaseDestinationProfileIds = defaultReleaseDestinationProfileIds,
): ReleaseMotionDraft {
  return {
    schemaVersion: 1,
    appleAlbum: createMotionProject(release.album.artwork, destinationProfileIds.appleAlbum),
    spotifyTracks: Object.fromEntries(
      release.tracks.map((track) => [
        track.id,
        createMotionProject(track.artwork, destinationProfileIds.spotifyTrack),
      ]),
    ),
  };
}

export function getSelectedDeliverables(release: ReleaseOrder): DeliverableTarget[] {
  const appleTarget: DeliverableTarget[] = release.selections.appleAlbum
    ? [{ kind: 'apple-album' }]
    : [];
  const spotifyTargets: DeliverableTarget[] = release.selections.spotifyTrackIds.map((trackId) => ({
    kind: 'spotify-track',
    trackId,
  }));

  return [...appleTarget, ...spotifyTargets];
}

export function getDeliverableProject(
  draft: ReleaseMotionDraft,
  target: DeliverableTarget,
): AlbumMotionProject {
  if (target.kind === 'apple-album') return draft.appleAlbum;

  const project = draft.spotifyTracks[target.trackId];

  if (!project) {
    throw new Error(`Unknown Spotify motion project: ${target.trackId}`);
  }

  return project;
}

export function updateDeliverableProject(
  draft: ReleaseMotionDraft,
  target: DeliverableTarget,
  project: AlbumMotionProject,
): ReleaseMotionDraft {
  if (target.kind === 'apple-album') {
    return { ...draft, appleAlbum: project };
  }

  if (!draft.spotifyTracks[target.trackId]) {
    throw new Error(`Unknown Spotify motion project: ${target.trackId}`);
  }

  return {
    ...draft,
    spotifyTracks: { ...draft.spotifyTracks, [target.trackId]: project },
  };
}

export function getDeliverableKey(target: DeliverableTarget): string {
  return target.kind === 'apple-album' ? 'apple-album' : `spotify-track:${target.trackId}`;
}

function createMotionProject(
  artwork: ArtworkReference,
  destination: DestinationProfileId,
): AlbumMotionProject {
  return {
    schemaVersion: 1,
    artwork,
    destination,
    motionStyle: 'drift',
    speed: 1,
    intensity: 1,
    loopBehavior: 'loop',
  };
}
