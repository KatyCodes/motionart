import type { RenderDeliverable } from '../../src/render/RenderRequest';

export interface PreviewRenderOptions {
  maximumDimension?: number;
  framesPerSecond?: number;
  maximumDurationSeconds?: number;
}

export interface PreviewFrameInput {
  artwork: Uint8Array;
  width: number;
  height: number;
  timeSeconds: number;
  speed: number;
  intensity: number;
}

export type PreviewFrameRenderer = (input: PreviewFrameInput) => Promise<Uint8Array>;

export interface PreviewRenderPlan {
  width: number;
  height: number;
  framesPerSecond: number;
  frameCount: number;
}

const defaultOptions = {
  maximumDimension: 320,
  framesPerSecond: 8,
  maximumDurationSeconds: 2,
} as const;

export function createPreviewRenderPlan(
  deliverable: RenderDeliverable,
  options: PreviewRenderOptions = {},
  dimensionAlignment = 1,
): PreviewRenderPlan {
  const settings = { ...defaultOptions, ...options };
  validateOptions(settings, dimensionAlignment);
  const dimensions = constrainDimensions(
    deliverable.output.width,
    deliverable.output.height,
    settings.maximumDimension,
    dimensionAlignment,
  );
  const durationSeconds = Math.min(
    deliverable.output.durationSeconds,
    settings.maximumDurationSeconds,
  );

  return {
    ...dimensions,
    framesPerSecond: settings.framesPerSecond,
    frameCount: Math.max(2, Math.ceil(durationSeconds * settings.framesPerSecond)),
  };
}

export async function* generatePreviewFrames(
  deliverable: RenderDeliverable,
  artwork: Uint8Array,
  renderFrame: PreviewFrameRenderer,
  plan: PreviewRenderPlan,
): AsyncGenerator<Uint8Array> {
  const expectedPixelBytes = plan.width * plan.height * 4;

  for (let frameIndex = 0; frameIndex < plan.frameCount; frameIndex += 1) {
    const pixels = await renderFrame({
      artwork,
      width: plan.width,
      height: plan.height,
      timeSeconds: frameIndex / plan.framesPerSecond,
      speed: deliverable.motion.speed,
      intensity: deliverable.motion.intensity,
    });
    if (pixels.byteLength !== expectedPixelBytes) {
      throw new RangeError(
        `Preview frame returned ${pixels.byteLength} bytes; expected ${expectedPixelBytes}.`,
      );
    }

    yield pixels;
  }
}

function constrainDimensions(
  width: number,
  height: number,
  maximumDimension: number,
  alignment: number,
) {
  const scale = Math.min(1, maximumDimension / Math.max(width, height));

  return {
    width: alignDimension(Math.max(1, Math.round(width * scale)), alignment),
    height: alignDimension(Math.max(1, Math.round(height * scale)), alignment),
  };
}

function alignDimension(value: number, alignment: number): number {
  return Math.max(alignment, Math.floor(value / alignment) * alignment);
}

function validateOptions(
  options: Required<PreviewRenderOptions>,
  dimensionAlignment: number,
): void {
  if (!Number.isInteger(options.maximumDimension) || options.maximumDimension <= 0) {
    throw new RangeError('Preview maximum dimension must be a positive integer.');
  }
  if (!Number.isFinite(options.framesPerSecond) || options.framesPerSecond <= 0) {
    throw new RangeError('Preview frame rate must be positive.');
  }
  if (!Number.isFinite(options.maximumDurationSeconds) || options.maximumDurationSeconds <= 0) {
    throw new RangeError('Preview duration must be positive.');
  }
  if (!Number.isInteger(dimensionAlignment) || dimensionAlignment <= 0) {
    throw new RangeError('Preview dimension alignment must be a positive integer.');
  }
  if (options.maximumDimension < dimensionAlignment) {
    throw new RangeError('Preview maximum dimension cannot be smaller than its alignment.');
  }
}
