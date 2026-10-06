// Current position, for «Я пришёл» and for saving where the workshop is.
// Inside Telegram the Mini App asks through Telegram's own LocationManager (Bot API 8+), which
// is the reliable path on phones; anywhere else — and as a fallback — the browser's own API.

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy?: number; // metres
}

const fromTelegram = (): Promise<GeoFix | null> =>
  new Promise((resolve) => {
    const lm = (window as any).Telegram?.WebApp?.LocationManager;
    if (!lm || typeof lm.init !== 'function') return resolve(null);
    const timer = setTimeout(() => resolve(null), 15000);
    const done = (fix: GeoFix | null) => {
      clearTimeout(timer);
      resolve(fix);
    };
    try {
      lm.init(() => {
        if (!lm.isLocationAvailable) return done(null);
        lm.getLocation((data: any) => {
          done(
            data && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)
              ? { lat: data.latitude, lng: data.longitude, accuracy: data.horizontal_accuracy ?? undefined }
              : null
          );
        });
      });
    } catch {
      done(null);
    }
  });

const fromBrowser = (): Promise<GeoFix | null> =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

// null = the position could not be obtained (no permission, GPS off, timeout).
export async function getCurrentFix(): Promise<GeoFix | null> {
  return (await fromTelegram()) ?? (await fromBrowser());
}

export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m)} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`;
