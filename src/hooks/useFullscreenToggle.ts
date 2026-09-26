import { useEffect, useState } from 'react';

// Works two ways depending on where the app is running (same "degrades gracefully outside
// Telegram" pattern as the rest of the app — see CLAUDE.md's "Telegram Mini App" section):
// - Inside Telegram with a client new enough to support it (Bot API 8.0+), uses the native
//   WebApp.requestFullscreen()/exitFullscreen() — this is the real "fullscreen" a Telegram
//   Mini App can have (hides Telegram's own header entirely), not just the expand() already
//   called on mount, which only grows the sheet to full height but keeps Telegram's chrome.
// - In a plain browser (or an older Telegram client without the fullscreen API), falls back to
//   the standard Fullscreen API on the document element.
export function useFullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Telegram's own top safe-area inset (status bar / notch) while in true fullscreen — in the
  // regular expanded mode Telegram already keeps content clear of it, but real fullscreen hides
  // Telegram's header too, so nothing else pushes content below the notch.
  const [topInset, setTopInset] = useState(0);

  const tg = (window as any).Telegram?.WebApp;
  const hasTelegramFullscreen = !!tg && typeof tg.requestFullscreen === 'function';

  useEffect(() => {
    if (hasTelegramFullscreen) {
      const sync = () => {
        setIsFullscreen(!!tg.isFullscreen);
        setTopInset(Number(tg.contentSafeAreaInset?.top) || Number(tg.safeAreaInset?.top) || 0);
      };
      sync();
      tg.onEvent('fullscreenChanged', sync);
      return () => tg.offEvent('fullscreenChanged', sync);
    }
    // Plain browser fallback — tracks Esc / any other way the user might leave fullscreen.
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [hasTelegramFullscreen, tg]);

  const toggle = () => {
    if (hasTelegramFullscreen) {
      if (tg.isFullscreen) tg.exitFullscreen();
      else tg.requestFullscreen();
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return { isFullscreen, toggle, topInset };
}
