declare module 'gifenc' {
  type Palette = number[][];

  interface GifFrameOptions {
    palette?: Palette;
    delay?: number;
    repeat?: number;
  }

  interface GifEncoderInstance {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      options?: GifFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  function GIFEncoder(): GifEncoderInstance;
  function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maximumColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): Palette;
  function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  export interface GifEncApi {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  }

  const gifenc: GifEncApi;
  export default gifenc;
}
