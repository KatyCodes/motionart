import type { ArtworkReference } from './ArtworkReference';

export interface ReleaseOrder {
  schemaVersion: 1;
  album: {
    id: string;
    title: string;
    artwork: ArtworkReference;
  };
  tracks: ReleaseTrack[];
  selections: ReleaseSelections;
}

export interface ReleaseTrack {
  id: string;
  title: string;
  artwork: ArtworkReference;
}

export interface ReleaseSelections {
  appleAlbum: boolean;
  spotifyTrackIds: string[];
}

export type PurchaseItem =
  | { kind: 'apple-album'; albumId: string; profileId: 'apple-music-cover-art-v1' }
  | { kind: 'spotify-track'; trackId: string; profileId: 'spotify-canvas-v1' };

export function selectAppleAlbum(order: ReleaseOrder, selected: boolean): ReleaseOrder {
  return {
    ...order,
    selections: { ...order.selections, appleAlbum: selected },
  };
}

export function selectSpotifyTrack(order: ReleaseOrder, trackId: string, selected: boolean): ReleaseOrder {
  if (!order.tracks.some((track) => track.id === trackId)) {
    throw new Error(`Unknown track: ${trackId}`);
  }

  const selectedTrackIds = new Set(order.selections.spotifyTrackIds);

  if (selected) {
    selectedTrackIds.add(trackId);
  } else {
    selectedTrackIds.delete(trackId);
  }

  return {
    ...order,
    selections: { ...order.selections, spotifyTrackIds: [...selectedTrackIds] },
  };
}

export function getPurchaseItems(order: ReleaseOrder): PurchaseItem[] {
  const appleItem: PurchaseItem[] = order.selections.appleAlbum
    ? [{ kind: 'apple-album', albumId: order.album.id, profileId: 'apple-music-cover-art-v1' }]
    : [];
  const spotifyItems: PurchaseItem[] = order.selections.spotifyTrackIds.map((trackId) => ({
    kind: 'spotify-track',
    trackId,
    profileId: 'spotify-canvas-v1',
  }));

  return [...appleItem, ...spotifyItems];
}
