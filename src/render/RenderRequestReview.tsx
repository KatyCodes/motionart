import type { CSSProperties } from 'react';
import {
  EditorWindowControls,
  type EditorWindowActions,
} from '../editor/EditorWindowControls';
import type { HostBranding } from '../model/HostBranding';
import { validateRenderRequest, type RenderDeliverable, type RenderRequest } from './RenderRequest';

export interface RenderRequestReviewProps {
  branding: HostBranding;
  request: RenderRequest;
  windowActions?: EditorWindowActions;
  statusMessage?: string | null;
  onEdit: () => void;
  onConfirm: (request: RenderRequest) => void;
}

export function RenderRequestReview({
  branding,
  request,
  windowActions,
  statusMessage,
  onEdit,
  onConfirm,
}: RenderRequestReviewProps) {
  validateRenderRequest(request);

  return (
    <main
      className="render-review-shell"
      style={{ '--host-accent': branding.accentColor } as CSSProperties}
    >
      {windowActions ? <EditorWindowControls {...windowActions} /> : null}

      <header className="render-review-heading">
        <p className="eyebrow">{branding.hostName} · final check</p>
        <h1>Review your deliverables</h1>
        <p>
          Confirm the motion and output details before {branding.hostName} continues to checkout.
        </p>
      </header>

      <section className="render-review-list" aria-label="Deliverables ready for checkout">
        {request.deliverables.map((deliverable) => (
          <RenderDeliverableCard deliverable={deliverable} key={deliverable.id} />
        ))}
      </section>

      <footer className="render-review-footer">
        <p>
          <strong>{request.deliverables.length}</strong> deliverable{request.deliverables.length === 1 ? '' : 's'} ready
        </p>
        <div className="render-review-actions">
          <button className="secondary-button" type="button" onClick={onEdit}>
            Edit motion
          </button>
          <button className="primary-button" type="button" onClick={() => onConfirm(request)}>
            Continue to checkout
          </button>
        </div>
        {statusMessage ? <output className="render-review-status">{statusMessage}</output> : null}
      </footer>
    </main>
  );
}

function RenderDeliverableCard({ deliverable }: { deliverable: RenderDeliverable }) {
  return (
    <article className="render-review-card">
      <div className="render-review-card-heading">
        <span>{formatTarget(deliverable)}</span>
        <h2>{deliverable.title}</h2>
        <p>{deliverable.destination.name}</p>
      </div>
      <dl>
        <div>
          <dt>Effect</dt>
          <dd>{formatMotionStyle(deliverable.motion.style)}</dd>
        </div>
        <div>
          <dt>Motion</dt>
          <dd>{deliverable.motion.speed.toFixed(2)}× speed · {deliverable.motion.intensity.toFixed(2)}× intensity</dd>
        </div>
        <div>
          <dt>Frame</dt>
          <dd>{deliverable.output.width} × {deliverable.output.height}px · {deliverable.destination.aspectRatio.width}:{deliverable.destination.aspectRatio.height}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{deliverable.output.durationSeconds} seconds · {deliverable.output.format.toUpperCase()}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatTarget(deliverable: RenderDeliverable): string {
  return deliverable.target.kind === 'apple-album' ? 'Apple Music · album' : 'Spotify · track';
}

function formatMotionStyle(style: string): string {
  return `${style.slice(0, 1).toUpperCase()}${style.slice(1)}`;
}
