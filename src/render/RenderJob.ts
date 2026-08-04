import type { RenderRequest } from './RenderRequest';

export type RenderJobState = 'submitted' | 'processing' | 'completed' | 'failed';

export interface RenderJobOutput {
  deliverableId: string;
  fileName: string;
}

export interface RenderJobFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RenderJob {
  schemaVersion: 1;
  id: string;
  launchId: string;
  status: RenderJobState;
  progress: {
    completed: number;
    total: number;
  };
  outputs: RenderJobOutput[];
  failure: RenderJobFailure | null;
  submittedAt: string;
  updatedAt: string;
}

export function createSubmittedRenderJob(
  request: RenderRequest,
  jobId: string,
  timestamp: string,
): RenderJob {
  return {
    schemaVersion: 1,
    id: jobId,
    launchId: request.launchId,
    status: 'submitted',
    progress: { completed: 0, total: request.deliverables.length },
    outputs: [],
    failure: null,
    submittedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function startRenderJob(job: RenderJob, timestamp: string): RenderJob {
  requireStatus(job, 'submitted');

  return {
    ...job,
    status: 'processing',
    updatedAt: timestamp,
  };
}

export function completeRenderJob(
  job: RenderJob,
  request: RenderRequest,
  timestamp: string,
): RenderJob {
  requireStatus(job, 'processing');

  return {
    ...job,
    status: 'completed',
    progress: { completed: request.deliverables.length, total: request.deliverables.length },
    outputs: createOutputs(request),
    updatedAt: timestamp,
  };
}

export function failRenderJob(
  job: RenderJob,
  failure: RenderJobFailure,
  timestamp: string,
): RenderJob {
  requireStatus(job, 'processing');

  return {
    ...job,
    status: 'failed',
    failure: { ...failure },
    updatedAt: timestamp,
  };
}

export function isRenderJobTerminal(job: RenderJob): boolean {
  return job.status === 'completed' || job.status === 'failed';
}

function createOutputs(request: RenderRequest): RenderJobOutput[] {
  const fileNameCounts = new Map<string, number>();

  return request.deliverables.map((deliverable) => {
    const baseName = slugify(deliverable.title) || 'motion-artwork';
    const count = (fileNameCounts.get(baseName) ?? 0) + 1;
    fileNameCounts.set(baseName, count);

    return {
      deliverableId: deliverable.id,
      fileName: `${baseName}${count > 1 ? `-${count}` : ''}.${deliverable.output.format}`,
    };
  });
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function requireStatus(job: RenderJob, expected: RenderJobState): void {
  if (job.status !== expected) {
    throw new Error(`Cannot transition render job ${job.id} from ${job.status}; expected ${expected}.`);
  }
}
