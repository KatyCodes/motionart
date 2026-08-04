import type { CSSProperties } from 'react';
import {
  EditorWindowControls,
  type EditorWindowActions,
} from '../editor/EditorWindowControls';
import type { HostBranding } from '../model/HostBranding';
import type { RenderJob, RenderJobState } from './RenderJob';
import type { RenderRequest } from './RenderRequest';

export interface RenderJobStatusProps {
  branding: HostBranding;
  job: RenderJob;
  request: RenderRequest;
  windowActions?: EditorWindowActions;
  onEdit: () => void;
  onRetry: () => void;
}

const statusCopy: Record<RenderJobState, { eyebrow: string; heading: string; detail: string }> = {
  submitted: {
    eyebrow: 'Checkout accepted',
    heading: 'Render queued',
    detail: 'Your motion settings are safely submitted and waiting for a renderer.',
  },
  processing: {
    eyebrow: 'Render in progress',
    heading: 'Creating your motion',
    detail: 'We are applying your effect and preparing each destination-ready file.',
  },
  completed: {
    eyebrow: 'Render complete',
    heading: 'Your motion is ready',
    detail: 'Every selected deliverable finished successfully.',
  },
  failed: {
    eyebrow: 'Render needs attention',
    heading: 'We couldn’t finish this render',
    detail: 'Your project and settings are still safe. You can retry or return to the editor.',
  },
};

export function RenderJobStatus({
  branding,
  job,
  request,
  windowActions,
  onEdit,
  onRetry,
}: RenderJobStatusProps) {
  const copy = statusCopy[job.status];

  return (
    <main
      className={`render-job-shell is-${job.status}`}
      style={{ '--host-accent': branding.accentColor } as CSSProperties}
    >
      {windowActions ? <EditorWindowControls {...windowActions} /> : null}

      <section className="render-job-status" aria-live="polite">
        <div className="render-job-state-mark" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">{branding.hostName} · {copy.eyebrow}</p>
        <h1>{copy.heading}</h1>
        <p>{copy.detail}</p>

        <div className="render-job-progress">
          <div className="render-job-progress-heading">
            <span>Job {job.id}</span>
            <strong>{formatProgress(job)}</strong>
          </div>
          <progress
            aria-label="Render progress"
            max={job.progress.total}
            value={job.progress.completed}
          />
        </div>

        <ul className="render-job-deliverables">
          {request.deliverables.map((deliverable) => {
            const output = job.outputs.find((candidate) => (
              candidate.deliverableId === deliverable.id
            ));

            return (
              <li key={deliverable.id}>
                <div className="render-job-deliverable-copy">
                  <strong>{deliverable.title}</strong>
                  <span>{deliverable.destination.name}</span>
                </div>
                <span className="render-job-deliverable-state">
                  {output?.fileName ?? formatDeliverableStatus(job.status)}
                </span>
              </li>
            );
          })}
        </ul>

        {job.failure ? (
          <p className="render-job-failure">{job.failure.message}</p>
        ) : null}

        {job.status === 'completed' || job.status === 'failed' ? (
          <div className="render-job-actions">
            <button className="secondary-button" type="button" onClick={onEdit}>
              {job.status === 'completed' ? 'Back to editor' : 'Edit motion'}
            </button>
            {job.status === 'failed' && job.failure?.retryable ? (
              <button className="primary-button" type="button" onClick={onRetry}>
                Try render again
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function formatProgress(job: RenderJob): string {
  if (job.status === 'submitted') return 'Waiting';
  if (job.status === 'processing') return 'Processing';
  if (job.status === 'failed') return 'Stopped';
  return `${job.progress.completed} of ${job.progress.total} complete`;
}

function formatDeliverableStatus(status: RenderJobState): string {
  if (status === 'submitted') return 'Queued';
  if (status === 'processing') return 'Rendering';
  if (status === 'failed') return 'Not completed';
  return 'Complete';
}
