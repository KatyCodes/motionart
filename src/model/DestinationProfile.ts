export interface AspectRatio {
  width: number;
  height: number;
}

export interface DestinationProfile {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  pixelRequirements: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
  durationSeconds?: { min: number; max: number };
  acceptedFormats: readonly string[];
}

export type DestinationProfileId = 'spotify-canvas-v1' | 'apple-music-cover-art-v1' | 'square-campaign-v1';

export const destinationProfiles: readonly DestinationProfile[] = [
  {
    id: 'spotify-canvas-v1',
    name: 'Spotify Canvas',
    aspectRatio: { width: 9, height: 16 },
    pixelRequirements: { minHeight: 720, maxHeight: 1080 },
    durationSeconds: { min: 3, max: 8 },
    acceptedFormats: ['mp4', 'jpg'],
  },
  {
    id: 'apple-music-cover-art-v1',
    name: 'Apple Music cover art',
    aspectRatio: { width: 1, height: 1 },
    pixelRequirements: { minWidth: 4000, minHeight: 4000 },
    acceptedFormats: ['jpg', 'png', 'gif'],
  },
  {
    id: 'square-campaign-v1',
    name: 'Square campaign',
    aspectRatio: { width: 1, height: 1 },
    pixelRequirements: { minWidth: 1080, minHeight: 1080 },
    acceptedFormats: ['jpg', 'png', 'mp4'],
  },
];

export function getDestinationProfile(id: string): DestinationProfile {
  const profile = destinationProfiles.find((candidate) => candidate.id === id);

  if (!profile) {
    throw new Error(`Unknown destination profile: ${id}`);
  }

  return profile;
}

export function validateDestinationProfile(profile: DestinationProfile): void {
  const values = [
    profile.aspectRatio.width,
    profile.aspectRatio.height,
    ...Object.values(profile.pixelRequirements),
    ...(profile.durationSeconds ? Object.values(profile.durationSeconds) : []),
  ];

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Destination profile dimensions must be positive finite numbers.');
  }

  if (profile.durationSeconds && profile.durationSeconds.min > profile.durationSeconds.max) {
    throw new RangeError('Destination profile minimum duration cannot exceed its maximum duration.');
  }

  if (profile.acceptedFormats.length === 0) {
    throw new RangeError('Destination profiles must accept at least one file format.');
  }
}
