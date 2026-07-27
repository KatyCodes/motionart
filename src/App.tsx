import { useState } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { AlbumMotionEditor, type AlbumMotionEditorResult } from './editor/AlbumMotionEditor';
import { sampleProject, type AlbumMotionProject } from './model/AlbumMotionProject';
import { destinationProfiles } from './model/DestinationProfile';
import type { HostBranding } from './model/HostBranding';
import type { ReleaseOrder } from './model/ReleaseOrder';
import type { ArtworkSource } from './preview/ArtworkSource';

const hostedArtwork: ArtworkSource = {
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

const demoBranding: HostBranding = {
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
  const [release, setRelease] = useState<ReleaseOrder>(demoRelease);
  const [artwork, setArtwork] = useState<ArtworkSource>(hostedArtwork);
  const [artworkSourceName, setArtworkSourceName] = useState('Hosted URL');
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);

  function useHostedUrl() {
    setArtwork(hostedArtwork);
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

  function handleContinue(result: AlbumMotionEditorResult) {
    setHandoffMessage(`Host received ${result.purchaseItems.length} purchase item${result.purchaseItems.length === 1 ? '' : 's'}.`);
  }

  return (
    <div className="host-demo">
      <aside className="host-demo-toolbar" aria-label="Host integration demo">
        <div>
          <strong>Embedding host controls</strong>
          <span>Artwork: {artworkSourceName}</span>
        </div>
        <button type="button" onClick={useHostedUrl}>URL</button>
        <button type="button" onClick={useHostLoader}>Loader</button>
        <label>
          <span>Local file</span>
          <input type="file" accept="image/*" onChange={(event) => useLocalFile(event.target.files?.[0])} />
        </label>
        {handoffMessage ? <output>{handoffMessage}</output> : null}
      </aside>

      <AlbumMotionEditor
        branding={demoBranding}
        artwork={artwork}
        project={project}
        release={release}
        destinationProfiles={destinationProfiles}
        onProjectChange={setProject}
        onReleaseChange={setRelease}
        onContinue={handleContinue}
      />
    </div>
  );
}
