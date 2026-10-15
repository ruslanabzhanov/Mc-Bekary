import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, FileSpreadsheet, Loader2, Wallet, History, CheckCircle2 } from 'lucide-react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import {
  Reimbursement, ReimbursementLine, ReimbursementLogEntry, computeReimbursementTotals,
} from '../lib/reimbursement';
import { StaffMember } from '../types';

interface ReimbursementManagerProps {
  telegramInitData: string;
  actorName: string;
  staff: StaffMember[];
}

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const isoLong = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MON[Number(m) - 1]} ${y}`;
};
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const money = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ru-RU')} ₸`;
const WHO_KEY = 'mc-bekary-reimb-who';

type Api = <T = any>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export const ReimbursementManager: React.FC<ReimbursementManagerProps> = ({ telegramInitData, actorName, staff }) => {
  const [list, setList] = useState<Reimbursement[] | null>(null);
  const [error, setError] = useState<{ text: string; noTables?: boolean } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const api = useCallback<Api>(
    (async (path: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(`/api/reimbursements${path}`, {
        method: init?.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': telegramInitData },
        body: init?.body !== undefined ? JSON.stringify({ ...(init.body as object), actorName }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e: any = new Error(data?.error || 'Не удалось выполнить. Попробуйте ещё раз.');
        e.code = data?.code;
        throw e;
      }
      return data;
    }) as Api,
    [telegramInitData, actorName]
  );

  const loadList = useCallback(async () => {
    try {
      const data = await api<{ reimbursements: Reimbursement[] }>('');
      setList(data.reimbursements);
      setError(null);
    } catch (e: any) {
      setList([]);
      setError({ text: e.message, noTables: e.code === 'no_tables' });
    }
  }, [api]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useTelegramBackButton(openId !== null, () => {
    setOpenId(null);
    loadList();
  });

  const draft = list?.find((r) => r.status === 'draft') || null;

  const startNew = async () => {
    setIsCreating(true);
    try {
      const data = await api<{ reimbursement: Reimbursement }>('', { method: 'POST', body: {} });
      setOpenId(data.reimbursement.id);
    } catch (e: any) {
      setError({ text: e.message, noTables: e.code === 'no_tables' });
    } finally {
      setIsCreating(false);
    }
  };

  if (openId !== null) {
    return (
      <Editor
        id={openId}
        api={api}
        telegramInitData={telegramInitData}
        staff={staff}
        onBack={() => {
          setOpenId(null);
          loadList();
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {error && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error.noTables ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          <p className="font-bold">{error.text}</p>
          {error.noTables && (
            <p className="mt-1 text-xs">Таблицы для возмещения ещё не созданы. Нужно один раз выполнить SQL в Supabase: сообщите разработчику.</p>
          )}
        </div>
      )}

      <button
        id="btn-new-reimbursement"
        onClick={startNew}
        disabled={isCreating || (error?.noTables ?? false) || list === null}
        className="w-full min-h-[64px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm flex items-center justify-center gap-3 transition-all"
      >
        {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
        <span className="text-left">
          <span className="block text-sm font-black uppercase tracking-wider">
            {draft ? `Продолжить возмещение №${draft.number}` : 'Добавить новое возмещение'}
          </span>
          <span className="block text-[11px] opacity-85">
            {draft ? 'Черновик ещё не сохранён' : 'Остаток с прошлого подставится сам'}
          </span>
        </span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-slate-600">
          <History className="w-4 h-4" />
          <h3 className="text-xs font-black uppercase tracking-wider">История возмещений</h3>
        </div>
        {list === null ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Загружаем…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Пока нет ни одного возмещения. Нажмите «Добавить новое возмещение», чтобы начать.
          </p>
        ) : (
          <div id="reimbursement-history" className="divide-y divide-slate-100">
            {list.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">Возмещение №{r.number}</span>
                    {r.status === 'draft' && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">черновик</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{isoLong(dateOf(r.savedAt || r.createdAt))}</p>
                  <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                    Расходы {money(r.expenses)} · пополнения {money(r.topups)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] font-black uppercase text-slate-400">Остаток</span>
                  <span className={`text-sm font-black tabular-nums ${r.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{money(r.balance)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EditorProps {
  id: number;
  api: Api;
  telegramInitData: string;
  staff: StaffMember[];
  onBack: () => void;
}

const Editor = ({ id, api, telegramInitData, staff, onBack }: EditorProps) => {
  const [rm, setRm] = useState<Reimbursement | null>(null);
  const [lines, setLines] = useState<ReimbursementLine[]>([]);
  const [log, setLog] = useState<ReimbursementLogEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [confirm, setConfirm] = useState<'save' | 'cancel' | null>(null);
  const [openingInput, setOpeningInput] = useState('');

  const [who, setWho] = useState(() => {
    try {
      return window.localStorage.getItem(WHO_KEY) || '';
    } catch {
      return '';
    }
  });
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(almatyToday());
  const [topAmount, setTopAmount] = useState('');
  const [topNote, setTopNote] = useState('');
  const [topDate, setTopDate] = useState(almatyToday());

  const names = useMemo(() => {
    const set = new Set<string>();
    staff.filter((s) => s.role === 'employee').forEach((s) => set.add(s.name));
    lines.forEach((l) => l.who && set.add(l.who));
    return [...set];
  }, [staff, lines]);

  const load = useCallback(async () => {
    try {
      const d = await api<{ reimbursement: Reimbursement; lines: ReimbursementLine[]; log: ReimbursementLogEntry[] }>(`/${id}`);
      setRm(d.reimbursement);
      setLines(d.lines);
      setLog(d.log);
      setLoadError('');
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const isDraft = rm?.status === 'draft';
  const totals = useMemo(() => computeReimbursementTotals(rm?.openingBalance || 0, lines), [rm?.openingBalance, lines]);
  const expenses = lines.filter((l) => l.kind === 'expense');
  const topups = lines.filter((l) => l.kind === 'topup');
  // Остаток вводят руками только у самого первого возмещения: у остальных он идёт из прошлого.
  const [isFirst, setIsFirst] = useState(false);
  const [prevNo, setPrevNo] = useState<number | null>(null);
  useEffect(() => {
    api<{ reimbursements: Reimbursement[] }>('')
      .then((d) => {
        setIsFirst(!d.reimbursements.some((r) => r.status === 'saved'));
        setPrevNo(d.reimbursements.find((r) => r.status === 'saved' && r.id < id)?.number ?? null);
      })
      .catch(() => {});
  }, [api, id, rm?.status]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addLine = (kind: 'expense' | 'topup') =>
    run(async () => {
      const body =
        kind === 'expense'
          ? { kind, who, title, amount: Number(amount.replace(/\s/g, '').replace(',', '.')), date }
          : { kind, title: topNote, amount: Number(topAmount.replace(/\s/g, '').replace(',', '.')), date: topDate };
      const d = await api<{ line: ReimbursementLine }>(`/${id}/lines`, { method: 'POST', body });
      setLines((prev) => [...prev, d.line]);
      if (kind === 'expense') {
        try {
          window.localStorage.setItem(WHO_KEY, who.trim());
        } catch {
          /* ignore */
        }
        setTitle('');
        setAmount('');
      } else {
        setTopAmount('');
        setTopNote('');
        setShowTopup(false);
      }
    });

  const removeLine = (l: ReimbursementLine) =>
    run(async () => {
      await api(`/${id}/lines/${l.id}`, { method: 'DELETE', body: {} });
      setLines((prev) => prev.filter((x) => x.id !== l.id));
    });

  const saveOpening = () =>
    run(async () => {
      const d = await api<{ reimbursement: Reimbursement }>(`/${id}`, {
        method: 'PATCH',
        body: { openingBalance: Number(openingInput.replace(/\s/g, '').replace(',', '.').replace('−', '-')) },
      });
      setRm(d.reimbursement);
      setOpeningInput('');
    });

  const finish = () =>
    run(async () => {
      const d = await api<{ reimbursement: Reimbursement }>(`/${id}/save`, { method: 'POST', body: {} });
      setRm(d.reimbursement);
      setConfirm(null);
      await load();
    });

  const cancelDraft = () =>
    run(async () => {
      await api(`/${id}`, { method: 'DELETE', body: {} });
      onBack();
    });

  const download = () => {
    const url = `${window.location.origin}/api/reimbursements/${id}/export.xlsx?initData=${encodeURIComponent(telegramInitData)}`;
    const fileName = `Возмещение ${rm?.number ?? id}.xlsx`;
    const tg = (window as any).Telegram?.WebApp;
    if (typeof tg?.downloadFile === 'function') return tg.downloadFile({ url, file_name: fileName });
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <button onClick={onBack} className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> К истории
        </button>
        <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 text-sm font-bold">{loadError}</p>
      </div>
    );
  }
  if (!rm) return <p className="text-center text-sm text-slate-400 py-10">Загружаем…</p>;

  const sortedExpenses = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const input =
    'w-full px-3 min-h-[46px] text-base border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> К истории
        </button>
        <div className="text-right min-w-0">
          <h3 className="text-sm font-black text-slate-900">
            Возмещение №{rm.number} {isDraft ? '· черновик' : '· сохранено'}
          </h3>
          <p className="text-[11px] text-slate-500">{isoLong(dateOf(rm.savedAt || rm.createdAt))}</p>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2.5 text-sm font-bold">{msg}</p>}

      {/* Сверху: остаток с прошлого (сам подставляется) и рядом пополнение */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4" id="reimb-opening">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Остаток с прошлого</span>
          <p className={`text-2xl font-black tabular-nums mt-1 ${rm.openingBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{money(rm.openingBalance)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {prevNo ? `Подставлен из возмещения №${prevNo}` : isFirst && isDraft ? 'Первое возмещение: введите остаток вручную, если он есть' : 'Это первое возмещение'}
          </p>
          {isDraft && isFirst && (
            <div className="flex gap-2 mt-2">
              <input
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                inputMode="text"
                placeholder="например −148415"
                className={input}
                aria-label="Остаток с прошлого"
              />
              <button onClick={saveOpening} disabled={busy || !openingInput.trim()} className="shrink-0 px-3 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-40">
                Задать
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4" id="reimb-topups">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Пополнение</span>
          <p className="text-2xl font-black tabular-nums mt-1 text-emerald-700">{totals.topups ? `+${money(totals.topups)}` : money(0)}</p>
          {topups.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 mt-1.5 text-xs text-slate-600">
              <span className="min-w-0 truncate">
                {isoLong(l.date)}
                {l.title && l.title !== 'Пополнение' ? ` · ${l.title}` : ''}
              </span>
              <span className="flex items-center gap-1 shrink-0 font-bold tabular-nums">
                +{money(l.amount)}
                {isDraft && (
                  <button onClick={() => removeLine(l)} disabled={busy} aria-label="Удалить пополнение" className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
          ))}
          {isDraft && !showTopup && (
            <button
              id="btn-add-topup"
              onClick={() => setShowTopup(true)}
              className="mt-3 w-full min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Мне дали ещё подотчёт
            </button>
          )}
          {isDraft && showTopup && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Сумма, ₸</label>
                  <input value={topAmount} onChange={(e) => setTopAmount(e.target.value)} inputMode="numeric" placeholder="0" className={input} id="input-topup-amount" />
                </div>
                <div>
                  <label className={label}>Дата</label>
                  <input type="date" value={topDate} max={almatyToday()} onChange={(e) => setTopDate(e.target.value)} className={input} />
                </div>
              </div>
              <div>
                <label className={label}>Комментарий (необязательно)</label>
                <input value={topNote} onChange={(e) => setTopNote(e.target.value)} placeholder="например: перевод от владельца" className={input} />
              </div>
              <div className="flex gap-2">
                <button id="btn-save-topup" onClick={() => addLine('topup')} disabled={busy} className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                  Добавить пополнение
                </button>
                <button onClick={() => setShowTopup(false)} className="min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold">
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Расходы: форма сверху, список ниже */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" id="reimb-expenses">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-slate-600">
          <Wallet className="w-4 h-4" />
          <h3 className="text-xs font-black uppercase tracking-wider">Расходы</h3>
        </div>
        {isDraft && (
          <div className="p-4 space-y-2.5 bg-slate-50 border-b border-slate-100">
            <div>
              <label className={label}>Кто потратил</label>
              <input id="input-who" value={who} onChange={(e) => setWho(e.target.value)} list="reimb-names" placeholder="имя" className={input} autoComplete="off" />
              <datalist id="reimb-names">
                {names.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={label}>Название расхода</label>
              <input id="input-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="например: вода для кухни" className={input} autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Сумма, ₸</label>
                <input id="input-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" className={input} />
              </div>
              <div>
                <label className={label}>Дата</label>
                <input type="date" value={date} max={almatyToday()} onChange={(e) => setDate(e.target.value)} className={input} />
              </div>
            </div>
            <button id="btn-add-expense" onClick={() => addLine('expense')} disabled={busy} className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Добавить расход
            </button>
          </div>
        )}
        {sortedExpenses.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Расходов пока нет.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedExpenses.map((l) => (
              <div key={l.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 break-words">{l.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {l.who} · {isoLong(l.date)}
                  </p>
                </div>
                <span className="text-sm font-black tabular-nums text-slate-900 shrink-0">−{money(l.amount)}</span>
                {isDraft && (
                  <button onClick={() => removeLine(l)} disabled={busy} aria-label={`Удалить расход: ${l.title}`} className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between" id="reimb-expenses-total">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Итого расходов</span>
          <span className="text-base font-black tabular-nums text-slate-900">{money(totals.expenses)}</span>
        </div>
      </div>

      {/* Остаток сразу подсчитывается */}
      <div className={`rounded-2xl border p-4 ${totals.balance < 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`} id="reimb-balance">
        <p className="text-xs text-slate-600 tabular-nums">
          {money(rm.openingBalance)} {totals.topups ? `+ ${money(totals.topups)}` : ''} − {money(totals.expenses)}
        </p>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">{isDraft ? 'Остаток сейчас' : 'Остаток'}</span>
          <span className={`text-3xl font-black tabular-nums ${totals.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{money(totals.balance)}</span>
        </div>
        <p className="text-[11px] text-slate-600 mt-1.5">
          {totals.balance < 0 ? 'Перерасход: ' : ''}
          {isDraft ? 'Этот остаток станет «остатком с прошлого» в следующем возмещении после сохранения.' : 'Передан в следующее возмещение как остаток с прошлого.'}
        </p>
      </div>

      {isDraft ? (
        <div className="space-y-2">
          {confirm === 'save' ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2.5" id="reimb-confirm-save">
              <p className="text-sm font-bold text-amber-950">Сохранить возмещение №{rm.number}?</p>
              <p className="text-xs text-amber-900">
                После сохранения править его нельзя. Остаток {money(totals.balance)} станет «остатком с прошлого» в следующем возмещении.
              </p>
              <div className="flex gap-2">
                <button id="btn-confirm-save" onClick={finish} disabled={busy} className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
                  Да, сохранить
                </button>
                <button onClick={() => setConfirm(null)} className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
                  Нет
                </button>
              </div>
            </div>
          ) : confirm === 'cancel' ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 space-y-2.5">
              <p className="text-sm font-bold text-rose-950">Отменить черновик целиком?</p>
              <p className="text-xs text-rose-900">Все внесённые расходы и пополнения этого черновика будут удалены.</p>
              <div className="flex gap-2">
                <button onClick={cancelDraft} disabled={busy} className="flex-1 min-h-[48px] rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50">
                  Да, отменить
                </button>
                <button onClick={() => setConfirm(null)} className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
                  Нет
                </button>
              </div>
            </div>
          ) : (
            <>
              <button id="btn-save-reimbursement" onClick={() => setConfirm('save')} disabled={busy || lines.length === 0} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Сохранить возмещение
              </button>
              <button onClick={() => setConfirm('cancel')} className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-bold uppercase tracking-wider">
                Отменить черновик
              </button>
            </>
          )}
        </div>
      ) : (
        <button id="btn-export-reimbursement" onClick={download} className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2">
          <FileSpreadsheet className="w-5 h-5" /> Скачать Excel
        </button>
      )}

      <button onClick={() => setShowLog((v) => !v)} className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-bold uppercase tracking-wider">
        {showLog ? 'Скрыть журнал изменений' : `Журнал изменений (${log.length})`}
      </button>
      {showLog && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {log.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">Записей пока нет.</p>
          ) : (
            log.map((l) => (
              <div key={l.id} className="px-4 py-2.5 text-xs">
                <p className="font-bold text-slate-800">{l.details || l.action}</p>
                <p className="text-slate-400 mt-0.5">
                  {l.actor} · {new Date(l.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
