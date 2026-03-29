'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type DateFilter = 'all' | 'month' | 'custom';

export default function SalespersonDashboard() {
  const { data: session } = useSession();

  const [purchases,     setPurchases]     = useState<any[]>([]);
  const [pendingEdits,  setPendingEdits]  = useState(0);
  const [pendingPay,    setPendingPay]    = useState(0);
  const [traderOut,     setTraderOut]     = useState(0);
  const [companyOut,    setCompanyOut]    = useState(0);
  const [loading,       setLoading]       = useState(true);

  const [dateFilter,   setDateFilter]   = useState<DateFilter>('month');
  const [selMonth,     setSelMonth]     = useState(new Date().getMonth());
  const [selYear,      setSelYear]      = useState(new Date().getFullYear());
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');

  const load = () => {
    Promise.all([
      fetch('/api/purchases').then(r => r.ok ? r.json() : { purchases: [] }),
      fetch('/api/edit-requests?status=pending').then(r => r.ok ? r.json() : { requests: [] }),
      fetch('/api/outstanding').then(r => r.ok ? r.json() : { traders: [], companies: [], purchases: [] }),
      fetch('/api/payments?status=pending').then(r => r.ok ? r.json() : { payments: [] }),
    ]).then(([pur, edits, out, pay]) => {
      setPurchases(pur.purchases || []);
      setPendingEdits(edits.requests?.length || 0);
      setPendingPay(pay.payments?.length || 0);
      // Use outstanding status=outstanding records sum (same logic as Outstanding page cards)
      const outTraders  = (out.traders  || []).filter((t: any) => t.status === 'outstanding');
      const outCompanies = (out.companies || []).filter((c: any) => c.status === 'outstanding');
      setTraderOut(outTraders.reduce((s: number, t: any) => s + t.outstandingNet, 0));
      setCompanyOut(outCompanies.reduce((s: number, c: any) => s + c.outstandingNet, 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  const filtered = purchases.filter(r => {
    const d = new Date(r.date); const now = new Date();
    if (dateFilter === 'month') return d.getMonth() === selMonth && d.getFullYear() === selYear;
    if (dateFilter === 'custom') {
      const s = customStart ? new Date(customStart)             : new Date(0);
      const e = customEnd   ? new Date(customEnd + 'T23:59:59') : new Date();
      return d >= s && d <= e;
    }
    return true;
  });

  const totalSales    = filtered.reduce((s, r) => s + (r.saleTotalAmount     || 0), 0);
  const totalPurchase = filtered.reduce((s, r) => s + (r.purchaseTotalAmount || 0), 0);
  const totalBirds    = filtered.reduce((s, r) => s + (r.numberOfBirds       || 0), 0);
  const todayCount    = purchases.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length;

  const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const name = session?.user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO HEADER — matches admin/accountant style ── */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 px-5 sm:px-8 pt-8 pb-20 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-56 h-56 bg-white/10 rounded-full" />
        <div className="absolute top-10 right-28 w-20 h-20 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 left-1/4 w-48 h-48 bg-orange-400/20 rounded-full" />

        <div className="relative max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-orange-200 text-sm font-medium mb-1">{greeting} 👋</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{name}</h1>
              <p className="text-orange-100 text-sm mt-0.5">Salesperson · Nanda Poultry Farm</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                <span className="text-white text-xs font-semibold">{todayCount} transaction{todayCount !== 1 ? 's' : ''} today</span>
              </div>
            </div>

            {/* Date filter in header */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex gap-0.5 bg-white/20 backdrop-blur-sm rounded-xl p-1">
                {(['all','month','custom'] as DateFilter[]).map(f => (
                  <button key={f} onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      dateFilter === f ? 'bg-white text-orange-600 shadow-sm font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}>
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
                    className="border border-white/30 bg-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]" />
                  <span className="text-white/60 text-xs">to</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="border border-white/30 bg-white/20 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-8 space-y-4">

        {/* Pending edit alert */}
        {pendingEdits > 0 && (
          <Link href="/dashboard/salesperson/transactions"
            className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 shadow-sm hover:bg-amber-100 transition">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-lg">⏳</div>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">{pendingEdits} edit request{pendingEdits > 1 ? 's' : ''} pending</p>
              <p className="text-amber-600 text-xs">Waiting for accountant review</p>
            </div>
            <span className="text-amber-400 text-lg">→</span>
          </Link>
        )}

        {/* ── ROW 1: KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" /><div className="h-6 bg-gray-100 rounded w-full" />
            </div>
          )) : <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-orange-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Transactions</p>
              <p className="text-2xl font-extrabold text-gray-900">{filtered.length}</p>
              <p className="text-xs text-gray-400 mt-1">Selected period</p>
              <span className="absolute top-2.5 right-2.5 text-lg">🔄</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-amber-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Birds Sold</p>
              <p className="text-2xl font-extrabold text-amber-600">{totalBirds.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-1">Total count</p>
              <span className="absolute top-2.5 right-2.5 text-lg">🐔</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-green-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Sales</p>
              <p className="text-lg font-extrabold text-green-600 leading-tight truncate">{fmt(totalSales)}</p>
              <p className="text-xs text-gray-400 mt-1">Sale revenue</p>
              <span className="absolute top-2.5 right-2.5 text-lg">💰</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition">
              <div className="absolute top-0 right-0 w-14 h-14 bg-red-50 rounded-bl-3xl" />
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Purchases</p>
              <p className="text-lg font-extrabold text-red-600 leading-tight truncate">{fmt(totalPurchase)}</p>
              <p className="text-xs text-gray-400 mt-1">Raw cost</p>
              <span className="absolute top-2.5 right-2.5 text-lg">🛒</span>
            </div>
          </>}
        </div>

        {/* ── ROW 2: Ops KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          <Link href="/dashboard/salesperson/payments"
            className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 hover:opacity-80 transition group">
            <div className="text-xl mb-1">⏳</div>
            <p className="text-2xl font-extrabold text-yellow-700">{pendingPay}</p>
            <p className="text-xs text-gray-500 mt-0.5 group-hover:underline">Pending Payments</p>
          </Link>
          <Link href="/dashboard/salesperson/transactions"
            className="bg-orange-50 border border-orange-200 rounded-2xl p-4 hover:opacity-80 transition group">
            <div className="text-xl mb-1">✏️</div>
            <p className="text-2xl font-extrabold text-orange-700">{pendingEdits}</p>
            <p className="text-xs text-gray-500 mt-0.5 group-hover:underline">Pending Edit Requests</p>
          </Link>
        </div>

        {/* ── ROW 3: Outstanding — matches admin/accountant style ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/dashboard/salesperson/outstanding"
            className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
            <div className="absolute top-2 right-2 w-12 h-12 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-red-100 uppercase tracking-widest">🤝 Trader Outstanding</span>
                <span className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all text-lg">→</span>
              </div>
              {loading
                ? <div className="h-8 bg-white/20 rounded-xl w-3/4 animate-pulse" />
                : <p className="text-2xl sm:text-3xl font-extrabold text-white">{fmt(traderOut)}</p>}
              <p className="text-red-200 text-xs mt-2">Tap to view details & export</p>
            </div>
          </Link>

          <Link href="/dashboard/salesperson/outstanding"
            className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
            <div className="absolute top-2 right-2 w-12 h-12 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">🏭 Company Outstanding</span>
                <span className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all text-lg">→</span>
              </div>
              {loading
                ? <div className="h-8 bg-white/20 rounded-xl w-3/4 animate-pulse" />
                : <p className="text-2xl sm:text-3xl font-extrabold text-white">{fmt(companyOut)}</p>}
              <p className="text-blue-200 text-xs mt-2">Tap to view details & export</p>
            </div>
          </Link>
        </div>

        {/* ── ROW 4: Quick Actions ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/dashboard/salesperson/transactions',    l: 'Transactions',    d: 'Record purchase & sale',       i: '🔄', accent: 'border-orange-200 hover:border-orange-400', iconBg: 'bg-orange-50', badge: null },
              { href: '/dashboard/salesperson/payments',        l: 'Payments',        d: 'Submit payment requests',      i: '💳', accent: 'border-green-200  hover:border-green-400',  iconBg: 'bg-green-50',  badge: pendingPay > 0 ? pendingPay : null },
              { href: '/dashboard/salesperson/outstanding',     l: 'Outstanding',     d: 'View & export dues report',    i: '📊', accent: 'border-blue-200   hover:border-blue-400',   iconBg: 'bg-blue-50',   badge: null },
              { href: '/dashboard/salesperson/ledger',          l: 'Ledger Report',   d: 'Generate account ledger',      i: '📒', accent: 'border-gray-200   hover:border-gray-400',   iconBg: 'bg-gray-50',   badge: null },
              { href: '/dashboard/salesperson/transactions',    l: 'Edit Request',    d: 'Request a transaction edit',   i: '✏️', accent: 'border-amber-200  hover:border-amber-400',  iconBg: 'bg-amber-50',  badge: pendingEdits > 0 ? pendingEdits : null },
            ].map(a => (
              <Link key={a.href + a.l} href={a.href}
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
