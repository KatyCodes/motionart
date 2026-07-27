import type { AlbumMotionProject } from '../model/AlbumMotionProject';
import type { ArtworkReference } from '../model/ArtworkReference';
import { motionControlLimits } from '../model/MotionControls';
import type { ReleaseMotionDraft } from '../model/ReleaseMotionDraft';
import type { ReleaseOrder } from '../model/ReleaseOrder';

export interface SavedReleaseDraft {
  schemaVersion: 1;
  release: ReleaseOrder;
  motion: ReleaseMotionDraft;
}

interface LegacyReleaseDraftV0 {
  schemaVersion: 0;
  release: unknown;
  draft: unknown;
}

export function serializeReleaseDraft(savedDraft: SavedReleaseDraft): string {
  validateSavedReleaseDraft(savedDraft);
  return JSON.stringify(savedDraft);
}

export function parseReleaseDraft(json: string): SavedReleaseDraft {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyntaxError('Saved release draft must be valid JSON.');
  }

  const migrated = migrateReleaseDraft(parsed);
  validateSavedReleaseDraft(migrated);
  return migrated;
}

export function migrateReleaseDraft(value: unknown): unknown {
  const record = requireRecord(value, 'Saved release draft');
  const schemaVersion = record.schemaVersion;

  if (schemaVersion === 1) return value;

  if (schemaVersion === 0) {
    const legacy = record as unknown as LegacyReleaseDraftV0;
    return {
      schemaVersion: 1,
      release: legacy.release,
      motion: legacy.draft,
    };
  }

  throw new RangeError(`Unsupported release draft schema: ${String(schemaVersion)}.`);
}

export function validateSavedReleaseDraft(value: unknown): asserts value is SavedReleaseDraft {
  const record = requireRecord(value, 'Saved release draft');

  if (record.schemaVersion !== 1) {
    throw new RangeError('Saved release draft must use schema version 1.');
  }

  validateRelease(record.release);
  validateMotionDraft(record.motion, record.release);
}

function validateRelease(value: unknown): asserts value is ReleaseOrder {
  const release = requireRecord(value, 'Release');

  if (release.schemaVersion !== 1) throw new RangeError('Release must use schema version 1.');

  const album = requireRecord(release.album, 'Release album');
  requireNonEmptyString(album.id, 'Release album id');
  requireNonEmptyString(album.title, 'Release album title');
  validateArtwork(album.artwork, 'Release album artwork');

  if (!Array.isArray(release.tracks)) throw new TypeError('Release tracks must be an array.');

  const trackIds = new Set<string>();
  for (const valueOfTrack of release.tracks) {
    const track = requireRecord(valueOfTrack, 'Release track');
    const trackId = requireNonEmptyString(track.id, 'Release track id');
    requireNonEmptyString(track.title, `Release track ${trackId} title`);
    validateArtwork(track.artwork, `Release track ${trackId} artwork`);

    if (trackIds.has(trackId)) throw new RangeError(`Release contains duplicate track id: ${trackId}.`);
    trackIds.add(trackId);
  }

  const selections = requireRecord(release.selections, 'Release selections');
  if (typeof selections.appleAlbum !== 'boolean') {
    throw new TypeError('Apple album selection must be a boolean.');
  }
  if (!Array.isArray(selections.spotifyTrackIds)) {
    throw new TypeError('Spotify track selections must be an array.');
  }

  for (const selectedTrackId of selections.spotifyTrackIds) {
    if (typeof selectedTrackId !== 'string' || !trackIds.has(selectedTrackId)) {
      throw new RangeError(`Release contains an unknown selected Spotify track: ${String(selectedTrackId)}.`);
    }
  }
}

function validateMotionDraft(value: unknown, release: ReleaseOrder): asserts value is ReleaseMotionDraft {
  const motion = requireRecord(value, 'Release motion draft');

  if (motion.schemaVersion !== 1) throw new RangeError('Release motion draft must use schema version 1.');

  validateMotionProject(motion.appleAlbum, 'Apple album motion project');
  const appleProject = motion.appleAlbum as AlbumMotionProject;
  if (appleProject.destination !== 'apple-music-cover-art-v1') {
    throw new RangeError('Apple album motion project has the wrong destination.');
  }
  validateMatchingArtwork(appleProject.artwork, release.album.artwork, 'Apple album');

  const spotifyProjects = requireRecord(motion.spotifyTracks, 'Spotify motion projects');
  for (const track of release.tracks) {
    const project = spotifyProjects[track.id];
    if (!project) throw new RangeError(`Spotify track ${track.id} is missing its motion project.`);

    validateMotionProject(project, `Spotify track ${track.id} motion project`);
    const typedProject = project as AlbumMotionProject;
    if (typedProject.destination !== 'spotify-canvas-v1') {
      throw new RangeError(`Spotify track ${track.id} motion project has the wrong destination.`);
    }
    validateMatchingArtwork(typedProject.artwork, track.artwork, `Spotify track ${track.id}`);
  }
}

function validateMotionProject(value: unknown, label: string): asserts value is AlbumMotionProject {
  const project = requireRecord(value, label);

  if (project.schemaVersion !== 1) throw new RangeError(`${label} must use schema version 1.`);
  validateArtwork(project.artwork, `${label} artwork`);
  requireNonEmptyString(project.destination, `${label} destination`);
  if (project.motionStyle !== 'drift') throw new RangeError(`${label} has an unsupported motion style.`);
  if (project.loopBehavior !== 'loop') throw new RangeError(`${label} has an unsupported loop behavior.`);

  requireNumberInRange(
    project.speed,
    motionControlLimits.speed.minimum,
    motionControlLimits.speed.maximum,
    `${label} speed`,
  );
  requireNumberInRange(
    project.intensity,
    motionControlLimits.intensity.minimum,
    motionControlLimits.intensity.maximum,
    `${label} intensity`,
  );
}

function validateArtwork(value: unknown, label: string): asserts value is ArtworkReference {
  const artwork = requireRecord(value, label);
  requireNonEmptyString(artwork.provider, `${label} provider`);
  requireNonEmptyString(artwork.assetKey, `${label} asset key`);

  if (artwork.version !== undefined && typeof artwork.version !== 'string') {
    throw new TypeError(`${label} version must be a string.`);
  }
}

function validateMatchingArtwork(
  projectArtwork: ArtworkReference,
  releaseArtwork: ArtworkReference,
  label: string,
): void {
  if (
    projectArtwork.provider !== releaseArtwork.provider
    || projectArtwork.assetKey !== releaseArtwork.assetKey
    || projectArtwork.version !== releaseArtwork.version
  ) {
    throw new RangeError(`${label} motion project references different artwork than the release.`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function requireNumberInRange(value: unknown, minimum: number, maximum: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
}
