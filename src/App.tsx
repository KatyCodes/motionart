import { useState } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { sampleProject, type AlbumMotionProject } from './model/AlbumMotionProject';
import type { ArtworkSource } from './preview/ArtworkSource';
import { PreviewCanvas } from './PreviewCanvas';

const sampleArtwork: ArtworkSource = {
  type: 'url',
  url: sampleCoverUrl,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function App() {
  const [project, setProject] = useState<AlbumMotionProject>(sampleProject);

  function updateProject(changes: Partial<Pick<AlbumMotionProject, 'speed' | 'intensity'>>) {
    setProject((current) => ({ ...current, ...changes }));
  }

  function surpriseMe() {
    updateProject({
      speed: Number((0.7 + Math.random() * 1.1).toFixed(2)),
      intensity: Number((0.45 + Math.random() * 1.05).toFixed(2)),
    });
  }

  return (
    <main className="editor-shell">
      <section className="editor-intro">
        <p className="eyebrow">Album Motion</p>
        <h1>Bring your artwork to life.</h1>
        <p className="intro-copy">A browser preview that can later be embedded inside a distributor’s upload flow.</p>
      </section>

      <PreviewCanvas artwork={sampleArtwork} speed={project.speed} intensity={project.intensity} />

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
            onChange={(event) => updateProject({ speed: clamp(Number(event.target.value), 0.5, 2) })}
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
            onChange={(event) => updateProject({ intensity: clamp(Number(event.target.value), 0, 1.5) })}
          />
        </label>

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
