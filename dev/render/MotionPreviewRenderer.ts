import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderDriftFrame } from './DriftFrameRenderer';
import { renderMotionGifPreview } from './MotionGifRenderer';
import { encodeMp4Preview } from './Mp4PreviewEncoder';
import type { PreviewFrameRenderer, PreviewRenderOptions } from './PreviewFrameRenderer';
import type { RenderedArtifact } from './RenderArtifact';
import { renderWaterFrame } from './WaterFrameRenderer';

export function renderMotionPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  options: PreviewRenderOptions = {},
): Promise<RenderedArtifact> {
  const format = deliverable.output.format.toLowerCase();
  if (format === 'gif') return renderMotionGifPreview(deliverable, artwork, options);
  if (format === 'mp4') {
    return encodeMp4Preview(deliverable, artwork, getFrameRenderer(deliverable), options);
  }

  return Promise.reject(new RangeError(`Unsupported preview format: ${format}`));
}

function getFrameRenderer(deliverable: RenderDeliverable): PreviewFrameRenderer {
  return deliverable.motion.style === 'water' ? renderWaterFrame : renderDriftFrame;
}
