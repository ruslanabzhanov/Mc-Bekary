import { isRed, fmtPcs } from './orderNorms.js';
import type { Deviation } from './orderNorms.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface DeviationMessageInput {
  shopLabel: string;
  shopId: number;
  managerName: string;
  submittedAt: Date;
  totalPcs: number;
  usualTotal: number;
  deviations: Deviation[];
}

const MAX_YELLOW_LINES = 8;

// Сообщение территориальному управляющему: заявка подана, и вот чем она отличается от обычного
// для этой точки. Telegram HTML (см. sendTelegramMessage).
export function buildDeviationMessage(p: DeviationMessageInput): string {
  const date = p.submittedAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' });
  const time = p.submittedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
  const reds = p.deviations.filter((d) => isRed(d.level));
  const yellows = p.deviations.filter((d) => !isRed(d.level));
  const line = (d: Deviation) => {
    const diff = d.qty - d.norm.avg;
    return `• ${esc(d.name)}: обычно ≈ ${fmtPcs(d.norm.avg)}, заказано ${d.qty} (${diff > 0 ? '+' : '−'}${fmtPcs(Math.abs(diff))} шт)`;
  };
  const gap = p.usualTotal > 0 ? p.totalPcs - p.usualTotal : 0;

  let text =
    `⚠️ <b>Отклонения в заявке</b>\n\n` +
    `🏪 ${esc(p.shopLabel)} (точка №${p.shopId})\n` +
    `👤 Менеджер: ${esc(p.managerName || '—')}\n` +
    `🕒 Подана: ${date}, ${time}\n` +
    `📦 Всего ${p.totalPcs} шт` +
    (p.usualTotal > 0 ? ` (обычно ≈ ${p.usualTotal} шт, ${gap >= 0 ? '+' : '−'}${Math.abs(gap)} шт)` : '') +
    `\n`;
  if (reds.length) text += `\n🔴 <b>Серьёзные (${reds.length}):</b>\n${reds.map(line).join('\n')}\n`;
  if (yellows.length) {
    const shown = yellows.slice(0, MAX_YELLOW_LINES);
    text += `\n🟡 <b>Небольшие (${yellows.length}):</b>\n${shown.map(line).join('\n')}\n`;
    if (yellows.length > shown.length) text += `…и ещё ${yellows.length - shown.length}\n`;
  }
  text +=
    `\n<i>Норма: среднее по заявкам этой точки за последние 3 недели. ` +
    `Ответственность за заявку лежит на менеджере точки; принять или отклонить её решает управляющий производством.</i>`;
  return text;
}
