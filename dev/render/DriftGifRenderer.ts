import sharp from 'sharp';
import { getDriftFrame } from '../../src/preview/DriftAnimation';
import type { RenderDeliverable } from '../../src/render/RenderRequest';
import type { RenderedArtifact } from './RenderArtifact';
import {
  encodeGifPreview,
  type GifFrameInput,
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
  return encodeGifPreview(deliverable, artwork, renderFrame, options);
}

async function renderFrame({
  artwork,
  width,
  height,
  timeSeconds,
  speed,
  intensity,
}: GifFrameInput): Promise<Uint8Array> {
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
