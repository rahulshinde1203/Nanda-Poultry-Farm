'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

type DateFilter = 'all' | 'month' | 'custom';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// Trader methods: UPI, NEFT, RTGS, IMPS, Cheque (NO Cash)
// All trader methods require transaction ID or cheque number
const TRADER_METHODS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'] as const;
type TraderMethod = typeof TRADER_METHODS[number];
const NEEDS_UTR: TraderMethod[] = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'];

const dateLabels: Record<DateFilter, string> = { all: 'All Time', month: 'Month', custom: 'Custom Range' };
const sc: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
  verified: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-200 text-red-700 border border-red-300',
};
const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
const inpErr = 'w-full border border-red-400 ring-1 ring-red-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50';
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';
const errCls = 'text-xs text-red-500 mt-1';

const emptyForm = {
  paymentFor: 'trader',
  trader: '', company: '', amount: '',
  paymentMethod: 'UPI' as TraderMethod,
  bankAccount: '', chequeNumber: '', utrNumber: '',
  notes: '', date: new Date().toISOString().split('T')[0],
};

export default function SalespersonPaymentsPage() {
  const [payments, setPayments]   = useState<any[]>([]);
  const [traders, setTraders]     = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ ...emptyForm });
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [dateFilter, setDateFilter]   = useState<DateFilter>('month');
  const [selMonth,    setSelMonth]     = useState(new Date().getMonth() + 1); // 1-indexed
  const [selYear,     setSelYear]      = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [filterFor, setFilterFor]     = useState<'all'|'trader'|'company'>('all');
  const [filterStatus, setFilterStatus] = useState<'all'|'pending'|'verified'|'rejected'>('all');

  const load = () => {
    fetch('/api/payments').then(r=>r.ok?r.json():{payments:[]}).then(d=>setPayments(d.payments||[]));
    fetch('/api/traders').then(r=>r.ok?r.json():{traders:[]}).then(d=>setTraders(d.traders||[]));
    fetch('/api/companies').then(r=>r.ok?r.json():{companies:[]}).then(d=>setCompanies(d.companies||[]));
    fetch('/api/bank-accounts').then(r=>r.ok?r.json():{accounts:[]}).then(d=>setBankAccounts(d.accounts||[]));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  const isCompany = form.paymentFor === 'company';
  const isCheque  = form.paymentMethod === 'Cheque';
  const needsUTR  = NEEDS_UTR.includes(form.paymentMethod as TraderMethod);

  const setMethod = (m: TraderMethod) => {
    setForm(f => ({ ...f, paymentMethod: m, utrNumber: '', chequeNumber: '' }));
    setErrors(e => ({ ...e, utrNumber: '', chequeNumber: '', bankAccount: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.date)  e.date = 'Date is required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Valid amount is required';
    if (!isCompany && !form.trader)  e.trader  = 'Please select a trader';
    if (isCompany  && !form.company) e.company = 'Please select a company';
    if (!isCompany) {
      // Bank account mandatory for all trader methods
      if (!form.bankAccount) e.bankAccount = 'Bank account is required';
      // UTR mandatory for UPI / NEFT / RTGS / IMPS
      if (needsUTR && !form.utrNumber.trim()) e.utrNumber = `Transaction ID is required for ${form.paymentMethod}`;
      // Cheque number mandatory for Cheque
      if (isCheque && !form.chequeNumber.trim()) e.chequeNumber = 'Cheque number is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { toast.error('Please fix the errors below'); return; }
    setLoading(true);
    const payload: any = { paymentFor: form.paymentFor, amount: form.amount, notes: form.notes, date: form.date };
    if (isCompany) {
      payload.company = form.company;
    } else {
      payload.trader        = form.trader;
      payload.paymentMethod = form.paymentMethod;
      payload.bankAccount   = form.bankAccount;
      if (form.utrNumber.trim())    payload.utrNumber    = form.utrNumber.trim();
      if (form.chequeNumber.trim()) payload.chequeNumber = form.chequeNumber.trim();
    }
    const res = await fetch('/api/payments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      toast.success(isCompany ? 'Company payment request submitted!' : 'Payment request submitted!');
      setShowForm(false); setForm({ ...emptyForm }); setErrors({}); load();
    } else toast.error(d.error || 'Failed to submit');
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return payments.filter(p => {
      const d = new Date(p.date);
      if (dateFilter==='month' && (d.getMonth()!==selMonth-1||d.getFullYear()!==selYear)) return false;
      if (dateFilter==='custom') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd+'T23:59:59')) return false;
      }
      if (filterFor!=='all' && p.paymentFor!==filterFor) return false;
      if (filterStatus!=='all' && p.status!==filterStatus) return false;
      return true;
    });
  }, [payments, dateFilter, selMonth, selYear, customStart, customEnd, filterFor, filterStatus]);

  const fmtAmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const totalPending  = filtered.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0);
  const totalVerified = filtered.filter(p=>p.status==='verified').reduce((s,p)=>s+p.amount,0);
  const totalRejected = filtered.filter(p=>p.status==='rejected').reduce((s,p)=>s+p.amount,0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Payment Requests</h1>
            <p className="text-orange-100 text-sm mt-0.5">{filtered.length} records</p>
          </div>
          <button onClick={()=>{ setShowForm(s=>!s); setErrors({}); setForm({...emptyForm}); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-xl text-sm font-bold shadow hover:bg-orange-50 transition">
            {showForm ? '✕ Cancel' : '+ New Request'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="font-bold text-yellow-700 text-base">{fmtAmt(totalPending)}</p>
            <p className="text-xs text-gray-400">{filtered.filter(p=>p.status==='pending').length} requests</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Verified</p>
            <p className="font-bold text-green-700 text-base">{fmtAmt(totalVerified)}</p>
            <p className="text-xs text-gray-400">{filtered.filter(p=>p.status==='verified').length} requests</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Rejected</p>
            <p className="font-bold text-red-600 text-base">{fmtAmt(totalRejected)}</p>
            <p className="text-xs text-gray-400">{filtered.filter(p=>p.status==='rejected').length} requests</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Period</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 flex-wrap">
              {(Object.keys(dateLabels) as DateFilter[]).map(f => (
                <button key={f} onClick={()=>setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFilter===f?'bg-orange-500 text-white shadow-sm':'text-gray-500 hover:text-gray-800'}`}>
                  {dateLabels[f]}
                </button>
              ))}
            </div>
            {dateFilter==='custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Filter</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['all','trader','company'] as const).map(f => (
                <button key={f} onClick={()=>setFilterFor(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterFor===f?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-800'}`}>
                  {f==='all'?'All':f==='trader'?'🤝 Trader':'🏭 Company'}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['all','pending','verified','rejected'] as const).map(s => (
                <button key={s} onClick={()=>setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${filterStatus===s?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-800'}`}>
                  {s==='all'?'All Status':s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── FORM ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-100 px-5 py-3">
              <h3 className="font-bold text-orange-800">New Payment Request</h3>
              <p className="text-xs text-orange-600 mt-0.5">Fill all required fields marked with *</p>
            </div>
            <form onSubmit={submit} className="p-5 space-y-5">

              {/* Payment To */}
              <div>
                <label className={lbl}>Payment To *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={()=>{ setForm({...emptyForm,paymentFor:'trader',date:form.date}); setErrors({}); }}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.paymentFor==='trader'?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
                    🤝 Trader (Buyer)
                  </button>
                  <button type="button"
                    onClick={()=>{ setForm({...emptyForm,paymentFor:'company',date:form.date}); setErrors({}); }}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.paymentFor==='company'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                    🏭 Company (Supplier)
                  </button>
                </div>
              </div>

              {isCompany && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                  ℹ️ Company payment requests are sent for <strong>accountant verification</strong>. Transaction details will be filled on approval.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Party select */}
                <div>
                  <label className={lbl}>{isCompany ? 'Company' : 'Trader'} *</label>
                  {isCompany ? (
                    <select value={form.company} onChange={e=>{ setForm(f=>({...f,company:e.target.value})); setErrors(er=>({...er,company:''})); }} className={errors.company?inpErr:inp}>
                      <option value="">Select company...</option>
                      {companies.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <select value={form.trader} onChange={e=>{ setForm(f=>({...f,trader:e.target.value})); setErrors(er=>({...er,trader:''})); }} className={errors.trader?inpErr:inp}>
                      <option value="">Select trader...</option>
                      {traders.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  )}
                  {(errors.trader||errors.company) && <p className={errCls}>{errors.trader||errors.company}</p>}
                </div>

                {/* Date */}
                <div>
                  <label className={lbl}>Date *</label>
                  <input type="date" value={form.date} max={new Date().toISOString().split('T')[0]}
                    onChange={e=>{ setForm(f=>({...f,date:e.target.value})); setErrors(er=>({...er,date:''})); }}
                    className={errors.date?inpErr:inp} />
                  {errors.date && <p className={errCls}>{errors.date}</p>}
                </div>

                {/* Amount */}
                <div>
                  <label className={lbl}>Amount (₹) *</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount} placeholder="0.00"
                    onChange={e=>{ setForm(f=>({...f,amount:e.target.value})); setErrors(er=>({...er,amount:''})); }}
                    className={errors.amount?inpErr:inp} />
                  {errors.amount && <p className={errCls}>{errors.amount}</p>}
                </div>

                {/* Payment Method — trader only (no Cash, UPI added) */}
                {!isCompany && (
                  <div>
                    <label className={lbl}>Payment Method *</label>
                    <div className="flex flex-wrap gap-2">
                      {TRADER_METHODS.map(m => (
                        <button key={m} type="button" onClick={()=>setMethod(m)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${form.paymentMethod===m?'bg-orange-500 text-white border-orange-500 shadow-sm':'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                    {errors.paymentMethod && <p className={errCls}>{errors.paymentMethod}</p>}
                  </div>
                )}

                {/* Bank Account — mandatory for all trader methods */}
                {!isCompany && (
                  <div>
                    <label className={lbl}>Bank Account * <span className="text-orange-500 normal-case font-normal">(mandatory)</span></label>
                    <select value={form.bankAccount} onChange={e=>{ setForm(f=>({...f,bankAccount:e.target.value})); setErrors(er=>({...er,bankAccount:''})); }}
                      className={errors.bankAccount?inpErr:inp}>
                      <option value="">Select bank account...</option>
                      {bankAccounts.map(b=>(
                        <option key={b._id} value={b._id}>{b.bankName} — ****{b.accountNumber?.slice(-4)}</option>
                      ))}
                    </select>
                    {errors.bankAccount && <p className={errCls}>{errors.bankAccount}</p>}
                  </div>
                )}

                {/* Transaction ID — mandatory for UPI/NEFT/RTGS/IMPS */}
                {!isCompany && needsUTR && (
                  <div>
                    <label className={lbl}>
                      Transaction ID / UTR / Ref No. *
                      <span className="ml-1 text-orange-500 normal-case font-normal">(required for {form.paymentMethod})</span>
                    </label>
                    <input type="text" value={form.utrNumber} placeholder={`Enter ${form.paymentMethod} UTR / Reference number`}
                      onChange={e=>{ setForm(f=>({...f,utrNumber:e.target.value})); setErrors(er=>({...er,utrNumber:''})); }}
                      className={errors.utrNumber?inpErr:inp} />
                    {errors.utrNumber && <p className={errCls}>{errors.utrNumber}</p>}
                  </div>
                )}

                {/* Cheque Number — mandatory for Cheque */}
                {!isCompany && isCheque && (
                  <div>
                    <label className={lbl}>Cheque / Transaction ID * <span className="text-orange-500 normal-case font-normal">(required)</span></label>
                    <input type="text" value={form.chequeNumber} placeholder="Enter cheque number or reference"
                      onChange={e=>{ setForm(f=>({...f,chequeNumber:e.target.value})); setErrors(er=>({...er,chequeNumber:''})); }}
                      className={errors.chequeNumber?inpErr:inp} />
                    {errors.chequeNumber && <p className={errCls}>{errors.chequeNumber}</p>}
                  </div>
                )}

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className={lbl}>Notes <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                  <textarea value={form.notes} rows={2} placeholder="Optional notes..."
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className={inp} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold text-sm disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</> : '📨 Submit Request'}
                </button>
                <button type="button" onClick={()=>{ setShowForm(false); setErrors({}); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mobile list */}
        <div className="sm:hidden space-y-2">
          {filtered.map(p => {
            const isComp = p.paymentFor==='company';
            const ref = p.utrNumber || p.chequeNumber || null;
            return (
              <div key={p._id} className={`rounded-xl border shadow-sm p-4 ${isComp?'bg-red-50 border-red-200':'bg-green-50 border-green-200'}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{isComp?'🏭':'🤝'}</span>
                      <p className="font-semibold text-gray-900 text-sm">{p.company?.name||p.trader?.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-base ${isComp?'text-red-600':'text-green-700'}`}>{fmtAmt(p.amount)}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc[p.status]||''}`}>{p.status}</span>
                  </div>
                </div>
                {p.paymentMethod && <p className="text-xs text-gray-600 mt-1">{p.paymentMethod}{ref?` · Ref: ${ref}`:''}</p>}
                {p.status==='rejected' && p.rejectionReason && <p className="text-xs text-red-500 mt-1">Reason: {p.rejectionReason}</p>}
              </div>
            );
          })}
          {filtered.length===0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">💳</div><p>No payment requests found</p></div>}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Payment Requests</h3>
            <span className="text-xs text-gray-400">{filtered.length} records</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Date','Type','Party','Amount','Method','Transaction ID / UTR','Status','Notes'].map(h=>(
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isComp = p.paymentFor==='company';
                const ref = p.utrNumber || p.chequeNumber || null;
                return (
                  <tr key={p._id} className={`border-b border-white/80 transition-colors ${isComp?'bg-red-50 hover:bg-red-100/70':'bg-green-50 hover:bg-green-100/70'}`}>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isComp?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                        {isComp?'🏭 Company':'🤝 Trader'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.company?.name||p.trader?.name}</td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${isComp?'text-red-600':'text-green-700'}`}>{fmtAmt(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.paymentMethod || <span className="italic text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-700 whitespace-nowrap">
                      {ref ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span>
                          {ref}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc[p.status]||''}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                      {p.status==='rejected'?<span className="text-red-500">{p.rejectionReason}</span>:p.notes||'—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 bg-white">No payment requests found</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
