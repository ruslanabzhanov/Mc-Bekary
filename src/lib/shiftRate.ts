// Ставка за смену «в том месяце, который открыт на экране».
// Текущий месяц — это ставка с карточки сотрудника: её меняют в табеле, и она же видна в кабинете.
// Прошлый месяц — та ставка, по которой тогда реально посчитаны смены (самая частая среди смен
// месяца), а не сегодняшняя: поменяли ставку в ноябре — октябрь показывает октябрьскую.
export function monthShiftRate(
  shifts: { rate: number; units?: number }[],
  cardRate: number | undefined,
  isCurrentMonth: boolean
): number {
  if (isCurrentMonth) return Number(cardRate) || 0;
  const counts = new Map<number, number>();
  shifts.forEach((s) => {
    const units = Number(s.units ?? 1) || 1;
    const perUnit = Math.round((Number(s.rate) || 0) / units);
    counts.set(perUnit, (counts.get(perUnit) || 0) + 1);
  });
  let best = 0;
  let bestCount = 0;
  counts.forEach((n, rate) => {
    if (n > bestCount) {
      best = rate;
      bestCount = n;
    }
  });
  return bestCount ? best : 0;
}
