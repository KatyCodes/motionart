import type { RenderArtifactStore, RenderedArtifact } from './RenderArtifact';

export function createInMemoryRenderArtifactStore(): RenderArtifactStore {
  const artifacts = new Map<string, RenderedArtifact>();

  return {
    async put(jobId, artifact) {
      artifacts.set(createArtifactKey(jobId, artifact.fileName), cloneArtifact(artifact));
    },

    async getArtifact(jobId, fileName) {
      const artifact = artifacts.get(createArtifactKey(jobId, fileName));
      return artifact ? cloneArtifact(artifact) : undefined;
    },
  };
}

function createArtifactKey(jobId: string, fileName: string): string {
  return `${jobId}\0${fileName}`;
}

function cloneArtifact(artifact: RenderedArtifact): RenderedArtifact {
  return {
    ...artifact,
    bytes: artifact.bytes.slice(),
  };
}
