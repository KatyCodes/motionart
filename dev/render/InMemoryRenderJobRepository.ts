import type { RenderJobRepository, StoredRenderJob } from './RenderJobRepository';

export function createInMemoryRenderJobRepository(): RenderJobRepository {
  const jobs = new Map<string, StoredRenderJob>();

  return {
    async save(storedJob) {
      jobs.set(storedJob.job.id, structuredClone(storedJob));
    },

    async find(jobId) {
      const storedJob = jobs.get(jobId);
      return storedJob ? structuredClone(storedJob) : undefined;
    },
  };
}
