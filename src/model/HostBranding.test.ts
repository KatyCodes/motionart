import { describe, expect, it } from 'vitest';
import { validateHostBranding } from './HostBranding';

describe('host branding', () => {
  it('accepts branding supplied by a white-label customer', () => {
    expect(() => validateHostBranding({
      hostName: 'Distributor demo',
      productName: 'Motion Studio',
      accentColor: '#d3b9ff',
    })).not.toThrow();
  });

  it('rejects incomplete branding before it reaches the editor', () => {
    expect(() => validateHostBranding({
      hostName: '',
      productName: 'Motion Studio',
      accentColor: '#d3b9ff',
    })).toThrow(RangeError);
  });
});
