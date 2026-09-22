import React, { useState } from 'react';
import {
  CoffeeShop, StaffMember, StaffRole, RegistrationRequest, POSITION_OPTIONS, positionValueOf,
} from '../types';
import { UserCheck, CheckCircle2, XCircle, ClipboardList, AlertTriangle, Search, Trash2 } from 'lucide-react';

interface PersonnelManagerProps {
  shops: CoffeeShop[];
  staff: StaffMember[];
  registrationRequests: RegistrationRequest[];
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  onUpdateRegistrationRequest: (requestId: string, updates: Partial<RegistrationRequest>) => void;
  onApproveRegistrationRequest: (requestId: string) => void;
  onRejectRegistrationRequest: (requestId: string) => void;
  // Only the Owner and «Заведующий производством» reach this screen at all (gated one level up,
  // same as everything else in the «Цех» cabinet) — no extra role check needed here.
  onDeleteStaffMember: (staffId: string) => void;
}

// Fallback wording for a request saved before positions existed, which has only a role.
const ROLE_GROUP_LABELS: Record<StaffRole, string> = {
  employee: 'Внутренний сотрудник',
  territorial_manager: 'Территориальный управляющий',
  shop_manager: 'Менеджер точки',
};

// The staff list toggles between two views instead of stacking three separate groups:
// "internal" (employees, not tied to a shop) and "shop" (territorial managers + shop
// managers together — both are point-facing roles, shown in one merged list).
const STAFF_VIEWS: { key: 'internal' | 'shop'; label: string; roles: StaffRole[] }[] = [
  { key: 'shop', label: 'Сотрудники кофейни', roles: ['territorial_manager', 'shop_manager'] },
  { key: 'internal', label: 'Внутренние сотрудники', roles: ['employee'] }
];

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  shops,
  staff,
  registrationRequests,
  onUpdateStaffMember,
  onUpdateRegistrationRequest,
  onApproveRegistrationRequest,
  onRejectRegistrationRequest,
  onDeleteStaffMember
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'requests'>('staff');
  const [staffView, setStaffView] = useState<'internal' | 'shop'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShopId, setFilterShopId] = useState<'all' | number>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const pendingRequests = registrationRequests.filter((r) => r.status === 'pending');

  // Toggle buttons and the category filter below drive the same state on purpose — two ways
  // to reach it, never two contradicting states.
  const switchStaffView = (view: 'internal' | 'shop') => {
    setStaffView(view);
    setFilterShopId('all');
    setFilterPosition('all');
  };

  // Which positions the "Должность" filter offers depends on the category shown — internal
  // staff and shop-facing staff draw from disjoint parts of POSITION_OPTIONS.
  const positionFilterOptions = POSITION_OPTIONS.filter((o) =>
    staffView === 'internal' ? o.role === 'employee' : o.role !== 'employee'
  );

  // Other people waiting on the same point. A territorial manager asks for several points at
  // once, so both sides are compared as sets. Internal staff never compared — every one of
  // them formally shares the same placeholder "point" (production), so this would flag every
  // pair of them as duplicates even though many different people legitimately work there.
  const pointsOf = (r: RegistrationRequest) => r.requestedShopIds || [r.requestedShopId];
  const duplicatesFor = (req: RegistrationRequest) =>
    req.requestedRole === 'employee'
      ? []
      : pendingRequests.filter(
          (other) =>
            other.id !== req.id &&
            other.requestedRole !== 'employee' &&
            pointsOf(other).some((id) => pointsOf(req).includes(id))
        );

  const handleDeleteMember = (member: StaffMember) => {
    if (!window.confirm(`Удалить «${member.name}»? Это действие нельзя отменить.`)) return;
    onDeleteStaffMember(member.id);
  };

  const currentViewMembers = staff.filter((s) =>
    STAFF_VIEWS.find((v) => v.key === staffView)!.roles.includes(s.role)
  );
  const q = searchQuery.trim().toLowerCase();
  const filteredMembers = currentViewMembers.filter((m) => {
    if (filterShopId !== 'all' && m.shopId !== filterShopId) return false;
    if (filterPosition !== 'all' && positionValueOf(m.role, m.position) !== filterPosition) return false;
    if (q && !m.name.toLowerCase().includes(q) && !(m.phone || '').includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Сотрудники / Заявки на регистрацию — всегда в одну строку */}
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded text-[11px] font-bold uppercase tracking-wide transition-all whitespace-nowrap overflow-hidden ${
            activeTab === 'staff'
              ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Сотрудники ({staff.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded text-[11px] font-bold uppercase tracking-wide transition-all whitespace-nowrap overflow-hidden ${
            activeTab === 'requests'
              ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Заявки ({pendingRequests.length})</span>
        </button>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="space-y-3">
          {/* Сотрудники кофейни / Внутренние сотрудники — тоже в одну строку */}
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {STAFF_VIEWS.map((view) => {
              const count = staff.filter((s) => view.roles.includes(s.role)).length;
              return (
                <button
                  key={view.key}
                  onClick={() => switchStaffView(view.key)}
                  className={`flex-1 min-w-0 px-1 py-2.5 rounded text-[9.5px] leading-tight font-bold uppercase transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                    staffView === view.key
                      ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {view.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Общий поиск */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени или телефону"
              className="w-full pl-9 pr-3 min-h-[44px] text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          {/* Фильтры: категория / точка / должность */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={staffView}
              onChange={(e) => switchStaffView(e.target.value as 'internal' | 'shop')}
              className="w-full px-1.5 min-h-[40px] text-[10px] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
            >
              {STAFF_VIEWS.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
            <select
              value={filterShopId}
              onChange={(e) => setFilterShopId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={staffView === 'internal'}
              className="w-full px-1.5 min-h-[40px] text-[10px] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="all">Все точки</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.district.trim() || s.address}</option>
              ))}
            </select>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-1.5 min-h-[40px] text-[10px] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
            >
              <option value="all">Все должности</option>
              {positionFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {filteredMembers.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Никого не нашлось по этим условиям.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMembers.map((member) => (
                <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{member.name}</div>
                      {member.phone && <div className="text-[11px] text-slate-500">{member.phone}</div>}
                    </div>
                    <button
                      onClick={() => handleDeleteMember(member)}
                      title="Удалить сотрудника"
                      className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Точка</span>
                      <select
                        value={member.shopId ?? ''}
                        onChange={(e) =>
                          onUpdateStaffMember(member.id, {
                            shopId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full bg-transparent font-bold text-indigo-900 text-xs leading-tight min-h-[32px] focus:outline-none cursor-pointer"
                      >
                        <option value="">Без точки</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.district.trim() || s.address}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Должность</span>
                      <select
                        value={positionValueOf(member.role, member.position)}
                        onChange={(e) => {
                          const picked = POSITION_OPTIONS.find((o) => o.value === e.target.value);
                          if (picked) {
                            onUpdateStaffMember(member.id, { role: picked.role, position: picked.position });
                          }
                        }}
                        className="w-full bg-transparent font-bold text-indigo-900 text-xs leading-tight min-h-[32px] focus:outline-none cursor-pointer"
                      >
                        {POSITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REGISTRATION REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
              Новых заявок на регистрацию нет.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm">{req.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {req.phone && <>{req.phone} · </>}
                    Подано в {req.submittedAt}
                  </div>
                  {/* Точка может нанимать несколько человек, поэтому это подсказка, а не запрет:
                      она нужна, чтобы один и тот же человек не был заведён дважды. */}
                  {duplicatesFor(req).length > 0 && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>
                        На эту точку уже есть заявка:{' '}
                        {duplicatesFor(req)
                          .map((d) => `${d.name} (${d.requestedPosition || ROLE_GROUP_LABELS[d.requestedRole]}, ${d.submittedAt})`)
                          .join('; ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-64 shrink-0">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                      {req.requestedShopIds ? 'Точки' : 'Точка'}
                    </span>
                    {req.requestedRole === 'employee' ? (
                      <span className="block font-bold text-indigo-900 text-xs leading-tight py-1.5">
                        Производство
                      </span>
                    ) : req.requestedShopIds ? (
                      <span className="block font-bold text-indigo-900 text-[10px] leading-tight">
                        {req.requestedShopIds.map((id) => `№${id}`).join(', ')}
                      </span>
                    ) : (
                      <select
                        value={req.requestedShopId}
                        onChange={(e) =>
                          onUpdateRegistrationRequest(req.id, { requestedShopId: Number(e.target.value) })
                        }
                        className="w-full bg-transparent font-bold text-indigo-900 text-xs leading-tight min-h-[32px] focus:outline-none cursor-pointer"
                      >
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.district.trim() || s.address}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Должность</span>
                    {/* Настоящая должность, а не группа роли: раньше здесь стоял список из трёх
                        ролей, поэтому «Бариста» выглядел как «Менеджеры точек», а смена этого
                        списка меняла роль, оставляя старую должность — так и появились записи
                        вроде «менеджер точки» с должностью «Ночной заготовщик кухни». */}
                    <select
                      value={positionValueOf(req.requestedRole, req.requestedPosition)}
                      onChange={(e) => {
                        const picked = POSITION_OPTIONS.find((o) => o.value === e.target.value);
                        if (picked) {
                          onUpdateRegistrationRequest(req.id, {
                            requestedRole: picked.role,
                            requestedPosition: picked.position,
                          });
                        }
                      }}
                      className="w-full bg-transparent font-bold text-indigo-900 text-xs leading-tight min-h-[32px] focus:outline-none cursor-pointer"
                    >
                      {POSITION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onApproveRegistrationRequest(req.id)}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Принять</span>
                  </button>
                  <button
                    onClick={() => onRejectRegistrationRequest(req.id)}
                    className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                    title="Отклонить"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
