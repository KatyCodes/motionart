import { describe, expect, it } from 'vitest';
import { resolveDemoRenderServiceMode } from './DemoRenderService';

describe('resolveDemoRenderServiceMode', () => {
  it('uses the local HTTP boundary by default during development', () => {
    expect(resolveDemoRenderServiceMode(undefined, true)).toBe('http');
  });

  it('keeps a static production demo functional without a backend', () => {
    expect(resolveDemoRenderServiceMode(undefined, false)).toBe('fake');
  });

  it('allows either mode to be selected explicitly', () => {
    expect(resolveDemoRenderServiceMode('fake', true)).toBe('fake');
    expect(resolveDemoRenderServiceMode('http', false)).toBe('http');
  });

  it('rejects a misspelled environment value', () => {
    expect(() => resolveDemoRenderServiceMode('htp', true)).toThrow(
      'Unsupported demo render service mode',
    );
  });
});
