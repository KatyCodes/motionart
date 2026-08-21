import {
  cloneRenderJob,
  completeRenderJob,
  createSubmittedRenderJob,
  failRenderJob,
  startRenderJob,
} from '../../src/render/RenderJob';
import { validateRenderRequest, type RenderDeliverable } from '../../src/render/RenderRequest';
import type { RenderService } from '../../src/render/RenderService';
import { createInMemoryRenderArtifactStore } from './InMemoryRenderArtifactStore';
import { createInMemoryRenderJobRepository } from './InMemoryRenderJobRepository';
import type { RenderArtifactReader, RenderArtifactStore, RenderedArtifact } from './RenderArtifact';
import type { RenderJobRepository } from './RenderJobRepository';

export interface LocalFileRenderServiceOptions {
  apiBaseUrl: string;
  renderDeliverable: (deliverable: RenderDeliverable) => Promise<RenderedArtifact>;
  artifactStore?: RenderArtifactStore;
  jobRepository?: RenderJobRepository;
  createJobId?: () => string;
  now?: () => string;
}

export interface LocalFileRenderService extends RenderService, RenderArtifactReader {}

export function createLocalFileRenderService({
  apiBaseUrl,
  renderDeliverable,
  artifactStore: artifactStoreOverride,
  jobRepository: jobRepositoryOverride,
  createJobId: createJobIdOverride,
  now: nowOverride,
}: LocalFileRenderServiceOptions): LocalFileRenderService {
  const artifactStore = artifactStoreOverride ?? createInMemoryRenderArtifactStore();
  const jobRepository = jobRepositoryOverride ?? createInMemoryRenderJobRepository();
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  let nextJobNumber = 1;
  const createJobId = createJobIdOverride ?? (() => `local-render-${nextJobNumber++}`);
  const now = nowOverride ?? (() => new Date().toISOString());

  return {
    async submit(request) {
      validateRenderRequest(request);
      const job = createSubmittedRenderJob(request, createJobId(), now());
      await jobRepository.create({ job, request });
      return cloneRenderJob(job);
    },

    async get(jobId) {
      const stored = await jobRepository.find(jobId);
      if (!stored) throw new Error(`Unknown render job: ${jobId}`);
      let changed = false;

      if (stored.job.status === 'submitted') {
        stored.job = startRenderJob(stored.job, now());
        changed = true;
      } else if (stored.job.status === 'processing') {
        changed = true;
        try {
          const renderedArtifacts = await Promise.all(
            stored.request.deliverables.map(renderDeliverable),
          );
          await Promise.all(
            renderedArtifacts.map((artifact) => artifactStore.put(jobId, artifact)),
          );

          const completed = completeRenderJob(stored.job, stored.request, now());
          stored.job = {
            ...completed,
            outputs: completed.outputs.map((output) => {
              const artifact = renderedArtifacts.find(
                (candidate) => candidate.deliverableId === output.deliverableId,
              );
              if (!artifact) throw new Error(`Missing rendered artifact: ${output.deliverableId}`);

              return {
                deliverableId: output.deliverableId,
                fileName: artifact.fileName,
                artifact: {
                  kind: 'preview',
                  contentType: artifact.contentType,
                  downloadUrl: `${baseUrl}/render-files/${encodeURIComponent(jobId)}/${encodeURIComponent(artifact.fileName)}`,
                  width: artifact.width,
                  height: artifact.height,
                  frameCount: artifact.frameCount,
                },
              };
            }),
          };
        } catch (error) {
          stored.job = failRenderJob(
            stored.job,
            {
              code: 'LOCAL_PREVIEW_RENDER_FAILED',
              message: error instanceof Error ? error.message : 'The local preview render failed.',
              retryable: false,
            },
            now(),
          );
        }
      }

      if (changed) await jobRepository.update(stored);
      return cloneRenderJob(stored.job);
    },

    getArtifact(jobId, fileName) {
      return artifactStore.getArtifact(jobId, fileName);
    },
  };
}
