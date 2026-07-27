import { useState } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { sampleProject, type AlbumMotionProject } from './model/AlbumMotionProject';
import { normalizeMotionControls } from './model/MotionControls';
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

export function App() {
  const [project, setProject] = useState<AlbumMotionProject>(sampleProject);
  const [artwork, setArtwork] = useState<ArtworkSource>(sampleArtwork);
  const [artworkSourceName, setArtworkSourceName] = useState('Hosted URL');

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

  return (
    <main className="editor-shell">
      <section className="editor-intro">
        <p className="eyebrow">Album Motion</p>
        <h1>Bring your artwork to life.</h1>
        <p className="intro-copy">A browser preview that can later be embedded inside a distributor’s upload flow.</p>
      </section>

      <PreviewCanvas artwork={artwork} speed={project.speed} intensity={project.intensity} />

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

        <div className="project-summary">
          <span>Destination</span>
          <strong>Spotify canvas</strong>
          <span>Loop behavior</span>
          <strong>Continuous</strong>
        </div>

        <button className="primary-button" type="button">Continue to purchase</button>
      </section>
    </main>
  );
}
