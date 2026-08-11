import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HostBranding } from '../model/HostBranding';
import type { RenderJob } from './RenderJob';
import { RenderJobStatus } from './RenderJobStatus';
import type { RenderRequest } from './RenderRequest';

const branding: HostBranding = {
  hostName: 'CD Baby demo',
  productName: 'Motion Studio',
  accentColor: '#d3b9ff',
};

const request: RenderRequest = {
  schemaVersion: 1,
  launchId: 'checkout-123',
  deliverables: [
    {
      id: 'apple-album',
      target: { kind: 'apple-album', albumId: 'album-1' },
      title: 'Night Drive',
      artwork: { provider: 'cdbaby', assetKey: 'album-cover' },
      motion: { style: 'drift', speed: 1, intensity: 0.6, loopBehavior: 'loop' },
      destination: {
        profileId: 'apple-music-cover-art-v1',
        name: 'Apple Music cover art',
        aspectRatio: { width: 1, height: 1 },
      },
      output: { width: 4000, height: 4000, durationSeconds: 8, format: 'gif' },
    },
  ],
};

function createJob(status: RenderJob['status']): RenderJob {
  return {
    schemaVersion: 1,
    id: 'render-1',
    launchId: request.launchId,
    status,
    progress: { completed: status === 'completed' ? 1 : 0, total: 1 },
    outputs: status === 'completed'
      ? [{ deliverableId: 'apple-album', fileName: 'night-drive.gif' }]
      : [],
    failure: status === 'failed'
      ? { code: 'DEMO_RENDER_FAILED', message: 'The demo renderer could not finish this job.', retryable: true }
      : null,
    submittedAt: '2026-08-04T12:00:00.000Z',
    updatedAt: '2026-08-04T12:00:00.000Z',
  };
}

describe('RenderJobStatus', () => {
  it.each([
    ['submitted', 'Render queued'],
    ['processing', 'Creating your motion'],
    ['completed', 'Your motion is ready'],
    ['failed', 'We couldn’t finish this render'],
  ] as const)('explains the %s state to the artist', (status, heading) => {
    const html = renderToStaticMarkup(
      <RenderJobStatus
        branding={branding}
        job={createJob(status)}
        request={request}
        onEdit={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain(heading);
    expect(html).toContain('Night Drive');
  });

  it('shows a completed output name and retryable failure actions', () => {
    const completedHtml = renderToStaticMarkup(
      <RenderJobStatus
        branding={branding}
        job={createJob('completed')}
        request={request}
        onEdit={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const failedHtml = renderToStaticMarkup(
      <RenderJobStatus
        branding={branding}
        job={createJob('failed')}
        request={request}
        onEdit={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(completedHtml).toContain('night-drive.gif');
    expect(failedHtml).toContain('Try render again');
    expect(failedHtml).toContain('Edit motion');
  });

  it('shows a temporary connection problem while polling can retry', () => {
    const html = renderToStaticMarkup(
      <RenderJobStatus
        branding={branding}
        job={createJob('processing')}
        request={request}
        statusMessage="The render status could not be refreshed. Retrying…"
        onEdit={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain('The render status could not be refreshed. Retrying…');
  });

  it('offers a completed preview artifact for download without calling it a final master', () => {
    const completed = createJob('completed');
    completed.outputs = [{
      deliverableId: 'apple-album',
      fileName: 'night-drive-preview.gif',
      artifact: {
        kind: 'preview',
        contentType: 'image/gif',
        downloadUrl: '/api/company-tbd/render-files/render-1/night-drive-preview.gif',
        width: 320,
        height: 320,
        frameCount: 16,
      },
    }];

    const html = renderToStaticMarkup(
      <RenderJobStatus
        branding={branding}
        job={completed}
        request={request}
        onEdit={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain('Download GIF preview');
    expect(html).toContain('320 × 320px · 16 frames');
    expect(html).toContain('/api/company-tbd/render-files/render-1/night-drive-preview.gif');
    expect(html).toContain('Proof-of-concept preview · host-provided artwork');
  });
});
