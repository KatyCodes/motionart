# Render service HTTP contract

The browser editor depends on the `RenderService` interface, not a specific cloud provider. `createHttpRenderService` is the production-facing adapter for any backend that implements the endpoints below.

## Client setup

```ts
const renderService = createHttpRenderService({
  baseUrl: '/api/company-tbd',
  getHeaders: async () => ({
    Authorization: `Bearer ${await getShortLivedRenderToken()}`,
  }),
});
```

`getHeaders` runs immediately before every submit or poll request, so the host can refresh short-lived authentication. Do not ship a permanent backend secret in browser JavaScript. A customer can instead use a same-origin proxy or issue the editor a narrowly scoped, short-lived token.

Both methods accept an optional `AbortSignal`, allowing React to cancel obsolete requests when the artist changes pages or closes the editor.

## Local development

`npm run dev` mounts an in-memory implementation at `/api/company-tbd`. The React demo still communicates through `createHttpRenderService`; only the server behind the URL is simulated. This verifies JSON serialization, HTTP methods, routing, response validation, polling, and cancellation without shipping the mock endpoint in the production bundle.

Set `VITE_RENDER_SERVICE_MODE=fake` only when the browser-only adapter is useful for debugging. Render jobs in either local mode are temporary and disappear when the development process restarts.

The proof-of-concept file renderer supports both Drift and Water requests with GIF or MP4 output. It reads the requested format from the selected destination profile, generates a real animated preview capped at 320px, 8 frames per second, and 2 seconds, then serves it from:

```http
GET /render-files/{url-encoded-job-id}/{url-encoded-file-name}
```

The completed job's output contains an optional `artifact` object with `kind: "preview"`, content type, download URL, dimensions, and frame count. MP4 previews are H.264/YUV 4:2:0 files with even dimensions for player compatibility. Full-size output, durable file storage, audio policy, and destination-specific seamless-loop tuning remain production renderer work.

`MotionPreviewRenderer` dispatches by configured file format, while the effect frame renderer is selected independently. `PreviewFrameRenderer` owns shared sizing and timestamps; `GifPreviewEncoder` and `Mp4PreviewEncoder` only encode those RGBA frames and add format-specific metadata. This keeps format, effect, and platform as separate decisions: adding a format does not require copying Drift and Water, and changing a customer profile does not add a platform-specific branch. Water reuses the browser preview's deterministic frame state and repeating displacement waveform, then bilinearly samples the registered artwork through that field.

The local MP4 adapter uses the `ffmpeg-static` development dependency and streams a fragmented MP4 through memory. A production render worker can replace that process adapter without changing the browser-facing `RenderService` or the frame-rendering code.

Local job and artifact persistence are also adapters. `RenderJobRepository` stores the job together with the request required to reproduce it, while `RenderArtifactStore` stores rendered bytes. Their in-memory implementations keep localhost fast; planned DynamoDB and S3 implementations use the same asynchronous contracts. The AWS mapping is described in [AWS-ARCHITECTURE.md](./AWS-ARCHITECTURE.md).

### Register development artwork

The demo resolves its runtime `ArtworkSource` in the browser and registers the resulting bytes before submitting the durable render request:

```http
PUT /render-assets/{url-encoded-provider}/{url-encoded-asset-key}[/{url-encoded-version}]
Content-Type: image/png

<binary image bytes>
```

Each path segment is encoded separately. The development server caps an image at 20 MB and stores it in memory under the exact provider, asset key, and optional version. Restarting Vite clears the bytes.

This development flow proves URLs, browser uploads, and authenticated loaders can all reach the renderer without adding temporary access details to `RenderRequest`. It also avoids making the render server fetch an arbitrary browser-entered URL. In production, an authorized server-to-server resolver can replace registration and obtain or refresh the image from the customer's catalog using the same durable reference.

## Submit a job

```http
POST /render-jobs
Accept: application/json
Content-Type: application/json
```

The body is a versioned `RenderRequest`. A successful response returns a validated `RenderJob`, normally with HTTP `201` and `status: "submitted"`.

## Poll a job

```http
GET /render-jobs/{url-encoded-job-id}
Accept: application/json
```

The response is the latest versioned `RenderJob`. Its status is one of `submitted`, `processing`, `completed`, or `failed`. A completed job contains one output entry per requested deliverable. A failed job contains a typed failure with a human-readable message and a `retryable` flag.

The first contract only includes output filenames. A later schema version can add expiring download references without changing the meaning of jobs already saved by a host.

## Error response

```json
{
  "code": "RENDERER_UNAVAILABLE",
  "message": "Renderer is temporarily unavailable."
}
```

The client preserves the HTTP status and error code in `RenderServiceHttpError`. HTTP `408`, `429`, and `5xx` responses are classified as retryable. Successful HTTP responses are still treated as untrusted data and must pass `validateRenderJob` before they reach React.

## Customer and Company TBD responsibilities

- The customer host decides when checkout is complete and when to submit the render request.
- Company TBD's service resolves the durable artwork reference, renders the requested outputs, and reports job status.
- Temporary artwork and download URLs are refreshed at their respective boundaries; they are not stored as permanent project identifiers.
- Cross-origin deployments must explicitly allow the customer's origin and required request headers.
