import { useEffect, useState, type FormEvent } from 'react';
import sampleCoverUrl from './assets/sample-cover.svg';
import { AlbumMotionEditor, type AlbumMotionEditorResult } from './editor/AlbumMotionEditor';
import {
  transitionEditorWindow,
  type EditorWindowAction,
  type EditorWindowState,
} from './editor/EditorWindowState';
import {
  createHostEditorSession,
  type HostLaunchConfig,
} from './integration/HostLaunchConfig';
import { createDemoRenderService } from './integration/DemoRenderService';
import { destinationProfiles } from './model/DestinationProfile';
import type { HostBranding } from './model/HostBranding';
import type { ReleaseMotionDraft } from './model/ReleaseMotionDraft';
import type { ReleaseOrder } from './model/ReleaseOrder';
import { parseReleaseDraft, serializeReleaseDraft } from './persistence/ReleaseDraftCodec';
import type { ArtworkSource } from './preview/ArtworkSource';
import {
  createRenderRequest,
  isRenderJobTerminal,
  registerRenderRequestArtwork,
  RenderJobStatus,
  RenderRequestReview,
  type RenderJob,
  type RenderRequest,
} from './render';

const demoStorageKey = 'album-motion-demo-release-v1';
const exampleArtworkUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Buzz_Aldrin_on_the_Moon_with_the_American_Flag_MET_DP-15797-029.jpg/960px-Buzz_Aldrin_on_the_Moon_with_the_American_Flag_MET_DP-15797-029.jpg';

type DemoDeliverable = 'apple-album' | 'spotify-track';

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
  hostName: 'CD Baby demo',
  productName: 'Motion Studio',
  accentColor: '#d3b9ff',
  providerName: 'Company TBD',
};

const initialSession = createHostEditorSession(createDemoHostConfig('apple-album', hostedArtwork));
const demoRenderSelection = createDemoRenderService(
  import.meta.env.VITE_RENDER_SERVICE_MODE,
  import.meta.env.DEV,
);
const demoRenderService = demoRenderSelection.service;

export function App() {
  const [session, setSession] = useState(initialSession);
  const [release, setRelease] = useState<ReleaseOrder>(initialSession.release);
  const [draft, setDraft] = useState<ReleaseMotionDraft>(initialSession.draft);
  const [deliverable, setDeliverable] = useState<DemoDeliverable>('apple-album');
  const [artworkSource, setArtworkSource] = useState<ArtworkSource>(hostedArtwork);
  const [artworkSourceName, setArtworkSourceName] = useState('Bundled sample');
  const [artworkUrl, setArtworkUrl] = useState(exampleArtworkUrl);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [editorWindowState, setEditorWindowState] = useState<EditorWindowState>('open');
  const [reviewRequest, setReviewRequest] = useState<RenderRequest | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!renderJob || isRenderJobTerminal(renderJob)) return;

    const activeJob = renderJob;
    let cancelled = false;
    const controller = new AbortController();
    let pollTimer = window.setTimeout(poll, 900);

    async function poll() {
      try {
        const nextJob = await demoRenderService.get(activeJob.id, {
          signal: controller.signal,
        });

        if (!cancelled) {
          setCheckoutMessage(null);
          setRenderJob(nextJob);
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return;

        const message = error instanceof Error
          ? error.message
          : 'The render status could not be refreshed.';
        setCheckoutMessage(`${message} Retrying…`);
        pollTimer = window.setTimeout(poll, 1800);
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
      controller.abort();
    };
  }, [renderJob]);

  function updateEditorWindow(action: EditorWindowAction) {
    setEditorWindowState((current) => transitionEditorWindow(current, action));
  }

  const editorWindowActions = {
    onMinimize: () => updateEditorWindow('minimize'),
    onExit: () => updateEditorWindow('exit'),
  };

  function launchFromHost(
    nextDeliverable: DemoDeliverable,
    nextArtwork: ArtworkSource,
    sourceName: string,
  ) {
    const nextSession = createHostEditorSession(
      createDemoHostConfig(nextDeliverable, nextArtwork),
    );

    setSession(nextSession);
    setRelease(nextSession.release);
    setDraft(nextSession.draft);
    setDeliverable(nextDeliverable);
    setArtworkSource(nextArtwork);
    setArtworkSourceName(sourceName);
    updateEditorWindow('restore');
    setReviewRequest(null);
    setRenderJob(null);
    setCheckoutMessage(null);
    setHandoffMessage(
      nextDeliverable === 'apple-album'
        ? 'CD Baby supplied an album order. Apple Music was selected automatically.'
        : 'CD Baby supplied a track order. Spotify was selected automatically.',
    );
  }

  function useHostLoader() {
    launchFromHost(deliverable, hostLoadedArtwork, 'Authenticated host loader');
  }

  function switchDeliverable(nextDeliverable: DemoDeliverable) {
    launchFromHost(nextDeliverable, artworkSource, artworkSourceName);
  }

  function useArtworkUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = artworkUrl.trim();

    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error('Unsupported URL protocol.');
      }
    } catch {
      setHandoffMessage('Enter a complete image URL beginning with https:// or http://.');
      return;
    }

    launchFromHost(deliverable, { type: 'url', url }, `Image URL: ${getUrlHost(url)}`);
  }

  function handleLocalFile(file: File | undefined) {
    if (!file) return;

    launchFromHost(deliverable, { type: 'blob', blob: file }, `Uploaded file: ${file.name}`);
  }

  function handleContinue(result: AlbumMotionEditorResult) {
    const request = createRenderRequest({
      launchId: session.launchId,
      release: result.release,
      draft: result.draft,
      destinationProfiles,
    });

    setReviewRequest(request);
    setRenderJob(null);
    setCheckoutMessage(null);
    setHandoffMessage(`Host prepared ${request.deliverables.length} render deliverable${request.deliverables.length === 1 ? '' : 's'} for review.`);
  }

  async function handleCheckout(request: RenderRequest) {
    setCheckoutMessage('CD Baby is preparing the artwork for rendering.');

    try {
      await registerRenderRequestArtwork(
        request,
        session.resolveArtwork,
        demoRenderSelection.artworkRegistrationService,
      );
      setCheckoutMessage('CD Baby is submitting the paid render request.');
      const job = await demoRenderService.submit(request);
      const message = `CD Baby submitted render job ${job.id} with ${request.deliverables.length} deliverable${request.deliverables.length === 1 ? '' : 's'}.`;

      setRenderJob(job);
      setCheckoutMessage(null);
      setHandoffMessage(message);
    } catch (error) {
      setCheckoutMessage(
        error instanceof Error ? error.message : 'CD Baby could not submit the render request.',
      );
    }
  }

  function returnToEditor() {
    setRenderJob(null);
    setReviewRequest(null);
    setCheckoutMessage(null);
  }

  function retryRender() {
    if (!reviewRequest) return;

    setRenderJob(null);
    void handleCheckout(reviewRequest);
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
      setReviewRequest(null);
      setRenderJob(null);
      setCheckoutMessage(null);
      setHandoffMessage('Host restored the saved release draft.');
    } catch (error) {
      setHandoffMessage(error instanceof Error ? error.message : 'The saved release draft is invalid.');
    }
  }

  return (
    <div className="host-demo">
      <details className="developer-panel">
        <summary>
          <span className="developer-badge">Developer tools</span>
          <span className="developer-summary-copy">
            <strong>CD Baby integration simulator</strong>
            <small>Local demo only — artists will not see these controls.</small>
          </span>
          <span className="developer-panel-action">Configure demo</span>
        </summary>
        <aside className="host-demo-toolbar" aria-label="Host integration demo">
          <div className="host-demo-heading">
            <strong>Simulated launch payload</strong>
            <span>{deliverable === 'apple-album' ? 'Album → Apple Music' : 'Track → Spotify'} · {artworkSourceName}</span>
            <span>Renderer · {demoRenderSelection.label}</span>
          </div>
          <label className="host-demo-field">
            <span>Incoming order</span>
            <select
              aria-label="Incoming order"
              value={deliverable}
              onChange={(event) => switchDeliverable(event.target.value as DemoDeliverable)}
            >
              <option value="apple-album">Album · Apple Music</option>
              <option value="spotify-track">Track · Spotify</option>
            </select>
          </label>
          <form className="host-url-form" onSubmit={useArtworkUrl}>
            <label className="host-demo-field">
              <span>Artwork URL</span>
              <input
                aria-label="Artwork URL"
                type="url"
                value={artworkUrl}
                onChange={(event) => setArtworkUrl(event.target.value)}
                placeholder="https://cdn.example/artwork.jpg"
              />
            </label>
            <button type="submit">Launch with URL</button>
          </form>
          <button type="button" onClick={useHostLoader}>Use authenticated loader</button>
          <button type="button" onClick={saveDraft}>Save draft</button>
          <button type="button" onClick={restoreDraft}>Restore draft</button>
          <label className="host-file-control">
            <span>Launch with uploaded image</span>
            <input type="file" accept="image/*" onChange={(event) => handleLocalFile(event.target.files?.[0])} />
          </label>
          {handoffMessage ? <output>{handoffMessage}</output> : null}
        </aside>
      </details>

      <div className="artist-view-label">
        <span>Artist experience</span>
        <small>The reusable editor begins here.</small>
      </div>

      {editorWindowState !== 'open' ? (
        <section className={`editor-window-placeholder is-${editorWindowState}`} aria-live="polite">
          <div>
            <p className="eyebrow">{demoBranding.hostName}</p>
            <h2>
              {editorWindowState === 'minimized'
                ? `${demoBranding.productName} is minimized`
                : `${demoBranding.productName} is closed`}
            </h2>
            <p>
              {editorWindowState === 'minimized'
                ? 'Your motion settings are still here when you are ready to continue.'
                : 'This demo kept your draft in memory. In production, the customer host can navigate the artist back to its catalog or checkout.'}
            </p>
          </div>
          <div className="editor-window-placeholder-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => updateEditorWindow('restore')}
            >
              {editorWindowState === 'minimized' ? 'Restore editor' : 'Open editor again'}
            </button>
            {editorWindowState === 'minimized' ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => updateEditorWindow('exit')}
              >
                Exit
              </button>
            ) : null}
          </div>
        </section>
      ) : renderJob && reviewRequest ? (
        <RenderJobStatus
          branding={demoBranding}
          job={renderJob}
          request={reviewRequest}
          statusMessage={checkoutMessage}
          windowActions={editorWindowActions}
          onEdit={returnToEditor}
          onRetry={retryRender}
        />
      ) : reviewRequest ? (
        <RenderRequestReview
          branding={demoBranding}
          request={reviewRequest}
          statusMessage={checkoutMessage}
          windowActions={editorWindowActions}
          onEdit={() => {
            setReviewRequest(null);
            setRenderJob(null);
            setCheckoutMessage(null);
          }}
          onConfirm={handleCheckout}
        />
      ) : (
        <AlbumMotionEditor
          branding={demoBranding}
          draft={draft}
          release={release}
          destinationProfiles={destinationProfiles}
          resolveArtwork={session.resolveArtwork}
          allowDeliverableChanges={false}
          windowActions={editorWindowActions}
          onDraftChange={setDraft}
          onReleaseChange={setRelease}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}

function createDemoHostConfig(
  deliverable: DemoDeliverable,
  artworkSource: ArtworkSource,
): HostLaunchConfig {
  return {
    schemaVersion: 2,
    launchId: `demo-${deliverable}`,
    destinationProfileIds: {
      appleAlbum: 'apple-music-cover-art-v1',
      spotifyTrack: 'spotify-canvas-v1',
    },
    album: {
      id: 'album-night-drive',
      title: 'Night Drive',
      artwork: {
        reference: { provider: 'cdbaby', assetKey: 'album-night-drive-cover' },
        source: artworkSource,
      },
    },
    tracks: [
      {
        id: 'track-signal',
        title: 'Signal',
        artwork: {
          reference: { provider: 'cdbaby', assetKey: 'track-signal-cover' },
          source: artworkSource,
        },
      },
    ],
    deliverables: deliverable === 'apple-album'
      ? [{ kind: 'apple-album' }]
      : [{ kind: 'spotify-track', trackId: 'track-signal' }],
  };
}

function getUrlHost(url: string): string {
  return new URL(url).host;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
