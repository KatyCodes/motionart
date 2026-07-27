export interface AspectRatio {
  width: number;
  height: number;
}

export interface DestinationProfile {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  output: {
    width: number;
    height: number;
  };
}

export type DestinationProfileId = 'spotify-canvas-v1' | 'square-campaign-v1';

export const destinationProfiles: readonly DestinationProfile[] = [
  {
    id: 'spotify-canvas-v1',
    name: 'Spotify Canvas',
    aspectRatio: { width: 9, height: 16 },
    output: { width: 1080, height: 1920 },
  },
  {
    id: 'square-campaign-v1',
    name: 'Square campaign',
    aspectRatio: { width: 1, height: 1 },
    output: { width: 1080, height: 1080 },
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
    profile.output.width,
    profile.output.height,
  ];

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Destination profile dimensions must be positive finite numbers.');
  }
}
