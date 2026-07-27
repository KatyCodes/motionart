import { useState, type CSSProperties } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { sampleProject, type AlbumMotionProject } from './model/AlbumMotionProject';
import { destinationProfiles, getDestinationProfile, type DestinationProfileId } from './model/DestinationProfile';
import { normalizeMotionControls } from './model/MotionControls';
import { getPurchaseItems, selectAppleAlbum, selectSpotifyTrack, type ReleaseOrder } from './model/ReleaseOrder';
import type { ArtworkSource } from './preview/ArtworkSource';
import { PreviewCanvas } from './PreviewCanvas';

const sampleArtwork: ArtworkSource = {
  type: 'url',
  url: sampleCoverUrl,
};

const hostLoadedArtwork: ArtworkSource = {
  type: 'loader',
  async load(signal) {
    const response = await fetch(sampleCoverUrl, { signal });

    if (!response.ok) {
      throw new Error(`The host could not load artwork (${response.status}).`);
    }

    return response.blob();
  },
};

const demoHostBranding = {
  hostName: 'Distributor demo',
  productName: 'Motion Studio',
  accentColor: '#d3b9ff',
};

const demoRelease: ReleaseOrder = {
  schemaVersion: 1,
  album: {
    id: 'album-demo',
    title: 'Night Drive',
    artwork: { provider: 'demo', assetKey: 'sample-cover' },
  },
  tracks: [
    { id: 'track-signal', title: 'Signal', artwork: { provider: 'demo', assetKey: 'signal-cover' } },
    { id: 'track-afterglow', title: 'Afterglow', artwork: { provider: 'demo', assetKey: 'afterglow-cover' } },
  ],
  selections: { appleAlbum: false, spotifyTrackIds: [] },
};

export function App() {
  const [project, setProject] = useState<AlbumMotionProject>(sampleProject);
  const [artwork, setArtwork] = useState<ArtworkSource>(sampleArtwork);
  const [artworkSourceName, setArtworkSourceName] = useState('Hosted URL');
  const [release, setRelease] = useState<ReleaseOrder>(demoRelease);
  const destination = getDestinationProfile(project.destination);
  const purchaseItems = getPurchaseItems(release);

  function updateProject(changes: Partial<Pick<AlbumMotionProject, 'speed' | 'intensity'>>) {
    setProject((current) => ({
      ...current,
      ...normalizeMotionControls({
        speed: changes.speed ?? current.speed,
        intensity: changes.intensity ?? current.intensity,
      }),
    }));
  }

  function surpriseMe() {
    updateProject({
      speed: Number((0.7 + Math.random() * 1.1).toFixed(2)),
      intensity: Number((0.45 + Math.random() * 1.05).toFixed(2)),
    });
  }

  function useHostedUrl() {
    setArtwork(sampleArtwork);
    setArtworkSourceName('Hosted URL');
  }

  function useHostLoader() {
    setArtwork(hostLoadedArtwork);
    setArtworkSourceName('Host loader');
  }

  function useLocalFile(file: File | undefined) {
    if (!file) return;

    setArtwork({ type: 'blob', blob: file });
    setArtworkSourceName(`Local file: ${file.name}`);
  }

  function updateDestination(destinationId: DestinationProfileId) {
    setProject((current) => ({ ...current, destination: destinationId }));
  }

  function updateAppleSelection(selected: boolean) {
    setRelease((current) => selectAppleAlbum(current, selected));
  }

  function updateSpotifyTrack(trackId: string, selected: boolean) {
    setRelease((current) => selectSpotifyTrack(current, trackId, selected));
  }

  return (
    <main
      className="editor-shell"
      style={{ '--host-accent': demoHostBranding.accentColor } as CSSProperties}
    >
      <section className="editor-intro">
        <p className="eyebrow">{demoHostBranding.hostName} · powered by Album Motion</p>
        <h1>{demoHostBranding.productName}</h1>
        <p className="intro-copy">A browser preview that can later be embedded inside a distributor’s upload flow.</p>
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

        <fieldset className="artwork-source-controls">
          <legend>Artwork source</legend>
          <p>
            <strong>{artworkSourceName}</strong>
            The host can supply artwork without the plugin owning its storage.
          </p>
          <div className="source-actions">
            <button className="secondary-button" type="button" onClick={useHostedUrl}>Hosted URL</button>
            <button className="secondary-button" type="button" onClick={useHostLoader}>Host loader</button>
          </div>
          <label className="file-control">
            <span>Or choose a local image</span>
            <input type="file" accept="image/*" onChange={(event) => useLocalFile(event.target.files?.[0])} />
          </label>
        </fieldset>

        <label className="destination-control">
          <span>Destination profile</span>
          <select
            value={project.destination}
            onChange={(event) => updateDestination(event.target.value as DestinationProfileId)}
          >
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
              onChange={(event) => updateAppleSelection(event.target.checked)}
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
                  onChange={(event) => updateSpotifyTrack(track.id, event.target.checked)}
                />
                <span>{track.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="project-summary">
          <span>Destination</span>
          <strong>{destination.name}</strong>
          <span>Loop behavior</span>
          <strong>Continuous</strong>
          <span>Purchase items</span>
          <strong>{purchaseItems.length}</strong>
        </div>

        <button className="primary-button" type="button" disabled={purchaseItems.length === 0}>
          Continue with {purchaseItems.length} item{purchaseItems.length === 1 ? '' : 's'}
        </button>
      </section>
    </main>
  );
}

function formatDestinationRequirements(destination: ReturnType<typeof getDestinationProfile>): string {
  const pixelRequirements = destination.pixelRequirements;
  const dimensions = pixelRequirements.minWidth && pixelRequirements.minHeight
    ? `minimum ${pixelRequirements.minWidth} × ${pixelRequirements.minHeight}px`
    : `${pixelRequirements.minHeight}–${pixelRequirements.maxHeight}px tall`;
  const duration = destination.durationSeconds
    ? ` · ${destination.durationSeconds.min}–${destination.durationSeconds.max}s`
    : '';

  return `${dimensions}${duration} · ${destination.acceptedFormats.join(', ').toUpperCase()}`;
}
