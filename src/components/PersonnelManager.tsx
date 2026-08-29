import React, { useState } from 'react';
import { CoffeeShop, StaffMember, StaffRole, RegistrationRequest } from '../types';
import { Users, UserCheck, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';

interface PersonnelManagerProps {
  shops: CoffeeShop[];
  staff: StaffMember[];
  registrationRequests: RegistrationRequest[];
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  onUpdateRegistrationRequest: (requestId: string, updates: Partial<RegistrationRequest>) => void;
  onApproveRegistrationRequest: (requestId: string) => void;
  onRejectRegistrationRequest: (requestId: string) => void;
}

const ROLE_GROUPS: { key: StaffRole; label: string }[] = [
  { key: 'employee', label: 'Внутренние сотрудники' },
  { key: 'territorial_manager', label: 'Территориальные управляющие' },
  { key: 'shop_manager', label: 'Менеджеры точек' }
];

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  shops,
  staff,
  registrationRequests,
  onUpdateStaffMember,
  onUpdateRegistrationRequest,
  onApproveRegistrationRequest,
  onRejectRegistrationRequest
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'requests'>('staff');
  const pendingRequests = registrationRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Sub-header / tab toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Персонал</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Внутренние сотрудники, территориальные управляющие и менеджеры точек
          </p>
        </div>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
              activeTab === 'staff'
                ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Сотрудники ({staff.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
              activeTab === 'requests'
                ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Заявки на регистрацию ({pendingRequests.length})</span>
          </button>
        </div>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          {ROLE_GROUPS.map((group) => {
            const members = staff.filter((s) => s.role === group.key);
            return (
              <div key={group.key} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {group.label} ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Пока никого нет в этой группе.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {members.map((member) => (
                      <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                        <div className="font-bold text-slate-900 text-sm">{member.name}</div>
                        {member.phone && <div className="text-[11px] text-slate-500">{member.phone}</div>}

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
                              className="w-full bg-transparent font-bold text-indigo-900 text-[10px] leading-tight focus:outline-none cursor-pointer"
                            >
                              <option value="">Без точки</option>
                              {shops.map((s) => (
                                <option key={s.id} value={s.id}>
                                  №{s.id}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                            <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Должность</span>
                            <select
                              value={member.role}
                              onChange={(e) => onUpdateStaffMember(member.id, { role: e.target.value as StaffRole })}
                              className="w-full bg-transparent font-bold text-indigo-900 text-[10px] leading-tight focus:outline-none cursor-pointer"
                            >
                              {ROLE_GROUPS.map((g) => (
                                <option key={g.key} value={g.key}>
                                  {g.label}
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
            );
          })}
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
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-64 shrink-0">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                      {req.requestedShopIds ? 'Точки' : 'Точка'}
                    </span>
                    {req.requestedShopIds ? (
                      <span className="block font-bold text-indigo-900 text-[10px] leading-tight">
                        {req.requestedShopIds.map((id) => `№${id}`).join(', ')}
                      </span>
                    ) : (
                      <select
                        value={req.requestedShopId}
                        onChange={(e) =>
                          onUpdateRegistrationRequest(req.id, { requestedShopId: Number(e.target.value) })
                        }
                        className="w-full bg-transparent font-bold text-indigo-900 text-[10px] leading-tight focus:outline-none cursor-pointer"
                      >
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            №{s.id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Должность</span>
                    <select
                      value={req.requestedRole}
                      onChange={(e) =>
                        onUpdateRegistrationRequest(req.id, { requestedRole: e.target.value as StaffRole })
                      }
                      className="w-full bg-transparent font-bold text-indigo-900 text-[10px] leading-tight focus:outline-none cursor-pointer"
                    >
                      {ROLE_GROUPS.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
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
