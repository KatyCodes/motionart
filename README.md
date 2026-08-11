# Album Motion proof of concept

A browser motion-artwork editor using TypeScript, React, Vite, and PixiJS. It loads customer-provided artwork, center-crops it for configurable destinations, and offers deterministic effects including cinematic Drift and liquid Water ripples.

The preview engine accepts artwork without assuming where it is stored. A host can provide a CORS-enabled URL (including a signed S3/CDN URL), a `Blob`/`File`, or a loader function that uses the host's own authentication. Durable customer asset identifiers remain separate from temporary preview sources.

Animation state is calculated from an explicit timestamp through `renderAt(timeSeconds)`, so the same time, effect, and project settings can later produce the same frame in both the browser preview and server renderer. Customers can also provide a subset of `motionStyles` to control which built-in effects appear and customize their labels and descriptions.

## Embed contract

The demo page is a small example host. The reusable editor receives all customer-owned data through props and reports changes through callbacks:

```tsx
<AlbumMotionEditor
  branding={customerBranding}
  draft={releaseMotionDraft}
  release={release}
  destinationProfiles={customerProfiles}
  resolveArtwork={resolveCustomerArtwork}
  onDraftChange={saveReleaseMotionDraft}
  onReleaseChange={saveReleaseDraft}
  onContinue={startCustomerCheckout}
/>
```

The host owns catalog data, artwork access, persistence, branding, and checkout. The editor owns motion controls, preview rendering, destination validation, and the structured purchase handoff.

AWS is the planned first production-cloud adapter. The incremental service map and learning sequence live in [AWS-ARCHITECTURE.md](./AWS-ARCHITECTURE.md); the editor and render domain remain cloud-neutral.

`createRenderRequest` turns the editor result into a versioned, serializable checkout contract. Each selected album or track gets its own item containing a durable artwork reference, motion settings, destination snapshot, and concrete render dimensions, duration, and format. Those output values come from the customer's `DestinationProfile.renderDefaults`, so changing a platform or white-label configuration does not require changing the request builder.

`RenderRequestReview` presents that contract to the artist before handing it back to the host's checkout callback. After the simulated checkout, the demo submits the request through the asynchronous `RenderService` interface and polls a `RenderJob` through submitted, processing, and completed states. Local development uses the real HTTP adapter against a development-only Vite endpoint; unit tests and static production previews can use the in-memory adapter.

For a Drift or Water request whose configured destination format is GIF or MP4, the local endpoint renders and serves a real downloadable animated preview in that format. MP4 previews use H.264 video with broadly compatible YUV 4:2:0 pixels. Both formats are intentionally capped at 320px, 8 frames per second, and 2 seconds; they prove that the deterministic render path works, but they are not destination-ready masters. Before the demo submits a job, it resolves the selected URL, `File`/`Blob`, or authenticated loader and temporarily registers those image bytes under the durable artwork reference. The render request itself still contains no source URL or browser object.

That registration endpoint is a development adapter, not a requirement for every customer. A production integration can instead let Company TBD's backend resolve the durable reference through the customer's authorized server-to-server asset API. Either design can refresh an expired signed URL at render time without saving that URL in the project.

The fake renderer is an adapter, not a dependency of the editor. A future Company TBD backend client can implement the same `submit(request)` and `get(jobId)` methods while the request, status screen, and editor remain unchanged.

### Host launch flow

`createHostEditorSession` converts one customer launch configuration into the controlled `release`, `draft`, and `resolveArtwork` values required by the editor. CD Baby can request an Apple album, one or more Spotify tracks, or both. The requested deliverables are selected before the editor opens.

```ts
const session = createHostEditorSession({
  schemaVersion: 2,
  launchId: 'checkout-123',
  destinationProfileIds: {
    appleAlbum: 'apple-music-cover-art-v1',
    spotifyTrack: 'spotify-canvas-v1',
  },
  album: {
    id: 'album-1',
    title: 'Night Drive',
    artwork: {
      reference: { provider: 'cdbaby', assetKey: 'album-1-cover' },
      source: { type: 'url', url: temporaryPreviewUrl },
    },
  },
  tracks: [{
    id: 'track-1',
    title: 'Signal',
    artwork: {
      reference: { provider: 'cdbaby', assetKey: 'track-1-cover' },
      source: { type: 'blob', blob: uploadedFile },
    },
  }],
  deliverables: [
    { kind: 'apple-album' },
    { kind: 'spotify-track', trackId: 'track-1' },
  ],
});
```

The runtime `source` can be a CORS-enabled URL, a browser `File`/`Blob`, or an authenticated loader function. Only the durable `reference` is copied into saved motion drafts and render requests, so signed URLs and uploaded file objects are not persisted accidentally. The localhost demo temporarily uploads the resolved bytes immediately before rendering; restarting Vite clears them.

An image URL that displays in a normal browser tab is not necessarily canvas-safe. Its actual `GET` response must include an appropriate `Access-Control-Allow-Origin` header. If it does not, the embedding customer should supply an authenticated loader backed by its own server.

`serializeReleaseDraft` validates and converts the complete release to JSON for customer storage. `parseReleaseDraft` parses, migrates, and validates saved JSON before it enters the editor. The localhost demo uses `localStorage` only to demonstrate those host responsibilities; an actual distributor can use the same boundary with its database API.

## Run locally

Requires Node.js 20.19+ or 22.12+.

For first-time Mac setup and an explanation of the development environment, see [DEVELOPMENT.md](./DEVELOPMENT.md).

For an explanation of the TypeScript and React files in this proof of concept, see [TYPESCRIPT-WALKTHROUGH.md](./TYPESCRIPT-WALKTHROUGH.md).

For the testing workflow and engineering practices, see [ENGINEERING.md](./ENGINEERING.md).

For the future backend endpoint and authentication contract, see [RENDER-SERVICE.md](./RENDER-SERVICE.md).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
```
