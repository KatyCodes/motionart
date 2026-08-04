export type EditorWindowState = 'open' | 'minimized' | 'closed';

export type EditorWindowAction = 'minimize' | 'exit' | 'restore';

export function transitionEditorWindow(
  state: EditorWindowState,
  action: EditorWindowAction,
): EditorWindowState {
  if (action === 'exit') return 'closed';
  if (action === 'restore') return 'open';

  return state === 'open' ? 'minimized' : state;
}
