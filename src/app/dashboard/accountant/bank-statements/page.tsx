'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type PeriodType = 'all' | 'day' | 'month' | 'range';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const fmt    = (n: number) => `₹${(n||0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const inp    = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
const lbl    = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';
const todayStr = () => new Date().toISOString().split('T')[0];

const SOURCE_LABEL: Record<string,{label:string;color:string}> = {
  manual:           { label: 'Manual',          color: 'bg-gray-100 text-gray-600' },
  payment_trader:   { label: 'Trader Payment',  color: 'bg-green-100 text-green-700' },
  payment_company:  { label: 'Company Payment', color: 'bg-red-100 text-red-700' },
  expense:          { label: 'Expense',         color: 'bg-purple-100 text-purple-700' },

};

const PERIOD_LABELS: Record<PeriodType,string> = {
  all: 'All Time', day: 'Select Date', month: 'Select Month', range: 'Date Range',
};

export default function BankStatementsPage() {
  const [statements,   setStatements]   = useState<any[]>([]);
  const [accounts,     setAccounts]     = useState<any[]>([]);

  // Period filters
  const [period,      setPeriod]      = useState<PeriodType>('month');
  const [selDate,     setSelDate]     = useState(todayStr());
  const [selMonth,    setSelMonth]    = useState(new Date().getMonth() + 1);
  const [selYear,     setSelYear]     = useState(new Date().getFullYear());
  const [rangeStart,  setRangeStart]  = useState('');
  const [rangeEnd,    setRangeEnd]    = useState('');

  // Bank + source filters
  const [selAccount,   setSelAccount]   = useState('');

  // Form / UI state
  const [showForm,   setShowForm]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [form, setForm] = useState({
    bankAccount: '', date: todayStr(), description: '', remark: '',
    credit: '', debit: '', transactionId: '', type: 'credit',
  });

  const buildParams = () => {
    const p = new URLSearchParams({ period });
    if (selAccount) p.set('bankAccount', selAccount);
    if (period === 'day')   p.set('date', selDate);
    if (period === 'month') { p.set('month', String(selMonth)); p.set('year', String(selYear)); }
    if (period === 'range') { p.set('start', rangeStart); p.set('end', rangeEnd); }
    return p.toString();
  };

  const load = () => {
    if (period === 'range' && (!rangeStart || !rangeEnd)) return;
    fetch(`/api/bank-statements?${buildParams()}`).then(r=>r.json()).then(d=>setStatements(d.statements||[]));
    fetch('/api/bank-accounts').then(r=>r.json()).then(d=>{ const accs = d.accounts||[]; setAccounts(accs); if(accs.length && !selAccount) setSelAccount(accs[0]._id); });
  };

  useEffect(() => { load(); }, [period, selDate, selMonth, selYear, rangeStart, rangeEnd, selAccount]);

  const generate = async () => {
    if (!selAccount) { toast.error('Please select a bank account first'); return; }
    if (period !== 'month') { toast.error('Auto-generate works for Month period only'); return; }
    setGenerating(true);
    const res = await fetch('/api/bank-statements/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ bankAccountId: selAccount, month: selMonth, year: selYear }),
    });
    const d = await res.json(); setGenerating(false);
    if (res.ok) { toast.success(`✅ ${d.message}`); load(); }
    else toast.error(d.error || 'Generation failed');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const payload = {
      bankAccount: form.bankAccount, date: form.date,
      description: form.description, remark: form.remark,
      transactionId: form.transactionId,
      creditAmount: form.type === 'credit' ? form.credit : '0',
      debitAmount:  form.type === 'debit'  ? form.debit  : '0',
    };
    const res = await fetch('/api/bank-statements', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
    });
    const d = await res.json(); setLoading(false);
    if (res.ok) {
      toast.success('Entry added ✅'); setShowForm(false);
      setForm({ bankAccount:'', date:todayStr(), description:'', remark:'', credit:'', debit:'', transactionId:'', type:'credit' });
      load();
    } else toast.error(d.error || 'Failed');
  };

  const closingBalance = statements.length > 0 ? statements[statements.length - 1]?.balance || 0 : 0;
  const totalCredit = statements.reduce((s,x)=>s+(x.creditAmount||0),0);
  const totalDebit  = statements.reduce((s,x)=>s+(x.debitAmount||0),0);
  const lastBalance = closingBalance;
  const filtered = [...statements].reverse().map((s, i, arr) => {
    const newerEntries = arr.slice(0, i);
    const newerCredit = newerEntries.reduce((sum, x) => sum + (x.creditAmount||0), 0);
    const newerDebit  = newerEntries.reduce((sum, x) => sum + (x.debitAmount||0), 0);
    return { ...s, displayBalance: closingBalance - newerCredit + newerDebit };
  });

  const periodLabel = period === 'all' ? 'All Time'
    : period === 'day'   ? new Date(selDate).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
    : period === 'month' ? `${MONTHS[selMonth-1]} ${selYear}`
    : rangeStart && rangeEnd ? `${new Date(rangeStart).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} – ${new Date(rangeEnd).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}` : 'Range';

  const exportExcel = async () => {
    if (!filtered.length) return;
    const { utils, writeFile } = await import('xlsx');
    const rows = filtered.map((s,i) => ({
      '#': i+1, 'Date': new Date(s.date).toLocaleDateString('en-IN'),
      'Account': s.bankAccount?.bankName, 'Description': s.description,
      'Remark': s.remark||'', 'Transaction ID': s.transactionId||'',
      'Type': SOURCE_LABEL[s.sourceType]?.label||s.sourceType,
      'Credit (₹)': s.creditAmount||0, 'Debit (₹)': s.debitAmount||0, 'Balance (₹)': s.displayBalance||0,
    }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Bank Statement');
    writeFile(wb, `bank-statement-${periodLabel.replace(/\s/g,'-')}.xlsx`);
    toast.success('Excel downloaded!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-extrabold text-xl sm:text-2xl">Bank Statements</h1>
          <p className="text-slate-300 text-sm mt-0.5">{periodLabel} · {filtered.length} entries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel} disabled={!filtered.length}
            className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition">📥 Excel</button>
          <button onClick={()=>setShowForm(s=>!s)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition shadow-sm">
            {showForm ? '✕ Cancel' : '+ Manual Entry'}
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-4">

        {/* Row 1: Period tabs */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Period</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['all','day','month','range'] as PeriodType[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Date picker for 'day' */}
          {period === 'day' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Date</span>
              <input type="date" value={selDate} max={todayStr()}
                onChange={e => setSelDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
            </div>
          )}

          {/* Month + Year for 'month' */}
          {period === 'month' && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Month</span>
                <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Year</span>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Range */}
          {period === 'range' && (
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">From</span>
                <input type="date" value={rangeStart} max={todayStr()}
                  onChange={e => setRangeStart(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">To</span>
                <input type="date" value={rangeEnd} max={todayStr()}
                  onChange={e => setRangeEnd(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Bank + Source filter + Auto-generate */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🏦 Bank Account</span>
            <select value={selAccount} onChange={e => setSelAccount(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[200px]">
              {accounts.map(a => <option key={a._id} value={a._id}>{a.bankName} — ****{a.accountNumber?.slice(-4)}</option>)}
            </select>
          </div>

          {/* Auto-generate — only for month period */}
          {period === 'month' && (
            <button onClick={generate} disabled={generating || !selAccount}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition shadow-sm self-end">
              {generating
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating...</>
                : '⚡ Auto-Generate'}
            </button>
          )}
          {period === 'month' && !selAccount && (
            <p className="text-xs text-amber-600 self-end pb-2">← Select account to auto-generate</p>
          )}
        </div>

        {/* Row 3: Source type filter chips */}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Credit</p>
          <p className="font-extrabold text-green-700">{fmt(totalCredit)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Debit</p>
          <p className="font-extrabold text-red-600">{fmt(totalDebit)}</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${lastBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Closing Balance</p>
          <p className={`font-extrabold ${lastBalance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{fmt(lastBalance)}</p>
        </div>
      </div>

      {/* Auto-generate info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-xs text-blue-800">
        <p className="font-bold mb-0.5">⚡ Auto-Generate (Month period only) pulls from:</p>
        <p>✅ Verified trader payments (credit) · Company payments (debit) · Expenses (debit) · Each with remark showing party/expense name</p>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
            <h3 className="font-bold text-gray-900 text-sm">➕ Manual Entry (non-system transaction)</h3>
          </div>
          <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Bank Account *</label>
              <select required value={form.bankAccount} onChange={e => setForm({...form, bankAccount: e.target.value})} className={inp}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a._id} value={a._id}>{a.bankName} — ****{a.accountNumber?.slice(-4)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Date *</label>
              <input type="date" required value={form.date} max={todayStr()} onChange={e => setForm({...form, date: e.target.value})} className={inp} />
            </div>
            <div>
              <label className={lbl}>Type *</label>
              <div className="flex gap-2">
                {(['credit','debit'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({...f, type: t}))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${form.type === t ? (t === 'credit' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {t === 'credit' ? '💰 Credit (In)' : '💸 Debit (Out)'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Amount (₹) *</label>
              <input required type="number" min="0.01" step="0.01"
                value={form.type === 'credit' ? form.credit : form.debit}
                onChange={e => setForm(f => ({...f, [f.type === 'credit' ? 'credit' : 'debit']: e.target.value}))}
                className={inp} placeholder="0.00" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Description *</label>
              <input required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inp} placeholder="e.g. Cash withdrawal, Bank charges..." />
            </div>
            <div>
              <label className={lbl}>Remark <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <input value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} className={inp} placeholder="Additional context..." />
            </div>
            <div>
              <label className={lbl}>Transaction ID <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <input value={form.transactionId} onChange={e => setForm({...form, transactionId: e.target.value})} className={inp} placeholder="UTR / Ref number" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={loading}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-orange-600 transition">
                {loading ? 'Saving...' : '➕ Add Entry'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Statement Entries</h3>
          <span className="text-xs text-gray-400">{filtered.length} entries</span>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-gray-50">
          {filtered.map((s, i) => (
            <div key={s._id} className="px-4 py-3.5">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.description}</p>
                  {s.remark && <p className="text-xs text-blue-600 mt-0.5">📌 {s.remark}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(s.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · {s.bankAccount?.bankName}</p>
                  {s.transactionId && <p className="text-xs font-mono text-gray-500 mt-0.5">Txn: {s.transactionId}</p>}
                </div>
                <div className="text-right shrink-0">
                  {s.creditAmount > 0 && <p className="font-bold text-green-600">+{fmt(s.creditAmount)}</p>}
                  {s.debitAmount  > 0 && <p className="font-bold text-red-600">−{fmt(s.debitAmount)}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">Bal: {fmt(s.displayBalance||0)}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SOURCE_LABEL[s.sourceType]?.color||'bg-gray-100 text-gray-600'}`}>
                {SOURCE_LABEL[s.sourceType]?.label||s.sourceType}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-14 text-center text-gray-400">
              <div className="text-3xl mb-2">🏦</div>
              <p className="text-sm">No entries found</p>
              {period === 'month' && <p className="text-xs mt-1">Select account & click ⚡ Auto-Generate</p>}
            </div>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['#','Date','Account','Description','Remark','Txn ID','Type','Credit','Debit','Balance'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s, i) => (
                <tr key={s._id} className={`hover:bg-gray-50/80 transition ${!s.isAutoGenerated ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-4 py-3 text-xs text-gray-400">{i+1}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(s.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.bankAccount?.bankName}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{s.description}</td>
                  <td className="px-4 py-3 text-xs text-blue-700 max-w-[180px]">
                    {s.remark ? <span className="flex items-center gap-1"><span>📌</span>{s.remark}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{s.transactionId||'—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_LABEL[s.sourceType]?.color||'bg-gray-100 text-gray-600'}`}>
                      {SOURCE_LABEL[s.sourceType]?.label||s.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">
                    {s.creditAmount > 0 ? `+${fmt(s.creditAmount)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600 whitespace-nowrap">
                    {s.debitAmount > 0 ? `−${fmt(s.debitAmount)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-4 py-3 font-bold whitespace-nowrap ${(s.displayBalance||0) >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                    {fmt(s.displayBalance||0)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="py-14 text-center text-gray-400 bg-white">
                  <div className="text-3xl mb-2">🏦</div>
                  <p>No entries found · {period === 'month' ? 'Select account and click ⚡ Auto-Generate' : 'Try a different filter'}</p>
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase">Totals ({filtered.length})</td>
                  <td className="px-4 py-3 font-extrabold text-green-700 whitespace-nowrap">+{fmt(totalCredit)}</td>
                  <td className="px-4 py-3 font-extrabold text-red-600 whitespace-nowrap">−{fmt(totalDebit)}</td>
                  <td className={`px-4 py-3 font-extrabold whitespace-nowrap ${lastBalance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{fmt(lastBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
