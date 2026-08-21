export interface RenderedArtifact {
  deliverableId: string;
  fileName: string;
  contentType: string;
  width: number;
  height: number;
  frameCount: number;
  bytes: Uint8Array;
}

export interface RenderArtifactReader {
  getArtifact(jobId: string, fileName: string): Promise<RenderedArtifact | undefined>;
}

export interface RenderArtifactStore extends RenderArtifactReader {
  put(jobId: string, artifact: RenderedArtifact): Promise<void>;
}
