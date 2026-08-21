/**
 * A durable, serializable identity for artwork. It deliberately does not contain
 * a signed URL, Blob, or customer authentication details.
 */
export interface ArtworkReference {
  provider: string;
  assetKey: string;
  version?: string;
}

/** Creates an exact map key without exposing temporary artwork access details. */
export function getArtworkReferenceKey(reference: ArtworkReference): string {
  return [reference.provider, reference.assetKey, reference.version ?? ''].join('\u0000');
}
