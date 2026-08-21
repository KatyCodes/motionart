import type { RenderDeliverable } from '../../src/render/RenderRequest';
import {
  encodeGifPreview,
  type GifPreviewOptions,
} from './GifPreviewEncoder';
import type { RenderedArtifact } from './RenderArtifact';
import { renderWaterFrame } from './WaterFrameRenderer';

export type WaterGifPreviewOptions = GifPreviewOptions;

export async function renderWaterGifPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  options: WaterGifPreviewOptions = {},
): Promise<RenderedArtifact> {
  if (deliverable.motion.style !== 'water') {
    throw new RangeError('The preview renderer only supports the Water effect.');
  }
  return encodeGifPreview(deliverable, artwork, renderWaterFrame, options);
}
