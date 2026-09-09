import React, { useEffect, useRef, useState } from 'react';

const SPLASH_DURATION_MS = 3900; // slightly longer than the 3.7s clip, as a fallback if it never fires 'ended'
const FADE_MS = 400;
const SESSION_KEY = 'mc-bekary-splash-shown';

interface SplashScreenProps {
  onDone: () => void;
}

// One-time animated splash (raw dough -> baked croissant -> "MASTER BAKERY") shown on first
// load of a session. Poster image paints instantly so there's never a blank/black frame while
// the video initializes; a fixed timeout guarantees the app is reachable even if the video
// never loads or never fires 'ended'. Shown once per browser session (sessionStorage), not on
// every return from background — this is a business app opened many times a day, not a game.
export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setIsFadingOut(true);
    setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    const timer = setTimeout(finish, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-[400ms] ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#E5E0D3' }}
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/splash/poster_start.jpg"
        onEnded={finish}
        onError={finish}
        className="w-full h-full object-cover"
      >
        <source src="/splash/splash.webm" type="video/webm" />
        <source src="/splash/splash.mp4" type="video/mp4" />
      </video>
    </div>
  );
};

export const wasSplashShownThisSession = (): boolean => {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

export const markSplashShown = (): void => {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage unavailable (private mode, etc.) — worst case the splash replays; harmless
  }
};
