// Задачи для сотрудников цеха: ставит владелец или управляющий производством, исполнитель закрывает
// с доказательством (фото, файл или ссылка), руководитель проверяет и принимает или возвращает.

export type TaskStatus = 'open' | 'review' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  deadline: string; // YYYY-MM-DD, казахстанский календарный день; срок истекает в конце этого дня
  status: TaskStatus; // open — в работе, review — исполнитель закрыл и ждёт проверки, done — принята
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  proofComment: string;
  proofLink: string;
  proofFileUrl: string;
  proofFileName: string;
  returnedReason: string; // почему вернули на доработку в последний раз (пока задача снова в работе)
  returnedCount: number;
  acceptedBy: string;
  acceptedAt: string | null;
}

export interface TaskEvent {
  id: number;
  action: string;
  details: string;
  actor: string;
  createdAt: string;
}

// Доказательство выполнения: файл не больше 2,5 МБ (у Vercel предел тела запроса около 4,5 МБ, а
// base64 раздувает файл на треть) — фото сжимаются на телефоне и обычно укладываются в 300 КБ.
export const TASK_FILE_MAX_BYTES = 2.5 * 1024 * 1024;
export const TASK_ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export const isTaskOverdue = (t: Pick<Task, 'status' | 'deadline'>, today: string) => t.status === 'open' && t.deadline < today;

const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const formatTaskDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MON[Number(m) - 1]} ${y}`;
};
