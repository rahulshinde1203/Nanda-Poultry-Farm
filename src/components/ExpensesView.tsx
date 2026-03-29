'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

type PeriodType = 'all' | 'month' | 'custom';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const PAYMENT_METHODS = ['Cash', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'];

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  expenseType: '', amount: '', transactionId: '',
  bankAccount: '', paymentMethod: 'Cash', notes: '',
};
const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function ExpensesView({ readOnly = false }: { readOnly?: boolean }) {
  const [expenses,     setExpenses]     = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showForm,  setShowForm]    = useState(false);
  const [loading,   setLoading]     = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deleteId,  setDeleteId]    = useState<string | null>(null);
  const [form,      setForm]        = useState({ ...emptyForm });

  // Period filter
  const [period,      setPeriod]      = useState<PeriodType>('month');
  const [selMonth,    setSelMonth]    = useState(new Date().getMonth());   // 0-indexed
  const [selYear,     setSelYear]     = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [filterType,  setFilterType]  = useState('');
  const [filterBank,  setFilterBank]  = useState('');

  const load = () => {
    fetch('/api/expenses').then(r => r.ok ? r.json() : { expenses: [] }).then(d => setExpenses(d.expenses || []));
    fetch('/api/expense-types').then(r => r.ok ? r.json() : { expenseTypes: [] }).then(d => setExpenseTypes(d.expenseTypes || []));
    fetch('/api/bank-accounts').then(r => r.ok ? r.json() : { accounts: [] }).then(d => setBankAccounts(d.accounts || []));
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date);
      if (period === 'month' && (d.getMonth() !== selMonth || d.getFullYear() !== selYear)) return false;
      if (period === 'custom') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd + 'T23:59:59')) return false;
      }
      if (filterType && e.expenseType !== filterType) return false;
      if (filterBank && e.bankAccount?._id !== filterBank) return false;
      return true;
    });
  }, [expenses, period, selMonth, selYear, customStart, customEnd, filterType, filterBank]);

  const totalExpenses = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const typeNames = expenseTypes.map((t: any) => t.name || t);
  // Transaction ID only shown when not Cash
  const needsUTR  = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque'].includes(form.paymentMethod);
  const needsBank = true; // Bank account mandatory for all expense payment methods

  const periodLabel = period === 'all' ? 'All Time'
    : period === 'month'  ? `${MONTHS[selMonth]} ${selYear}`
    : 'Custom Range';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expenseType) { toast.error('Please select expense type'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Please enter a valid amount'); return; }
    if (needsUTR && !form.transactionId.trim()) { toast.error(`Transaction ID is required for ${form.paymentMethod}`); return; }
    if (needsBank && !form.bankAccount) { toast.error('Bank account is required'); return; }
    setLoading(true);
    const payload = { ...form, bankAccount: form.bankAccount || undefined };
    const url    = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await res.json(); setLoading(false);
    if (res.ok) {
      toast.success(editingId ? 'Expense updated! ✅' : 'Expense recorded! ✅');
      setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); load();
    } else toast.error(d.error || 'Failed');
  };

  const openEdit = (exp: any) => {
    setEditingId(exp._id);
    setForm({
      date: exp.date?.split('T')[0] || '',
      expenseType: exp.expenseType || '',
      amount: String(exp.amount || ''),
      transactionId: exp.transactionId || '',
      bankAccount: exp.bankAccount?._id || '',
      paymentMethod: exp.paymentMethod || 'Cash',
      notes: exp.notes || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/expenses/${deleteId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Expense deleted'); load(); }
    else toast.error('Delete failed');
    setDeleteId(null);
  };

  /* ── Excel ── */
  const exportExcel = async () => {
    if (!filtered.length) return; setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const rows = filtered.map(e => ({
        'Date': new Date(e.date).toLocaleDateString('en-IN'),
        'Type': e.expenseType, 'Amount (₹)': e.amount,
        'Method': e.paymentMethod || '', 'Transaction ID': e.transactionId || '',
        'Bank': e.bankAccount?.bankName || '', 'Notes': e.notes || '',
        'Added By': e.createdBy?.name || '',
      }));
      rows.push({ 'Date': 'TOTAL', 'Type': '', 'Amount (₹)': totalExpenses, 'Method': '', 'Transaction ID': '', 'Bank': '', 'Notes': '', 'Added By': '' });
      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Expenses');
      writeFile(wb, `expenses-${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Nanda Poultry Farm', 14, 15);
      doc.setFontSize(11); doc.text('Expenses Report', 14, 23);
      doc.setFontSize(8); doc.text(`Period: ${periodLabel}  |  Total: ${fmt(totalExpenses)}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);
      autoTable(doc, {
        startY: 36,
        head: [['Date','Type','Amount','Method','Txn ID','Bank','Notes']],
        body: [
          ...filtered.map(e => [
            new Date(e.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
            e.expenseType, fmt(e.amount || 0), e.paymentMethod || '',
            e.transactionId || '', e.bankAccount?.bankName || '', e.notes || '',
          ]),
          ['TOTAL','', fmt(totalExpenses),'','','',''],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] },
        didParseCell: (d: any) => { if (d.row.index === filtered.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [255, 247, 237]; } },
      });
      doc.save(`expenses-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl flex items-center gap-2">
              Expenses
              {readOnly && <span className="text-xs font-semibold bg-white/20 text-white/80 px-2 py-0.5 rounded-full">Read-only</span>}
            </h1>
            <p className="text-white/70 text-sm mt-0.5">{filtered.length} records · {periodLabel}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!readOnly && (
              <button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm({ ...emptyForm }); }}
                className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-xl text-sm font-bold shadow hover:bg-orange-50 transition">
                {showForm ? '✕ Cancel' : '+ Add Expense'}
              </button>
            )}
            <button onClick={exportExcel} disabled={exporting || !filtered.length}
              className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition">📥 Excel</button>
            <button onClick={exportPDF} disabled={exporting || !filtered.length}
              className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition">📄 PDF</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Total Expenses</p>
            <p className="text-2xl font-extrabold text-red-600">{fmt(totalExpenses)}</p>
          </div>
          <div className="text-4xl">💸</div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">

          {/* Period row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Period</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['all','month','custom'] as PeriodType[]).map(f => (
                <button key={f} onClick={() => setPeriod(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === f ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {f === 'all' ? 'All Time' : f === 'month' ? 'Month' : 'Custom Range'}
                </button>
              ))}
            </div>

            {/* Month + Year selector */}
            {period === 'month' && (
              <div className="flex items-center gap-2">
                <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {/* Custom date range */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            )}
          </div>

          {/* Dropdown filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 uppercase w-14 shrink-0">Filter</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]">
              <option value="">🏷 All Types</option>
              {typeNames.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterBank} onChange={e => setFilterBank(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[140px]">
              <option value="">🏦 All Banks</option>
              {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.bankName}</option>)}
            </select>
            {(filterType || filterBank) && (
              <button onClick={() => { setFilterType(''); setFilterBank(''); }}
                className="text-xs text-orange-500 hover:text-orange-700 font-bold border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-50 transition">✕ Clear</button>
            )}
          </div>
        </div>

        {/* Add/Edit form */}
        {!readOnly && showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-100 px-5 py-3">
              <h3 className="font-bold text-orange-800">{editingId ? '✏️ Edit Expense' : '+ Add New Expense'}</h3>
            </div>
            <form onSubmit={submit} className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Date *</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Expense Type *</label>
                  <select required value={form.expenseType}
                    onChange={e => setForm(f => ({ ...f, expenseType: e.target.value }))} className={inp}>
                    <option value="">Select type...</option>
                    {typeNames.map((t: string) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Amount (₹) *</label>
                  <input required type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} placeholder="0.00" />
                </div>
                <div>
                  <label className={lbl}>Payment Method *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: m, transactionId: '', bankAccount: '' }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${form.paymentMethod === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transaction ID — shown for all non-Cash methods */}
                {needsUTR && (
                  <div>
                    <label className={lbl}>Transaction ID / Cheque No * <span className="text-orange-500 normal-case font-normal">(required for {form.paymentMethod})</span></label>
                    <input type="text" value={form.transactionId}
                      onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                      className={inp} placeholder="UTR / Reference / Cheque number" />
                  </div>
                )}

                {/* Bank Account — always mandatory */}
                <div>
                    <label className={lbl}>Bank Account * <span className="text-orange-500 normal-case font-normal">(required)</span></label>
                    <select value={form.bankAccount}
                      onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} className={inp}>
                      <option value="">Select bank account...</option>
                      {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.bankName} – ****{a.accountNumber?.slice(-4)}</option>)}
                    </select>
                  </div>

                <div className="sm:col-span-2">
                  <label className={lbl}>Notes <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                  <textarea value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={inp} rows={2} placeholder="Optional notes..." />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={loading}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold text-sm disabled:opacity-50 transition">
                  {loading ? 'Saving...' : editingId ? '💾 Update Expense' : '+ Add Expense'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-3xl mb-3">🗑️</div>
              <h3 className="font-bold text-gray-900 mb-2">Delete Expense?</h3>
              <p className="text-gray-500 text-sm mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition">Delete</button>
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Expense Records</h3>
            <div className="flex items-center gap-2">
              {readOnly && <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">🔒 Read-only</span>}
              <span className="text-xs font-bold text-red-600">{fmt(totalExpenses)}</span>
            </div>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gray-50">
            {filtered.map(e => (
              <div key={e._id} className="px-4 py-3.5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{e.expenseType}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(e.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      {e.paymentMethod ? ` · ${e.paymentMethod}` : ''}
                    </p>
                    {e.transactionId && <p className="text-xs font-mono text-gray-500 mt-0.5">Txn: {e.transactionId}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-red-600">{fmt(e.amount)}</p>
                    {!readOnly && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 text-xs">✏️</button>
                        <button onClick={() => setDeleteId(e._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 text-xs">🗑</button>
                      </div>
                    )}
                  </div>
                </div>
                {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-4 py-12 text-center text-gray-400">No expenses found</div>}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date','Type','Amount','Method','Transaction ID','Bank','Added By','Notes', ...(readOnly ? [] : ['Actions'])].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e._id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{e.expenseType}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-red-600 whitespace-nowrap">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.paymentMethod || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {e.transactionId
                        ? <span className="font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg">{e.transactionId}</span>
                        : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.bankAccount?.bankName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.createdBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{e.notes || '—'}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(e)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition">✏️ Edit</button>
                          <button onClick={() => setDeleteId(e._id)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑 Del</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={readOnly ? 8 : 9} className="px-4 py-12 text-center text-gray-400">No expenses found</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-red-50 border-t-2 border-red-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-extrabold text-gray-700 uppercase">Total ({filtered.length})</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-red-700 whitespace-nowrap">{fmt(totalExpenses)}</td>
                    <td colSpan={readOnly ? 5 : 6} />
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
