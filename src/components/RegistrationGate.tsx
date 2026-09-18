import React, { useEffect, useRef, useState } from 'react';
import { UserPlus, Clock, CheckCircle2, XCircle, RotateCcw, Phone, AlertTriangle } from 'lucide-react';
import { CoffeeShop, StaffRole, StaffMember, RegistrationRequest, SHOP_STAFF_POSITIONS } from '../types';
import { RoleShopFields } from './RoleShopFields';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';

const PENDING_ID_KEY = 'mc-bekary-pending-registration-id';

// How long to keep polling after the person taps "Поделиться номером" before giving up and
// offering a retry — the contact itself arrives asynchronously via a Telegram webhook, not as
// a direct response to anything we call, so there's no other way to bound the wait.
const CONTACT_POLL_INTERVAL_MS = 2000;
const CONTACT_POLL_MAX_ATTEMPTS = 60; // ~2 minutes

type ContactState = 'checking' | 'blocked-no-telegram' | 'need-contact' | 'waiting' | 'timeout' | 'unsupported' | 'confirmed';

// How often the waiting screen re-checks its own request. The screen promises the app will
// open by itself the moment the manager approves — without this it only ever found out on a
// manual tap or a restart, while the person sat looking at "на рассмотрении".
const STATUS_POLL_INTERVAL_MS = 10000;

interface RegistrationGateProps {
  shops: CoffeeShop[];
  staff: StaffMember[];
  // False until /api/initial-data has answered. Until then the lists are the bundled demo
  // rows, and "my request isn't there" would be a lie.
  serverDataLoaded: boolean;
  registrationRequests: RegistrationRequest[];
  onSubmit: (request: Omit<RegistrationRequest, 'id' | 'submittedAt' | 'status'>) => string;
  onApproved: (identity: {
    requestId: string;
    role: StaffRole;
    shopId: number | null;
    assignedShopIds?: number[];
    position?: string;
  }) => void;
  onRefresh: () => void;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  shop_manager: 'Менеджер точки',
  territorial_manager: 'Территориальный управляющий',
  employee: 'Внутренний сотрудник',
};

export const RegistrationGate: React.FC<RegistrationGateProps> = ({
  shops,
  staff,
  serverDataLoaded,
  registrationRequests,
  onSubmit,
  onApproved,
  onRefresh,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(() =>
    window.localStorage.getItem(PENDING_ID_KEY)
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopId, setShopId] = useState<number>(shops[0]?.id || 1);
  const [shopIds, setShopIds] = useState<number[]>([]);
  const [role, setRole] = useState<StaffRole>('shop_manager');
  const [position, setPosition] = useState('');

  // Phone is no longer typed in — it's confirmed by Telegram itself before the rest of the
  // form ever shows up (see CONTACT_POLL_* above and the state machine below).
  const [contactState, setContactState] = useState<ContactState>('checking');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myRequest = pendingId ? registrationRequests.find((r) => r.id === pendingId) : null;

  const checkContactStatus = async (): Promise<boolean> => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.initData) return false;
    try {
      const res = await fetch('/api/registration/contact-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await res.json();
      if (data?.ready && data?.phone) {
        setPhone(data.phone);
        if (data.firstName) {
          setName((prev) => prev || [data.firstName, data.lastName].filter(Boolean).join(' '));
        }
        setContactState('confirmed');
        return true;
      }
    } catch (e) {
      console.error('Failed to check contact status:', e);
    }
    return false;
  };

  // Runs once whenever we're about to show the mandatory form (fresh device, or right after
  // "Подать заявку заново") — re-checks first, so someone who already shared their number once
  // before doesn't have to tap the button again.
  useEffect(() => {
    if (pendingId) return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.initData) {
      setContactState('blocked-no-telegram');
      return;
    }
    setContactState('checking');
    checkContactStatus().then((ready) => {
      if (!ready) setContactState('need-contact');
    });
  }, [pendingId]);

  useEffect(() => {
    if (contactState !== 'waiting') return;
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const ready = await checkContactStatus();
      if (ready && pollRef.current) {
        clearInterval(pollRef.current);
      } else if (attempts >= CONTACT_POLL_MAX_ATTEMPTS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setContactState('timeout');
      }
    }, CONTACT_POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [contactState]);

  const handleShareContact = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || typeof tg.requestContact !== 'function') {
      setContactState('unsupported');
      return;
    }
    setContactState('waiting');
    tg.requestContact((shared: boolean) => {
      if (!shared) setContactState('need-contact');
    });
  };

  // The staff record an approval creates, found by the id derived from the request. This is
  // the fallback identity when the request row itself is missing.
  const myStaffRecord = pendingId ? staff.find((s) => s.id === `staff-from-${pendingId}`) : undefined;

  useEffect(() => {
    if (myRequest?.status === 'approved') {
      window.localStorage.removeItem(PENDING_ID_KEY);
      onApproved({
        requestId: myRequest.id,
        role: myRequest.requestedRole,
        shopId: myRequest.requestedShopId,
        assignedShopIds: myRequest.requestedShopIds,
        position: myRequest.requestedPosition,
      });
    }
  }, [myRequest?.status]);

  // The request is gone from the server but this device is still waiting on it. Either it was
  // approved and the row was lost afterwards — the staff record proves it, so let them in — or
  // it was lost before anyone saw it, in which case nobody is coming and the only way out is to
  // submit again. Without this the person waits on "на рассмотрении" forever, invisible to the
  // manager, which is exactly what happened to several people on 2026-09-17.
  useEffect(() => {
    if (!pendingId || myRequest || !serverDataLoaded) return;
    if (myStaffRecord) {
      window.localStorage.removeItem(PENDING_ID_KEY);
      onApproved({
        requestId: pendingId,
        role: myStaffRecord.role,
        shopId: myStaffRecord.shopId ?? null,
        assignedShopIds: myStaffRecord.assignedShopIds,
        position: myStaffRecord.position,
      });
      return;
    }
    window.localStorage.removeItem(PENDING_ID_KEY);
    setPendingId(null);
  }, [pendingId, myRequest, myStaffRecord, serverDataLoaded]);

  // Waiting screen: ask about this one request rather than refetching all eleven tables, and
  // only pull the full state once something has actually changed.
  useEffect(() => {
    if (!pendingId || myRequest?.status !== 'pending') return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/registration-requests/${encodeURIComponent(pendingId)}`);
        const data = await res.json();
        if (!data || data.request === null || data.request?.status !== 'pending') onRefresh();
      } catch (e) {
        console.error('Failed to check registration status:', e);
      }
    }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pendingId, myRequest?.status]);

  // Кто ещё ждёт решения по этой же точке. Территориальный просит сразу несколько точек,
  // поэтому сравниваем наборы, а не одно число. Внутренних сотрудников не сравниваем вовсе —
  // все они формально «на производстве», и предупреждать одного заявителя-цеховика про
  // другого только потому, что у обоих один и тот же служебный шифр точки, было бы ложным
  // срабатыванием: на производстве закономерно работает много разных людей.
  const requestedPoints = role === 'territorial_manager' ? shopIds : [shopId];
  const sameShopRequests =
    role === 'employee'
      ? []
      : registrationRequests.filter(
          (r) =>
            r.status === 'pending' &&
            r.id !== pendingId &&
            r.requestedRole !== 'employee' &&
            (r.requestedShopIds || [r.requestedShopId]).some((id) => requestedPoints.includes(id))
        );

  const submitRequest = () => {
    const newId = onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      requestedShopId: shopId,
      requestedShopIds: role === 'territorial_manager' ? shopIds : undefined,
      requestedRole: role,
      // Должность нужна и сотрудникам кофейни: бариста и менеджер точки делят одну роль
      // и различаются только ею. Не передаём её лишь у территориального управляющего.
      requestedPosition: role === 'territorial_manager' ? undefined : position || undefined,
    });
    window.localStorage.setItem(PENDING_ID_KEY, newId);
    setPendingId(newId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (role === 'territorial_manager' && shopIds.length === 0) return;
    // На точку законно устраиваются несколько человек, поэтому это подтверждение, а не
    // запрет: показываем, кто уже подал, чтобы один и тот же человек не подался дважды.
    if (sameShopRequests.length > 0) {
      setShowDuplicateWarning(true);
      return;
    }
    submitRequest();
  };

  const handleRetry = () => {
    window.localStorage.removeItem(PENDING_ID_KEY);
    setPendingId(null);
  };

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm border border-slate-200 relative">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 flex items-center justify-center mb-3">
            <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-full h-full object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  // Rejected — offer to submit again
  if (myRequest?.status === 'rejected') {
    return (
      <Shell>
        <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mb-3 border border-rose-200">
          <XCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Заявка отклонена</h3>
        <p className="text-xs text-slate-500 mt-1">
          Управляющий отклонил вашу заявку. Уточните детали и подайте заявку заново, либо обратитесь к управляющему.
        </p>
        <button
          onClick={handleRetry}
          className="mt-5 w-full flex items-center justify-center space-x-1.5 min-h-[52px] text-sm font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Подать заявку заново</span>
        </button>
      </Shell>
    );
  }

  // Pending (or freshly submitted, waiting for the data to load) — blocking waiting screen
  if (pendingId) {
    return (
      <Shell>
        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-3 border border-amber-200">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Заявка на рассмотрении</h3>
        <p className="text-xs text-slate-500 mt-1">
          Управляющий ещё не подтвердил вашу заявку. Как только это произойдёт, приложение откроется само.
        </p>
        {myRequest && (
          <div className="w-full mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs space-y-1">
            <div><span className="text-slate-400">ФИО:</span> <span className="font-bold text-slate-800">{myRequest.name}</span></div>
            <div>
              <span className="text-slate-400">Должность:</span>{' '}
              <span className="font-bold text-slate-800">
                {/* Должность точнее роли: бариста и менеджер точки делят роль shop_manager,
                    и без этого бариста видел бы здесь «Менеджер точки». */}
                {myRequest.requestedPosition || ROLE_LABELS[myRequest.requestedRole]}
              </span>
            </div>
            <div>
              <span className="text-slate-400">{myRequest.requestedShopIds ? 'Точки:' : 'Точка:'}</span>{' '}
              <span className="font-bold text-slate-800">
                {myRequest.requestedRole === 'employee'
                  ? 'Производство'
                  : myRequest.requestedShopIds
                  ? myRequest.requestedShopIds.map((id) => `№${id}`).join(', ')
                  : `№${myRequest.requestedShopId}`}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={onRefresh}
          className="mt-5 w-full min-h-[52px] text-sm font-bold uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
        >
          Проверить статус
        </button>
      </Shell>
    );
  }

  // Opened outside Telegram (e.g. a preview link in a plain browser) — there's no way to
  // confirm a phone number without Telegram's own contact-share button, so registration can't
  // proceed at all here.
  if (contactState === 'blocked-no-telegram') {
    return (
      <Shell>
        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-3 border border-amber-200">
          <Phone className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Откройте через Telegram</h3>
        <p className="text-xs text-slate-500 mt-1">
          Регистрация возможна только внутри Telegram — так мы можем подтвердить ваш номер
          телефона. Откройте приложение через бота.
        </p>
      </Shell>
    );
  }

  if (contactState === 'checking') {
    return (
      <Shell>
        <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mb-3 border border-slate-200">
          <Phone className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Проверяем номер…</h3>
      </Shell>
    );
  }

  // Number not confirmed yet — the mandatory form below doesn't even render until it is.
  if (contactState !== 'confirmed') {
    return (
      <Shell>
        <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
          <Phone className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Подтвердите номер телефона</h3>
        <p className="text-xs text-slate-500 mt-1">
          Нажмите «Поделиться номером» — Telegram сам подтвердит, что номер ваш. Вводить его
          вручную не нужно.
        </p>

        {contactState === 'unsupported' && (
          <p className="text-xs text-rose-600 mt-3 font-bold">
            Ваша версия Telegram это не поддерживает. Обновите Telegram и попробуйте снова.
          </p>
        )}
        {contactState === 'timeout' && (
          <p className="text-xs text-rose-600 mt-3 font-bold">Номер не пришёл. Попробуйте ещё раз.</p>
        )}

        <button
          onClick={handleShareContact}
          disabled={contactState === 'waiting'}
          className="mt-5 w-full min-h-[52px] text-sm font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-md transition-all"
        >
          {contactState === 'waiting' ? 'Ждём подтверждение…' : 'Поделиться номером'}
        </button>
      </Shell>
    );
  }

  // Tapped "Отправить" for a point somebody else is already waiting on.
  if (showDuplicateWarning) {
    return (
      <Shell>
        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-3 border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">
          На эту точку уже подана заявка
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Проверьте, не подали ли вы её раньше сами. Если это ваш коллега — подавайте свою,
          на точке может работать несколько человек.
        </p>

        <div className="w-full mt-4 space-y-2">
          {sameShopRequests.map((r) => (
            <div
              key={r.id}
              className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-xs space-y-1"
            >
              <div className="font-bold text-slate-900">{r.name}</div>
              <div className="text-slate-600">
                {r.requestedPosition || ROLE_LABELS[r.requestedRole]}
              </div>
              <div className="text-slate-500">
                Точка{' '}
                {(r.requestedShopIds || [r.requestedShopId]).map((id) => `№${id}`).join(', ')} ·
                подана в {r.submittedAt}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setShowDuplicateWarning(false);
            submitRequest();
          }}
          className="mt-5 w-full min-h-[52px] text-sm font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
        >
          Всё равно подать
        </button>
        <button
          onClick={() => setShowDuplicateWarning(false)}
          className="mt-2 w-full min-h-[48px] text-sm font-bold uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
        >
          Вернуться к анкете
        </button>
      </Shell>
    );
  }

  // No request yet — mandatory registration form
  return (
    <Shell>
      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
        <UserPlus className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-extrabold text-slate-900">Регистрация</h3>
      <p className="text-xs text-slate-500 mt-1">
        Это устройство ещё не зарегистрировано. Заполните заявку — управляющий подтвердит точку и должность.
      </p>

      <form onSubmit={handleSubmit} className="w-full mt-5 space-y-3 text-left">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">ФИО</label>
          <input
            type="text"
            required
            placeholder="Например: Асель Ким"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Телефон</label>
          {/* Подтверждён Telegram-ом на предыдущем шаге — руками уже не вводится и не
              редактируется, чтобы номер нельзя было подменить. */}
          <div className="w-full px-3 min-h-[48px] flex items-center justify-between text-base border border-emerald-200 bg-emerald-50 rounded-xl text-slate-900 font-medium">
            <span>{phone}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          </div>
        </div>

        <RoleShopFields
          shops={shops}
          role={role}
          onRoleChange={setRole}
          position={position}
          onPositionChange={setPosition}
          shopId={shopId}
          onShopIdChange={setShopId}
          shopIds={shopIds}
          onShopIdsChange={setShopIds}
        />

        <button
          type="submit"
          className="w-full mt-2 min-h-[52px] text-sm font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
        >
          Отправить заявку
        </button>
      </form>
    </Shell>
  );
};
