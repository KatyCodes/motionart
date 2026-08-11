import * as gifencModule from 'gifenc';
import type { GifEncApi } from 'gifenc';
import sharp from 'sharp';
import { getDriftFrame } from '../../src/preview/DriftAnimation';
import { createRenderOutputFileName } from '../../src/render/RenderJob';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import type { RenderedArtifact } from './RenderArtifact';

export interface DriftGifPreviewOptions {
  maximumDimension?: number;
  framesPerSecond?: number;
  maximumDurationSeconds?: number;
}

const defaultOptions = {
  maximumDimension: 320,
  framesPerSecond: 8,
  maximumDurationSeconds: 2,
} as const;
const gifenc = 'GIFEncoder' in gifencModule
  ? gifencModule as unknown as GifEncApi
  : gifencModule.default;
const { GIFEncoder, applyPalette, quantize } = gifenc;

export async function renderDriftGifPreview(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  options: DriftGifPreviewOptions = {},
): Promise<RenderedArtifact> {
  if (deliverable.motion.style !== 'drift') {
    throw new RangeError('The preview renderer only supports the Drift effect.');
  }
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
  const encoder = GIFEncoder();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timeSeconds = frameIndex / settings.framesPerSecond;
    const pixels = await renderFrame(
      artwork,
      dimensions.width,
      dimensions.height,
      timeSeconds,
      deliverable.motion.speed,
      deliverable.motion.intensity,
    );
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

async function renderFrame(
  artwork: Uint8Array,
  width: number,
  height: number,
  timeSeconds: number,
  speed: number,
  intensity: number,
): Promise<Uint8Array> {
  const frame = getDriftFrame(timeSeconds, { speed, intensity });
  const scale = 1.08 * frame.zoom;
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const maximumLeft = scaledWidth - width;
  const maximumTop = scaledHeight - height;
  const left = clamp(
    Math.round(maximumLeft / 2 - frame.offsetXRatio * width),
    0,
    maximumLeft,
  );
  const top = clamp(
    Math.round(maximumTop / 2 - frame.offsetYRatio * height),
    0,
    maximumTop,
  );

  return sharp(artwork)
    .resize(scaledWidth, scaledHeight, { fit: 'cover', position: 'centre' })
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function constrainDimensions(width: number, height: number, maximumDimension: number) {
  const scale = Math.min(1, maximumDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function validateOptions(options: Required<DriftGifPreviewOptions>): void {
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
