export interface EditorWindowActions {
  onMinimize: () => void;
  onExit: () => void;
}

export function EditorWindowControls({ onMinimize, onExit }: EditorWindowActions) {
  return (
    <fieldset className="editor-window-controls">
      <legend className="visually-hidden">Editor window controls</legend>
      <button
        className="editor-window-button"
        type="button"
        aria-label="Minimize editor"
        title="Minimize editor"
        onClick={onMinimize}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        className="editor-window-button is-exit"
        type="button"
        aria-label="Exit editor"
        title="Exit editor"
        onClick={onExit}
      >
        <span aria-hidden="true">×</span>
      </button>
    </fieldset>
  );
}
