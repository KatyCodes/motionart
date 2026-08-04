export interface EditorWindowActions {
  onMinimize: () => void;
  onExit: () => void;
}

export function EditorWindowControls({ onMinimize, onExit }: EditorWindowActions) {
  return (
    <div className="editor-window-controls" role="group" aria-label="Editor window controls">
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
    </div>
  );
}
