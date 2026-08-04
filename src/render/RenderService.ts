import {
  completeRenderJob,
  createSubmittedRenderJob,
  failRenderJob,
  startRenderJob,
  type RenderJob,
} from './RenderJob';
import { validateRenderRequest, type RenderRequest } from './RenderRequest';

export interface RenderService {
  submit(request: RenderRequest, options?: RenderServiceRequestOptions): Promise<RenderJob>;
  get(jobId: string, options?: RenderServiceRequestOptions): Promise<RenderJob>;
}

export interface RenderServiceRequestOptions {
  signal?: AbortSignal;
}

export interface FakeRenderServiceOptions {
  createJobId?: () => string;
  now?: () => string;
  finalStatus?: 'completed' | 'failed';
}

interface StoredRenderJob {
  job: RenderJob;
  request: RenderRequest;
}

const demoFailure = {
  code: 'DEMO_RENDER_FAILED',
  message: 'The demo renderer could not finish this job.',
  retryable: true,
} as const;

export function createFakeRenderService(
  options: FakeRenderServiceOptions = {},
): RenderService {
  const jobs = new Map<string, StoredRenderJob>();
  let nextJobNumber = 1;
  const createJobId = options.createJobId ?? (() => `demo-render-${nextJobNumber++}`);
  const now = options.now ?? (() => new Date().toISOString());
  const finalStatus = options.finalStatus ?? 'completed';

  return {
    async submit(request) {
      validateRenderRequest(request);
      const job = createSubmittedRenderJob(request, createJobId(), now());

      if (jobs.has(job.id)) {
        throw new Error(`Render job already exists: ${job.id}`);
      }

      jobs.set(job.id, { job, request });
      return cloneRenderJob(job);
    },

    async get(jobId) {
      const stored = jobs.get(jobId);

      if (!stored) throw new Error(`Unknown render job: ${jobId}`);

      if (stored.job.status === 'submitted') {
        stored.job = startRenderJob(stored.job, now());
      } else if (stored.job.status === 'processing') {
        stored.job = finalStatus === 'completed'
          ? completeRenderJob(stored.job, stored.request, now())
          : failRenderJob(stored.job, demoFailure, now());
      }

      return cloneRenderJob(stored.job);
    },
  };
}

function cloneRenderJob(job: RenderJob): RenderJob {
  return {
    ...job,
    progress: { ...job.progress },
    outputs: job.outputs.map((output) => ({ ...output })),
    failure: job.failure ? { ...job.failure } : null,
  };
}
