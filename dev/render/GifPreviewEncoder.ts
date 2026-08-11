import * as gifencModule from 'gifenc';
import type { GifEncApi } from 'gifenc';
import { createRenderOutputFileName } from '../../src/render/RenderJob';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import type { RenderedArtifact } from './RenderArtifact';

export interface GifPreviewOptions {
  maximumDimension?: number;
  framesPerSecond?: number;
  maximumDurationSeconds?: number;
}

export interface GifFrameInput {
  artwork: Uint8Array;
  width: number;
  height: number;
  timeSeconds: number;
  speed: number;
  intensity: number;
}

export type GifFrameRenderer = (input: GifFrameInput) => Promise<Uint8Array>;

const defaultOptions = {
  maximumDimension: 320,
  framesPerSecond: 8,
  maximumDurationSeconds: 2,
} as const;
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

  const settings = { ...defaultOptions, ...options };
  validateOptions(settings);
  const dimensions = constrainDimensions(
    deliverable.output.width,
    deliverable.output.height,
    settings.maximumDimension,
  );
  const durationSeconds = Math.min(
    deliverable.output.durationSeconds,
    settings.maximumDurationSeconds,
  );
  const frameCount = Math.max(2, Math.ceil(durationSeconds * settings.framesPerSecond));
  const frameDelay = Math.max(20, Math.round(1000 / settings.framesPerSecond));
  const expectedPixelBytes = dimensions.width * dimensions.height * 4;
  const encoder = GIFEncoder();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const pixels = await renderFrame({
      artwork,
      width: dimensions.width,
      height: dimensions.height,
      timeSeconds: frameIndex / settings.framesPerSecond,
      speed: deliverable.motion.speed,
      intensity: deliverable.motion.intensity,
    });
    if (pixels.byteLength !== expectedPixelBytes) {
      throw new RangeError(
        `GIF frame returned ${pixels.byteLength} bytes; expected ${expectedPixelBytes}.`,
      );
    }

    const palette = quantize(pixels, 256, { format: 'rgb565' });
    const indexedPixels = applyPalette(pixels, palette, 'rgb565');
    encoder.writeFrame(indexedPixels, dimensions.width, dimensions.height, {
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
    width: dimensions.width,
    height: dimensions.height,
    frameCount,
    bytes: encoder.bytes(),
  };
}

function constrainDimensions(width: number, height: number, maximumDimension: number) {
  const scale = Math.min(1, maximumDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function validateOptions(options: Required<GifPreviewOptions>): void {
  if (!Number.isInteger(options.maximumDimension) || options.maximumDimension <= 0) {
    throw new RangeError('Preview maximum dimension must be a positive integer.');
  }
  if (!Number.isFinite(options.framesPerSecond) || options.framesPerSecond <= 0) {
    throw new RangeError('Preview frame rate must be positive.');
  }
  if (!Number.isFinite(options.maximumDurationSeconds) || options.maximumDurationSeconds <= 0) {
    throw new RangeError('Preview duration must be positive.');
  }
}
