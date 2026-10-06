import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Loader2, CheckCircle2, UserX, Hand } from 'lucide-react';
import { StaffMember, Shift, WorkshopLocation } from '../types';
import { getCurrentFix, formatDistance } from '../lib/geolocation';

interface AttendanceManagerProps {
  staff: StaffMember[];
  telegramInitData: string;
}

const RADIUS_OPTIONS = [100, 150, 300, 500];

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const addDays = (iso: string, delta: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00+05:00`);
  return `${Number(iso.slice(8))} ${MONTHS_GEN[Number(iso.slice(5, 7)) - 1]}, ${WEEKDAYS[d.getDay()]}`;
};
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
const unitsWord = (u: number) => (u === 1 ? '1 смена' : `${String(u).replace('.', ',')} смены`);

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({ staff, telegramInitData }) => {
  const [date, setDate] = useState(almatyToday);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [location, setLocation] = useState<WorkshopLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const today = almatyToday();
  const employees = useMemo(
    () => staff.filter((s) => s.role === 'employee').sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [staff]
  );

  const load = (silent = false) => {
    if (!silent) setIsLoading(true);
    fetch(`/api/attendance?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setShifts(data.shifts || []);
        setLocation(data.location || null);
      })
      .catch((e) => console.error('Failed to load attendance:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // Today's journal fills up as people arrive, so keep it fresh while it is open.
    if (date !== today) return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [date]);

  const shiftOf = (id: string) => shifts.find((s) => s.staffId === id);
  const arrived = employees
    .filter((m) => shiftOf(m.id)?.checkInAt)
    .sort((a, b) => shiftOf(a.id)!.checkInAt!.localeCompare(shiftOf(b.id)!.checkInAt!));
  const manualOnly = employees.filter((m) => shiftOf(m.id) && !shiftOf(m.id)!.checkInAt);
  const absent = employees.filter((m) => !shiftOf(m.id));

  const saveLocation = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/attendance/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, initData: telegramInitData }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({
        kind: 'error',
        text:
          res.status === 403
            ? 'Нет подтверждения доступа. Откройте приложение через Telegram от имени владельца или заведующего.'
            : data?.error || 'Не удалось сохранить.',
      });
      return false;
    }
    setLocation(data.location);
    return true;
  };

  const setHere = async () => {
    setMessage(null);
    setIsLocating(true);
    try {
      const fix = await getCurrentFix();
      if (!fix) {
        setMessage({
          kind: 'error',
          text: 'Не удалось определить местоположение. Разрешите доступ к геолокации в настройках Telegram и повторите.',
        });
        return;
      }
      if (await saveLocation({ lat: fix.lat, lng: fix.lng, radius: location?.radius ?? 150 })) {
        const rough = fix.accuracy && fix.accuracy > 100 ? ` Точность низкая (±${Math.round(fix.accuracy)} м) — лучше повторить у окна или на улице у входа.` : '';
        setMessage({ kind: 'ok', text: `Местоположение цеха сохранено.${rough}` });
        load(true);
      }
    } finally {
      setIsLocating(false);
    }
  };

  const geoBadge = (s: Shift) => {
    if (s.checkInDistance == null) {
      return { text: 'без геолокации', cls: 'bg-slate-100 text-slate-600' };
    }
    const radius = location?.radius ?? 150;
    return s.checkInDistance <= radius
      ? { text: `в цехе · ${formatDistance(s.checkInDistance)}`, cls: 'bg-emerald-100 text-emerald-800' }
      : { text: `вне цеха · ${formatDistance(s.checkInDistance)}`, cls: 'bg-amber-100 text-amber-800' };
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Day */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center"
          aria-label="Предыдущий день"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-extrabold text-slate-900">{dayLabel(date)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {date === today ? 'сегодня · ' : ''}отметились {arrived.length} из {employees.length}
          </p>
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 flex items-center justify-center"
          aria-label="Следующий день"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Where the workshop is */}
      <div
        id="workshop-location-card"
        className={`rounded-2xl border p-3 ${location ? 'bg-white border-slate-200' : 'bg-amber-50 border-amber-200'}`}
      >
        <div className="flex items-start gap-2.5">
          <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${location ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              {location ? 'Местоположение цеха задано' : 'Местоположение цеха не задано'}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {location
                ? 'Отметиться можно только рядом с этой точкой, в пределах радиуса.'
                : 'Пока оно не задано, сотрудники не смогут отметиться. Встаньте в цехе и нажмите кнопку ниже.'}
            </p>
          </div>
        </div>
        <button
          id="btn-set-workshop-location"
          onClick={setHere}
          disabled={isLocating}
          className="mt-3 w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {location ? 'Обновить: я сейчас в цехе' : 'Задать: я сейчас в цехе'}
        </button>
        {location && (
          <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
            <span>Отметиться можно, если ближе, чем</span>
            <select
              value={location.radius}
              onChange={async (e) => {
                setMessage(null);
                await saveLocation({ radius: Number(e.target.value) });
              }}
              className="h-10 px-2 border border-slate-300 rounded-lg bg-white text-sm font-bold text-slate-900"
            >
              {[...new Set([...RADIUS_OPTIONS, location.radius])].sort((a, b) => a - b).map((r) => (
                <option key={r} value={r}>
                  {r} м
                </option>
              ))}
            </select>
          </label>
        )}
        {message && (
          <p className={`mt-2 text-xs font-medium ${message.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {message.text}
          </p>
        )}
      </div>

      {isLoading && <p className="text-center text-sm text-slate-400 py-2">Загружаем журнал…</p>}

      {/* Arrived */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          <h3 className="text-xs font-black uppercase tracking-wider">Отметились ({arrived.length})</h3>
        </div>
        {arrived.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400 italic">В этот день никто не отмечался</p>
        ) : (
          <div id="attendance-arrived" className="divide-y divide-slate-100">
            {arrived.map((m) => {
              const s = shiftOf(m.id)!;
              const badge = geoBadge(s);
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <p className="text-base font-black text-slate-900 tabular-nums w-14 shrink-0">{timeOf(s.checkInAt!)}</p>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{m.position || 'Внутренний сотрудник'}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className={`text-xs font-black ${(s.units ?? 1) === 1 ? 'text-slate-900' : 'text-amber-700'}`}>
                      {unitsWord(s.units ?? 1)}
                    </p>
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In the timesheet but never tapped «Я пришёл» */}
      {manualOnly.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-slate-600">
            <Hand className="w-4 h-4" />
            <h3 className="text-xs font-black uppercase tracking-wider">Проставлено вручную в табеле ({manualOnly.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {manualOnly.map((m) => (
              <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                <span className="text-[11px] text-slate-500 shrink-0">без отметки о приходе</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not marked at all */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-rose-600">
          <UserX className="w-4 h-4" />
          <h3 className="text-xs font-black uppercase tracking-wider">
            {date === today ? 'Ещё не отметились' : 'Не было отметки'} ({absent.length})
          </h3>
        </div>
        {absent.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400 italic">Все на месте</p>
        ) : (
          <div id="attendance-absent" className="divide-y divide-slate-100">
            {absent.map((m) => (
              <div key={m.id} className="px-4 py-2.5">
                <p className="text-sm font-bold text-slate-900">{m.name}</p>
                <p className="text-[11px] text-slate-500">{m.position || 'Внутренний сотрудник'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
