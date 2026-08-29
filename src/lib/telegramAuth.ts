// Verifies Telegram Mini App `initData` server-side per Telegram's documented algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Never trust window.Telegram.WebApp.initDataUnsafe from the client for authorization —
// it's just parsed JSON the client sent us, and can be forged. Only a HMAC check using
// the bot token (known only to the server) proves it actually came from Telegram.
import crypto from 'crypto';

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; userId?: number } {
  if (!initData || !botToken) return { valid: false };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false };
  params.delete('hash');

  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuf = Buffer.from(hash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  const valid =
    hashBuf.length === computedBuf.length && crypto.timingSafeEqual(hashBuf, computedBuf);
  if (!valid) return { valid: false };

  const userJson = params.get('user');
  if (!userJson) return { valid: true };
  try {
    const user = JSON.parse(userJson);
    return { valid: true, userId: typeof user.id === 'number' ? user.id : undefined };
  } catch {
    return { valid: true };
  }
}
