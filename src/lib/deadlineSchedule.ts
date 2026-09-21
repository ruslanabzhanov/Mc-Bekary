// Когда и что напоминать точкам, которые ещё не подали заявку. Только решение — без базы и
// без Telegram, чтобы его можно было проверить на любое время дня, ничего никому не отправив.

// За сколько минут до дедлайна напоминать. Считаются от дедлайна, а не заданы часами: сдвинули
// приём на 16:00 — напоминания сами переехали на 15:00, 15:30, 15:40, 15:50, 15:55.
export const PRE_DEADLINE_OFFSETS = [60, 30, 20, 10, 5];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export type ReminderPlan =
  | { kind: 'before'; minutesLeft: number; offset: number; markOffsets: number[] }
  | { kind: 'after' }
  | null;

// sentBefore — какие «за N минут» уже ушли сегодня для этого дедлайна; sentAfter — ушло ли
// «дедлайн прошёл».
export function planDeadlineReminder(
  nowMinutes: number,
  deadlineMinutes: number,
  sentBefore: Set<number>,
  sentAfter: boolean
): ReminderPlan {
  if (nowMinutes >= deadlineMinutes) {
    return sentAfter ? null : { kind: 'after' };
  }
  const minutesLeft = deadlineMinutes - nowMinutes;
  const due = PRE_DEADLINE_OFFSETS.filter((o) => minutesLeft <= o);
  if (due.length === 0) return null;
  const latest = Math.min(...due);
  if (sentBefore.has(latest)) return null;
  // Если проверка пропустила несколько отметок подряд (сбой, включили посреди окна), шлём одно
  // сообщение — самое свежее, а пропущенные помечаем как сделанные: три напоминания за минуту —
  // это спам, а не напоминание.
  return { kind: 'before', minutesLeft, offset: latest, markOffsets: due.filter((o) => !sentBefore.has(o)) };
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const formatMinutesLeft = (minutes: number) => {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${plural(h, 'час', 'часа', 'часов')}`;
  }
  return `${minutes} ${plural(minutes, 'минута', 'минуты', 'минут')}`;
};
