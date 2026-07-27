import { useState } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { AlbumMotionEditor, type AlbumMotionEditorResult } from './editor/AlbumMotionEditor';
import { destinationProfiles } from './model/DestinationProfile';
import type { HostBranding } from './model/HostBranding';
import { createReleaseMotionDraft, type ReleaseMotionDraft } from './model/ReleaseMotionDraft';
import type { ReleaseOrder } from './model/ReleaseOrder';
import { parseReleaseDraft, serializeReleaseDraft } from './persistence/ReleaseDraftCodec';
import type { ArtworkSource } from './preview/ArtworkSource';

const demoStorageKey = 'album-motion-demo-release-v1';

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
  const [release, setRelease] = useState<ReleaseOrder>(demoRelease);
  const [draft, setDraft] = useState<ReleaseMotionDraft>(() => createReleaseMotionDraft(demoRelease));
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

  function saveDraft() {
    const json = serializeReleaseDraft({ schemaVersion: 1, release, motion: draft });
    window.localStorage.setItem(demoStorageKey, json);
    setHandoffMessage('Host saved this release draft.');
  }

  function restoreDraft() {
    const json = window.localStorage.getItem(demoStorageKey);

    if (!json) {
      setHandoffMessage('No saved release draft was found.');
      return;
    }

    try {
      const saved = parseReleaseDraft(json);
      setRelease(saved.release);
      setDraft(saved.motion);
      setHandoffMessage('Host restored the saved release draft.');
    } catch (error) {
      setHandoffMessage(error instanceof Error ? error.message : 'The saved release draft is invalid.');
    }
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
        <button type="button" onClick={saveDraft}>Save draft</button>
        <button type="button" onClick={restoreDraft}>Restore draft</button>
        <label>
          <span>Local file</span>
          <input type="file" accept="image/*" onChange={(event) => useLocalFile(event.target.files?.[0])} />
        </label>
        {handoffMessage ? <output>{handoffMessage}</output> : null}
      </aside>

      <AlbumMotionEditor
        branding={demoBranding}
        draft={draft}
        release={release}
        destinationProfiles={destinationProfiles}
        resolveArtwork={() => artwork}
        onDraftChange={setDraft}
        onReleaseChange={setRelease}
        onContinue={handleContinue}
      />
    </div>
  );
}
