export interface AspectRatio {
  width: number;
  height: number;
}

export interface RenderOutputDefaults {
  width: number;
  height: number;
  durationSeconds: number;
  format: string;
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
  renderDefaults: RenderOutputDefaults;
}

export type BuiltInDestinationProfileId =
  | 'spotify-canvas-v1'
  | 'apple-music-cover-art-v1'
  | 'square-campaign-v1';

/** Host applications may add their own stable, versioned profile IDs. */
export type DestinationProfileId = string;

export const destinationProfiles: readonly DestinationProfile[] = [
  {
    id: 'spotify-canvas-v1',
    name: 'Spotify Canvas',
    aspectRatio: { width: 9, height: 16 },
    pixelRequirements: { minHeight: 720, maxHeight: 1080 },
    durationSeconds: { min: 3, max: 8 },
    acceptedFormats: ['mp4', 'jpg'],
    renderDefaults: { width: 540, height: 960, durationSeconds: 8, format: 'mp4' },
  },
  {
    id: 'apple-music-cover-art-v1',
    name: 'Apple Music cover art',
    aspectRatio: { width: 1, height: 1 },
    pixelRequirements: { minWidth: 4000, minHeight: 4000 },
    acceptedFormats: ['jpg', 'png', 'gif'],
    renderDefaults: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
  },
  {
    id: 'square-campaign-v1',
    name: 'Square campaign',
    aspectRatio: { width: 1, height: 1 },
    pixelRequirements: { minWidth: 1080, minHeight: 1080 },
    acceptedFormats: ['jpg', 'png', 'mp4'],
    renderDefaults: { width: 1080, height: 1080, durationSeconds: 6, format: 'mp4' },
  },
];

export function getDestinationProfile(id: string): DestinationProfile {
  return resolveDestinationProfile(destinationProfiles, id);
}

export function resolveDestinationProfile(
  profiles: readonly DestinationProfile[],
  id: string,
): DestinationProfile {
  const profile = profiles.find((candidate) => candidate.id === id);

  if (!profile) {
    throw new Error(`Unknown destination profile: ${id}`);
  }

  validateDestinationProfile(profile);
  return profile;
}

export function validateDestinationProfile(profile: DestinationProfile): void {
  const values = [
    profile.aspectRatio.width,
    profile.aspectRatio.height,
    ...Object.values(profile.pixelRequirements),
    ...(profile.durationSeconds ? Object.values(profile.durationSeconds) : []),
    profile.renderDefaults.width,
    profile.renderDefaults.height,
    profile.renderDefaults.durationSeconds,
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

  if (!profile.acceptedFormats.includes(profile.renderDefaults.format)) {
    throw new RangeError('Destination profile render format must be accepted by the profile.');
  }

  const actualRatio = profile.renderDefaults.width / profile.renderDefaults.height;
  const expectedRatio = profile.aspectRatio.width / profile.aspectRatio.height;

  if (Math.abs(actualRatio - expectedRatio) > 0.001) {
    throw new RangeError('Destination profile render dimensions must match its aspect ratio.');
  }

  validateRenderDimension(
    profile.renderDefaults.width,
    profile.pixelRequirements.minWidth,
    profile.pixelRequirements.maxWidth,
    'width',
  );
  validateRenderDimension(
    profile.renderDefaults.height,
    profile.pixelRequirements.minHeight,
    profile.pixelRequirements.maxHeight,
    'height',
  );

  if (
    profile.durationSeconds
    && (
      profile.renderDefaults.durationSeconds < profile.durationSeconds.min
      || profile.renderDefaults.durationSeconds > profile.durationSeconds.max
    )
  ) {
    throw new RangeError('Destination profile render duration must meet its duration requirements.');
  }
}

function validateRenderDimension(
  value: number,
  minimum: number | undefined,
  maximum: number | undefined,
  label: string,
): void {
  if ((minimum && value < minimum) || (maximum && value > maximum)) {
    throw new RangeError(`Destination profile render ${label} must meet its pixel requirements.`);
  }
}
