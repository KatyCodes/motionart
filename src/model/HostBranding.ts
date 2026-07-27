export interface HostBranding {
  hostName: string;
  productName: string;
  accentColor: string;
  providerName?: string;
  logoUrl?: string;
  supportUrl?: string;
}

export function validateHostBranding(branding: HostBranding): void {
  if (!branding.hostName.trim() || !branding.productName.trim() || !branding.accentColor.trim()) {
    throw new RangeError('Host branding requires a host name, product name, and accent color.');
  }
}
