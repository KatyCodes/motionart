import * as gifencModule from 'gifenc';
import type { GifEncApi } from 'gifenc';
import { createRenderOutputFileName } from '../../src/render/RenderJob';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import {
  createPreviewRenderPlan,
  generatePreviewFrames,
  type PreviewFrameInput,
  type PreviewFrameRenderer,
  type PreviewRenderOptions,
} from './PreviewFrameRenderer';
import type { RenderedArtifact } from './RenderArtifact';

export type GifPreviewOptions = PreviewRenderOptions;
export type GifFrameInput = PreviewFrameInput;
export type GifFrameRenderer = PreviewFrameRenderer;
const gifenc = 'GIFEncoder' in gifencModule
  ? gifencModule as unknown as GifEncApi
  : gifencModule.default;
const { GIFEncoder, applyPalette, quantize } = gifenc;

export async function encodeGifPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  renderFrame: GifFrameRenderer,
  options: GifPreviewOptions = {},
): Promise<RenderedArtifact> {
  if (deliverable.output.format.toLowerCase() !== 'gif') {
    throw new RangeError('The preview renderer only produces GIF previews.');
  }
  if (artwork.byteLength === 0) {
    throw new RangeError('The preview renderer requires artwork bytes.');
  }

  const plan = createPreviewRenderPlan(deliverable, options);
  const frameDelay = Math.max(20, Math.round(1000 / plan.framesPerSecond));
  const encoder = GIFEncoder();

  for await (const pixels of generatePreviewFrames(deliverable, artwork, renderFrame, plan)) {
    const palette = quantize(pixels, 256, { format: 'rgb565' });
    const indexedPixels = applyPalette(pixels, palette, 'rgb565');
    encoder.writeFrame(indexedPixels, plan.width, plan.height, {
      palette,
      delay: frameDelay,
      repeat: 0,
    });
  }

  encoder.finish();

  return {
    deliverableId: deliverable.id,
    fileName: createRenderOutputFileName(deliverable.title, 'gif', 'preview'),
    contentType: 'image/gif',
    width: plan.width,
    height: plan.height,
    frameCount: plan.frameCount,
    bytes: encoder.bytes(),
  };
}
