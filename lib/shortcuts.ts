export type ShortcutHandlers = {
  onPlayPause?: () => void;
  onRecord?: () => void;
  onUndo?: () => void;
  onExport?: () => void;
};

const registry = new Map<symbol, ShortcutHandlers>();

function getActiveHandlers(): ShortcutHandlers {
  const merged: ShortcutHandlers = {};
  Array.from(registry.values()).forEach((entry) => {
    Object.assign(merged, entry);
  });
  return merged;
}

export function registerShortcutHandlers(next: ShortcutHandlers): () => void {
  const id = Symbol("shortcut-handlers");
  registry.set(id, next);
  return () => {
    registry.delete(id);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function handleGlobalKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return;

  const handlers = getActiveHandlers();

  if (event.code === "Space") {
    event.preventDefault();
    handlers.onPlayPause?.();
    return;
  }

  if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey) {
    handlers.onRecord?.();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    handlers.onUndo?.();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    handlers.onExport?.();
  }
}
