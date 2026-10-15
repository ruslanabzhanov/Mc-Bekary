// Возмещение подотчётных денег. Общие типы и расчёт для сервера и экрана, чтобы остаток везде
// считался одинаково: остаток = остаток с прошлого + пополнения − расходы.

export type ReimbursementStatus = 'draft' | 'saved';
export type ReimbursementLineKind = 'expense' | 'topup';

export interface ReimbursementLine {
  id: number;
  reimbursementId: number;
  kind: ReimbursementLineKind;
  who: string; // кто потратил (у пополнения пусто)
  title: string;
  amount: number; // тенге, целое, больше нуля
  date: string; // YYYY-MM-DD
  createdBy?: string;
}

export interface ReimbursementTotals {
  topups: number;
  expenses: number;
  balance: number;
}

export interface Reimbursement extends ReimbursementTotals {
  id: number;
  number: number; // порядковый номер среди существующих возмещений (1, 2, 3…)
  status: ReimbursementStatus;
  openingBalance: number; // остаток с прошлого возмещения (минус = перерасход)
  closingBalance: number | null; // фиксируется при сохранении
  createdAt: string;
  savedAt: string | null;
  createdBy: string;
  linesCount: number;
}

export interface ReimbursementLogEntry {
  id: number;
  action: string;
  details: string;
  actor: string;
  createdAt: string;
}

export function computeReimbursementTotals(
  openingBalance: number,
  lines: { kind: ReimbursementLineKind | string; amount: number | string }[]
): ReimbursementTotals {
  let topups = 0;
  let expenses = 0;
  for (const l of lines) {
    const n = Number(l.amount) || 0;
    if (l.kind === 'topup') topups += n;
    else if (l.kind === 'expense') expenses += n;
  }
  return { topups, expenses, balance: (Number(openingBalance) || 0) + topups - expenses };
}

// «6000000-148415-5769084=82501» — строка расчёта, как в таблице: пополнения, остаток с прошлого
// (знак по его знаку), расходы, результат.
export function reimbursementFormula(openingBalance: number, t: ReimbursementTotals): string {
  const sign = openingBalance < 0 ? '-' : '+';
  return `${t.topups}${sign}${Math.abs(openingBalance)}-${t.expenses}=${t.balance}`;
}
