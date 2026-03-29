'use client';
import { useEffect, useState } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type DateFilter = 'all' | 'month' | 'custom';

export default function AccountantDashboard() {
  const { data: session } = useSession();
  const [stats, setStats]         = useState({ pending: 0, verified: 0, pendingEdits: 0, totalExpenses: 0 });
  const [outstanding, setOutstanding] = useState({ traders: 0, companies: 0 });
  const [purchases, setPurchases]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dateFilter,  setDateFilter]  = useState<DateFilter>('month');
  const [selMonth,    setSelMonth]    = useState(new Date().getMonth());   // 0-indexed
  const [selYear,     setSelYear]     = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  const load = () => {
    Promise.all([
      fetch('/api/payments').then(r => r.ok ? r.json() : { payments: [] }),
      fetch('/api/expenses').then(r => r.ok ? r.json() : { expenses: [] }),
      fetch('/api/edit-requests?status=pending').then(r => r.ok ? r.json() : { requests: [] }),
      fetch('/api/outstanding').then(r => r.ok ? r.json() : { traders: [], companies: [] }),
      fetch('/api/purchases').then(r => r.ok ? r.json() : { purchases: [] }),
    ]).then(([pay, exp, edits, out, pur]) => {
      const payments = pay.payments || [];
      setStats({
        pending:      payments.filter((p: any) => p.status === 'pending').length,
        verified:     payments.filter((p: any) => p.status === 'verified').length,
        pendingEdits: edits.requests?.length || 0,
        totalExpenses:(exp.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0),
      });
      // Use only 'outstanding' status records (same formula as Outstanding page summary cards)
      const outTraders   = (out.traders   || []).filter((t: any) => t.status === 'outstanding');
      const outCompanies = (out.companies || []).filter((c: any) => c.status === 'outstanding');
      setOutstanding({
        traders:   outTraders.reduce((s: number, t: any) => s + (t.outstandingNet || 0), 0),
        companies: outCompanies.reduce((s: number, c: any) => s + (c.outstandingNet || 0), 0),
      });
      setPurchases(pur.purchases || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  const filtered = purchases.filter(r => {
    const d = new Date(r.date); const now = new Date();
    if (dateFilter === 'month') return d.getMonth() === selMonth && d.getFullYear() === selYear;
    if (dateFilter === 'custom') {
      const s = customStart ? new Date(customStart) : new Date(0);
      const e = customEnd   ? new Date(customEnd + 'T23:59:59') : new Date();
      return d >= s && d <= e;
    }
    return true;
  });

  const sales        = filtered.reduce((s, r) => s + (r.saleTotalAmount     || 0), 0);
  const purchases_   = filtered.reduce((s, r) => s + (r.purchaseTotalAmount || 0), 0);
  const grossProfit  = filtered.reduce((s, r) => s + (r.grossProfit         || 0), 0);
  const netProfit    = grossProfit - stats.totalExpenses;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const name = session?.user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-gray-900 px-5 sm:px-8 pt-8 pb-20 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute top-10 right-28 w-20 h-20 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 left-1/4 w-48 h-48 bg-orange-500/10 rounded-full" />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">{greeting} 👋</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{name}</h1>
              <p className="text-slate-400 text-sm mt-0.5">Accountant · Nanda Poultry Farm</p>
            </div>
            {/* Date filter in header */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-0.5 bg-white/10 backdrop-blur-sm rounded-xl p-1">
                {(['all','month','custom'] as DateFilter[]).map(f => (
                  <button key={f} onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFilter === f ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}>
                    {f === 'all' ? 'All Time' : f === 'month' ? 'Month' : 'Custom'}
                  </button>
                ))}
              </div>
              {dateFilter === 'month' && (
                <div className="flex items-center gap-2">
                  <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} className="border border-white/30 bg-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none [color-scheme:dark]">
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={m} value={i}>{m}</option>)}
                  </select>
                  <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} className="border border-white/30 bg-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none [color-scheme:dark]">
                    {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]" />
                  <span className="text-slate-400 text-xs">to</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-8 space-y-4">

        {/* Pending edit alert */}
        {stats.pendingEdits > 0 && (
          <Link href="/dashboard/accountant/edit-requests"
            className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 shadow-sm hover:bg-amber-100 transition">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-lg">✏️</div>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">{stats.pendingEdits} edit request{stats.pendingEdits > 1 ? 's' : ''} awaiting review</p>
              <p className="text-amber-600 text-xs">Tap to review & approve</p>
            </div>
            <span className="text-amber-400 text-lg">→</span>
          </Link>
        )}

        {/* ── ROW 1: Financial KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" /><div className="h-6 bg-gray-100 rounded w-full" />
            </div>
          )) : <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-green-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Sales</p>
              <p className="text-lg font-extrabold text-green-600 leading-tight truncate">{fmt(sales)}</p>
              <p className="text-xs text-gray-400 mt-1">{filtered.length} transactions</p>
              <span className="absolute top-2.5 right-2.5 text-lg">💰</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-red-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Purchases</p>
              <p className="text-lg font-extrabold text-red-600 leading-tight truncate">{fmt(purchases_)}</p>
              <p className="text-xs text-gray-400 mt-1">Raw cost</p>
              <span className="absolute top-2.5 right-2.5 text-lg">🛒</span>
            </div>

            <div className={`rounded-2xl border shadow-sm p-4 relative overflow-hidden hover:shadow-md transition ${grossProfit >= 0 ? 'bg-white border-gray-100' : 'bg-red-50 border-red-200'}`}>
              <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-3xl ${grossProfit >= 0 ? 'bg-emerald-50' : 'bg-red-100'}`} />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Gross Profit</p>
              <p className={`text-lg font-extrabold leading-tight truncate ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(grossProfit)}</p>
              <p className="text-xs text-gray-400 mt-1">Sale − Purchase</p>
              <span className="absolute top-2.5 right-2.5 text-lg">📈</span>
            </div>

            <div className={`rounded-2xl border shadow-sm p-4 relative overflow-hidden hover:shadow-md transition ${netProfit >= 0 ? 'bg-white border-gray-100' : 'bg-red-50 border-red-200'}`}>
              <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-3xl ${netProfit >= 0 ? 'bg-purple-50' : 'bg-red-100'}`} />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Net Profit</p>
              <p className={`text-lg font-extrabold leading-tight truncate ${netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>{fmt(netProfit)}</p>
              <p className="text-xs text-gray-400 mt-1">After expenses</p>
              <span className="absolute top-2.5 right-2.5 text-lg">🏆</span>
            </div>
          </>}
        </div>

        {/* ── ROW 2: Operations KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Pending Payments', v: stats.pending,       c: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', i: '⏳', href: '/dashboard/accountant/payments' },
            { l: 'Verified Payments',v: stats.verified,      c: 'text-green-700',  bg: 'bg-green-50  border-green-200',  i: '✅', href: '/dashboard/accountant/payments' },
            { l: 'Pending Edits',    v: stats.pendingEdits,  c: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', i: '✏️', href: '/dashboard/accountant/edit-requests' },
            { l: 'Total Expenses',   v: fmt(stats.totalExpenses), c: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', i: '💸', href: '/dashboard/accountant/expenses' },
          ].map(s => (
            <Link key={s.l} href={s.href} className={`${s.bg} border rounded-2xl p-4 hover:opacity-80 transition group`}>
              <div className="text-xl mb-1">{s.i}</div>
              <p className={`text-xl font-extrabold ${s.c} truncate`}>{s.v}</p>
              <p className="text-xs text-gray-500 mt-0.5 group-hover:underline">{s.l}</p>
            </Link>
          ))}
        </div>

        {/* ── ROW 3: Outstanding ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/dashboard/accountant/outstanding"
            className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
            <div className="absolute top-2 right-2 w-12 h-12 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-red-100 uppercase tracking-widest">🤝 Trader Outstanding</span>
                <span className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all text-lg">→</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">{fmt(outstanding.traders)}</p>
              <p className="text-red-200 text-xs mt-2">Tap to view details</p>
            </div>
          </Link>

          <Link href="/dashboard/accountant/outstanding"
            className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
            <div className="absolute top-2 right-2 w-12 h-12 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">🏭 Company Outstanding</span>
                <span className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all text-lg">→</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">{fmt(outstanding.companies)}</p>
              <p className="text-blue-200 text-xs mt-2">Tap to view details</p>
            </div>
          </Link>
        </div>

        {/* ── ROW 4: Quick Actions ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/dashboard/accountant/payments',      l: 'Verify Payments', d: 'Approve or reject requests',   i: '✅', accent: 'border-green-200 hover:border-green-400',  iconBg: 'bg-green-50',  badge: stats.pending > 0 ? stats.pending : null },
              { href: '/dashboard/accountant/transactions',  l: 'Transactions',    d: 'View all purchase & sale data', i: '🔄', accent: 'border-orange-200 hover:border-orange-400', iconBg: 'bg-orange-50', badge: null },
              { href: '/dashboard/accountant/expenses',      l: 'Expenses',        d: 'Track business expenses',       i: '💸', accent: 'border-purple-200 hover:border-purple-400', iconBg: 'bg-purple-50', badge: null },
              { href: '/dashboard/accountant/edit-requests', l: 'Edit Requests',   d: 'Review change requests',        i: '✏️', accent: 'border-amber-200  hover:border-amber-400',  iconBg: 'bg-amber-50',  badge: stats.pendingEdits > 0 ? stats.pendingEdits : null },
              { href: '/dashboard/accountant/outstanding',   l: 'Outstanding',     d: 'View dues report',              i: '📋', accent: 'border-blue-200  hover:border-blue-400',   iconBg: 'bg-blue-50',   badge: null },
              { href: '/dashboard/accountant/bank-statements',l:'Bank Statements', d: 'View bank records',             i: '🏦', accent: 'border-gray-200  hover:border-gray-400',   iconBg: 'bg-gray-50',   badge: null },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className={`group bg-white rounded-2xl border-2 shadow-sm ${a.accent} p-4 hover:shadow-md transition-all flex items-center gap-4`}>
                <div className={`relative w-11 h-11 ${a.iconBg} rounded-xl flex items-center justify-center text-xl shrink-0`}>
                  {a.i}
                  {a.badge && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{a.badge}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition text-sm">{a.l}</h3>
                  <p className="text-xs text-gray-400 truncate">{a.d}</p>
                </div>
                <span className="text-gray-300 group-hover:text-orange-400 group-hover:translate-x-1 transition-all text-lg">→</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
