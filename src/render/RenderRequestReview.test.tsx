import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HostBranding } from '../model/HostBranding';
import type { RenderRequest } from './RenderRequest';
import { RenderRequestReview } from './RenderRequestReview';

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
      id: 'spotify-track:track-1',
      target: { kind: 'spotify-track', trackId: 'track-1' },
      title: 'Signal',
      artwork: { provider: 'cdbaby', assetKey: 'signal-cover' },
      motion: { style: 'water', speed: 1.25, intensity: 0.8, loopBehavior: 'loop' },
      destination: {
        profileId: 'spotify-canvas-v1',
        name: 'Spotify Canvas',
        aspectRatio: { width: 9, height: 16 },
      },
      output: { width: 540, height: 960, durationSeconds: 8, format: 'mp4' },
    },
  ],
};

describe('RenderRequestReview', () => {
  it('shows the artist exactly what will be sent to checkout', () => {
    const html = renderToStaticMarkup(
      <RenderRequestReview
        branding={branding}
        request={request}
        onEdit={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toContain('Review your deliverables');
    expect(html).toContain('Signal');
    expect(html).toContain('Spotify Canvas');
    expect(html).toContain('540 × 960px');
    expect(html).toContain('8 seconds');
    expect(html).toContain('MP4');
    expect(html).toContain('Edit motion');
    expect(html).toContain('Continue to checkout');
  });
});
