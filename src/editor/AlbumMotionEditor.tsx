import type { CSSProperties } from 'react';
import type { AlbumMotionProject } from '../model/AlbumMotionProject';
import {
  resolveDestinationProfile,
  type DestinationProfile,
  type DestinationProfileId,
} from '../model/DestinationProfile';
import { validateHostBranding, type HostBranding } from '../model/HostBranding';
import { normalizeMotionControls } from '../model/MotionControls';
import {
  getPurchaseItems,
  selectAppleAlbum,
  selectSpotifyTrack,
  type PurchaseItem,
  type ReleaseOrder,
} from '../model/ReleaseOrder';
import { PreviewCanvas } from '../PreviewCanvas';
import type { ArtworkSource } from '../preview/ArtworkSource';

export interface AlbumMotionEditorResult {
  project: AlbumMotionProject;
  release: ReleaseOrder;
  purchaseItems: PurchaseItem[];
}

export interface AlbumMotionEditorProps {
  branding: HostBranding;
  artwork: ArtworkSource;
  project: AlbumMotionProject;
  release: ReleaseOrder;
  destinationProfiles: readonly DestinationProfile[];
  onProjectChange: (project: AlbumMotionProject) => void;
  onReleaseChange: (release: ReleaseOrder) => void;
  onContinue: (result: AlbumMotionEditorResult) => void;
}

export function AlbumMotionEditor({
  branding,
  artwork,
  project,
  release,
  destinationProfiles,
  onProjectChange,
  onReleaseChange,
  onContinue,
}: AlbumMotionEditorProps) {
  validateHostBranding(branding);
  const destination = resolveDestinationProfile(destinationProfiles, project.destination);
  const purchaseItems = getPurchaseItems(release);

  function updateProject(changes: Partial<Pick<AlbumMotionProject, 'speed' | 'intensity'>>) {
    onProjectChange({
      ...project,
      ...normalizeMotionControls({
        speed: changes.speed ?? project.speed,
        intensity: changes.intensity ?? project.intensity,
      }),
    });
  }

  function surpriseMe() {
    updateProject({
      speed: Number((0.7 + Math.random() * 1.1).toFixed(2)),
      intensity: Number((0.45 + Math.random() * 1.05).toFixed(2)),
    });
  }

  function updateDestination(destinationId: DestinationProfileId) {
    onProjectChange({ ...project, destination: destinationId });
  }

  return (
    <main
      className="editor-shell"
      style={{ '--host-accent': branding.accentColor } as CSSProperties}
    >
      <section className="editor-intro">
        <div className="brand-lockup">
          {branding.logoUrl ? <img src={branding.logoUrl} alt={`${branding.hostName} logo`} /> : null}
          <p className="eyebrow">{branding.hostName} · powered by Album Motion</p>
        </div>
        <h1>{branding.productName}</h1>
        <p className="intro-copy">Create motion artwork for this release and choose where it will be delivered.</p>
      </section>

      <PreviewCanvas
        artwork={artwork}
        speed={project.speed}
        intensity={project.intensity}
        aspectRatio={destination.aspectRatio}
      />

      <section className="editor-controls" aria-label="Motion controls">
        <div className="control-heading">
          <div>
            <p className="eyebrow">Motion style</p>
            <h2>Drift</h2>
          </div>
          <button className="secondary-button" type="button" onClick={surpriseMe}>
            Surprise me
          </button>
        </div>

        <label className="range-control">
          <span>Speed <output>{project.speed.toFixed(2)}×</output></span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={project.speed}
            onChange={(event) => updateProject({ speed: Number(event.target.value) })}
          />
        </label>

        <label className="range-control">
          <span>Intensity <output>{project.intensity.toFixed(2)}×</output></span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={project.intensity}
            onChange={(event) => updateProject({ intensity: Number(event.target.value) })}
          />
        </label>

        <label className="destination-control">
          <span>Preview destination</span>
          <select value={project.destination} onChange={(event) => updateDestination(event.target.value)}>
            {destinationProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
          <small>
            {destination.aspectRatio.width}:{destination.aspectRatio.height} preview · {formatDestinationRequirements(destination)}
          </small>
        </label>

        <fieldset className="purchase-selection">
          <legend>Choose deliverables</legend>
          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={release.selections.appleAlbum}
              onChange={(event) => onReleaseChange(selectAppleAlbum(release, event.target.checked))}
            />
            <span>
              <strong>Apple Music — {release.album.title}</strong>
              One album-cover treatment shared by every track.
            </span>
          </label>
          <div className="track-selection">
            <strong>Spotify Canvas — choose tracks</strong>
            {release.tracks.map((track) => (
              <label className="checkbox-control" key={track.id}>
                <input
                  type="checkbox"
                  checked={release.selections.spotifyTrackIds.includes(track.id)}
                  onChange={(event) => onReleaseChange(selectSpotifyTrack(release, track.id, event.target.checked))}
                />
                <span>{track.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="project-summary">
          <span>Preview</span>
          <strong>{destination.name}</strong>
          <span>Loop behavior</span>
          <strong>Continuous</strong>
          <span>Purchase items</span>
          <strong>{purchaseItems.length}</strong>
        </div>

        <button
          className="primary-button"
          type="button"
          disabled={purchaseItems.length === 0}
          onClick={() => onContinue({ project, release, purchaseItems })}
        >
          Continue with {purchaseItems.length} item{purchaseItems.length === 1 ? '' : 's'}
        </button>

        {branding.supportUrl ? <a className="support-link" href={branding.supportUrl}>Get support from {branding.hostName}</a> : null}
      </section>
    </main>
  );
}

function formatDestinationRequirements(destination: DestinationProfile): string {
  const pixelRequirements = destination.pixelRequirements;
  const dimensions = pixelRequirements.minWidth && pixelRequirements.minHeight
    ? `minimum ${pixelRequirements.minWidth} × ${pixelRequirements.minHeight}px`
    : `${pixelRequirements.minHeight}–${pixelRequirements.maxHeight}px tall`;
  const duration = destination.durationSeconds
    ? ` · ${destination.durationSeconds.min}–${destination.durationSeconds.max}s`
    : '';

  return `${dimensions}${duration} · ${destination.acceptedFormats.join(', ').toUpperCase()}`;
}
