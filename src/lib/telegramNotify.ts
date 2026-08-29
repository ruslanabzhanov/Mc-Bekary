// Sends a push notification via the Telegram Bot API (sendMessage) to a specific chat.
// Fire-and-forget from the caller's perspective — logs failures rather than throwing,
// since a failed notification should never block the request that triggered it.
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  webAppUrl?: string
) {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (webAppUrl) {
      // web_app inline buttons only work in a private chat between the user and the bot —
      // fine here, since we only ever notify people who've already messaged the bot directly.
      body.reply_markup = {
        inline_keyboard: [[{ text: '📋 Открыть приложение', web_app: { url: webAppUrl } }]],
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Telegram sendMessage failed:', chatId, await res.text());
    }
  } catch (e) {
    console.error('Telegram sendMessage error:', chatId, e);
  }
}
