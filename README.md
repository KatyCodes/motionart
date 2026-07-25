# Album Motion proof of concept

A minimal browser animation experiment using TypeScript, Vite, and PixiJS. It loads one square artwork asset, center-crops it, and applies a slow zoom with subtle horizontal and vertical drift.

The preview engine accepts artwork without assuming where it is stored. A host can provide a CORS-enabled URL (including a signed S3/CDN URL), a `Blob`/`File`, or a loader function that uses the host's own authentication. Durable customer asset identifiers remain separate from temporary preview sources.

Animation state is calculated from an explicit timestamp through `renderAt(timeSeconds)`, so the same time and project settings can later produce the same frame in both the browser preview and server renderer.

## Run locally

Requires Node.js 20.19+ or 22.12+.

For first-time Mac setup and an explanation of the development environment, see [DEVELOPMENT.md](./DEVELOPMENT.md).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
```
