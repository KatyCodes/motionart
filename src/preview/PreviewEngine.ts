import { Application, Assets, Sprite, type Texture } from 'pixi.js';

export class PreviewEngine {
  private readonly app = new Application();
  private artwork?: Sprite;
  private elapsedSeconds = 0;
  private baseScale = 1;

  constructor(private readonly host: HTMLElement) {}

  async start(imageUrl: string): Promise<void> {
    await this.app.init({
      antialias: true,
      background: '#0b0a12',
      resizeTo: this.host,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    this.host.appendChild(this.app.canvas);

    const texture = await Assets.load<Texture>(imageUrl);
    this.artwork = new Sprite(texture);
    this.artwork.anchor.set(0.5);
    this.app.stage.addChild(this.artwork);

    this.fitArtwork();
    this.app.renderer.on('resize', this.fitArtwork);
    this.app.ticker.add(this.animate);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.fitArtwork);
    this.app.ticker.remove(this.animate);
    this.app.destroy(true, { children: true });
  }

  private readonly fitArtwork = (): void => {
    if (!this.artwork) return;

    const { width, height } = this.app.screen;
    const texture = this.artwork.texture;

    // A little overscan keeps the moving image beyond every canvas edge.
    this.baseScale = Math.max(width / texture.width, height / texture.height) * 1.08;
    this.artwork.position.set(width / 2, height / 2);
    this.artwork.scale.set(this.baseScale);
  };

  private readonly animate = (): void => {
    if (!this.artwork) return;

    this.elapsedSeconds += this.app.ticker.deltaMS / 1000;

    const zoom = 1 + (Math.sin(this.elapsedSeconds * 0.38) + 1) * 0.018;
    const driftX = Math.sin(this.elapsedSeconds * 0.24) * this.app.screen.width * 0.018;
    const driftY = Math.cos(this.elapsedSeconds * 0.19) * this.app.screen.height * 0.014;

    this.artwork.scale.set(this.baseScale * zoom);
    this.artwork.position.set(
      this.app.screen.width / 2 + driftX,
      this.app.screen.height / 2 + driftY,
    );
  };
}
