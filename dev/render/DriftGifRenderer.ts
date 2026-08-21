import type { RenderDeliverable } from '../../src/render/RenderRequest';
import { renderDriftFrame } from './DriftFrameRenderer';
import type { RenderedArtifact } from './RenderArtifact';
import {
  encodeGifPreview,
  type GifPreviewOptions,
} from './GifPreviewEncoder';

export type DriftGifPreviewOptions = GifPreviewOptions;

export async function renderDriftGifPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  options: DriftGifPreviewOptions = {},
): Promise<RenderedArtifact> {
  if (deliverable.motion.style !== 'drift') {
    throw new RangeError('The preview renderer only supports the Drift effect.');
  }
  return encodeGifPreview(deliverable, artwork, renderDriftFrame, options);
}
