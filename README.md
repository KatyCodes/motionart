# Album Motion proof of concept

A minimal browser animation experiment using TypeScript, Vite, and PixiJS. It loads one square artwork asset, center-crops it, and applies a slow zoom with subtle horizontal and vertical drift.

The preview engine accepts artwork without assuming where it is stored. A host can provide a CORS-enabled URL (including a signed S3/CDN URL), a `Blob`/`File`, or a loader function that uses the host's own authentication. Durable customer asset identifiers remain separate from temporary preview sources.

Animation state is calculated from an explicit timestamp through `renderAt(timeSeconds)`, so the same time and project settings can later produce the same frame in both the browser preview and server renderer.

## Embed contract

The demo page is a small example host. The reusable editor receives all customer-owned data through props and reports changes through callbacks:

```tsx
<AlbumMotionEditor
  branding={customerBranding}
  artwork={artworkSource}
  project={project}
  release={release}
  destinationProfiles={customerProfiles}
  onProjectChange={saveProjectDraft}
  onReleaseChange={saveReleaseDraft}
  onContinue={startCustomerCheckout}
/>
```

The host owns catalog data, artwork access, persistence, branding, and checkout. The editor owns motion controls, preview rendering, destination validation, and the structured purchase handoff.

## Run locally

Requires Node.js 20.19+ or 22.12+.

For first-time Mac setup and an explanation of the development environment, see [DEVELOPMENT.md](./DEVELOPMENT.md).

For an explanation of the TypeScript and React files in this proof of concept, see [TYPESCRIPT-WALKTHROUGH.md](./TYPESCRIPT-WALKTHROUGH.md).

For the testing workflow and engineering practices, see [ENGINEERING.md](./ENGINEERING.md).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
```
