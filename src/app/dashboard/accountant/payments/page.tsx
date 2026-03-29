'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

type PeriodType = 'all' | 'month' | 'custom';

export default function VerifyPaymentsPage() {
  const [payments,     setPayments]     = useState<any[]>([]);
  const [traders,      setTraders]      = useState<any[]>([]);
  const [companies,    setCompanies]    = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading,      setLoading]      = useState<string | null>(null);
  const [exporting,    setExporting]    = useState(false);

  // Modals
  const [verifyModal,  setVerifyModal]  = useState<any | null>(null);
  const [rejectModal,  setRejectModal]  = useState<{id:string;reason:string}|null>(null);
  const [deleteModal,  setDeleteModal]  = useState<any | null>(null);
  const [verifyForm,   setVerifyForm]   = useState({ transactionId:'', bankAccount:'', paymentMethod:'UPI', chequeNumber:'', utrNumber:'', notes:'' });

  // Period filter
  const [period,       setPeriod]       = useState<PeriodType>('month');
  const [selMonth,     setSelMonth]     = useState(new Date().getMonth());   // 0-indexed
  const [selYear,      setSelYear]      = useState(new Date().getFullYear());
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');

  // Party/status filters
  const [filterStatus,  setFilterStatus]  = useState<'all'|'pending'|'verified'|'rejected'>('all');
  const [filterType,    setFilterType]    = useState<'all'|'trader'|'company'>('all');
  const [filterTrader,  setFilterTrader]  = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterBy,      setFilterBy]      = useState('');
  const [filterBank,    setFilterBank]    = useState('');

  const load = () => {
    fetch('/api/payments').then(r=>r.json()).then(d => {
      const pmts = d.payments || [];
      setPayments(pmts);
      const seen = new Map<string,any>();
      pmts.forEach((p: any) => {
        if (p.createdBy?._id && !seen.has(p.createdBy._id)) seen.set(p.createdBy._id, p.createdBy);
      });
      setSalespersons(Array.from(seen.values()));
    });
    fetch('/api/traders').then(r=>r.json()).then(d=>setTraders(d.traders||[]));
    fetch('/api/companies').then(r=>r.json()).then(d=>setCompanies(d.companies||[]));
    fetch('/api/bank-accounts').then(r=>r.json()).then(d=>setBankAccounts(d.accounts||[]));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  const filtered = useMemo(() => {
    const now = new Date();
    return payments.filter(p => {
      const d = new Date(p.date);
      if (period === 'month' && (d.getMonth() !== selMonth || d.getFullYear() !== selYear)) return false;
      if (period === 'custom') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd+'T23:59:59')) return false;
      }
      if (filterStatus  !== 'all' && p.status       !== filterStatus)  return false;
      if (filterType    !== 'all' && p.paymentFor   !== filterType)    return false;
      if (filterTrader   && String(p.trader?._id)   !== filterTrader)  return false;
      if (filterCompany  && String(p.company?._id)  !== filterCompany) return false;
      if (filterBy       && String(p.createdBy?._id) !== filterBy)     return false;
      if (filterBank     && String(p.bankAccount?._id) !== filterBank) return false;
      return true;
    });
  }, [payments, period, selMonth, selYear, customStart, customEnd, filterStatus, filterType, filterTrader, filterCompany, filterBy, filterBank]);

  const totalAmt    = filtered.reduce((s,p)=>s+(p.amount||0),0);
  const pendingAmt  = filtered.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0);
  const verifiedAmt = filtered.filter(p=>p.status==='verified').reduce((s,p)=>s+p.amount,0);
  const rejectedAmt = filtered.filter(p=>p.status==='rejected').reduce((s,p)=>s+p.amount,0);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  const sc: Record<string,string> = {
    pending:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
    verified: 'bg-green-100 text-green-700 border border-green-200',
    rejected: 'bg-red-100 text-red-700 border border-red-200',
  };
  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

  // Transaction ID — check all possible fields
  const getTxnId = (p: any) => p.utrNumber || p.chequeNumber || p.transactionId || null;

  const clearFilters = () => {
    setFilterStatus('all'); setFilterType('all');
    setFilterTrader(''); setFilterCompany(''); setFilterBy(''); setFilterBank('');
  };
  const hasFilter = filterTrader||filterCompany||filterBy||filterBank||filterType!=='all'||filterStatus!=='all';

  const openVerify = (p: any) => {
    setVerifyModal(p);
    setVerifyForm({ transactionId:p.transactionId||'', bankAccount:'', paymentMethod:'UPI', chequeNumber:'', utrNumber:'', notes:'' });
  };

  const submitVerify = async () => {
    if (!verifyModal) return;
    // UTR/Transaction ID required only for company payments, optional for trader payments
    if (verifyModal.paymentFor === 'company' && !verifyForm.transactionId.trim()) {
      toast.error('Transaction ID / UTR is required for company payments'); return;
    }
    if (verifyModal.paymentFor === 'company' && !verifyForm.paymentMethod) {
      toast.error('Payment method is required'); return;
    }
    setLoading(verifyModal._id);
    const res = await fetch(`/api/payments/${verifyModal._id}/verify`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'verify',...verifyForm}),
    });
    setLoading(null);
    if (res.ok) { toast.success('Payment verified! ✅'); setVerifyModal(null); load(); }
    else { const d=await res.json(); toast.error(d.error||'Verification failed'); }
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    setLoading(rejectModal.id);
    const res = await fetch(`/api/payments/${rejectModal.id}/verify`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'reject',rejectionReason:rejectModal.reason}),
    });
    setLoading(null);
    if (res.ok) { toast.success('Payment rejected'); setRejectModal(null); load(); }
    else toast.error('Action failed');
  };

  const submitDelete = async () => {
    if (!deleteModal) return;
    setLoading(deleteModal._id);
    const res = await fetch(`/api/payments/${deleteModal._id}`,{method:'DELETE'});
    setLoading(null); setDeleteModal(null);
    if (res.ok) { toast.success('Payment deleted'); load(); }
    else { const d=await res.json(); toast.error(d.error||'Delete failed'); }
  };

  /* ── Excel ── */
  const exportExcel = async () => {
    if (!filtered.length) return; setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const rows = filtered.map(p => ({
        'Date': new Date(p.date).toLocaleDateString('en-IN'),
        'Type': p.paymentFor, 'Party': p.company?.name||p.trader?.name||'',
        'Amount (₹)': p.amount, 'Method': p.paymentMethod||'',
        'Transaction ID': getTxnId(p)||'', 'Bank': p.bankAccount?.bankName||'',
        'Requested By': p.createdBy?.name||'', 'Status': p.status,
        'Rejection Reason': p.rejectionReason||'', 'Notes': p.notes||'',
      }));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Payments');
      writeFile(wb, `payments-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  /* ── PDF ── */
  const exportPDF = async () => {
    if (!filtered.length) return; setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16); doc.text('Nanda Poultry Farm', 14, 15);
      doc.setFontSize(11); doc.text('Payments Report', 14, 23);
      doc.setFontSize(9);
      doc.text(`Records: ${filtered.length}   Total: ${fmt(totalAmt)}   Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);
      autoTable(doc, {
        startY: 36,
        head: [['Date','Type','Party','Amount','Method','Transaction ID','Bank','By','Status']],
        body: filtered.map(p => [
          new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
          p.paymentFor, p.company?.name||p.trader?.name||'',
          fmt(p.amount||0), p.paymentMethod||'—',
          getTxnId(p)||'—', p.bankAccount?.bankName||'—',
          p.createdBy?.name||'', p.status,
        ]),
        styles: { fontSize:7.5 }, headStyles: { fillColor:[249,115,22] },
        didParseCell: (data: any) => {
          const status = filtered[data.row.index]?.status;
          if (data.column.index===8) data.cell.styles.textColor = status==='verified'?[22,163,74]:status==='rejected'?[220,38,38]:[161,98,7];
        },
      });
      doc.save(`payments-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const periodLabel = period==='all'?'All Time':period==='month'?`${MONTHS[selMonth]} ${selYear}`:'Custom Range';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Verify Payments</h1>
          <p className="text-gray-500 text-sm">{filtered.length} records · {periodLabel}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting||!filtered.length}
            className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-40">📥 Excel</button>
          <button onClick={exportPDF} disabled={exporting||!filtered.length}
            className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-40">📄 PDF</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {l:'Total',    v:fmt(totalAmt),    c:'text-gray-900',   bg:'bg-gray-50   border-gray-200',   cnt:filtered.length},
          {l:'Pending',  v:fmt(pendingAmt),  c:'text-yellow-700', bg:'bg-yellow-50 border-yellow-200', cnt:filtered.filter(p=>p.status==='pending').length},
          {l:'Verified', v:fmt(verifiedAmt), c:'text-green-700',  bg:'bg-green-50  border-green-200',  cnt:filtered.filter(p=>p.status==='verified').length},
          {l:'Rejected', v:fmt(rejectedAmt), c:'text-red-600',    bg:'bg-red-50    border-red-200',    cnt:filtered.filter(p=>p.status==='rejected').length},
        ].map(s => (
          <div key={s.l} className={`rounded-xl border p-3 ${s.bg}`}>
            <p className="text-xs text-gray-500">{s.l}</p>
            <p className={`text-base font-bold truncate ${s.c}`}>{s.v}</p>
            <p className="text-xs text-gray-400">{s.cnt} payments</p>
          </div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 space-y-3">

        {/* Period row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Period</span>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {(['all','month','custom'] as PeriodType[]).map(f => (
              <button key={f} onClick={()=>setPeriod(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period===f?'bg-orange-500 text-white shadow-sm':'text-gray-500 hover:text-gray-800'}`}>
                {f==='all'?'All Time':f==='month'?'Month':'Custom Range'}
              </button>
            ))}
          </div>

          {/* Month + Year selector — shown when period === 'month' */}
          {period==='month' && (
            <div className="flex items-center gap-2">
              <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
              </select>
              <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Custom date range */}
          {period==='custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
        </div>

        {/* Status + Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Status</span>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {(['all','pending','verified','rejected'] as const).map(s => (
              <button key={s} onClick={()=>setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${filterStatus===s?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-800'}`}>
                {s==='all'?'All':s}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 ml-1">
            {(['all','trader','company'] as const).map(t => (
              <button key={t} onClick={()=>{ setFilterType(t); setFilterTrader(''); setFilterCompany(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType===t?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-800'}`}>
                {t==='all'?'All Types':t==='trader'?'🤝 Trader':'🏭 Company'}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Filter</span>
          {filterType!=='company' && (
            <select value={filterTrader} onChange={e=>setFilterTrader(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[130px]">
              <option value="">🤝 All Traders</option>
              {traders.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}
          {filterType!=='trader' && (
            <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[130px]">
              <option value="">🏭 All Companies</option>
              {companies.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}
          <select value={filterBy} onChange={e=>setFilterBy(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]">
            <option value="">👤 All Salespersons</option>
            {salespersons.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <select value={filterBank} onChange={e=>setFilterBank(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[130px]">
            <option value="">🏦 All Banks</option>
            {bankAccounts.map(a=><option key={a._id} value={a._id}>{a.bankName}</option>)}
          </select>
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-orange-500 hover:text-orange-700 font-semibold underline">Clear all</button>
          )}
        </div>
      </div>

      {/* ── VERIFY MODAL ── */}
      {verifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">Verify Payment</h2>
                <p className="text-green-100 text-xs">{verifyModal.paymentFor==='company'?'Fill transaction details':'Confirm this payment'}</p>
              </div>
              <button onClick={()=>setVerifyModal(null)} className="text-white/70 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Type</p><p className="font-medium">{verifyModal.paymentFor==='company'?'🏭 Company':'🤝 Trader'}</p></div>
                <div><p className="text-xs text-gray-500">Party</p><p className="font-medium">{verifyModal.company?.name||verifyModal.trader?.name}</p></div>
                <div><p className="text-xs text-gray-500">Amount</p><p className="font-bold text-green-700">{fmt(verifyModal.amount)}</p></div>
                <div><p className="text-xs text-gray-500">Requested by</p><p className="font-medium">{verifyModal.createdBy?.name}</p></div>
                {getTxnId(verifyModal) && (
                  <div className="col-span-2"><p className="text-xs text-gray-500">Transaction ID</p><p className="font-mono font-semibold text-gray-800">{getTxnId(verifyModal)}</p></div>
                )}
              </div>
              {/* Transaction ID - Required for company, Optional for trader (non-cash) */}
              {(verifyModal.paymentFor==='company' || verifyModal.paymentMethod !== 'Cash') && (
                <div>
                  <label className={lbl}>
                    Transaction ID / UTR{' '}
                    {verifyModal.paymentFor === 'company'
                      ? <span className="text-red-500">(Required)</span>
                      : <span className="text-gray-400">(Optional)</span>}
                  </label>
                  <input value={verifyForm.transactionId} onChange={e=>setVerifyForm({...verifyForm,transactionId:e.target.value})} className={inp} placeholder="UTR / Ref / Transaction number" />
                </div>
              )}
              {verifyModal.paymentFor==='company' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Payment Method *</label>
                      <select value={verifyForm.paymentMethod} onChange={e=>setVerifyForm({...verifyForm,paymentMethod:e.target.value})} className={inp}>
                        {['UPI','NEFT','RTGS','IMPS','Cheque','Cash','Other'].map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Bank Account</label>
                      <select value={verifyForm.bankAccount} onChange={e=>setVerifyForm({...verifyForm,bankAccount:e.target.value})} className={inp}>
                        <option value="">Select bank...</option>
                        {bankAccounts.map(a=><option key={a._id} value={a._id}>{a.bankName} – ****{a.accountNumber?.slice(-4)}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className={lbl}>Notes (Optional)</label>
                <textarea value={verifyForm.notes} onChange={e=>setVerifyForm({...verifyForm,notes:e.target.value})} className={inp} rows={2} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={submitVerify} disabled={!!loading} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50">
                  {loading?'Processing...':'✅ Verify Payment'}
                </button>
                <button onClick={()=>setVerifyModal(null)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-3">Reject Payment</h3>
            <label className={lbl}>Rejection Reason</label>
            <textarea value={rejectModal.reason} onChange={e=>setRejectModal({...rejectModal,reason:e.target.value})} className={inp} rows={3} placeholder="Reason for rejection..." />
            <div className="flex gap-3 mt-4">
              <button onClick={submitReject} disabled={!!loading} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 disabled:opacity-50">
                {loading?'Processing...':'Confirm Reject'}
              </button>
              <button onClick={()=>setRejectModal(null)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setDeleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">🗑️</div>
              <div><h3 className="font-bold text-gray-900">Delete Payment?</h3><p className="text-sm text-gray-500">This cannot be undone</p></div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <p><span className="text-gray-500">Party:</span> <span className="font-semibold">{deleteModal.company?.name||deleteModal.trader?.name}</span></p>
              <p><span className="text-gray-500">Amount:</span> <span className="font-extrabold text-red-600">{fmt(deleteModal.amount)}</span></p>
              <p><span className="text-gray-500">Status:</span> <span className="font-semibold capitalize">{deleteModal.status}</span></p>
              {getTxnId(deleteModal) && <p><span className="text-gray-500">Txn ID:</span> <span className="font-mono">{getTxnId(deleteModal)}</span></p>}
            </div>
            {deleteModal.status==='verified' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                ⚠️ This payment is <strong>verified</strong>. Deleting will reverse the outstanding balance adjustment.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={submitDelete} disabled={!!loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition">
                {loading?'Deleting...':'🗑️ Yes, Delete'}
              </button>
              <button onClick={()=>setDeleteModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE CARDS ── */}
      <div className="sm:hidden space-y-3">
        {filtered.map(p => {
          const isComp = p.paymentFor==='company';
          const txnId  = getTxnId(p);
          return (
            <div key={p._id} className={`rounded-xl border shadow-sm p-4 ${isComp?'bg-red-50 border-red-200':'bg-green-50 border-green-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{isComp?'🏭':'🤝'}</span>
                    <p className="font-semibold text-gray-900 text-sm">{p.company?.name||p.trader?.name}</p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · {p.createdBy?.name}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isComp?'text-red-600':'text-green-700'}`}>{fmt(p.amount)}</p>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc[p.status]||''}`}>{p.status}</span>
                </div>
              </div>
              {p.paymentMethod && <p className="text-xs text-gray-500 mb-1">{p.paymentMethod}</p>}
              {txnId && <p className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded mb-2 inline-block">Txn: {txnId}</p>}
              {p.status==='rejected'&&p.rejectionReason&&<p className="text-xs text-red-500 mb-2">Reason: {p.rejectionReason}</p>}
              <div className="flex gap-2 mt-2">
                {p.status==='pending' && <>
                  <button onClick={()=>openVerify(p)} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-semibold">✓ Verify</button>
                  <button onClick={()=>setRejectModal({id:p._id,reason:''})} className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold">✗ Reject</button>
                </>}
                <button onClick={()=>setDeleteModal(p)} className="py-2 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition">🗑️</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">✅</div><p>No payments found</p></div>}
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Payment Records</h3>
          <span className="text-xs text-gray-400">{filtered.length} records · Total {fmt(totalAmt)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Date','Type','Party','Amount','Method','Transaction ID / UTR','Bank','By','Status','Action'].map(h=>(
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isComp = p.paymentFor==='company';
                const txnId  = getTxnId(p);
                return (
                  <tr key={p._id} className={`border-b border-white/70 transition-colors ${isComp?'bg-red-50 hover:bg-red-100/60':'bg-green-50 hover:bg-green-100/60'}`}>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isComp?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                        {isComp?'🏭 Company':'🤝 Trader'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.company?.name||p.trader?.name}</td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap text-base ${isComp?'text-red-600':'text-green-700'}`}>{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.paymentMethod||<span className="italic text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {txnId
                        ? <span className="font-mono text-xs text-gray-800 bg-gray-100 px-2 py-1 rounded-lg">{txnId}</span>
                        : <span className="text-gray-300 text-xs italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.bankAccount?.bankName||'—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.createdBy?.name||'—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc[p.status]||''}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.status==='pending' && <>
                          <button onClick={()=>openVerify(p)} disabled={loading===p._id}
                            className="p-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 disabled:opacity-50 transition" title="Verify">✓</button>
                          <button onClick={()=>setRejectModal({id:p._id,reason:''})}
                            className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition" title="Reject">✗</button>
                        </>}
                        <button onClick={()=>setDeleteModal(p)} disabled={loading===p._id}
                          className="p-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 bg-white">No payments found</td></tr>
              )}
            </tbody>
            {filtered.length>0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total ({filtered.length})</td>
                  <td className="px-4 py-3 text-sm font-extrabold text-gray-800 whitespace-nowrap">{fmt(totalAmt)}</td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
