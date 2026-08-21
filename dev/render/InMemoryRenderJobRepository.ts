import {
  RenderJobAlreadyExistsError,
  RenderJobRevisionConflictError,
  type RenderJobRepository,
  type StoredRenderJob,
} from './RenderJobRepository';

export function createInMemoryRenderJobRepository(): RenderJobRepository {
  const jobs = new Map<string, StoredRenderJob>();

  return {
    async create(newStoredJob) {
      const jobId = newStoredJob.job.id;
      if (jobs.has(jobId)) throw new RenderJobAlreadyExistsError(jobId);

      const storedJob = { ...structuredClone(newStoredJob), revision: 0 };
      jobs.set(jobId, storedJob);
      return structuredClone(storedJob);
    },

    async update(storedJob) {
      const jobId = storedJob.job.id;
      const current = jobs.get(jobId);
      if (!current || current.revision !== storedJob.revision) {
        throw new RenderJobRevisionConflictError(jobId);
      }

      const updated = { ...structuredClone(storedJob), revision: storedJob.revision + 1 };
      jobs.set(jobId, updated);
      return structuredClone(updated);
    },

    async find(jobId) {
      const storedJob = jobs.get(jobId);
      return storedJob ? structuredClone(storedJob) : undefined;
    },
  };
}
