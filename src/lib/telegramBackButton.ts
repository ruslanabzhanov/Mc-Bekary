// Wires Telegram Mini App's native BackButton to whichever modal/panel is currently on top of
// the stack, so the hardware/gesture back action closes that one layer instead of exiting the
// whole Mini App (which is what happens today when nothing has ever called BackButton.show()).
// A plain module-level stack rather than React context because the button itself is a single
// global piece of native chrome outside the DOM — there is only ever one to show/hide/bind.
// No-ops entirely outside real Telegram (window.Telegram is undefined there).
type BackHandler = () => void;

const stack: BackHandler[] = [];
let clickBound = false;

function getBackButton(): any {
  return (window as any).Telegram?.WebApp?.BackButton;
}

function sync() {
  const btn = getBackButton();
  if (!btn) return;
  if (stack.length > 0) btn.show();
  else btn.hide();
}

function ensureClickBound() {
  const btn = getBackButton();
  if (!btn || clickBound) return;
  clickBound = true;
  // Bound once, forever — always dispatches to whatever is on top of the stack *now*, not
  // whatever was on top when this was bound.
  btn.onClick(() => {
    const top = stack[stack.length - 1];
    top?.();
  });
}

// Pushes `handler` onto the back-button stack and returns a cleanup that pops it back off.
// Call from useTelegramBackButton (src/hooks/useTelegramBackButton.ts) rather than directly.
export function pushBackHandler(handler: BackHandler): () => void {
  ensureClickBound();
  stack.push(handler);
  sync();
  return () => {
    const idx = stack.lastIndexOf(handler);
    if (idx !== -1) stack.splice(idx, 1);
    sync();
  };
}
