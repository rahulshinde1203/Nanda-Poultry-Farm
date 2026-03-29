'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

type DateFilter = 'all' | 'month' | 'custom';
const DATE_LABELS: Record<DateFilter, string> = { all: 'All Time', month: 'Month', custom: 'Custom Range' };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

interface Props {
  readOnly?:  boolean;  // shows read-only badge
  canDelete?: boolean;  // admin can delete purchases
}

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function TransactionsView({ readOnly = false, canDelete = false }: Props) {
  const [purchases, setPurchases]   = useState<any[]>([]);
  const [traders, setTraders]       = useState<any[]>([]);
  const [companies, setCompanies]   = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [dateFilter, setDateFilter]     = useState<DateFilter>('month');
  const [selMonth,    setSelMonth]      = useState(new Date().getMonth() + 1);
  const [selYear,     setSelYear]       = useState(new Date().getFullYear());
  const [customStart, setCustomStart]   = useState('');
  const [customEnd, setCustomEnd]       = useState('');
  const [filterTrader, setFilterTrader] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/purchases').then(r => r.ok ? r.json() : { purchases: [] }),
      fetch('/api/traders').then(r => r.ok ? r.json() : { traders: [] }),
      fetch('/api/companies').then(r => r.ok ? r.json() : { companies: [] }),
      fetch('/api/users?role=salesperson').then(r => r.ok ? r.json() : { users: [] }),
    ]).then(([pur, trd, cmp, usr]) => {
      setPurchases(pur.purchases || []);
      setTraders(trd.traders || []);
      setCompanies(cmp.companies || []);
      setSalespersons(usr.users || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return purchases.filter(r => {
      const d = new Date(r.date);
      if (dateFilter === 'month' && (d.getMonth() !== selMonth-1 || d.getFullYear() !== selYear)) return false;
      if (dateFilter === 'custom') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd + 'T23:59:59')) return false;
      }
      if (filterTrader      && r.trader?._id  !== filterTrader)      return false;
      if (filterCompany     && r.company?._id !== filterCompany)     return false;
      if (filterSalesperson && String(r.createdBy?._id) !== filterSalesperson) return false;
      return true;
    });
  }, [purchases, dateFilter, customStart, customEnd, filterTrader, filterCompany, filterSalesperson]);

  const totalBirds    = filtered.reduce((s, r) => s + (r.numberOfBirds || 0), 0);
  const totalWeight   = filtered.reduce((s, r) => s + (r.totalWeight   || 0), 0);
  const totalPurchase = filtered.reduce((s, r) => s + (r.purchaseTotalAmount || 0), 0);
  const totalSale     = filtered.reduce((s, r) => s + (r.saleTotalAmount     || 0), 0);
  const totalProfit   = filtered.reduce((s, r) => s + (r.grossProfit         || 0), 0);

  const hasFilter = filterTrader || filterCompany || filterSalesperson || dateFilter !== 'all';
  const clearFilters = () => { setDateFilter('all'); setCustomStart(''); setCustomEnd(''); setFilterTrader(''); setFilterCompany(''); setFilterSalesperson(''); };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    setDeleting(null);
    setConfirmDelete(null);
    if (res.ok) { toast.success('Transaction deleted'); load(); }
    else { const d = await res.json(); toast.error(d.error || 'Delete failed'); }
  };

  /* ── Excel ── */
  const exportExcel = async () => {
    if (!filtered.length) return;
    setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const rows = filtered.map(r => ({
        'Date': new Date(r.date).toLocaleDateString('en-IN'),
        'Vehicle': r.vehicleNumber || '',
        'Company': r.company?.name || '',
        'Trader': r.trader?.name || '',
        'Salesperson': r.createdBy?.name || '',
        'Birds': r.numberOfBirds,
        'Weight (Kg)': Number(r.totalWeight?.toFixed(3)),
        'Avg Wt': Number(r.avgWeight?.toFixed(3) || 0),
        'Buy/Kg (₹)': r.purchaseRatePerKg,
        'Sell/Kg (₹)': r.saleRatePerKg,
        'Purchase Total (₹)': r.purchaseTotalAmount,
        'Sale Total (₹)': r.saleTotalAmount,
        'Gross Profit (₹)': r.grossProfit,
      }));
      rows.push({ 'Date': 'TOTAL', 'Vehicle': '', 'Company': '', 'Trader': '', 'Salesperson': '', 'Birds': totalBirds, 'Weight (Kg)': Number(totalWeight.toFixed(3)), 'Avg Wt': 0, 'Buy/Kg (₹)': 0, 'Sell/Kg (₹)': 0, 'Purchase Total (₹)': totalPurchase, 'Sale Total (₹)': totalSale, 'Gross Profit (₹)': totalProfit });
      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Transactions');
      writeFile(wb, `transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  /* ── PDF ── */
  const exportPDF = async () => {
    if (!filtered.length) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16); doc.text('Nanda Poultry Farm', 14, 15);
      doc.setFontSize(11); doc.text('Transactions Report', 14, 23);
      doc.setFontSize(8);
      doc.text(`Period: ${DATE_LABELS[dateFilter]}  |  Records: ${filtered.length}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);
      autoTable(doc, {
        startY: 36,
        head: [['Date','Vehicle','Company','Trader','Salesperson','Birds','Wt(Kg)','Buy/Kg','Sell/Kg','Purchase','Sale','Gross Profit']],
        body: [
          ...filtered.map(r => [
            new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
            r.vehicleNumber || '—', r.company?.name || '', r.trader?.name || '', r.createdBy?.name || '',
            (r.numberOfBirds||0).toLocaleString('en-IN'), r.totalWeight?.toFixed(3),
            `₹${r.purchaseRatePerKg}`, `₹${r.saleRatePerKg}`,
            fmt(r.purchaseTotalAmount||0), fmt(r.saleTotalAmount||0), fmt(r.grossProfit||0),
          ]),
          ['TOTAL','','','','', totalBirds.toLocaleString('en-IN'), totalWeight.toFixed(3), '','', fmt(totalPurchase), fmt(totalSale), fmt(totalProfit)],
        ],
        styles: { fontSize: 7 },
        headStyles: { fillColor: [249, 115, 22] },
        didParseCell: (d: any) => { if (d.row.index === filtered.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [255, 247, 237]; } },
      });
      doc.save(`transactions-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const sel = 'border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl flex items-center gap-2">
              All Transactions
              {readOnly && <span className="text-xs font-semibold bg-white/20 text-white/80 px-2 py-0.5 rounded-full">Read-only</span>}
            </h1>
            <p className="text-slate-300 text-sm mt-0.5">{filtered.length} records · {DATE_LABELS[dateFilter]}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={exporting || !filtered.length}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 shadow-sm transition">
              📥 Excel
            </button>
            <button onClick={exportPDF} disabled={exporting || !filtered.length}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 shadow-sm transition">
              📄 PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Period</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 flex-wrap">
              {(Object.keys(DATE_LABELS) as DateFilter[]).map(f => (
                <button key={f} onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${dateFilter === f ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {DATE_LABELS[f]}
                </button>
              ))}
            </div>
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <span className="text-gray-400 text-xs font-medium">to</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Filter</span>
            {salespersons.length > 0 && (
              <select value={filterSalesperson} onChange={e => setFilterSalesperson(e.target.value)} className={sel}>
                <option value="">👤 All Salespersons</option>
                {salespersons.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            )}
            <select value={filterTrader} onChange={e => setFilterTrader(e.target.value)} className={sel}>
              <option value="">🤝 All Traders</option>
              {traders.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className={sel}>
              <option value="">🏭 All Companies</option>
              {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {hasFilter && (
              <button onClick={clearFilters}
                className="text-xs text-orange-500 hover:text-orange-700 font-bold border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-50 transition">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { l: 'Transactions', v: filtered.length.toString(),         c: 'text-gray-900' },
              { l: 'Birds',        v: totalBirds.toLocaleString('en-IN'), c: 'text-amber-600' },
              { l: 'Weight (Kg)',  v: totalWeight.toFixed(3),             c: 'text-blue-600' },
              { l: 'Purchase',     v: fmt(totalPurchase),                 c: 'text-red-600' },
              { l: 'Sale Total',   v: fmt(totalSale),                     c: 'text-green-600' },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <p className={`text-base font-extrabold ${s.c} truncate`}>{s.v}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Transaction Records</h3>
            <div className="flex items-center gap-2">
              {readOnly && !canDelete && <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">🔒 Read-only</span>}
              {canDelete && <span className="flex items-center gap-1 text-xs text-red-400 bg-red-50 border border-red-100 rounded-lg px-2 py-1">⚠️ Admin mode</span>}
              <span className="text-xs text-gray-400">{filtered.length} records</span>
            </div>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gray-50">
            {filtered.map(r => (
              <div key={r._id} className="px-4 py-3.5">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{r.trader?.name} ← {r.company?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      {r.vehicleNumber ? ` · ${r.vehicleNumber}` : ''}
                      {r.createdBy?.name ? ` · ${r.createdBy.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-extrabold text-sm ${(r.grossProfit||0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(r.grossProfit||0)}</p>
                    {canDelete && (
                      <button onClick={() => setConfirmDelete(r)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs">🗑️</button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <p className="text-xs text-gray-500">Birds: <span className="font-semibold text-gray-800">{r.numberOfBirds?.toLocaleString('en-IN')}</span></p>
                  <p className="text-xs text-gray-500">Wt: <span className="font-semibold text-gray-800">{r.totalWeight?.toFixed(3)} Kg</span></p>
                  <p className="text-xs text-red-500">Purchase: <span className="font-semibold">{fmt(r.purchaseTotalAmount||0)}</span></p>
                  <p className="text-xs text-green-600">Sale: <span className="font-semibold">{fmt(r.saleTotalAmount||0)}</span></p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="px-4 py-14 text-center text-gray-400">No transactions found</div>}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date','Vehicle','Company','Trader','Salesperson','Birds','Wt(Kg)','Buy/Kg','Sell/Kg','Purchase','Sale','Gross Profit', ...(canDelete ? [''] : [])].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r._id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{r.vehicleNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.company?.name}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.trader?.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.createdBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{(r.numberOfBirds||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.totalWeight?.toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-red-500">₹{r.purchaseRatePerKg}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-green-600">₹{r.saleRatePerKg}</td>
                    <td className="px-4 py-3 text-xs font-bold text-red-600 whitespace-nowrap">{fmt(r.purchaseTotalAmount||0)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-green-700 whitespace-nowrap">{fmt(r.saleTotalAmount||0)}</td>
                    <td className={`px-4 py-3 text-xs font-extrabold whitespace-nowrap ${(r.grossProfit||0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(r.grossProfit||0)}</td>
                    {canDelete && (
                      <td className="px-4 py-3">
                        <button onClick={() => setConfirmDelete(r)}
                          className="opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                          🗑️ Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={canDelete ? 13 : 12} className="px-4 py-14 text-center text-gray-400">No transactions found</td></tr>}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-extrabold text-gray-700 uppercase">Totals ({filtered.length})</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-gray-800">{totalBirds.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-gray-800">{totalWeight.toFixed(3)}</td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-xs font-extrabold text-red-700 whitespace-nowrap">{fmt(totalPurchase)}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-green-700 whitespace-nowrap">{fmt(totalSale)}</td>
                    <td className={`px-4 py-3 text-xs font-extrabold whitespace-nowrap ${totalProfit >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmt(totalProfit)}</td>
                    {canDelete && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">🗑️</div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Transaction?</h3>
                <p className="text-sm text-gray-500">This cannot be undone</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <p><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(confirmDelete.date).toLocaleDateString('en-IN')}</span></p>
              <p><span className="text-gray-500">Trader:</span> <span className="font-medium">{confirmDelete.trader?.name}</span></p>
              <p><span className="text-gray-500">Company:</span> <span className="font-medium">{confirmDelete.company?.name}</span></p>
              <p><span className="text-gray-500">Sale Total:</span> <span className="font-bold text-red-600">{fmt(confirmDelete.saleTotalAmount || 0)}</span></p>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              ⚠️ This will also reverse the outstanding balance adjustments for the trader and company.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete._id || confirmDelete.id)}
                disabled={!!deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition">
                {deleting ? 'Deleting...' : '🗑️ Yes, Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
