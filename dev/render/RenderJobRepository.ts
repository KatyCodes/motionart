import type { RenderJob } from '../../src/render/RenderJob';
import type { RenderRequest } from '../../src/render/RenderRequest';

export interface NewStoredRenderJob {
  job: RenderJob;
  request: RenderRequest;
}

export interface StoredRenderJob extends NewStoredRenderJob {
  revision: number;
}

export interface RenderJobRepository {
  create(storedJob: NewStoredRenderJob): Promise<StoredRenderJob>;
  update(storedJob: StoredRenderJob): Promise<StoredRenderJob>;
  find(jobId: string): Promise<StoredRenderJob | undefined>;
}

export class RenderJobAlreadyExistsError extends Error {
  constructor(jobId: string) {
    super(`Render job already exists: ${jobId}`);
    this.name = 'RenderJobAlreadyExistsError';
  }
}

export class RenderJobRevisionConflictError extends Error {
  constructor(jobId: string) {
    super(`Render job revision conflict: ${jobId}`);
    this.name = 'RenderJobRevisionConflictError';
  }
}
