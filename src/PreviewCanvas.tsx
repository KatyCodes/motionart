import { useEffect, useRef, useState } from 'react';
import type { MotionStyleId } from './model/AlbumMotionProject';
import { PreviewEngine } from './preview/PreviewEngine';
import type { ArtworkSource } from './preview/ArtworkSource';

interface PreviewCanvasProps {
  artwork: ArtworkSource;
  motionStyle: MotionStyleId;
  speed: number;
  intensity: number;
  aspectRatio: {
    width: number;
    height: number;
  };
}

export function PreviewCanvas({ artwork, motionStyle, speed, intensity, aspectRatio }: PreviewCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<PreviewEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) return;

    setError(null);
    const preview = new PreviewEngine(host);
    previewRef.current = preview;
    let active = true;

    void preview.start(artwork).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'The artwork preview could not be loaded.');
      }
    });

    return () => {
      active = false;
      preview.destroy();
      previewRef.current = null;
    };
  }, [artwork]);

  useEffect(() => {
    previewRef.current?.setMotionSettings(motionStyle, { speed, intensity });
  }, [motionStyle, speed, intensity]);

  return (
    <div className="preview-frame" style={{ aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}` }}>
      <div className="preview-canvas" ref={hostRef} aria-label="Animated album artwork preview" />
      {error ? <p className="preview-error">{error}</p> : null}
    </div>
  );
}
