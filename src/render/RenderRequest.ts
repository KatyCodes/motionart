import type { ArtworkReference } from '../model/ArtworkReference';
import type { MotionStyleId, LoopBehavior } from '../model/AlbumMotionProject';
import {
  resolveDestinationProfile,
  type AspectRatio,
  type DestinationProfile,
  type RenderOutputDefaults,
} from '../model/DestinationProfile';
import {
  getDeliverableKey,
  getDeliverableProject,
  getSelectedDeliverables,
  type DeliverableTarget,
  type ReleaseMotionDraft,
} from '../model/ReleaseMotionDraft';
import type { ReleaseOrder } from '../model/ReleaseOrder';

export interface RenderRequest {
  schemaVersion: 1;
  launchId: string;
  deliverables: RenderDeliverable[];
}

export type RenderTarget =
  | { kind: 'apple-album'; albumId: string }
  | { kind: 'spotify-track'; trackId: string };

export interface RenderDeliverable {
  id: string;
  target: RenderTarget;
  title: string;
  artwork: ArtworkReference;
  motion: {
    style: MotionStyleId;
    speed: number;
    intensity: number;
    loopBehavior: LoopBehavior;
  };
  destination: {
    profileId: string;
    name: string;
    aspectRatio: AspectRatio;
  };
  output: RenderOutputDefaults;
}

export interface CreateRenderRequestInput {
  launchId: string;
  release: ReleaseOrder;
  draft: ReleaseMotionDraft;
  destinationProfiles: readonly DestinationProfile[];
}

export function createRenderRequest({
  launchId,
  release,
  draft,
  destinationProfiles,
}: CreateRenderRequestInput): RenderRequest {
  const request: RenderRequest = {
    schemaVersion: 1,
    launchId,
    deliverables: getSelectedDeliverables(release).map((target) => {
      const project = getDeliverableProject(draft, target);
      const profile = resolveDestinationProfile(destinationProfiles, project.destination);

      return {
        id: getDeliverableKey(target),
        target: createRenderTarget(release, target),
        title: getDeliverableTitle(release, target),
        artwork: { ...project.artwork },
        motion: {
          style: project.motionStyle,
          speed: project.speed,
          intensity: project.intensity,
          loopBehavior: project.loopBehavior,
        },
        destination: {
          profileId: profile.id,
          name: profile.name,
          aspectRatio: { ...profile.aspectRatio },
        },
        output: { ...profile.renderDefaults },
      };
    }),
  };

  validateRenderRequest(request);
  return request;
}

export function validateRenderRequest(request: RenderRequest): void {
  if (request.schemaVersion !== 1) {
    throw new RangeError('Unsupported render request schema version.');
  }

  requireText(request.launchId, 'launch ID');

  if (request.deliverables.length === 0) {
    throw new RangeError('A render request requires at least one deliverable.');
  }

  const deliverableIds = new Set<string>();

  for (const deliverable of request.deliverables) {
    if (deliverableIds.has(deliverable.id)) {
      throw new RangeError(`Duplicate render deliverable: ${deliverable.id}`);
    }

    deliverableIds.add(deliverable.id);
    requireText(deliverable.id, 'deliverable ID');
    requireText(deliverable.title, 'deliverable title');
    requireText(deliverable.artwork.provider, 'artwork provider');
    requireText(deliverable.artwork.assetKey, 'artwork asset key');
    requireText(deliverable.destination.profileId, 'destination profile ID');
    requireText(deliverable.destination.name, 'destination name');
    requireText(deliverable.output.format, 'output format');
    requirePositiveNumber(deliverable.destination.aspectRatio.width, 'aspect-ratio width');
    requirePositiveNumber(deliverable.destination.aspectRatio.height, 'aspect-ratio height');
    requirePositiveNumber(deliverable.output.width, 'output width');
    requirePositiveNumber(deliverable.output.height, 'output height');
    requirePositiveNumber(deliverable.output.durationSeconds, 'output duration');
    requirePositiveNumber(deliverable.motion.speed, 'motion speed');

    if (!Number.isFinite(deliverable.motion.intensity) || deliverable.motion.intensity < 0) {
      throw new RangeError('Render request motion intensity must be a non-negative finite number.');
    }

    if (deliverable.id !== getRenderTargetId(deliverable.target)) {
      throw new RangeError(`Render deliverable ID does not match its target: ${deliverable.id}`);
    }
  }
}

function createRenderTarget(release: ReleaseOrder, target: DeliverableTarget): RenderTarget {
  return target.kind === 'apple-album'
    ? { kind: 'apple-album', albumId: release.album.id }
    : { kind: 'spotify-track', trackId: target.trackId };
}

function getDeliverableTitle(release: ReleaseOrder, target: DeliverableTarget): string {
  if (target.kind === 'apple-album') return release.album.title;

  const track = release.tracks.find((candidate) => candidate.id === target.trackId);

  if (!track) throw new Error(`Unknown render track: ${target.trackId}`);
  return track.title;
}

function getRenderTargetId(target: RenderTarget): string {
  return target.kind === 'apple-album' ? 'apple-album' : `spotify-track:${target.trackId}`;
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new RangeError(`Render request requires a ${label}.`);
}

function requirePositiveNumber(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Render request ${label} must be a positive finite number.`);
  }
}
