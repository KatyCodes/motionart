import type { ArtworkReference } from '../model/ArtworkReference';
import {
  defaultReleaseDestinationProfileIds,
  type ReleaseDestinationProfileIds,
} from '../model/DestinationProfile';
import {
  createReleaseMotionDraft,
  type DeliverableTarget,
  type ReleaseMotionDraft,
} from '../model/ReleaseMotionDraft';
import type { ReleaseOrder } from '../model/ReleaseOrder';
import type { ArtworkSource } from '../preview/ArtworkSource';

/**
 * Runtime artwork configuration supplied by the embedding host.
 *
 * `reference` is safe to persist in a draft. `source` is only used to load the
 * current preview and may contain a temporary URL, File/Blob, or loader.
 */
export interface HostArtworkConfig {
  reference: ArtworkReference;
  source: ArtworkSource;
}

export interface HostAlbumConfig {
  id: string;
  title: string;
  artwork: HostArtworkConfig;
}

export interface HostTrackConfig {
  id: string;
  title: string;
  artwork: HostArtworkConfig;
}

interface HostLaunchConfigBase {
  launchId: string;
  album: HostAlbumConfig;
  tracks: HostTrackConfig[];
  deliverables: DeliverableTarget[];
}

/** Kept so an existing integration continues to receive the built-in defaults. */
export interface HostLaunchConfigV1 extends HostLaunchConfigBase {
  schemaVersion: 1;
}

export interface HostLaunchConfigV2 extends HostLaunchConfigBase {
  schemaVersion: 2;
  destinationProfileIds: ReleaseDestinationProfileIds;
}

export type HostLaunchConfig = HostLaunchConfigV1 | HostLaunchConfigV2;

export interface HostEditorSession {
  launchId: string;
  release: ReleaseOrder;
  draft: ReleaseMotionDraft;
  resolveArtwork: (reference: ArtworkReference) => ArtworkSource;
}

/** Converts a customer launch payload into the editor's controlled state. */
export function createHostEditorSession(config: HostLaunchConfig): HostEditorSession {
  validateLaunchConfig(config);
  const destinationProfileIds = config.schemaVersion === 2
    ? config.destinationProfileIds
    : defaultReleaseDestinationProfileIds;

  const spotifyTrackIds = config.deliverables
    .filter((target): target is Extract<DeliverableTarget, { kind: 'spotify-track' }> => (
      target.kind === 'spotify-track'
    ))
    .map((target) => target.trackId);
  const release: ReleaseOrder = {
    schemaVersion: 1,
    album: {
      id: config.album.id,
      title: config.album.title,
      artwork: config.album.artwork.reference,
    },
    tracks: config.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artwork: track.artwork.reference,
    })),
    selections: {
      appleAlbum: config.deliverables.some((target) => target.kind === 'apple-album'),
      spotifyTrackIds,
    },
  };
  const artworkSources = createArtworkSourceMap(config);

  return {
    launchId: config.launchId,
    release,
    draft: createReleaseMotionDraft(release, destinationProfileIds),
    resolveArtwork(reference) {
      const source = artworkSources.get(getArtworkReferenceKey(reference));

      if (!source) {
        throw new Error(
          `The host did not supply preview artwork for ${reference.provider}:${reference.assetKey}.`,
        );
      }

      return source;
    },
  };
}

function validateLaunchConfig(config: HostLaunchConfig): void {
  if (config.schemaVersion !== 1 && config.schemaVersion !== 2) {
    throw new RangeError('Unsupported host launch schema version.');
  }

  requireText(config.launchId, 'launch ID');
  validateCatalogItem(config.album, 'album');

  if (config.schemaVersion === 2) {
    requireText(config.destinationProfileIds.appleAlbum, 'Apple destination profile ID');
    requireText(config.destinationProfileIds.spotifyTrack, 'Spotify destination profile ID');
  }

  if (config.deliverables.length === 0) {
    throw new RangeError('The host launch must request at least one deliverable.');
  }

  const trackIds = new Set<string>();

  for (const track of config.tracks) {
    validateCatalogItem(track, 'track');

    if (trackIds.has(track.id)) {
      throw new RangeError(`Duplicate track ID: ${track.id}`);
    }

    trackIds.add(track.id);
  }

  const deliverableKeys = new Set<string>();

  for (const deliverable of config.deliverables) {
    const key = deliverable.kind === 'apple-album'
      ? 'apple-album'
      : `spotify-track:${deliverable.trackId}`;

    if (deliverableKeys.has(key)) {
      throw new RangeError(`Duplicate deliverable: ${key}`);
    }

    deliverableKeys.add(key);

    if (deliverable.kind === 'spotify-track' && !trackIds.has(deliverable.trackId)) {
      throw new RangeError(`Unknown Spotify track: ${deliverable.trackId}`);
    }
  }
}

function validateCatalogItem(
  item: { id: string; title: string; artwork: HostArtworkConfig },
  label: string,
): void {
  requireText(item.id, `${label} ID`);
  requireText(item.title, `${label} title`);
  requireText(item.artwork.reference.provider, `${label} artwork provider`);
  requireText(item.artwork.reference.assetKey, `${label} artwork asset key`);

  if (item.artwork.source.type === 'url') {
    requireText(item.artwork.source.url, `${label} artwork URL`);
  }
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new RangeError(`Host launch requires a ${label}.`);
}

function createArtworkSourceMap(config: HostLaunchConfig): Map<string, ArtworkSource> {
  const sources = new Map<string, ArtworkSource>();

  registerArtworkSource(sources, config.album.artwork);

  for (const track of config.tracks) {
    registerArtworkSource(sources, track.artwork);
  }

  return sources;
}

function registerArtworkSource(
  sources: Map<string, ArtworkSource>,
  artwork: HostArtworkConfig,
): void {
  const key = getArtworkReferenceKey(artwork.reference);
  const existing = sources.get(key);

  if (existing && existing !== artwork.source) {
    throw new RangeError(
      `Multiple preview sources were supplied for ${artwork.reference.provider}:${artwork.reference.assetKey}.`,
    );
  }

  sources.set(key, artwork.source);
}

function getArtworkReferenceKey(reference: ArtworkReference): string {
  return [reference.provider, reference.assetKey, reference.version ?? ''].join('\u0000');
}
