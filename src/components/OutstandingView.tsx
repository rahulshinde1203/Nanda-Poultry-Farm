'use client';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

type Tab        = 'trader' | 'company';
type FilterType = 'all' | 'month' | 'day' | 'range';

interface FilterState {
  type: FilterType;
  date: string; month: string; year: string;
  start: string; end: string;
  salespersonId: string; traderId: string; companyId: string;
}

const todayStr  = () => new Date().toISOString().split('T')[0];
const thisMonth = () => String(new Date().getMonth() + 1);
const thisYear  = () => String(new Date().getFullYear());
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

const fmtAbs = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const sel = 'border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[150px]';
const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';

const emptyFilter = (): FilterState => ({
  type: 'all', date: todayStr(), month: thisMonth(), year: thisYear(),
  start: '', end: '', salespersonId: '', traderId: '', companyId: '',
});

function buildQS(f: FilterState): string {
  const p = new URLSearchParams({ filter: f.type });
  if (f.type === 'day')   p.set('date', f.date || todayStr());
  if (f.type === 'month') { p.set('month', f.month || thisMonth()); p.set('year', f.year || thisYear()); }
  if (f.type === 'range') { p.set('start', f.start); p.set('end', f.end); }
  if (f.salespersonId) p.set('salespersonId', f.salespersonId);
  if (f.traderId)      p.set('traderId',      f.traderId);
  if (f.companyId)     p.set('companyId',     f.companyId);
  return p.toString();
}

// Status badge
function StatusBadge({ status }: { status: 'outstanding' | 'settled' | 'advance' }) {
  if (status === 'outstanding') return <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full whitespace-nowrap">Outstanding</span>;
  if (status === 'advance')     return <span className="px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full whitespace-nowrap">Advance</span>;
  return <span className="px-2.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-500 rounded-full whitespace-nowrap">Settled</span>;
}

// Net balance display — red for positive (owed), green for negative (advance/credit), gray for zero
function NetBalance({ value }: { value: number }) {
  if (value > 0.01)  return <span className="font-extrabold text-red-600">{fmtAbs(value)}</span>;
  if (value < -0.01) return <span className="font-extrabold text-green-600">{fmtAbs(value)} <span className="text-xs font-semibold opacity-75">(Adv)</span></span>;
  return <span className="font-extrabold text-gray-400">₹0.00</span>;
}

export default function OutstandingView() {
  const [data, setData]           = useState<any>({ traders: [], companies: [], role: '', totals: { traderOutstanding: 0, companyOutstanding: 0 }, salespersons: [], allTraders: [], allCompanies: [] });
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('trader');
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter]       = useState<FilterState>(emptyFilter());

  const fetchData = useCallback((f: FilterState) => {
    setLoading(true);
    fetch(`/api/outstanding?${buildQS(f)}`)
      .then(r => r.ok ? r.json() : ({} as any))
      .then((d: any) => { if (d.role) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(filter); const t = setInterval(() => fetchData(filter), 30000); return () => clearInterval(t); }, [fetchData]);

  const upd = (key: keyof FilterState, val: string) => {
    const next = { ...filter, [key]: val };
    setFilter(next);
    if (next.type === 'range' && (!next.start || !next.end)) return;
    fetchData(next);
  };

  const reset = () => { const r = emptyFilter(); setFilter(r); fetchData(r); };

  const role    = data.role as string;
  const isSP    = role === 'salesperson';
  const canSeeAll = role === 'admin' || role === 'accountant';

  const traders   = data.traders  as any[];
  const companies = data.companies as any[];

  const traderTotal  = data.totals?.traderOutstanding  || 0;
  const companyTotal = data.totals?.companyOutstanding || 0;

  const traderOutstanding  = traders.filter(t => t.status === 'outstanding');
  const traderAdvance      = traders.filter(t => t.status === 'advance');
  const companyOutstanding = companies.filter(c => c.status === 'outstanding');
  const companyAdvance     = companies.filter(c => c.status === 'advance');

  const hasFilter = filter.type !== 'all' || filter.salespersonId || filter.traderId || filter.companyId;

  /* ── Export Excel ── */
  const exportExcel = async (type: Tab) => {
    setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const list  = type === 'trader' ? traders : companies;
      const label = type === 'trader' ? 'Trader' : 'Company';
      const rows  = list.map((p: any) => ({
        [label]: p.name,
        'Mobile': p.mobileNumber || '',
        'Net Balance (₹)': p.outstandingNet,
        'Status': p.status === 'advance' ? 'Advance/Credit' : p.status === 'settled' ? 'Settled' : 'Outstanding',
      }));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(rows), `${label} Outstanding`);
      writeFile(wb, `${type}-outstanding-${todayStr()}.xlsx`);
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  /* ── Export PDF ── */
  const exportPDF = async (type: Tab) => {
    setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const list  = type === 'trader' ? traders : companies;
      const label = type === 'trader' ? 'Trader' : 'Company';
      const doc   = new jsPDF({ orientation: 'portrait' });
      doc.setFontSize(16); doc.text('Nanda Poultry Farm', 14, 15);
      doc.setFontSize(11); doc.text(`${label} Outstanding Report`, 14, 23);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}  |  Role: ${role.toUpperCase()}`, 14, 30);
      autoTable(doc, {
        startY: 36,
        head: [['#', label, 'Mobile', 'Net Balance', 'Status']],
        body: list.map((p: any, i: number) => [
          i + 1, p.name, p.mobileNumber || '—',
          p.outstandingNet < -0.01 ? `-₹${Math.abs(p.outstandingNet).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)` :
          p.outstandingNet > 0.01  ? `₹${p.outstandingNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00',
          p.status === 'advance' ? 'Advance/Credit' : p.status === 'settled' ? 'Settled' : 'Outstanding',
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [249, 115, 22] },
        didParseCell: (d: any) => {
          if (d.column.index === 3 && d.section === 'body') {
            const net = list[d.row.index]?.outstandingNet || 0;
            d.cell.styles.textColor = net < -0.01 ? [22, 163, 74] : net > 0.01 ? [220, 38, 38] : [107, 114, 128];
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
      doc.save(`${type}-outstanding-${todayStr()}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  /* ─── PARTY TABLE ─────────────────────────────────────── */
  const PartyTable = ({ list, type }: { list: any[]; type: Tab }) => {
    const label    = type === 'trader' ? 'Trader' : 'Company';
    // Sort: highest outstanding first (positives desc), then zero, then most negative last
    const sorted   = [...list].sort((a, b) => b.outstandingNet - a.outstandingNet);
    const netTotal = list.reduce((s: number, p: any) => s + p.outstandingNet, 0);
    const dueCount = list.filter(p => p.status === 'outstanding').length;
    const advCount = list.filter(p => p.status === 'advance').length;
    const setCount = list.filter(p => p.status === 'settled').length;

    const headerBg   = type === 'trader' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100';
    const headerText = type === 'trader' ? 'text-orange-800' : 'text-blue-800';
    const footerBg   = type === 'trader' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200';

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className={`px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 ${headerBg}`}>
          <h3 className={`font-bold text-sm ${headerText}`}>
            {type === 'trader' ? '🤝' : '🏭'} {label}-wise Outstanding
          </h3>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-gray-400">{list.length} {label.toLowerCase()}{list.length !== 1 ? 's' : ''}</span>
            {dueCount > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">{dueCount} due</span>}
            {advCount > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">{advCount} advance</span>}
            {setCount > 0 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-semibold">{setCount} settled</span>}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-50">
          {sorted.map((p: any) => (
            <div key={p._id} className={`px-4 py-3.5 ${p.status === 'settled' ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.mobileNumber || '—'}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <NetBalance value={p.outstandingNet} />
                  <StatusBadge status={p.status} />
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="py-14 text-center text-gray-400">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-medium">No records found</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', label, 'Mobile', 'Net Balance', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((p: any, i: number) => (
                <tr key={p._id} className={`hover:bg-gray-50/80 transition ${p.status === 'settled' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-xs text-gray-400 w-8">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.mobileNumber || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><NetBalance value={p.outstandingNet} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-gray-400">
                    <div className="text-3xl mb-2">✅</div>No records found
                  </td>
                </tr>
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot className={`border-t-2 ${footerBg}`}>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase">
                    Net Total ({list.length} {label.toLowerCase()}{list.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <NetBalance value={netTotal} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={netTotal > 0.01 ? 'outstanding' : netTotal < -0.01 ? 'advance' : 'settled'} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  /* ─── RENDER ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Outstanding</h1>
            <p className="text-slate-300 text-sm mt-0.5">
              {isSP ? 'Your traders & companies balances' : 'All outstanding balances'}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
            isSP ? 'bg-orange-100/20 text-orange-200 border-orange-300/30' :
            role === 'admin' ? 'bg-purple-100/20 text-purple-200 border-purple-300/30' :
            'bg-blue-100/20 text-blue-200 border-blue-300/30'
          }`}>
            {isSP ? '👤 My records' : '🔭 All records'}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {/* Period */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Period</p>
            <div className="flex flex-wrap gap-2">
              {(['all','month','day','range'] as FilterType[]).map(t => (
                <button key={t} onClick={() => upd('type', t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    filter.type === t
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}>
                  {t === 'all' ? 'All Time' : t === 'month' ? 'Month' : t === 'day' ? 'Select Day' : 'Date Range'}
                </button>
              ))}
            </div>

            {filter.type === 'day' && (
              <div className="flex items-center gap-3 mt-3">
                <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                <input type="date" value={filter.date} max={todayStr()}
                  onChange={e => upd('date', e.target.value)} className={inp} />
              </div>
            )}
            {filter.type === 'month' && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <select value={filter.month} onChange={e => upd('month', e.target.value)} className={inp}>
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                </select>
                <select value={filter.year} onChange={e => upd('year', e.target.value)} className={inp}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
            {filter.type === 'range' && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="text-xs font-semibold text-gray-500 uppercase">From</label>
                <input type="date" value={filter.start} max={todayStr()}
                  onChange={e => upd('start', e.target.value)} className={inp} />
                <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                <input type="date" value={filter.end} max={todayStr()}
                  onChange={e => upd('end', e.target.value)} className={inp} />
              </div>
            )}
          </div>

          {/* Dropdowns */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Filter By</p>
            <div className="flex flex-wrap gap-2">
              {canSeeAll && (
                <select value={filter.salespersonId} onChange={e => upd('salespersonId', e.target.value)} className={sel}>
                  <option value="">👤 All Salespersons</option>
                  {data.salespersons.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              )}
              <select value={filter.traderId} onChange={e => upd('traderId', e.target.value)} className={sel}>
                <option value="">🤝 All Traders</option>
                {data.allTraders.map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
              <select value={filter.companyId} onChange={e => upd('companyId', e.target.value)} className={sel}>
                <option value="">🏭 All Companies</option>
                {data.allCompanies.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {hasFilter && (
                <button onClick={reset}
                  className="text-xs text-orange-500 hover:text-orange-700 font-bold border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-50 transition">
                  ✕ Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : (
          <>
            {/* Summary cards — show only sum of Outstanding status records */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setTab('trader')}
                className={`rounded-2xl p-5 border-2 text-left transition ${tab === 'trader' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white hover:border-orange-200'}`}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🤝 Trader Outstanding</p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-extrabold text-red-600 text-2xl">
                      {fmtAbs(traderOutstanding.reduce((s, t) => s + t.outstandingNet, 0))}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{traders.length} trader{traders.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    {traderOutstanding.length > 0 && <div><span className="text-gray-400">Due: </span><span className="font-semibold text-red-600">{traderOutstanding.length}</span></div>}
                    {traderAdvance.length > 0 && <div><span className="text-gray-400">Advance: </span><span className="font-semibold text-green-600">{traderAdvance.length}</span></div>}
                    {traders.filter(t => t.status === 'settled').length > 0 && <div><span className="text-gray-400">Settled: </span><span className="font-semibold text-gray-500">{traders.filter(t => t.status === 'settled').length}</span></div>}
                  </div>
                </div>
              </button>

              <button onClick={() => setTab('company')}
                className={`rounded-2xl p-5 border-2 text-left transition ${tab === 'company' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🏭 Company Outstanding</p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-extrabold text-red-600 text-2xl">
                      {fmtAbs(companyOutstanding.reduce((s, c) => s + c.outstandingNet, 0))}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}</p>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    {companyOutstanding.length > 0 && <div><span className="text-gray-400">Due: </span><span className="font-semibold text-red-600">{companyOutstanding.length}</span></div>}
                    {companyAdvance.length > 0 && <div><span className="text-gray-400">Advance: </span><span className="font-semibold text-green-600">{companyAdvance.length}</span></div>}
                    {companies.filter(c => c.status === 'settled').length > 0 && <div><span className="text-gray-400">Settled: </span><span className="font-semibold text-gray-500">{companies.filter(c => c.status === 'settled').length}</span></div>}
                  </div>
                </div>
              </button>
            </div>

            {/* Tab bar + exports */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                <button onClick={() => setTab('trader')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'trader' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  🤝 Trader-wise
                </button>
                <button onClick={() => setTab('company')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'company' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  🏭 Company-wise
                </button>
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <button onClick={() => exportExcel(tab)} disabled={exporting}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition">
                  📥 Excel
                </button>
                <button onClick={() => exportPDF(tab)} disabled={exporting}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition">
                  📄 PDF
                </button>
              </div>
            </div>

            {tab === 'trader'  && <PartyTable list={traders}   type="trader"  />}
            {tab === 'company' && <PartyTable list={companies} type="company" />}
          </>
        )}
      </div>
    </div>
  );
}
