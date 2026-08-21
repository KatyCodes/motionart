import sharp from 'sharp';
import {
  getWaterDisplacementSample,
  getWaterFrame,
} from '../../src/preview/WaterAnimation';
import type { PreviewFrameInput } from './PreviewFrameRenderer';

const displacementMapSize = 256;
const displacementColorScale = 80 / 255;
const maximumWaveMagnitude = 1.45;

export async function renderWaterFrame({
  artwork,
  width,
  height,
  timeSeconds,
  speed,
  intensity,
}: PreviewFrameInput): Promise<Uint8Array> {
  const frame = getWaterFrame(timeSeconds, { speed, intensity });
  const horizontalPadding = frame.displacementX * displacementColorScale * maximumWaveMagnitude;
  const verticalPadding = frame.displacementY * displacementColorScale * maximumWaveMagnitude;
  const overscan = 1.08 * frame.zoom + Math.max(
    horizontalPadding * 2 / width,
    verticalPadding * 2 / height,
  );
  const sourceWidth = Math.ceil(width * overscan);
  const sourceHeight = Math.ceil(height * overscan);
  const source = await sharp(artwork)
    .resize(sourceWidth, sourceHeight, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const output = new Uint8Array(width * height * 4);
  const cropLeft = (sourceWidth - width) / 2;
  const cropTop = (sourceHeight - height) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = getWaterDisplacementSample(
        (x + frame.mapOffsetX) / displacementMapSize,
        (y + frame.mapOffsetY) / displacementMapSize,
      );
      const sourceX = cropLeft + x
        + sample.horizontal * frame.displacementX * displacementColorScale;
      const sourceY = cropTop + y
        + sample.vertical * frame.displacementY * displacementColorScale;
      const outputIndex = (y * width + x) * 4;
      sampleBilinear(source, sourceWidth, sourceHeight, sourceX, sourceY, output, outputIndex);
    }
  }

  return output;
}

function sampleBilinear(
  source: Uint8Array,
  width: number,
  height: number,
  sourceX: number,
  sourceY: number,
  output: Uint8Array,
  outputIndex: number,
): void {
  const x0 = clamp(Math.floor(sourceX), 0, width - 1);
  const y0 = clamp(Math.floor(sourceY), 0, height - 1);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const mixX = sourceX - Math.floor(sourceX);
  const mixY = sourceY - Math.floor(sourceY);
  const topLeft = (y0 * width + x0) * 4;
  const topRight = (y0 * width + x1) * 4;
  const bottomLeft = (y1 * width + x0) * 4;
  const bottomRight = (y1 * width + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = mix(source[topLeft + channel], source[topRight + channel], mixX);
    const bottom = mix(source[bottomLeft + channel], source[bottomRight + channel], mixX);
    output[outputIndex + channel] = Math.round(mix(top, bottom, mixY));
  }
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
