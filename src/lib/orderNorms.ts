// «Норма» точки по каждой позиции: среднее количество в заявке за последние 3 недели (по дням,
// когда точка подавала заявку). Сервер отдаёт её в GET /api/orders/:shopId/norms; отсюда же
// общие правила подсветки, чтобы экран заказа и подтверждение перед отправкой считали одинаково.

export interface ProductNorm {
  avg: number; // среднее штук за день заказа
  d: number; // в скольких днях позиция вообще заказывалась
}

export type DeviationLevel = 'ok' | 'yellow-up' | 'yellow-down' | 'red-up' | 'red-down' | 'new' | 'none';

// Позиция, которую точка брала меньше чем в 3 днях окна, считается новой — оценивать нечем.
export const MIN_DAYS_FOR_NORM = 3;

// Жёлтый: отличие от нормы не меньше 2 шт и не меньше 40 %. Красный: не меньше 4 шт и не меньше 80 %.
export const YELLOW = { pcs: 2, share: 0.4 };
export const RED = { pcs: 4, share: 0.8 };

export function classifyDeviation(qty: number, norm?: ProductNorm | null): DeviationLevel {
  if (!norm) return qty > 0 ? 'new' : 'none';
  if (norm.d < MIN_DAYS_FOR_NORM) return qty > 0 ? 'new' : 'none';
  const diff = qty - norm.avg;
  const abs = Math.abs(diff);
  const share = abs / Math.max(norm.avg, 1);
  if (abs >= RED.pcs && share >= RED.share) return diff > 0 ? 'red-up' : 'red-down';
  if (abs >= YELLOW.pcs && share >= YELLOW.share) return diff > 0 ? 'yellow-up' : 'yellow-down';
  return 'ok';
}

export const isRed = (l: DeviationLevel) => l === 'red-up' || l === 'red-down';
export const isYellow = (l: DeviationLevel) => l === 'yellow-up' || l === 'yellow-down';

export const fmtPcs = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

// «Обычно ≈ 7,7 шт, сейчас 25: на 17,3 шт больше»
export function describeDeviation(qty: number, norm: ProductNorm): string {
  const diff = qty - norm.avg;
  return `Обычно ≈ ${fmtPcs(norm.avg)} шт, сейчас ${qty}: на ${fmtPcs(Math.abs(diff))} шт ${diff > 0 ? 'больше' : 'меньше'}`;
}

export interface Deviation {
  productId: string;
  name: string;
  qty: number;
  norm: ProductNorm;
  level: DeviationLevel;
}
