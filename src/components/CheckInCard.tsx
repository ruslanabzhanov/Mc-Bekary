import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, MapPin, Loader2 } from 'lucide-react';
import { Shift } from '../types';
import { getCurrentFix } from '../lib/geolocation';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

interface CheckInCardProps {
  staffId: string;
  // Called with the shift after every successful mark, so a screen that also lists shifts
  // (the employee cabinet) can show it without refetching.
  onChange?: (shift: Shift) => void;
}

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const checkInTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });

// «Я пришёл»: the big button, today's mark, and the 1 / 0,5 shift dialog. Shared by the employee
// cabinet and by the production head (who is a staff member too, but lives on the admin screen).
export const CheckInCard: React.FC<CheckInCardProps> = ({ staffId, onChange }) => {
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [units, setUnits] = useState<1 | 0.5>(1);
  const [step, setStep] = useState<'idle' | 'locating' | 'sending'>('idle');
  const [error, setError] = useState('');
  const [geoFailed, setGeoFailed] = useState(false);

  useTelegramBackButton(isOpen, () => setIsOpen(false));

  useEffect(() => {
    let cancelled = false;
    setTodayShift(null);
    const today = almatyToday();
    fetch(`/api/timesheet?month=${today.slice(0, 7)}&staffId=${encodeURIComponent(staffId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTodayShift((data.shifts || []).find((s: Shift) => s.workDate === today) || null);
      })
      .catch((e) => console.error('Failed to load today shift:', e));
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  // First tap of the day sends where the person is; after that the same call only switches
  // 1 ↔ 0.5 and never re-records the arrival.
  const submit = async (picked: 1 | 0.5, withGeo: boolean) => {
    setError('');
    let fix: Awaited<ReturnType<typeof getCurrentFix>> = null;
    if (withGeo && !todayShift?.checkInAt) {
      setStep('locating');
      fix = await getCurrentFix();
      if (!fix) {
        setStep('idle');
        setGeoFailed(true);
        setError(
          'Не удалось определить местоположение. Включите геолокацию на телефоне и разрешите её для Telegram, затем нажмите «Отметиться» ещё раз.'
        );
        return;
      }
    }
    setStep('sending');
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, units: picked, lat: fix?.lat, lng: fix?.lng, accuracy: fix?.accuracy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.shift) {
        setError(data?.error || 'Не удалось отметиться. Попробуйте ещё раз.');
        return;
      }
      const shift: Shift = data.shift;
      setTodayShift(shift);
      onChange?.(shift);
      setIsOpen(false);
      setGeoFailed(false);
    } catch (e) {
      console.error('Check-in failed:', e);
      setError('Нет связи с сервером.');
    } finally {
      setStep('idle');
    }
  };

  return (
    <>
      {todayShift?.checkInAt ? (
        <div id="check-in-done" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-emerald-900">Вы отмечены в {checkInTime(todayShift.checkInAt)}</p>
            <p className="text-xs text-emerald-800 mt-0.5">{(todayShift.units ?? 1) === 1 ? '1 смена' : '0,5 смены'}</p>
          </div>
          <button
            id="btn-check-in-switch"
            onClick={() => submit((todayShift.units ?? 1) === 1 ? 0.5 : 1, false)}
            disabled={step !== 'idle'}
            className="shrink-0 min-h-[44px] px-3 rounded-xl border border-emerald-300 bg-white text-emerald-800 text-xs font-bold disabled:opacity-50"
          >
            {(todayShift.units ?? 1) === 1 ? 'Изменить на 0,5' : 'Изменить на 1'}
          </button>
        </div>
      ) : (
        <button
          id="btn-check-in"
          onClick={() => {
            setError('');
            setGeoFailed(false);
            setUnits(1);
            setIsOpen(true);
          }}
          className="w-full min-h-[72px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-sm flex items-center justify-center gap-3 transition-all"
        >
          <MapPin className="w-6 h-6" />
          <span className="text-left">
            <span className="block text-base font-black uppercase tracking-wider">Я пришёл</span>
            <span className="block text-[11px] opacity-90">отметиться о приходе на работу</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => step === 'idle' && setIsOpen(false)}
        >
          <div id="check-in-dialog" className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Отметка о приходе</h3>
              <button
                onClick={() => setIsOpen(false)}
                disabled={step !== 'idle'}
                className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">Сколько смен отработаете сегодня?</p>
            <div className="grid grid-cols-2 gap-2">
              {([1, 0.5] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={`min-h-[64px] rounded-xl border-2 font-black text-lg transition-colors ${
                    units === u ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {u === 1 ? '1 смена' : '0,5 смены'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Отметиться можно только в цехе: приложение проверит ваше местоположение и запомнит время.
            </p>
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
            <button
              id="btn-confirm-check-in"
              onClick={() => submit(units, true)}
              disabled={step !== 'idle'}
              className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {step !== 'idle' && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 'locating' ? 'Определяем местоположение…' : step === 'sending' ? 'Отмечаем…' : 'Отметиться'}
            </button>
            {geoFailed && (
              <p className="text-[11px] text-slate-500 text-center">
                В Telegram: ⋯ → Настройки → разрешите доступ к геолокации для этого приложения.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};
