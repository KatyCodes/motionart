import {
  cloneRenderJob,
  completeRenderJob,
  createSubmittedRenderJob,
  failRenderJob,
  startRenderJob,
  type RenderJob,
} from '../../src/render/RenderJob';
import { validateRenderRequest, type RenderDeliverable, type RenderRequest } from '../../src/render/RenderRequest';
import type { RenderService } from '../../src/render/RenderService';
import type { RenderArtifactReader, RenderedArtifact } from './RenderArtifact';

export interface LocalFileRenderServiceOptions {
  apiBaseUrl: string;
  renderDeliverable: (deliverable: RenderDeliverable) => Promise<RenderedArtifact>;
  createJobId?: () => string;
  now?: () => string;
}

export interface LocalFileRenderService extends RenderService, RenderArtifactReader {}

interface StoredJob {
  job: RenderJob;
  request: RenderRequest;
}

export function createLocalFileRenderService({
  apiBaseUrl,
  renderDeliverable,
  createJobId: createJobIdOverride,
  now: nowOverride,
}: LocalFileRenderServiceOptions): LocalFileRenderService {
  const jobs = new Map<string, StoredJob>();
  const artifacts = new Map<string, RenderedArtifact>();
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  let nextJobNumber = 1;
  const createJobId = createJobIdOverride ?? (() => `local-render-${nextJobNumber++}`);
  const now = nowOverride ?? (() => new Date().toISOString());

  return {
    async submit(request) {
      validateRenderRequest(request);
      const job = createSubmittedRenderJob(request, createJobId(), now());
      jobs.set(job.id, { job, request });
      return cloneRenderJob(job);
    },

    async get(jobId) {
      const stored = jobs.get(jobId);
      if (!stored) throw new Error(`Unknown render job: ${jobId}`);

      if (stored.job.status === 'submitted') {
        stored.job = startRenderJob(stored.job, now());
      } else if (stored.job.status === 'processing') {
        try {
          const renderedArtifacts = await Promise.all(
            stored.request.deliverables.map(renderDeliverable),
          );
          for (const artifact of renderedArtifacts) {
            artifacts.set(getArtifactKey(jobId, artifact.fileName), artifact);
          }

          const completed = completeRenderJob(stored.job, stored.request, now());
          stored.job = {
            ...completed,
            outputs: completed.outputs.map((output) => {
              const artifact = renderedArtifacts.find((candidate) => (
                candidate.deliverableId === output.deliverableId
              ));
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
          stored.job = failRenderJob(stored.job, {
            code: 'LOCAL_PREVIEW_RENDER_FAILED',
            message: error instanceof Error ? error.message : 'The local preview render failed.',
            retryable: false,
          }, now());
        }
      }

      return cloneRenderJob(stored.job);
    },

    getArtifact(jobId, fileName) {
      return artifacts.get(getArtifactKey(jobId, fileName));
    },
  };
}

function getArtifactKey(jobId: string, fileName: string): string {
  return `${jobId}\0${fileName}`;
}
