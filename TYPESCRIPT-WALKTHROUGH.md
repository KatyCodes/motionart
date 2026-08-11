# Album Motion TypeScript walkthrough

This guide follows the code in the order the browser uses it.

## 1. `src/main.tsx`: start React

```tsx
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`createRoot` tells React which HTML element it owns. `<App />` means “render the `App` component.” The `.tsx` extension means this file contains TypeScript plus JSX, React's HTML-like syntax.

## 2. `src/App.tsx`: act like an embedding customer

```ts
<AlbumMotionEditor
  draft={draft}
  release={release}
  onDraftChange={setDraft}
  onReleaseChange={setRelease}
/>
```

`App` is now a demonstration host, similar to a distributor embedding the product. It owns the current project and release data. The collapsed “Developer tools” panel simulates CD Baby's launch payload, but it sits outside `AlbumMotionEditor` and would not appear in the artist-facing integration. The editor receives data through props and reports changes through callbacks.

## 3. `src/editor/AlbumMotionEditor.tsx`: expose the public contract

```ts
export interface AlbumMotionEditorProps {
  branding: HostBranding;
  draft: ReleaseMotionDraft;
  onDraftChange: (draft: ReleaseMotionDraft) => void;
}
```

The props interface is the integration contract. A callback such as `onDraftChange` is a function supplied by the host. The editor calls it with the updated release draft instead of deciding where that draft should be stored. The draft holds one Apple album project and a separate project for every Spotify track.

## 4. `src/render/RenderRequest.ts`: create the checkout contract

```ts
export interface RenderRequest {
  schemaVersion: 1;
  launchId: string;
  deliverables: RenderDeliverable[];
}
```

`createRenderRequest` converts the editable release draft into a self-contained description of the files to render. Each deliverable includes its durable artwork reference, motion recipe, destination, dimensions, duration, and format. It deliberately excludes temporary URLs and browser `File` objects.

The `schemaVersion: 1` field is a literal type: the value must be exactly `1`. A future version can add a new contract without silently changing the meaning of requests already stored by a customer.

## 5. `src/render/RenderRequestReview.tsx`: review before checkout

This React component receives a validated `RenderRequest` through props. It displays the request but does not decide how checkout works. Its `onConfirm` callback returns the same structured request to the embedding host, keeping customer-specific payments outside the reusable editor.

## 6. `RenderJob.ts` and `RenderService.ts`: model asynchronous work

`RenderJob` is a discriminated state model for submitted, processing, completed, and failed work. Transition functions enforce the legal order. `RenderService` is a small interface with asynchronous `submit` and `get` methods, so React does not need to know whether a job comes from the demo or a real server.

The fake service implements that same interface in memory. It is useful for tests and the localhost demonstration, but it is not imported by the reusable editor.

## 7. `HttpRenderService.ts`: adapt the interface to HTTP

```ts
export interface RenderService {
  submit(request: RenderRequest, options?: RenderServiceRequestOptions): Promise<RenderJob>;
  get(jobId: string, options?: RenderServiceRequestOptions): Promise<RenderJob>;
}
```

The HTTP adapter turns those method calls into `POST /render-jobs` and `GET /render-jobs/{id}` requests. Its `getHeaders` callback can provide fresh authentication for each request. Responses begin as `unknown` because TypeScript cannot guarantee that a remote server returned valid data; `validateRenderJob` checks them before the adapter returns a typed `RenderJob`.

`ArtworkRegistrationService.ts` is a second small boundary. Before the demo submits a job, `registerRenderRequestArtwork` collects its distinct durable artwork references. The HTTP adapter resolves each matching URL, `Blob`, or loader to image bytes and sends them to the development server. A `Map<string, ArtworkReference>` removes duplicates, so Apple and Spotify deliverables that share exactly the same reference upload it once.

The development server's `MotionPreviewRenderer.ts` demonstrates the other side of the render interface. It looks at the requested `output.format` and delegates to `GifPreviewEncoder.ts` or `Mp4PreviewEncoder.ts`. It does not check for Apple or Spotify: those customer-configurable destination profiles already chose the format.

`PreviewFrameRenderer.ts` is the shared middle layer. Its `PreviewFrameRenderer` function type says that an effect accepts artwork, dimensions, time, speed, and intensity and asynchronously returns RGBA pixels. Its `createPreviewRenderPlan` function caps preview dimensions, frame rate, and duration in one place. Its async generator supplies every timestamp and verifies that each effect returned the right number of pixel bytes.

Drift and Water each supply only their effect-specific frame function. The GIF encoder turns those shared frames into palettes and delays; the MP4 encoder passes them to FFmpeg as H.264/YUV 4:2:0 video. Drift uses `getDriftFrame(timeSeconds)` to crop a moving image. Water uses `getWaterFrame(timeSeconds)` plus the same repeating displacement waveform as PixiJS to bend the registered artwork pixels. This is DRY without forcing unlike effect math or unlike file formats into one function.

`InMemoryArtworkStore.ts` keys temporary inputs by the durable reference; `LocalFileRenderService.ts` stores outputs temporarily and adds a typed preview artifact to the completed job. None of these development files is bundled into the browser application.

## 8. `src/model/AlbumMotionProject.ts`: define the saved recipe

```ts
export interface AlbumMotionProject {
  schemaVersion: 1;
  motionStyle: MotionStyleId;
  speed: number;
  intensity: number;
}
```

An `interface` is a contract for an object. It does not create a real object by itself. Instead, it lets TypeScript reject project data that is missing a required field or has the wrong kind of value.

```ts
export type MotionStyleId = 'drift' | 'water';
```

This is a union of string-literal types. A project may use exactly `'drift'` or `'water'`; a typo such as `'watre'` is rejected by TypeScript. We can add future effects to this union without accepting vague strings everywhere.

## 9. `src/PreviewCanvas.tsx`: connect React to PixiJS

```ts
const previewRef = useRef<PreviewEngine | null>(null);
```

`useRef` keeps a value between React renders without causing another render. Here, it stores the PixiJS engine. The `| null` is a union type: before the engine is created, the value is `null`; afterward it is a `PreviewEngine`.

```ts
useEffect(() => {
  const preview = new PreviewEngine(host);
  void preview.start(artwork);

  return () => preview.destroy();
}, [artwork]);
```

`useEffect` runs after React puts the component on the page. The returned function is cleanup: React calls it when the preview is removed or its artwork source changes. `void` here deliberately ignores the promise returned by the asynchronous `start()` method; errors are handled with `.catch(...)` in the real code.

## 10. `src/preview/PreviewEngine.ts`: draw, not interface

```ts
setMotionSettings(motionStyle: MotionStyleId, settings: DriftSettings): void {
  this.motionStyle = motionStyle;
  this.driftSettings = { ...settings };
  this.renderAt(this.playbackTimeSeconds);
}
```

This public method accepts a permitted effect ID plus a typed settings object and redraws the artwork. `: void` says that the method performs an action but does not return a result.

## 11. `DriftAnimation.ts` and `WaterAnimation.ts`: keep animation math pure

```ts
export function getDriftFrame(timeSeconds: number, settings: DriftSettings): DriftFrame
```

This function receives data and returns data. It does not read the DOM, call PixiJS, or change a global variable. That makes it predictable: the same time and settings always produce the same frame. A future server renderer can use the same idea.

`getWaterFrame` follows the same rule. It calculates ripple strength, texture-map offsets, and overscan from time, speed, and intensity. `PreviewEngine` turns those values into a PixiJS displacement filter, but the animation recipe itself remains testable without a browser.

## A small vocabulary

- `type`: names a kind of value.
- `interface`: describes an object’s required fields.
- `number`, `string`, `boolean`: basic value types.
- `A | B`: a union, meaning one of two allowed types.
- `Promise<void>`: an asynchronous operation that finishes without returning a value.
- `export`: makes a value or type available to another file.
- `import type`: imports only type information, not runtime code.
