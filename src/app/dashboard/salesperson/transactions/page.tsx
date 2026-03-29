'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

const emptyForm = { date: new Date().toISOString().split('T')[0], company: '', trader: '', numberOfBirds: '', totalWeight: '', purchaseRatePerKg: '', saleRatePerKg: '', vehicleNumber: '', notes: '' };

type DateFilter = 'all' | 'month' | 'custom';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function TransactionsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [traders, setTraders] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editReason, setEditReason] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [selMonth,    setSelMonth]    = useState(new Date().getMonth() + 1);
  const [selYear,     setSelYear]     = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterTrader, setFilterTrader] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const loadAll = () => {
    fetch('/api/purchases').then(r => r.json()).then(d => setRecords(d.purchases || []));
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d.companies || []));
    fetch('/api/traders').then(r => r.json()).then(d => setTraders(d.traders || []));
    fetch('/api/edit-requests').then(r => r.json()).then(d => setMyRequests(d.requests || []));
  };
  useEffect(() => { loadAll(); const t = setInterval(loadAll, 30000); return () => clearInterval(t); }, []);

  // Filter records by date, trader, company
  const filteredRecords = useMemo(() => {
    const now = new Date();
    return records.filter(r => {
      const d = new Date(r.date);
      if (dateFilter === 'month') {
        if (d.getMonth() !== selMonth-1 || d.getFullYear() !== selYear) return false;
      } else if (dateFilter === 'custom') {
        const s = customStart ? new Date(customStart) : new Date(0);
        const e = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
        if (d < s || d > e) return false;
      }
      if (filterTrader && r.trader?._id !== filterTrader) return false;
      if (filterCompany && r.company?._id !== filterCompany) return false;
      return true;
    });
  }, [records, dateFilter, selMonth, selYear, customStart, customEnd, filterTrader, filterCompany]);

  const birds = Number(form.numberOfBirds) || 0, weight = Number(form.totalWeight) || 0, buyRate = Number(form.purchaseRatePerKg) || 0, sellRate = Number(form.saleRatePerKg) || 0;
  const avgWt = birds > 0 ? (weight / birds).toFixed(3) : '0.000';
  const purTotal = +(weight * buyRate).toFixed(2);
  const saleTotal = +(weight * sellRate).toFixed(2);
  const profit = +(saleTotal - purTotal).toFixed(2);

  const eBirds = Number(editForm.numberOfBirds) || 0, eWeight = Number(editForm.totalWeight) || 0, eBuy = Number(editForm.purchaseRatePerKg) || 0, eSell = Number(editForm.saleRatePerKg) || 0;
  const eAvgWt = eBirds > 0 ? (eWeight / eBirds).toFixed(3) : '0.000';
  const ePurTotal = +(eWeight * eBuy).toFixed(2);
  const eSaleTotal = +(eWeight * eSell).toFixed(2);
  const eProfit = +(eSaleTotal - ePurTotal).toFixed(2);

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k: string) => (e: any) => setEditForm((p: any) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json(); setLoading(false);
    if (res.ok) { toast.success('Transaction saved!'); setShowForm(false); setForm(emptyForm); loadAll(); }
    else toast.error(d.error || 'Failed');
  };

  const openEdit = (rec: any) => {
    const hasPending = myRequests.some(r => r.recordId?._id === rec._id && r.status === 'pending');
    if (hasPending) { toast.warning('Pending edit request already exists for this record'); return; }
    setEditingRecord(rec);
    setEditForm({ date: new Date(rec.date).toISOString().split('T')[0], company: rec.company?._id || '', trader: rec.trader?._id || '', numberOfBirds: rec.numberOfBirds, totalWeight: rec.totalWeight, purchaseRatePerKg: rec.purchaseRatePerKg, saleRatePerKg: rec.saleRatePerKg, vehicleNumber: rec.vehicleNumber || '', notes: rec.notes || '' });
    setEditReason('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReason.trim()) { toast.error('Reason is mandatory'); return; }
    setEditLoading(true);
    const res = await fetch('/api/edit-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: editingRecord._id, requestedData: editForm, reason: editReason }) });
    const d = await res.json(); setEditLoading(false);
    if (res.ok) { toast.success('Edit request submitted for approval'); setEditingRecord(null); loadAll(); }
    else toast.error(d.error || 'Failed');
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const wb = utils.book_new();
      const rows = filteredRecords.map(r => ({
        'Date': new Date(r.date).toLocaleDateString('en-IN'),
        'Vehicle': r.vehicleNumber || '',
        'Company': r.company?.name || '',
        'Trader': r.trader?.name || '',
        'Birds': r.numberOfBirds,
        'Weight (Kg)': r.totalWeight?.toFixed(3),
        'Avg Weight': r.avgWeight?.toFixed(3),
        'Buy Rate/Kg': r.purchaseRatePerKg,
        'Sell Rate/Kg': r.saleRatePerKg,
        'Purchase Total (₹)': r.purchaseTotalAmount,
        'Sale Total (₹)': r.saleTotalAmount,
      }));
      const ws = utils.json_to_sheet(rows);
      utils.book_append_sheet(wb, ws, 'Transactions');
      writeFile(wb, `transactions-${dateFilter}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('landscape');
      doc.setFontSize(14); doc.text('Nanda Poultry Farm — Transactions', 14, 15);
      doc.setFontSize(9); doc.text(`Filter: ${dateFilter.toUpperCase()} | Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 22);
      autoTable(doc, {
        startY: 27,
        head: [['Date', 'Vehicle', 'Company', 'Trader', 'Birds', 'Wt(Kg)', 'Buy/kg', 'Sell/kg', 'Purchase', 'Sale']],
        body: filteredRecords.map(r => [
          new Date(r.date).toLocaleDateString('en-IN'), r.vehicleNumber || '',
          r.company?.name || '', r.trader?.name || '',
          r.numberOfBirds, r.totalWeight?.toFixed(3),
          `₹${r.purchaseRatePerKg}`, `₹${r.saleRatePerKg}`,
          `₹${(r.purchaseTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          `₹${(r.saleTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [249, 115, 22] },
      });
      doc.save(`transactions-${dateFilter}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;
  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';
  const sc: any = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

  const totalPurchase = filteredRecords.reduce((s, r) => s + (r.purchaseTotalAmount || 0), 0);
  const totalSale = filteredRecords.reduce((s, r) => s + (r.saleTotalAmount || 0), 0);
  const totalBirds = filteredRecords.reduce((s, r) => s + (r.numberOfBirds || 0), 0);
  const totalWeight = filteredRecords.reduce((s, r) => s + (r.totalWeight || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Transactions</h1>
            <p className="text-slate-300 text-sm mt-0.5">{filteredRecords.length} records · {dateFilter === 'all' ? 'All Time' : dateFilter === 'month' ? `${MONTHS[selMonth-1]} ${selYear}` : 'Custom Range'}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowRequests(!showRequests)} className="relative flex items-center gap-2 px-3 py-2 border border-white/20 bg-white/10 text-white rounded-xl hover:bg-white/20 text-sm font-medium transition">
              📋 My Requests
              {pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{pendingCount}</span>}
            </button>
            <button onClick={() => { setShowForm(!showForm); setForm(emptyForm); }} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold text-sm shadow-sm transition">+ New Transaction</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex flex-col gap-3">
        {/* Row 1: Date + Export */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
            {([['all','All Time'],['month','Month'],['custom','Custom Range']] as [DateFilter,string][]).map(([v,l]) => (
              <button key={v} onClick={() => setDateFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${dateFilter === v ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{l}</button>
            ))}
          </div>
          {dateFilter === 'month' && (
            <div className="flex items-center gap-2">
              <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
              </select>
              <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={exportExcel} disabled={exporting || filteredRecords.length === 0} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-40">📥 Excel</button>
            <button onClick={exportPDF} disabled={exporting || filteredRecords.length === 0} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40">📄 PDF</button>
          </div>
        </div>
        {/* Row 2: Trader + Company dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Filter</span>
          <select value={filterTrader} onChange={e => setFilterTrader(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]">
            <option value="">🤝 All Traders</option>
            {traders.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]">
            <option value="">🏭 All Companies</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {(filterTrader || filterCompany) && (
            <button onClick={() => { setFilterTrader(''); setFilterCompany(''); }}
              className="text-xs text-orange-500 hover:text-orange-700 font-semibold underline">Clear</button>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { l: 'Transactions', v: filteredRecords.length.toString(), c: 'text-gray-900' },
          { l: 'Birds', v: totalBirds.toLocaleString('en-IN'), c: 'text-orange-600' },
          { l: 'Weight (Kg)', v: totalWeight.toFixed(3), c: 'text-blue-600' },
          { l: 'Purchase Total', v: `₹${totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, c: 'text-red-600' },
          { l: 'Sale Total', v: `₹${totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, c: 'text-green-600' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <p className={`text-base sm:text-lg font-bold ${s.c} truncate`}>{s.v}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* My Requests Panel */}
      {showRequests && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">My Edit Requests</h3>
            <button onClick={() => setShowRequests(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          {myRequests.length === 0 ? <div className="px-5 py-8 text-center text-gray-400 text-sm">No requests yet</div> : (
            <div className="divide-y divide-gray-50">
              {myRequests.map(req => (
                <div key={req._id} className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sc[req.status]}`}>{req.status.toUpperCase()}</span>
                    <span className="text-sm font-medium text-gray-800">Vehicle: {req.recordId?.vehicleNumber || '—'}</span>
                    <span className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="text-xs text-gray-600"><span className="font-medium">Changed:</span> {req.changedFields?.join(', ')}</p>
                  <p className="text-xs text-gray-600"><span className="font-medium">Reason:</span> {req.reason}</p>
                  {req.reviewNote && <p className="text-xs text-gray-400 italic">Reviewer: "{req.reviewNote}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Transaction Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg mb-5 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
            <h2 className="text-white font-bold">New Purchase & Sale Entry</h2>
            <p className="text-orange-100 text-xs mt-0.5">Fill all details for this transaction</p>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Date *</label><input type="date" required value={form.date} onChange={f('date')} className={inp} /></div>
              <div><label className={lbl}>Vehicle Number *</label><input required type="text" value={form.vehicleNumber} onChange={f('vehicleNumber')} className={inp} placeholder="MH12 AB 1234" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 space-y-3">
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest">🛒 Purchase</p>
                <div><label className={lbl}>Company *</label><select required value={form.company} onChange={f('company')} className={inp}><option value="">Select...</option>{companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
                <div><label className={lbl}>Purchase Rate/Kg (₹) *</label><input required type="number" min="0" step="0.01" value={form.purchaseRatePerKg} onChange={f('purchaseRatePerKg')} className={inp} placeholder="110.00" /></div>
                <div className="bg-white rounded-lg px-3 py-2 border border-red-200"><p className="text-xs text-gray-500">Purchase Total</p><p className="text-lg font-bold text-red-600">₹{purTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-100 space-y-3">
                <p className="text-xs font-bold text-green-600 uppercase tracking-widest">💰 Sale</p>
                <div><label className={lbl}>Trader *</label><select required value={form.trader} onChange={f('trader')} className={inp}><option value="">Select...</option>{traders.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                <div><label className={lbl}>Sale Rate/Kg (₹) *</label><input required type="number" min="0" step="0.01" value={form.saleRatePerKg} onChange={f('saleRatePerKg')} className={inp} placeholder="125.00" /></div>
                <div className="bg-white rounded-lg px-3 py-2 border border-green-200"><p className="text-xs text-gray-500">Sale Total</p><p className="text-lg font-bold text-green-600">₹{saleTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>No. of Birds *</label><input required type="number" min="1" value={form.numberOfBirds} onChange={f('numberOfBirds')} className={inp} placeholder="500" /></div>
              <div><label className={lbl}>Total Weight (Kg) *</label><input required type="number" min="0" step="0.001" value={form.totalWeight} onChange={f('totalWeight')} className={inp} placeholder="1250.000" /></div>
              <div><label className={lbl}>Avg Wt/Bird</label><div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm font-bold text-gray-700">{avgWt} Kg</div></div>
            </div>
            <div className={`rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-2 ${profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex gap-6"><div><p className="text-xs text-gray-500">Purchase</p><p className="text-base font-bold text-red-600">₹{purTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div><div className="text-gray-300 self-center hidden sm:block">→</div><div><p className="text-xs text-gray-500">Sale</p><p className="text-base font-bold text-green-600">₹{saleTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div></div>
              <div className="sm:text-right"><p className="text-xs text-gray-500 uppercase">Net Profit</p><p className={`text-xl font-extrabold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{profit >= 0 ? '+' : ''}₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
            </div>
            <div><label className={lbl}>Notes</label><textarea value={form.notes} onChange={f('notes')} className={inp} rows={2} placeholder="Optional remarks..." /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="flex-1 sm:flex-none px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold disabled:opacity-50">{loading ? 'Saving...' : '✓ Save Transaction'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Request Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 sticky top-0 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div><h2 className="text-white font-bold">Request Record Edit</h2><p className="text-blue-100 text-xs">Changes need accountant approval</p></div>
                <button onClick={() => setEditingRecord(null)} className="text-white/70 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                📌 Editing: <strong>{editingRecord.vehicleNumber}</strong> · {new Date(editingRecord.date).toLocaleDateString('en-IN')} · {editingRecord.numberOfBirds} birds
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Date *</label><input type="date" required value={editForm.date} onChange={ef('date')} className={inp} /></div>
                <div><label className={lbl}>Vehicle No. *</label><input required type="text" value={editForm.vehicleNumber} onChange={ef('vehicleNumber')} className={inp} /></div>
                <div><label className={lbl}>Company *</label><select required value={editForm.company} onChange={ef('company')} className={inp}><option value="">Select...</option>{companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
                <div><label className={lbl}>Trader *</label><select required value={editForm.trader} onChange={ef('trader')} className={inp}><option value="">Select...</option>{traders.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                <div><label className={lbl}>Purchase Rate/Kg *</label><input required type="number" min="0" step="0.01" value={editForm.purchaseRatePerKg} onChange={ef('purchaseRatePerKg')} className={inp} /></div>
                <div><label className={lbl}>Sale Rate/Kg *</label><input required type="number" min="0" step="0.01" value={editForm.saleRatePerKg} onChange={ef('saleRatePerKg')} className={inp} /></div>
                <div><label className={lbl}>No. of Birds *</label><input required type="number" min="1" value={editForm.numberOfBirds} onChange={ef('numberOfBirds')} className={inp} /></div>
                <div><label className={lbl}>Total Weight (Kg) *</label><input required type="number" min="0" step="0.001" value={editForm.totalWeight} onChange={ef('totalWeight')} className={inp} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200"><p className="text-xs text-gray-500">Avg Wt</p><p className="text-sm font-bold">{eAvgWt} Kg</p></div>
                <div className="bg-red-50 rounded-lg p-2 border border-red-100"><p className="text-xs text-gray-500">New Purchase</p><p className="text-sm font-bold text-red-600">₹{ePurTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
                <div className={`rounded-lg p-2 border-2 ${eProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><p className="text-xs text-gray-500">New Profit</p><p className={`text-sm font-bold ${eProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{eProfit >= 0 ? '+' : ''}₹{eProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
              </div>
              <div><label className={lbl}>Notes</label><input type="text" value={editForm.notes} onChange={ef('notes')} className={inp} /></div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠️ Reason for Change <span className="text-red-500">* Mandatory</span></label>
                <textarea required value={editReason} onChange={e => setEditReason(e.target.value)} className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" rows={3} placeholder="Why are you changing this record?" />
              </div>
              <div className="flex gap-3 pb-2">
                <button type="submit" disabled={editLoading || !editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold disabled:opacity-50 text-sm">{editLoading ? 'Submitting...' : '📨 Submit for Approval'}</button>
                <button type="button" onClick={() => setEditingRecord(null)} className="px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Records — Mobile Cards */}
      <div className="sm:hidden space-y-3 mb-4">
        {filteredRecords.map(r => {
          const hasPending = myRequests.some(req => req.recordId?._id === r._id && req.status === 'pending');
          return (
            <div key={r._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div><p className="font-bold text-gray-900 font-mono text-sm">{r.vehicleNumber}</p><p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-2">
                <p className="text-gray-500">Company: <span className="text-gray-800 font-medium">{r.company?.name}</span></p>
                <p className="text-gray-500">Trader: <span className="text-gray-800 font-medium">{r.trader?.name}</span></p>
                <p className="text-gray-500">Birds: <span className="text-gray-800 font-medium">{r.numberOfBirds?.toLocaleString()}</span></p>
                <p className="text-gray-500">Weight: <span className="text-gray-800 font-medium">{r.totalWeight?.toFixed(3)} Kg</span></p>
                <p className="text-red-500">Buy: <span className="font-medium">₹{r.purchaseRatePerKg}/kg</span></p>
                <p className="text-green-600">Sell: <span className="font-medium">₹{r.saleRatePerKg}/kg</span></p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div className="flex gap-3">
                  <span className="text-xs text-red-600 font-medium">₹{r.purchaseTotalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-xs text-gray-300">→</span>
                  <span className="text-xs text-green-600 font-medium">₹{r.saleTotalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {hasPending ? <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">⏳ Pending</span> : <button onClick={() => openEdit(r)} className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold">✏️ Edit</button>}
              </div>
            </div>
          );
        })}
        {filteredRecords.length === 0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">🐔</div><p>No transactions for this period</p></div>}
      </div>

      {/* Records — Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Transactions</h3>
          <span className="text-xs text-gray-400">{filteredRecords.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Date', 'Vehicle', 'Company', 'Trader', 'Birds', 'Wt(Kg)', 'Buy/kg', 'Sell/kg', 'Purchase', 'Sale', ''].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRecords.map(r => {
                const hasPending = myRequests.some(req => req.recordId?._id === r._id && req.status === 'pending');
                return (
                  <tr key={r._id} className="hover:bg-orange-50/20">
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap text-xs">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700 text-xs whitespace-nowrap">{r.vehicleNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium text-xs">{r.company?.name}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium text-xs">{r.trader?.name}</td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{r.numberOfBirds?.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{r.totalWeight?.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-red-600 font-medium text-xs">₹{r.purchaseRatePerKg}</td>
                    <td className="px-3 py-2.5 text-green-600 font-medium text-xs">₹{r.saleRatePerKg}</td>
                    <td className="px-3 py-2.5 text-red-600 font-semibold whitespace-nowrap text-xs">₹{r.purchaseTotalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-green-600 font-semibold whitespace-nowrap text-xs">₹{r.saleTotalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5">{hasPending ? <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">⏳</span> : <button onClick={() => openEdit(r)} className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100">✏️</button>}</td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && <tr><td colSpan={11} className="px-4 py-16 text-center"><div className="text-3xl mb-2">🐔</div><p className="text-gray-400">No transactions for this period</p></td></tr>}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase">Totals ({filteredRecords.length})</td>
                  <td className="px-3 py-3 text-xs font-bold text-gray-800">{totalBirds.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-xs font-bold text-gray-800">{totalWeight.toFixed(3)}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-xs font-bold text-red-600 whitespace-nowrap">₹{totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-3 text-xs font-bold text-green-600 whitespace-nowrap">₹{totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td />
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