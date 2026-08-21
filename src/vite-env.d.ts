/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RENDER_SERVICE_MODE?: 'fake' | 'http';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
