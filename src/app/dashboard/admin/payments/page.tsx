'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

type DateFilter = 'all' | 'month' | 'custom';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const getTxnId = (p: any) => p.utrNumber || p.chequeNumber || p.transactionId || null;

export default function AdminPaymentsPage() {
  const [payments,     setPayments]     = useState<any[]>([]);
  const [traders,      setTraders]      = useState<any[]>([]);
  const [companies,    setCompanies]    = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [exporting,    setExporting]    = useState(false);
  const [viewModal,    setViewModal]    = useState<any|null>(null);

  /* Filters */
  const [dateFilter,    setDateFilter]    = useState<DateFilter>('month');
  const [selMonth,      setSelMonth]      = useState(new Date().getMonth() + 1);
  const [selYear,       setSelYear]       = useState(new Date().getFullYear());
  const [customStart,   setCustomStart]   = useState('');
  const [customEnd,     setCustomEnd]     = useState('');
  const [filterStatus,  setFilterStatus]  = useState<'all'|'pending'|'verified'|'rejected'>('all');
  const [filterType,    setFilterType]    = useState<'all'|'trader'|'company'>('all');
  const [filterTrader,  setFilterTrader]  = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterBy,      setFilterBy]      = useState('');
  const [filterBank,    setFilterBank]    = useState('');

  const load = () => {
    fetch('/api/payments').then(r=>r.json()).then(d=>{
      const pmts = d.payments||[];
      setPayments(pmts);
      const seen = new Map<string,any>();
      pmts.forEach((p:any)=>{ if(p.createdBy?._id && !seen.has(p.createdBy._id)) seen.set(p.createdBy._id, p.createdBy); });
      setSalespersons(Array.from(seen.values()));
    });
    fetch('/api/traders').then(r=>r.json()).then(d=>setTraders(d.traders||[]));
    fetch('/api/companies').then(r=>r.json()).then(d=>setCompanies(d.companies||[]));
    fetch('/api/bank-accounts').then(r=>r.json()).then(d=>setBankAccounts(d.accounts||[]));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  const filtered = useMemo(()=>{
    const now = new Date();
    return payments.filter(p=>{
      const d = new Date(p.date);
      if(dateFilter==='month' && (d.getMonth()!==selMonth-1||d.getFullYear()!==selYear)) return false;
      if(dateFilter==='custom'){
        if(customStart && d<new Date(customStart)) return false;
        if(customEnd   && d>new Date(customEnd+'T23:59:59')) return false;
      }
      if(filterStatus!=='all' && p.status!==filterStatus) return false;
      if(filterType!=='all'   && p.paymentFor!==filterType) return false;
      if(filterTrader  && String(p.trader?._id)!==filterTrader)    return false;
      if(filterCompany && String(p.company?._id)!==filterCompany)  return false;
      if(filterBy      && String(p.createdBy?._id)!==filterBy)     return false;
      if(filterBank    && String(p.bankAccount?._id)!==filterBank) return false;
      return true;
    });
  },[payments,dateFilter,selMonth,selYear,customStart,customEnd,filterStatus,filterType,filterTrader,filterCompany,filterBy,filterBank]);

  const fmt = (n:number) => `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  const totalAmt    = filtered.reduce((s,p)=>s+(p.amount||0),0);
  const pendingAmt  = filtered.filter(p=>p.status==='pending').reduce((s,p)=>s+(p.amount||0),0);
  const verifiedAmt = filtered.filter(p=>p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
  const rejectedAmt = filtered.filter(p=>p.status==='rejected').reduce((s,p)=>s+(p.amount||0),0);

  const sc: Record<string,string> = {
    pending:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
    verified: 'bg-green-100  text-green-700  border border-green-200',
    rejected: 'bg-red-100    text-red-700    border border-red-200',
  };

  const clearFilters = () => {
    setFilterStatus('all'); setFilterType('all'); setFilterTrader('');
    setFilterCompany(''); setFilterBy(''); setFilterBank('');
  };
  const hasFilter = filterTrader||filterCompany||filterBy||filterBank||filterType!=='all'||filterStatus!=='all';

  const exportExcel = async () => {
    if(!filtered.length) return;
    setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const rows = filtered.map(p=>({
        'Date':          new Date(p.date).toLocaleDateString('en-IN'),
        'Type':          p.paymentFor,
        'Party':         p.company?.name||p.trader?.name||'',
        'Amount (₹)':    p.amount,
        'Method':        p.paymentMethod||'',
        'Txn ID':        getTxnId(p)||'',
        'Bank':          p.bankAccount?.bankName||'',
        'Requested By':  p.createdBy?.name||'',
        'Status':        p.status,
        'Notes':         p.notes||'',
        'Rejection Reason': p.rejectionReason||'',
      }));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Payments');
      writeFile(wb, `payments-admin-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const exportPDF = async () => {
    if(!filtered.length) return;
    setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation:'landscape' });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(30,41,59); doc.rect(0,0,W,32,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont('helvetica','bold');
      doc.text('Nanda Poultry Farm',14,14);
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(200,210,225);
      doc.text('Payment Records (Admin View)',14,22);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`,W-14,22,{align:'right'});
      autoTable(doc,{
        startY:38,
        head:[['Date','Type','Party','Amount','Method','Txn ID','Bank','Requested By','Status']],
        body: filtered.map(p=>[
          new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
          p.paymentFor, p.company?.name||p.trader?.name||'', fmt(p.amount||0),
          p.paymentMethod||'—', getTxnId(p)||'—', p.bankAccount?.bankName||'—',
          p.createdBy?.name||'', p.status,
        ]),
        styles:{fontSize:7.5}, headStyles:{fillColor:[249,115,22]},
        didParseCell:(data)=>{
          const status = filtered[data.row.index]?.status;
          if(data.column.index===8){
            data.cell.styles.textColor = status==='verified'?[22,163,74]:status==='rejected'?[220,38,38]:[161,98,7];
          }
        },
      });
      doc.save(`payments-admin-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch(e){ console.error(e); toast.error('Export failed'); }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Payment Requests</h1>
            <p className="text-slate-300 text-sm mt-0.5">{filtered.length} records · view-only</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={exporting||!filtered.length}
              className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 disabled:opacity-40 transition">📥 Excel</button>
            <button onClick={exportPDF} disabled={exporting||!filtered.length}
              className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-40 transition">📄 PDF</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:'Total',    v:fmt(totalAmt),    c:'text-gray-900',   bg:'bg-gray-50   border-gray-200'},
          {l:'Pending',  v:fmt(pendingAmt),  c:'text-yellow-700', bg:'bg-yellow-50 border-yellow-200'},
          {l:'Verified', v:fmt(verifiedAmt), c:'text-green-700',  bg:'bg-green-50  border-green-200'},
          {l:'Rejected', v:fmt(rejectedAmt), c:'text-red-600',    bg:'bg-red-50    border-red-200'},
        ].map(s=>(
          <div key={s.l} className={`rounded-xl border p-3 ${s.bg}`}>
            <p className="text-xs text-gray-500">{s.l}</p>
            <p className={`text-base font-bold truncate ${s.c}`}>{s.v}</p>
            <p className="text-xs text-gray-400">{filtered.filter(p=>s.l==='Total'||p.status===s.l.toLowerCase()).length} payments</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 space-y-3">

        {/* Period */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Period</span>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {(['all','month','custom'] as DateFilter[]).map(f=>(
              <button key={f} onClick={()=>setDateFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFilter===f?'bg-orange-500 text-white shadow-sm':'text-gray-500 hover:text-gray-800'}`}>
                {f==='all'?'All Time':f==='month'?'Month':'Custom Range'}
              </button>
            ))}
          </div>
          {dateFilter==='month' && (
            <div className="flex items-center gap-2">
              <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
              </select>
              <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {dateFilter==='custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>
          )}
        </div>

        {/* Status + type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Status</span>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {(['all','pending','verified','rejected'] as const).map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${filterStatus===s?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-800'}`}>
                {s==='all'?'All':s}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 ml-1">
            {(['all','trader','company'] as const).map(t=>(
              <button key={t} onClick={()=>{setFilterType(t);setFilterTrader('');setFilterCompany('');}}
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
          {hasFilter && <button onClick={clearFilters} className="text-xs text-orange-500 hover:text-orange-700 font-semibold underline">Clear all</button>}
        </div>
      </div>

      {/* View modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">Payment Details</h2>
                <p className="text-slate-300 text-xs">View only — accountant handles verification</p>
              </div>
              <button onClick={()=>setViewModal(null)} className="text-white/70 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                ['Type',         viewModal.paymentFor==='company'?'🏭 Company':'🤝 Trader'],
                ['Party',        viewModal.company?.name||viewModal.trader?.name||'—'],
                ['Amount',       fmt(viewModal.amount)],
                ['Date',         new Date(viewModal.date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})],
                ['Method',       viewModal.paymentMethod||'—'],
                ['Txn / UTR ID', getTxnId(viewModal)||'—'],
                ['Bank',         viewModal.bankAccount?.bankName||'—'],
                ['Requested By', viewModal.createdBy?.name||'—'],
                ['Status',       viewModal.status],
                ...(viewModal.notes ? [['Notes', viewModal.notes]] : []),
                ...(viewModal.rejectionReason ? [['Rejection Reason', viewModal.rejectionReason]] : []),
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{k}</span>
                  <span className={`font-semibold text-right ${k==='Status'?(viewModal.status==='verified'?'text-green-700':viewModal.status==='rejected'?'text-red-600':'text-yellow-700'):k==='Amount'?'text-green-700 text-lg':'text-gray-900'}`}>{v}</span>
                </div>
              ))}
              <button onClick={()=>setViewModal(null)} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 mt-2">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map(p=>{
          const isComp = p.paymentFor==='company';
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
              {p.paymentMethod && <p className="text-xs text-gray-500 mb-2">{p.paymentMethod}{getTxnId(p)?` · ${getTxnId(p)}`:''}</p>}
              <button onClick={()=>setViewModal(p)} className="w-full py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition">
                👁 View Details
              </button>
            </div>
          );
        })}
        {filtered.length===0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">💳</div><p>No payments found</p></div>}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Payment Records</h3>
          <span className="text-xs text-gray-400">{filtered.length} records · Total {fmt(totalAmt)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Date','Type','Party','Amount','Method','Txn ID','Bank','By','Status',''].map(h=>(
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(p=>{
                const isComp = p.paymentFor==='company';
                return (
                  <tr key={p._id} className={`border-b border-white/70 transition-colors ${isComp?'bg-red-50 hover:bg-red-100/60':'bg-green-50 hover:bg-green-100/60'}`}>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isComp?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{isComp?'🏭 Company':'🤝 Trader'}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.company?.name||p.trader?.name}</td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${isComp?'text-red-600':'text-green-700'}`}>{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.paymentMethod||'—'}</td>
                    <td className="px-4 py-3">{getTxnId(p) ? <span className="font-mono text-xs text-gray-800 bg-gray-100 px-2 py-1 rounded-lg">{getTxnId(p)}</span> : <span className="text-gray-300 text-xs italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.bankAccount?.bankName||'—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.createdBy?.name||'—'}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc[p.status]||''}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={()=>setViewModal(p)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">👁 View</button>
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
                  <td colSpan={6}/>
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
