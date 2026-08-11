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
  getArtifact(jobId: string, fileName: string): RenderedArtifact | undefined;
}
