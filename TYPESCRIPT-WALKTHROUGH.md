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

## 4. `src/model/AlbumMotionProject.ts`: define the saved recipe

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

## 5. `src/PreviewCanvas.tsx`: connect React to PixiJS

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

## 6. `src/preview/PreviewEngine.ts`: draw, not interface

```ts
setMotionSettings(motionStyle: MotionStyleId, settings: DriftSettings): void {
  this.motionStyle = motionStyle;
  this.driftSettings = { ...settings };
  this.renderAt(this.playbackTimeSeconds);
}
```

This public method accepts a permitted effect ID plus a typed settings object and redraws the artwork. `: void` says that the method performs an action but does not return a result.

## 7. `DriftAnimation.ts` and `WaterAnimation.ts`: keep animation math pure

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
