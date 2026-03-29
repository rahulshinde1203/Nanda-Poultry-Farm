'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const fmt    = (n: number) => `₹${(n||0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const SOURCE_LABEL: Record<string,{label:string;color:string}> = {
  manual:           { label: 'Manual',          color: 'bg-gray-100 text-gray-600' },
  payment_trader:   { label: 'Trader Payment',  color: 'bg-green-100 text-green-700' },
  payment_company:  { label: 'Company Payment', color: 'bg-red-100 text-red-700' },
  expense:          { label: 'Expense',         color: 'bg-purple-100 text-purple-700' },

};

export default function AdminBankStatementsPage() {
  const [statements,   setStatements]   = useState<any[]>([]);
  const [accounts,     setAccounts]     = useState<any[]>([]);
  const [selAccount,   setSelAccount]   = useState('');
  const [selMonth,     setSelMonth]     = useState(new Date().getMonth() + 1);
  const [selYear,      setSelYear]      = useState(new Date().getFullYear());

  type PeriodType = 'all'|'day'|'month'|'range';
  const [period,     setPeriod]     = useState<PeriodType>('month');
  const [selDate,    setSelDate]    = useState(new Date().toISOString().split('T')[0]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd,   setRangeEnd]   = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const PERIOD_LABELS: Record<PeriodType,string> = { all:'All Time', day:'Select Date', month:'Select Month', range:'Date Range' };

  const buildParams = () => {
    const p = new URLSearchParams({ period });
    if (selAccount) p.set('bankAccount', selAccount);
    if (period==='day')   p.set('date', selDate);
    if (period==='month') { p.set('month', String(selMonth)); p.set('year', String(selYear)); }
    if (period==='range') { p.set('start', rangeStart); p.set('end', rangeEnd); }
    return p.toString();
  };

  const load = () => {
    if (period==='range' && (!rangeStart||!rangeEnd)) return;
    fetch(`/api/bank-statements?${buildParams()}`).then(r=>r.json()).then(d=>setStatements(d.statements||[]));
    fetch('/api/bank-accounts').then(r=>r.json()).then(d=>{ const accs = d.accounts||[]; setAccounts(accs); if(accs.length && !selAccount) setSelAccount(accs[0]._id); });
  };
  useEffect(()=>{ load(); },[period, selDate, selMonth, selYear, rangeStart, rangeEnd, selAccount]);

  // Statements from API are asc (oldest first) so balance column is correct.
  // Reverse for display so newest appears at top.
  const filtered = [...statements].reverse();
  const totalCredit = statements.reduce((s,x)=>s+(x.creditAmount||0),0);
  const totalDebit  = statements.reduce((s,x)=>s+(x.debitAmount||0),0);
  // Closing balance = last item in asc order (= most recent entry)
  const lastBalance = statements.length>0 ? statements[statements.length-1]?.balance||0 : 0;

  const exportExcel = async () => {
    if (!filtered.length) return;
    const { utils, writeFile } = await import('xlsx');
    const rows = filtered.map((s,i) => ({
      '#': i+1, 'Date': new Date(s.date).toLocaleDateString('en-IN'),
      'Account': s.bankAccount?.bankName, 'Description': s.description,
      'Remark': s.remark||'', 'Transaction ID': s.transactionId||'',
      'Type': SOURCE_LABEL[s.sourceType]?.label||s.sourceType,
      'Credit (₹)': s.creditAmount||0, 'Debit (₹)': s.debitAmount||0, 'Balance (₹)': s.balance||0,
    }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Bank Statement');
    writeFile(wb, `bank-statement-${MONTHS[selMonth-1]}-${selYear}.xlsx`);
    toast.success('Excel downloaded!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-extrabold text-xl sm:text-2xl">Bank Statements</h1>
          <p className="text-slate-300 text-sm mt-0.5">{period==='month'?`${MONTHS[selMonth-1]} ${selYear}`:period==='day'?selDate:period==='range'&&rangeStart?`${rangeStart} – ${rangeEnd}`:'All Time'} · {filtered.length} entries · <span className="text-gray-400">Read-only</span></p>
        </div>
        <button onClick={exportExcel} disabled={!filtered.length}
          className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-40">📥 Excel</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Period</span>
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {(['all','day','month','range'] as PeriodType[]).map(p=>(
                <button key={p} onClick={()=>setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period===p?'bg-orange-500 text-white shadow-sm':'text-gray-500 hover:text-gray-800'}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {period==='day'&&(
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Date</span>
              <input type="date" value={selDate} max={todayStr} onChange={e=>setSelDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
            </div>
          )}
          {period==='month'&&(
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Month</span>
                <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Year</span>
                <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}
          {period==='range'&&(
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">From</span>
                <input type="date" value={rangeStart} max={todayStr} onChange={e=>setRangeStart(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">To</span>
                <input type="date" value={rangeEnd} max={todayStr} onChange={e=>setRangeEnd(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🏦 Bank Account</span>
            <select value={selAccount} onChange={e=>setSelAccount(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[200px]">
              {accounts.map(a=><option key={a._id} value={a._id}>{a.bankName} — ****{a.accountNumber?.slice(-4)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-gray-500 mb-1">Total Credit</p><p className="font-extrabold text-green-700">{fmt(totalCredit)}</p></div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-gray-500 mb-1">Total Debit</p><p className="font-extrabold text-red-600">{fmt(totalDebit)}</p></div>
        <div className={`border rounded-xl p-3 text-center ${lastBalance>=0?'bg-blue-50 border-blue-200':'bg-orange-50 border-orange-200'}`}><p className="text-xs text-gray-500 mb-1">Closing Balance</p><p className={`font-extrabold ${lastBalance>=0?'text-blue-700':'text-orange-600'}`}>{fmt(lastBalance)}</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['#','Date','Account','Description','Remark','Txn ID','Type','Credit','Debit','Balance'].map(h=>(
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s,i)=>(
                <tr key={s._id} className="hover:bg-gray-50/80 transition">
                  <td className="px-4 py-3 text-xs text-gray-400">{i+1}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(s.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.bankAccount?.bankName}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{s.description}</td>
                  <td className="px-4 py-3 text-xs text-blue-700 max-w-[160px]">{s.remark?<span>📌 {s.remark}</span>:<span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{s.transactionId||'—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_LABEL[s.sourceType]?.color||'bg-gray-100 text-gray-600'}`}>{SOURCE_LABEL[s.sourceType]?.label||s.sourceType}</span></td>
                  <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">{s.creditAmount>0?`+${fmt(s.creditAmount)}`:<span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 font-semibold text-red-600 whitespace-nowrap">{s.debitAmount>0?`−${fmt(s.debitAmount)}`:<span className="text-gray-300">—</span>}</td>
                  <td className={`px-4 py-3 font-bold whitespace-nowrap ${(s.balance||0)>=0?'text-blue-700':'text-orange-600'}`}>{fmt(s.balance||0)}</td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={10} className="py-14 text-center text-gray-400 bg-white"><div className="text-3xl mb-2">🏦</div><p>No entries found</p></td></tr>}
            </tbody>
            {filtered.length>0&&(<tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr>
              <td colSpan={7} className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase">Totals ({filtered.length})</td>
              <td className="px-4 py-3 font-extrabold text-green-700">+{fmt(totalCredit)}</td>
              <td className="px-4 py-3 font-extrabold text-red-600">−{fmt(totalDebit)}</td>
              <td className={`px-4 py-3 font-extrabold ${lastBalance>=0?'text-blue-700':'text-orange-600'}`}>{fmt(lastBalance)}</td>
            </tr></tfoot>)}
          </table>
        </div>
        <div className="sm:hidden divide-y divide-gray-50">
          {filtered.map(s=>(
            <div key={s._id} className="px-4 py-3.5">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.description}</p>
                  {s.remark&&<p className="text-xs text-blue-600 mt-0.5">📌 {s.remark}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(s.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · {s.bankAccount?.bankName}</p>
                </div>
                <div className="text-right shrink-0">
                  {s.creditAmount>0&&<p className="font-bold text-green-600">+{fmt(s.creditAmount)}</p>}
                  {s.debitAmount>0&&<p className="font-bold text-red-600">−{fmt(s.debitAmount)}</p>}
                  <p className="text-xs text-gray-500">Bal: {fmt(s.balance||0)}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SOURCE_LABEL[s.sourceType]?.color||'bg-gray-100 text-gray-600'}`}>{SOURCE_LABEL[s.sourceType]?.label||s.sourceType}</span>
            </div>
          ))}
          {filtered.length===0&&<div className="py-14 text-center text-gray-400"><div className="text-3xl mb-2">🏦</div><p>No entries found</p></div>}
        </div>
      </div>
      </div>
    </div>
  );
}
