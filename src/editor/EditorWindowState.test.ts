import { describe, expect, it } from 'vitest';
import { transitionEditorWindow } from './EditorWindowState';

describe('transitionEditorWindow', () => {
  it('minimizes an open editor', () => {
    expect(transitionEditorWindow('open', 'minimize')).toBe('minimized');
  });

  it('closes an open or minimized editor', () => {
    expect(transitionEditorWindow('open', 'exit')).toBe('closed');
    expect(transitionEditorWindow('minimized', 'exit')).toBe('closed');
  });

  it('restores a minimized or closed editor', () => {
    expect(transitionEditorWindow('minimized', 'restore')).toBe('open');
    expect(transitionEditorWindow('closed', 'restore')).toBe('open');
  });

  it('ignores actions that do not change the current state', () => {
    expect(transitionEditorWindow('minimized', 'minimize')).toBe('minimized');
    expect(transitionEditorWindow('closed', 'minimize')).toBe('closed');
  });
});
