import type { RenderRequest } from './RenderRequest';

export type RenderJobState = 'submitted' | 'processing' | 'completed' | 'failed';

export interface RenderJobOutput {
  deliverableId: string;
  fileName: string;
  artifact?: RenderJobArtifact;
}

export interface RenderJobArtifact {
  kind: 'preview' | 'deliverable';
  contentType: string;
  downloadUrl: string;
  width: number;
  height: number;
  frameCount: number;
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

export function cloneRenderJob(job: RenderJob): RenderJob {
  return {
    ...job,
    progress: { ...job.progress },
    outputs: job.outputs.map((output) => ({
      ...output,
      artifact: output.artifact ? { ...output.artifact } : undefined,
    })),
    failure: job.failure ? { ...job.failure } : null,
  };
}

export function validateRenderJob(value: unknown): asserts value is RenderJob {
  const job = requireRecord(value, 'Render job');

  if (job.schemaVersion !== 1) {
    throw new RangeError('Unsupported render job schema version.');
  }

  requireText(job.id, 'job ID');
  requireText(job.launchId, 'launch ID');
  requireText(job.submittedAt, 'submitted timestamp');
  requireText(job.updatedAt, 'updated timestamp');

  if (!isRenderJobState(job.status)) {
    throw new RangeError('Render job has an unsupported status.');
  }

  const progress = requireRecord(job.progress, 'Render job progress');
  requireNonNegativeInteger(progress.completed, 'completed progress');
  requirePositiveInteger(progress.total, 'total progress');

  if (progress.completed > progress.total) {
    throw new RangeError('Render job completed progress cannot exceed its total.');
  }

  if (!Array.isArray(job.outputs)) {
    throw new TypeError('Render job outputs must be an array.');
  }

  const outputIds = new Set<string>();
  for (const value of job.outputs) {
    const output = requireRecord(value, 'Render job output');
    requireText(output.deliverableId, 'output deliverable ID');
    requireText(output.fileName, 'output file name');

    if (output.artifact !== undefined) {
      const artifact = requireRecord(output.artifact, 'Render job artifact');
      if (artifact.kind !== 'preview' && artifact.kind !== 'deliverable') {
        throw new RangeError('Render job artifact has an unsupported kind.');
      }
      requireText(artifact.contentType, 'artifact content type');
      requireText(artifact.downloadUrl, 'artifact download URL');
      requirePositiveInteger(artifact.width, 'artifact width');
      requirePositiveInteger(artifact.height, 'artifact height');
      requirePositiveInteger(artifact.frameCount, 'artifact frame count');
    }

    const deliverableId = output.deliverableId as string;
    if (outputIds.has(deliverableId)) {
      throw new RangeError(`Render job has a duplicate output: ${deliverableId}`);
    }

    outputIds.add(deliverableId);
  }

  if (job.failure !== null) {
    const failure = requireRecord(job.failure, 'Render job failure');
    requireText(failure.code, 'failure code');
    requireText(failure.message, 'failure message');

    if (typeof failure.retryable !== 'boolean') {
      throw new TypeError('Render job failure retryable must be a boolean.');
    }
  }

  validateStateShape(
    job.status,
    progress.completed as number,
    progress.total as number,
    job.outputs.length,
    job.failure,
  );
}

function createOutputs(request: RenderRequest): RenderJobOutput[] {
  const fileNameCounts = new Map<string, number>();

  return request.deliverables.map((deliverable) => {
    const baseName = slugify(deliverable.title) || 'motion-artwork';
    const count = (fileNameCounts.get(baseName) ?? 0) + 1;
    fileNameCounts.set(baseName, count);

    return {
      deliverableId: deliverable.id,
      fileName: createRenderOutputFileName(
        deliverable.title,
        deliverable.output.format,
        count > 1 ? String(count) : undefined,
      ),
    };
  });
}

export function createRenderOutputFileName(
  title: string,
  format: string,
  suffix?: string,
): string {
  const baseName = slugify(title) || 'motion-artwork';
  return `${baseName}${suffix ? `-${slugify(suffix)}` : ''}.${format.toLowerCase()}`;
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

function validateStateShape(
  status: RenderJobState,
  completed: number,
  total: number,
  outputCount: number,
  failure: unknown,
): void {
  if (status === 'completed') {
    if (completed !== total || outputCount !== total || failure !== null) {
      throw new RangeError('A completed render job must contain every output and no failure.');
    }
    return;
  }

  if (status === 'failed') {
    if (failure === null) {
      throw new RangeError('A failed render job requires failure details.');
    }
    return;
  }

  if (outputCount !== 0 || failure !== null) {
    throw new RangeError('An active render job cannot contain outputs or failure details.');
  }

  if (status === 'submitted' && completed !== 0) {
    throw new RangeError('A submitted render job cannot have completed progress.');
  }
}

function isRenderJobState(value: unknown): value is RenderJobState {
  return value === 'submitted'
    || value === 'processing'
    || value === 'completed'
    || value === 'failed';
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RangeError(`Render job requires a ${label}.`);
  }
}

function requireNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new RangeError(`Render job ${label} must be a non-negative integer.`);
  }
}

function requirePositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new RangeError(`Render job ${label} must be a positive integer.`);
  }
}
