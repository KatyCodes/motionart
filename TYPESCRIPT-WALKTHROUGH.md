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

## 2. `src/App.tsx`: describe the editor

```ts
const [project, setProject] = useState<AlbumMotionProject>(sampleProject);
```

`useState` stores information that can change while the page is open. `project` is the current project recipe. `setProject` replaces it with an updated recipe. `<AlbumMotionProject>` is a type argument: it tells TypeScript exactly what shape of data is allowed.

```ts
function updateProject(changes: Partial<Pick<AlbumMotionProject, 'speed' | 'intensity'>>) {
  setProject((current) => ({ ...current, ...changes }));
}
```

`Pick` selects only `speed` and `intensity` from the larger project type. `Partial` makes those selected fields optional, so the function can update one control at a time. `...current` copies the old project; `...changes` overwrites only the supplied fields.

## 3. `src/model/AlbumMotionProject.ts`: define the saved recipe

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
export type MotionStyleId = 'drift';
```

This is a string-literal type. For now, the only permitted motion style is exactly `'drift'`. Later we can expand it to `'drift' | 'pulse' | 'dream'` without using vague strings everywhere.

## 4. `src/PreviewCanvas.tsx`: connect React to PixiJS

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

## 5. `src/preview/PreviewEngine.ts`: draw, not interface

```ts
setDriftSettings(settings: DriftSettings): void {
  this.driftSettings = { ...settings };
  this.renderAt(this.playbackTimeSeconds);
}
```

This public method accepts a typed settings object and redraws the artwork. `: void` says that the method performs an action but does not return a result.

## 6. `src/preview/DriftAnimation.ts`: keep animation math pure

```ts
export function getDriftFrame(timeSeconds: number, settings: DriftSettings): DriftFrame
```

This function receives data and returns data. It does not read the DOM, call PixiJS, or change a global variable. That makes it predictable: the same time and settings always produce the same frame. A future server renderer can use the same idea.

## A small vocabulary

- `type`: names a kind of value.
- `interface`: describes an object’s required fields.
- `number`, `string`, `boolean`: basic value types.
- `A | B`: a union, meaning one of two allowed types.
- `Promise<void>`: an asynchronous operation that finishes without returning a value.
- `export`: makes a value or type available to another file.
- `import type`: imports only type information, not runtime code.
