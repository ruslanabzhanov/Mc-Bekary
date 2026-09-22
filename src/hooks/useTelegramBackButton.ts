import { useEffect, useRef } from 'react';
import { pushBackHandler } from '../lib/telegramBackButton';

// Shows Telegram's native BackButton while `isActive`, and routes a press to `onBack` — pass
// the exact same handler already wired to the modal/panel's own X/"Назад" button. Every
// closeable modal/fullscreen panel in the app calls this. When several are open at once
// (a modal opened from inside another modal), whichever became active most recently owns the
// button, so one press closes just that layer and reveals the one underneath — no need to
// close everything and re-navigate back in from the top.
export function useTelegramBackButton(isActive: boolean, onBack: () => void) {
  // Keeps the effect from re-running (and thrashing the shared stack) just because the caller
  // passed a fresh inline arrow function this render — only `isActive` flipping matters.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isActive) return;
    return pushBackHandler(() => onBackRef.current());
  }, [isActive]);
}
