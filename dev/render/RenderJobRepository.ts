import type { RenderJob } from '../../src/render/RenderJob';
import type { RenderRequest } from '../../src/render/RenderRequest';

export interface StoredRenderJob {
  job: RenderJob;
  request: RenderRequest;
}

export interface RenderJobRepository {
  save(storedJob: StoredRenderJob): Promise<void>;
  find(jobId: string): Promise<StoredRenderJob | undefined>;
}
