import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Wallet, ChevronLeft, ChevronRight, BadgeCheck, HandCoins, Clock,
  CheckCircle2, XCircle, X, Banknote, ClipboardList, Cake, FileHeart, Camera, Loader2, Pencil,
} from 'lucide-react';
import { compressImage } from '../utils/compressImage';
import { formatDateRu, ageOf, sanbookState, SANBOOK_STYLE } from '../utils/staffDocs';
import {
  StaffMember, Shift, AdvanceRequest, CoffeeShop, Product, ShopOrder, ChecklistAssignments,
  DishCosting, SemiFinishedProduct, RawMaterial,
} from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { PrintChecklistsModal, DEPARTMENT_CONFIG, ChecklistDeptKey } from './PrintChecklistsModal';

interface EmployeeViewProps {
  employee: StaffMember | null;
  // Set when the Owner is previewing someone else's cabinet rather than an employee viewing
  // their own — the screen then also offers a picker for whose timesheet to look at.
  allEmployees?: StaffMember[];
  onPickEmployee?: (staffId: string) => void;
  advanceRequests: AdvanceRequest[];
  onSubmitAdvanceRequest: (request: { staffId: string; staffName: string; amount: number; kaspiPhone: string }) => void;
  // For the read-only «Чек-листы» tile — same data AdminView's own checklist screen uses.
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  checklistAssignments: ChecklistAssignments;
  checklistSummaryAssignments: ChecklistAssignments;
  dishCostings: Record<string, DishCosting>;
  semiFinishedList: SemiFinishedProduct[];
  rawMaterials: RawMaterial[];
  // Photo upload — the employee for themselves, or the Owner previewing. Resolves false on failure.
  onUploadPhoto?: (staffId: string, dataUrl: string) => Promise<boolean>;
  // Only passed for the Owner previewing: birthday and sanitary-book dates are filled in by
  // management, not by the employee.
  onUpdateStaffMember?: (staffId: string, updates: Partial<StaffMember>) => void;
}

// Best-effort guess at which checklist a position mostly cares about — shown first, but the
// small department row under the tile lets anyone switch (covering a shift, checking another
// cex, etc.). Positions with no clean 1:1 fit (a generic helper, or the production manager who
// already has the full admin view) start on 'bakery' rather than guessing wrong.
const POSITION_DEPARTMENT: Partial<Record<string, ChecklistDeptKey>> = {
  'Шеф-пекарь': 'bakery',
  'Пекарь': 'bakery',
  'Ночной пекарь': 'bakery',
  'Кондитер': 'desserts',
  'Заготовщик бара': 'bar_prep',
  'Заготовщик кухни': 'kitchen_prep',
  'Ночной заготовщик кухни': 'kitchen_prep',
  'Заготовщик полуфабрикатов': 'kitchen_prep',
};
const CHECKLIST_DEPT_ORDER: ChecklistDeptKey[] = ['bakery', 'desserts', 'sandwiches', 'bar_prep', 'kitchen_prep', 'new_items'];

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Kazakhstan calendar month, same basis as every other date in the app.
const almatyToday = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });

const monthKey = (d: string) => d.slice(0, 7);

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;

const formatDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
};

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+05:00`).getDay()];
// Monday-first index (0=пн…6=вс), for laying the calendar grid out the way a Russian wall
// calendar reads, not the JS/Intl default of Sunday-first.
const mondayIndexOf = (iso: string) => (WEEKDAYS.indexOf(weekdayOf(iso)) + 6) % 7;
const WEEKDAY_HEADERS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

const daysInMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

export const EmployeeView: React.FC<EmployeeViewProps> = ({
  employee,
  allEmployees,
  onPickEmployee,
  advanceRequests,
  onSubmitAdvanceRequest,
  shops,
  products,
  orders,
  checklistAssignments,
  checklistSummaryAssignments,
  dishCostings,
  semiFinishedList,
  rawMaterials,
  onUploadPhoto,
  onUpdateStaffMember,
}) => {
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  const [isChecklistPickerOpen, setIsChecklistPickerOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [docsDraft, setDocsDraft] = useState({ birthDate: '', sanbookIssued: '', sanbookExpires: '' });
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState<string>(() => monthKey(almatyToday()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [kaspiPhone, setKaspiPhone] = useState('');
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);
  const [checklistDept, setChecklistDept] = useState<ChecklistDeptKey>(
    () => (employee?.position && POSITION_DEPARTMENT[employee.position]) || 'bakery'
  );
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // Re-guess whenever the viewed person changes (Owner switching preview, or the device's own
  // employee record — shouldn't change, but keeps this from ever showing a stale guess).
  useEffect(() => {
    setChecklistDept((employee?.position && POSITION_DEPARTMENT[employee.position]) || 'bakery');
  }, [employee?.id]);

  const staffId = employee?.id;

  useEffect(() => {
    if (!staffId) {
      setShifts([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/timesheet?month=${month}&staffId=${encodeURIComponent(staffId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setShifts(data.shifts || []);
      })
      .catch((e) => console.error('Failed to load own timesheet:', e))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, month]);

  const { shiftCount, earned } = useMemo(
    () => ({
      shiftCount: shifts.length,
      earned: shifts.reduce((sum, s) => sum + (Number(s.rate) || 0), 0),
    }),
    [shifts]
  );

  const shiftByDate = useMemo(() => {
    const m = new Map<string, Shift>();
    shifts.forEach((s) => m.set(s.workDate, s));
    return m;
  }, [shifts]);

  // Kaspi number defaults to whatever's on file, but stays editable — a payout number isn't
  // always the same as the contact number registration captured.
  useEffect(() => {
    setKaspiPhone((prev) => prev || employee?.phone || '');
  }, [employee?.id]);

  const myAdvanceRequests = useMemo(
    () =>
      advanceRequests
        .filter((r) => r.staffId === employee?.id)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [advanceRequests, employee?.id]
  );
  const pendingAdvance = myAdvanceRequests.find((r) => r.status === 'pending');
  const lastDecidedAdvance = myAdvanceRequests.find((r) => r.status !== 'pending');

  // What was actually paid out ahead of time for the month currently open in the tile — only
  // createdAt (a real timestamp) can say which month an advance belongs to; submittedAt is just
  // an "HH:MM" string with no date.
  const advanceTakenThisMonth = useMemo(
    () =>
      myAdvanceRequests
        .filter((r) => r.status === 'approved' && r.createdAt && monthKey(r.createdAt) === month)
        .reduce((sum, r) => sum + r.amount, 0),
    [myAdvanceRequests, month]
  );
  const netPayout = earned - advanceTakenThisMonth;

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(advanceAmount);
    if (!employee || !Number.isFinite(amount) || amount <= 0 || !kaspiPhone.trim()) return;
    onSubmitAdvanceRequest({ staffId: employee.id, staffName: employee.name, amount, kaspiPhone: kaspiPhone.trim() });
    setAdvanceAmount('');
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const [yearNum, monthNum] = month.split('-').map(Number);
  const isCurrentMonth = month === monthKey(almatyToday());
  const today = almatyToday();

  useTelegramBackButton(isTimesheetOpen, () => setIsTimesheetOpen(false));
  useTelegramBackButton(isAdvanceOpen, () => setIsAdvanceOpen(false));
  useTelegramBackButton(isChecklistPickerOpen, () => setIsChecklistPickerOpen(false));
  useTelegramBackButton(isDocsOpen, () => setIsDocsOpen(false));

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !employee || !onUploadPhoto) return;
    setPhotoError('');
    setIsPhotoUploading(true);
    compressImage(file, 600, 0.85)
      .then((dataUrl) => onUploadPhoto(employee.id, dataUrl))
      .then((ok) => {
        if (!ok) setPhotoError('Не удалось сохранить фото');
      })
      .catch(() => setPhotoError('Не удалось обработать фото'))
      .finally(() => setIsPhotoUploading(false));
  };

  const openDocs = () => {
    if (!employee) return;
    setDocsDraft({
      birthDate: employee.birthDate || '',
      sanbookIssued: employee.sanbookIssued || '',
      sanbookExpires: employee.sanbookExpires || '',
    });
    setIsDocsOpen(true);
  };

  if (!employee) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <h3 className="text-lg font-extrabold text-slate-900">Сотрудник не найден</h3>
        <p className="text-sm text-slate-500 mt-2">
          Эта учётная запись больше не числится в персонале. Обратитесь к управляющему.
        </p>
      </div>
    );
  }

  const dayCount = daysInMonth(yearNum, monthNum);
  const monthDayIso = (d: number) => `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const leadingBlanks = mondayIndexOf(monthDayIso(1));

  return (
    <div className="space-y-5 pb-10">
      {/* Who this is: photo on the left, name beside it */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            id="btn-employee-photo"
            onClick={() => onUploadPhoto && photoInputRef.current?.click()}
            disabled={!onUploadPhoto || isPhotoUploading}
            title={onUploadPhoto ? 'Сменить фото' : undefined}
            className="relative w-24 h-28 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center group disabled:cursor-default"
          >
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-slate-300">
                {employee.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
            {onUploadPhoto && (
              <span
                className={`absolute inset-x-0 bottom-0 py-1 flex items-center justify-center gap-1 text-[10px] font-bold text-white bg-slate-900/60 ${
                  employee.photoUrl && !isPhotoUploading ? 'opacity-0 group-hover:opacity-100' : ''
                } transition-opacity`}
              >
                {isPhotoUploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-3 h-3" /> {employee.photoUrl ? 'Сменить' : 'Добавить фото'}
                  </>
                )}
              </span>
            )}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{employee.name}</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
              {employee.position || 'Внутренний сотрудник'}
            </p>
            {employee.phone && <p className="text-xs text-slate-500 mt-1.5">{employee.phone}</p>}
            {photoError && <p className="text-xs text-rose-600 mt-1.5">{photoError}</p>}
          </div>
        </div>

        {allEmployees && onPickEmployee && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Чей кабинет смотрим
            </label>
            <select
              value={employee.id}
              onChange={(e) => onPickEmployee(e.target.value)}
              className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allEmployees.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.position ? ` — ${s.position}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Small tiles: facts at a glance, and each opens its own screen. */}
      {(() => {
        const sb = sanbookState(employee.sanbookExpires);
        const sbStyle = SANBOOK_STYLE[sb.state];
        const age = ageOf(employee.birthDate);
        const shiftsWord = shiftCount === 1 ? 'смена' : shiftCount >= 2 && shiftCount <= 4 ? 'смены' : 'смен';
        const tileBase =
          'min-h-[104px] min-w-0 rounded-2xl border p-3 shadow-xs flex flex-col items-start text-left gap-1 transition-all break-words';
        const clickable = 'hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.98]';
        const Label = ({ children }: { children: React.ReactNode }) => (
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{children}</span>
        );
        return (
          <div className="grid grid-cols-3 gap-2.5">
            <div className={`${tileBase} bg-white border-slate-200`}>
              <BadgeCheck className="w-5 h-5 text-indigo-600" />
              <Label>Должность</Label>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">
                {(employee.position || 'Внутренний сотрудник').replace('Заведующий производством', 'Зав. производством')}
              </span>
            </div>

            <button
              id="tile-birthday"
              onClick={onUpdateStaffMember ? openDocs : undefined}
              disabled={!onUpdateStaffMember}
              className={`${tileBase} bg-white border-slate-200 ${onUpdateStaffMember ? clickable : 'cursor-default'}`}
            >
              <Cake className="w-5 h-5 text-pink-600" />
              <Label>Дата рождения</Label>
              <span className="text-xs font-extrabold text-slate-900 leading-tight tabular-nums">
                {formatDateRu(employee.birthDate)}
              </span>
              {age != null && <span className="text-[10px] text-slate-500">{age} лет</span>}
            </button>

            <button
              id="tile-sanbook"
              onClick={openDocs}
              className={`${tileBase} ${sbStyle.tile} ${clickable}`}
            >
              <FileHeart className={`w-5 h-5 ${sbStyle.text}`} />
              <Label>Санкнижка</Label>
              <span className={`text-xs font-extrabold leading-tight tabular-nums ${sb.state === 'missing' ? 'text-slate-400' : 'text-slate-900'}`}>
                {employee.sanbookExpires ? `до ${formatDateRu(employee.sanbookExpires)}` : 'не указана'}
              </span>
              {sb.state !== 'missing' && sb.state !== 'ok' && (
                <span className={`text-[10px] font-bold ${sbStyle.text}`}>{sbStyle.label}</span>
              )}
            </button>

            <button
              id="btn-open-my-timesheet"
              onClick={() => setIsTimesheetOpen(true)}
              className={`${tileBase} bg-white border-slate-200 ${clickable}`}
            >
              <CalendarDays className="w-5 h-5 text-teal-600" />
              <Label>Табель</Label>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">
                {isLoading ? '…' : `${shiftCount} ${shiftsWord}`}
              </span>
              {!isLoading && <span className="text-[10px] text-slate-500 tabular-nums">{formatMoney(earned)}</span>}
            </button>

            <button
              id="btn-open-my-advances"
              onClick={() => setIsAdvanceOpen(true)}
              className={`${tileBase} ${pendingAdvance ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} ${clickable}`}
            >
              <HandCoins className="w-5 h-5 text-amber-600" />
              <Label>Авансы</Label>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">
                {pendingAdvance
                  ? 'на рассмотрении'
                  : advanceTakenThisMonth > 0
                  ? formatMoney(advanceTakenThisMonth)
                  : 'запросить'}
              </span>
            </button>

            <button
              id="btn-open-my-checklist"
              onClick={() => setIsChecklistPickerOpen(true)}
              className={`${tileBase} bg-white border-slate-200 ${clickable}`}
            >
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <Label>Чек-листы</Label>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">
                {DEPARTMENT_CONFIG[checklistDept].icon} {DEPARTMENT_CONFIG[checklistDept].shortTitle.replace('Чек-лист ', '')}
              </span>
            </button>
          </div>
        );
      })()}

      {/* Which checklist to open */}
      {isChecklistPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-4" onClick={() => setIsChecklistPickerOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Чек-листы</h3>
              <button onClick={() => setIsChecklistPickerOpen(false)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CHECKLIST_DEPT_ORDER.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setChecklistDept(key);
                    setIsChecklistPickerOpen(false);
                    setIsChecklistOpen(true);
                  }}
                  className={`min-h-[64px] rounded-xl border p-2.5 flex items-center gap-2 text-left transition-colors ${
                    checklistDept === key ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl shrink-0">{DEPARTMENT_CONFIG[key].icon}</span>
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {DEPARTMENT_CONFIG[key].shortTitle.replace('Чек-лист ', '')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Birthday + sanitary book: details for everyone, editable only by management */}
      {isDocsOpen && (() => {
        const sb = sanbookState(employee.sanbookExpires);
        const sbStyle = SANBOOK_STYLE[sb.state];
        const canEdit = !!onUpdateStaffMember;
        const dateInput = (key: keyof typeof docsDraft, label: string) => (
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
            <input
              type="date"
              value={docsDraft[key]}
              onChange={(e) => setDocsDraft((d) => ({ ...d, [key]: e.target.value }))}
              className="w-full px-3 min-h-[44px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        );
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-4" onClick={() => setIsDocsOpen(false)}>
            <div id="employee-docs-dialog" className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Документы</h3>
                <button onClick={() => setIsDocsOpen(false)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {canEdit ? (
                <>
                  {dateInput('birthDate', 'Дата рождения')}
                  {dateInput('sanbookIssued', 'Санкнижка выдана')}
                  {dateInput('sanbookExpires', 'Санкнижка действительна до')}
                  <button
                    id="btn-save-employee-docs"
                    onClick={() => {
                      onUpdateStaffMember!(employee.id, {
                        birthDate: docsDraft.birthDate,
                        sanbookIssued: docsDraft.sanbookIssued,
                        sanbookExpires: docsDraft.sanbookExpires,
                      });
                      setIsDocsOpen(false);
                    }}
                    className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" /> Сохранить
                  </button>
                </>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Дата рождения</span><b className="tabular-nums">{formatDateRu(employee.birthDate)}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Санкнижка выдана</span><b className="tabular-nums">{formatDateRu(employee.sanbookIssued)}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Действительна до</span><b className="tabular-nums">{formatDateRu(employee.sanbookExpires)}</b></div>
                  <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${sbStyle.tile} ${sbStyle.text}`}>
                    Санкнижка: {sbStyle.label}
                    {sb.state === 'soon' && sb.daysLeft != null && ` — осталось ${sb.daysLeft} дн.`}
                  </div>
                  <p className="text-[11px] text-slate-400">Даты заполняет управляющий. Если что-то не так — скажите ему.</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <PrintChecklistsModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        departmentKey={checklistDept}
        shops={shops}
        products={products}
        orders={orders}
        checklistAssignments={checklistAssignments}
        checklistSummaryAssignments={checklistSummaryAssignments}
        dishCostings={dishCostings}
        semiFinishedList={semiFinishedList}
        rawMaterials={rawMaterials}
      />

      {/* Авансы — opened from the tile. Requesting one is only for a real employee in their own
          cabinet; the Owner previewing someone else's just sees that person's history. */}
      {isAdvanceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-4" onClick={() => setIsAdvanceOpen(false)}>
        <div id="employee-advance-dialog" className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-slate-700">
              <HandCoins className="w-4 h-4" />
              <h3 className="text-xs font-black uppercase tracking-wider">Авансы</h3>
            </div>
            <button onClick={() => setIsAdvanceOpen(false)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {allEmployees ? (
            myAdvanceRequests.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Заявок на аванс не было</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {myAdvanceRequests.map((r) => (
                  <div key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-900 tabular-nums">{formatMoney(r.amount)}</span>
                    <span
                      className={`text-xs font-bold ${
                        r.status === 'approved' ? 'text-emerald-700' : r.status === 'rejected' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      {r.status === 'approved' ? 'одобрен' : r.status === 'rejected' ? 'отклонён' : 'на рассмотрении'}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : pendingAdvance ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Заявка на рассмотрении</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {formatMoney(pendingAdvance.amount)} на Kaspi {pendingAdvance.kaspiPhone}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdvanceSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Сумма
                </label>
                <input
                  type="number"
                  min="1"
                  step="500"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Например, 20000"
                  className="w-full px-3 min-h-[44px] text-base border border-slate-300 rounded-xl bg-white font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Уже заработано в этом месяце: {formatMoney(earned)}
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Номер Kaspi
                </label>
                <input
                  type="tel"
                  value={kaspiPhone}
                  onChange={(e) => setKaspiPhone(e.target.value)}
                  placeholder="+7 707 000 00 00"
                  className="w-full px-3 min-h-[44px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Запросить аванс
              </button>
            </form>
          )}

          {!allEmployees && !pendingAdvance && lastDecidedAdvance && (
            <div
              className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                lastDecidedAdvance.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-800'
              }`}
            >
              {lastDecidedAdvance.status === 'approved' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                Последняя заявка ({formatMoney(lastDecidedAdvance.amount)}) —{' '}
                {lastDecidedAdvance.status === 'approved' ? 'одобрена' : 'отклонена'}
              </span>
            </div>
          )}
        </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center px-4">
        Табель и документы ведёт управляющий. Если чего-то не хватает — скажите ему.
      </p>

      {/* TIMESHEET FULLSCREEN WINDOW */}
      {isTimesheetOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-600" />
              <span>Табель</span>
            </h2>
            <button
              onClick={() => setIsTimesheetOpen(false)}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
            {/* Month picker */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex items-center justify-between gap-2">
              <button
                onClick={() => shiftMonth(-1)}
                className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center min-w-0">
                <p className="text-sm font-extrabold text-slate-900 truncate">
                  {MONTHS[monthNum - 1]} {yearNum}
                </p>
                {isCurrentMonth && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mt-0.5">
                    текущий месяц
                  </p>
                )}
              </div>
              <button
                onClick={() => shiftMonth(1)}
                disabled={isCurrentMonth}
                className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                aria-label="Следующий месяц"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* The numbers this screen exists for */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Banknote className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Ставка/день</span>
                </div>
                <p className="text-xl font-black text-slate-900 tabular-nums leading-none">
                  {employee.shiftRate ? formatMoney(employee.shiftRate) : '—'}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Отработано</span>
                </div>
                <p className="text-xl font-black text-slate-900 tabular-nums leading-none">
                  {shiftCount} {shiftCount === 1 ? 'смена' : shiftCount >= 2 && shiftCount <= 4 ? 'смены' : 'смен'}
                </p>
              </div>

              <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-amber-700/70 mb-1.5">
                  <HandCoins className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Аванс</span>
                </div>
                <p className="text-xl font-black text-amber-900 tabular-nums leading-none break-all">
                  {advanceTakenThisMonth > 0 ? formatMoney(advanceTakenThisMonth) : '—'}
                </p>
              </div>

              <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-emerald-700/70 mb-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">К выплате</span>
                </div>
                <p className={`text-xl font-black tabular-nums leading-none break-all ${netPayout < 0 ? 'text-rose-700' : 'text-emerald-900'}`}>
                  {formatMoney(netPayout)}
                </p>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {WEEKDAY_HEADERS.map((w) => (
                  <div key={w} className="text-center text-[10px] font-black text-slate-400">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
                  const iso = monthDayIso(d);
                  const shift = shiftByDate.get(iso);
                  const worked = !!shift;
                  const wd = weekdayOf(iso);
                  const isWeekend = wd === 'вс' || wd === 'сб';
                  const isToday = iso === today;
                  const cellCls = worked
                    ? 'bg-emerald-500 text-white'
                    : isWeekend
                    ? 'bg-amber-300 text-amber-900'
                    : 'bg-slate-100 text-slate-500';
                  return (
                    <div
                      key={iso}
                      title={worked ? `${formatDay(iso)} — ${formatMoney(shift!.rate)}` : formatDay(iso)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold tabular-nums ${cellCls} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> отработано
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-300 inline-block" /> выходной
                </span>
              </div>
            </div>

            {/* Day by day, for anyone who wants the detail behind the calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Смены по дням
                </h3>
              </div>

              {isLoading ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Загружаем…</p>
              ) : shifts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  В этом месяце смен пока нет
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...shifts]
                    .sort((a, b) => a.workDate.localeCompare(b.workDate))
                    .map((s) => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatDay(s.workDate)}
                            <span className="ml-2 text-xs font-medium text-slate-400">
                              {weekdayOf(s.workDate)}
                            </span>
                          </p>
                          {s.note && <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>}
                        </div>
                        <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">
                          {formatMoney(s.rate)}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {shifts.length > 0 && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Итого</span>
                  <span className="text-base font-black text-slate-900 tabular-nums">
                    {formatMoney(earned)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
