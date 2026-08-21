import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderDriftGifPreview } from './DriftGifRenderer';
import type { GifPreviewOptions } from './GifPreviewEncoder';
import type { RenderedArtifact } from './RenderArtifact';
import { renderWaterGifPreview } from './WaterGifRenderer';

export function renderMotionGifPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  options: GifPreviewOptions = {},
): Promise<RenderedArtifact> {
  return deliverable.motion.style === 'water'
    ? renderWaterGifPreview(deliverable, artwork, options)
    : renderDriftGifPreview(deliverable, artwork, options);
}
