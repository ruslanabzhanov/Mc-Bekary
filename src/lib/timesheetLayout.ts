import type { StaffMember } from '../types.js';

// Подразделения табеля по умолчанию — в том порядке, в каком бумажный табель перечисляет людей.
export const GRID_GROUPS: { label: string; positions: string[] }[] = [
  { label: 'Руководство цеха', positions: ['Заведующий производством'] },
  { label: 'Пекари', positions: ['Шеф-пекарь', 'Пекарь', 'Ночной пекарь'] },
  { label: 'Кондитеры', positions: ['Кондитер'] },
  { label: 'Курьеры', positions: ['Курьер'] },
  {
    label: 'Заготовщики',
    positions: ['Заготовщик бара', 'Заготовщик кухни', 'Ночной заготовщик кухни', 'Заготовщик полуфабрикатов'],
  },
];

// Сохранённый порядок строк и подразделения табеля (app_settings → timesheet_layout). Только
// отображение: смены, ставки и авансы принадлежат человеку, поэтому перестановка денег не меняет.
export interface LayoutGroup {
  id: string;
  label: string;
  staffIds: string[];
}

export const OTHER_LABEL = 'Прочие';
const defaultGroupLabel = (m: StaffMember) =>
  GRID_GROUPS.find((g) => m.position && g.positions.includes(m.position))?.label || OTHER_LABEL;

// Подразделения с людьми в нужном порядке. Без сохранённого порядка — по должностям. Тот, кого в
// сохранённом порядке нет (новичок), попадает в подразделение своей должности или в «Прочие»,
// так что в табеле не пропадает никто.
export const buildGroups = (employees: StaffMember[], layout: LayoutGroup[] | null): LayoutGroup[] => {
  const groups: LayoutGroup[] = layout
    ? layout.map((g) => ({ id: g.id, label: g.label, staffIds: [] as string[] }))
    : GRID_GROUPS.map((g, i) => ({ id: `default-${i}`, label: g.label, staffIds: [] as string[] }));
  const byId = new Map(employees.map((m) => [m.id, m]));
  const placed = new Set<string>();
  if (layout) {
    layout.forEach((g, i) => {
      (g.staffIds || []).forEach((id) => {
        if (byId.has(id) && !placed.has(id)) {
          groups[i].staffIds.push(id);
          placed.add(id);
        }
      });
    });
  }
  employees
    .filter((m) => !placed.has(m.id))
    .forEach((m) => {
      const label = defaultGroupLabel(m);
      let g = groups.find((x) => x.label === label);
      if (!g) {
        g = { id: `default-${label}`, label, staffIds: [] };
        groups.push(g);
      }
      g.staffIds.push(m.id);
    });
  return groups;
};
