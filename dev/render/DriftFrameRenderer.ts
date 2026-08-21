import sharp from 'sharp';
import { getDriftFrame } from '../../src/preview/DriftAnimation';
import type { PreviewFrameInput } from './PreviewFrameRenderer';

export async function renderDriftFrame({
  artwork,
  width,
  height,
  timeSeconds,
  speed,
  intensity,
}: PreviewFrameInput): Promise<Uint8Array> {
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
