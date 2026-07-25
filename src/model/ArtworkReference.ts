/**
 * A durable, serializable identity for artwork. It deliberately does not contain
 * a signed URL, Blob, or customer authentication details.
 */
export interface ArtworkReference {
  provider: string;
  assetKey: string;
  version?: string;
}
