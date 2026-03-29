'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Period = 'all' | 'month' | 'custom';

const fmt   = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtFull = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const pct   = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) : '0.0';

const PIE_COLORS = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899'];

/* ── tiny Tooltip ── */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 border border-white/10 rounded-xl px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-white text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

/* ── Stat Card ── */
function StatCard({ icon, label, value, sub, trend, color, href }: any) {
  const colors: Record<string,string> = {
    green:  'from-green-500/10 to-emerald-500/5 border-green-200/60',
    red:    'from-red-500/10 to-rose-500/5 border-red-200/60',
    blue:   'from-blue-500/10 to-cyan-500/5 border-blue-200/60',
    emerald:'from-emerald-500/10 to-teal-500/5 border-emerald-200/60',
    orange: 'from-orange-500/10 to-amber-500/5 border-orange-200/60',
    purple: 'from-purple-500/10 to-violet-500/5 border-purple-200/60',
  };
  const iconBg: Record<string,string> = {
    green:'bg-green-100 text-green-700', red:'bg-red-100 text-red-700',
    blue:'bg-blue-100 text-blue-700',   emerald:'bg-emerald-100 text-emerald-700',
    orange:'bg-orange-100 text-orange-700', purple:'bg-purple-100 text-purple-700',
  };
  const valColor: Record<string,string> = {
    green:'text-green-800', red:'text-red-700', blue:'text-blue-800',
    emerald:'text-emerald-800', orange:'text-orange-700', purple:'text-purple-700',
  };
  const card = (
    <div className={`group relative bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg[color]} rounded-xl flex items-center justify-center text-lg font-bold`}>{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className={`text-xl sm:text-2xl font-extrabold tracking-tight ${valColor[color]} truncate`}>{value}</p>
      <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {href && <span className="absolute right-4 bottom-4 text-gray-300 text-sm group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all">→</span>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

/* ── Quick Action Card ── */
function QuickAction({ icon, label, desc, href, color }: any) {
  const hover: Record<string,string> = {
    orange:'hover:border-orange-300 hover:bg-orange-50/50',
    blue:'hover:border-blue-300 hover:bg-blue-50/50',
    emerald:'hover:border-emerald-300 hover:bg-emerald-50/50',
    purple:'hover:border-purple-300 hover:bg-purple-50/50',
    red:'hover:border-red-300 hover:bg-red-50/50',
    green:'hover:border-green-300 hover:bg-green-50/50',
  };
  return (
    <Link href={href} className={`group flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3.5 transition-all duration-200 ${hover[color]} hover:shadow-sm hover:-translate-y-0.5`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight">{label}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      <span className="text-gray-200 text-sm group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all shrink-0">→</span>
    </Link>
  );
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { data: session } = useSession();
  const adminName = (session?.user as any)?.name || 'Admin';

  const [purchases,    setPurchases]    = useState<any[]>([]);
  const [expenses,     setExpenses]     = useState<any[]>([]);
  const [payments,     setPayments]     = useState<any[]>([]);
  const [outstanding,  setOutstanding]  = useState({ traders: 0, companies: 0, traderCount: 0, companyCount: 0 });
  const [userCounts,   setUserCounts]   = useState({ salespersons: 0, traders: 0, companies: 0 });
  const [loading,      setLoading]      = useState(true);
  const [period,       setPeriod]       = useState<Period>('month');
  const [selMonth,     setSelMonth]     = useState(new Date().getMonth());
  const [selYear,      setSelYear]      = useState(new Date().getFullYear());
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');

  const load = () => {
    Promise.all([
      fetch('/api/purchases').then(r => r.ok ? r.json() : { purchases: [] }),
      fetch('/api/expenses').then(r => r.ok ? r.json() : { expenses: [] }),
      fetch('/api/payments').then(r => r.ok ? r.json() : { payments: [] }),
      fetch('/api/outstanding').then(r => r.ok ? r.json() : { traders: [], companies: [] }),
      fetch('/api/users?role=salesperson').then(r => r.ok ? r.json() : { users: [] }),
      fetch('/api/traders').then(r => r.ok ? r.json() : { traders: [] }),
      fetch('/api/companies').then(r => r.ok ? r.json() : { companies: [] }),
    ]).then(([p, e, pm, out, users, traders, companies]) => {
      setPurchases(p.purchases || []);
      setExpenses(e.expenses || []);
      setPayments(pm.payments || []);
      const trs = out.traders || [];
      const cos = out.companies || [];
      setOutstanding({
        traders:      trs.reduce((s: number, t: any) => s + (t.outstandingBalance || 0), 0),
        companies:    cos.reduce((s: number, c: any) => s + (c.outstandingBalance || 0), 0),
        traderCount:  trs.filter((t: any) => (t.outstandingBalance || 0) > 0).length,
        companyCount: cos.filter((c: any) => (c.outstandingBalance || 0) > 0).length,
      });
      setUserCounts({
        salespersons: (users.users || []).length,
        traders:      (traders.traders || []).filter((t: any) => t.isActive).length,
        companies:    (companies.companies || []).filter((c: any) => c.isActive).length,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(()=>{ load(); const _id = setInterval(load, 30000); return () => clearInterval(_id); },[]);

  /* ── filter purchases + expenses by period ── */
  const filtered = useMemo(() => {
    const now = new Date();
    const inPeriod = (d: Date) => {
      if (period === 'month') return d.getMonth() === selMonth && d.getFullYear() === selYear;
      if (period === 'custom') {
        const s = customStart ? new Date(customStart) : new Date(0);
        const e = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
        return d >= s && d <= e;
      }
      return true;
    };
    const p = purchases.filter(r => inPeriod(new Date(r.date)));
    const e = expenses.filter(r  => inPeriod(new Date(r.date)));
    const totalSales     = p.reduce((s, r) => s + (r.saleTotalAmount     || 0), 0);
    const totalPurchases = p.reduce((s, r) => s + (r.purchaseTotalAmount || 0), 0);
    const grossProfit    = totalSales - totalPurchases;
    const totalExpenses  = e.reduce((s, r) => s + (r.amount || 0), 0);
    const netProfit      = grossProfit - totalExpenses;
    const totalBirds     = p.reduce((s, r) => s + (r.numberOfBirds || 0), 0);
    const totalWeight    = p.reduce((s, r) => s + (r.totalWeight   || 0), 0);
    return { p, e, totalSales, totalPurchases, grossProfit, totalExpenses, netProfit, totalBirds, totalWeight };
  }, [purchases, expenses, period, selMonth, selYear, customStart, customEnd]);

  /* ── pending payments ── */
  const pendingPayments = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);
  const pendingTotal    = pendingPayments.reduce((s, p) => s + (p.amount || 0), 0);

  /* ── area chart: last 15 days rolling ── */
  const areaData = useMemo(() => {
    const map: Record<string, { date: string; sales: number; purchases: number; profit: number }> = {};
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      map[key] = { date: key, sales: 0, purchases: 0, profit: 0 };
    }
    purchases.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
      if (map[key]) {
        map[key].sales     += r.saleTotalAmount     || 0;
        map[key].purchases += r.purchaseTotalAmount || 0;
        map[key].profit    += r.grossProfit         || 0;
      }
    });
    return Object.values(map);
  }, [purchases]);

  /* ── bar chart: top 6 traders by sale amt ── */
  const traderBarData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.p.forEach((r: any) => {
      const name = r.trader?.name || 'Unknown';
      map[name] = (map[name] || 0) + (r.saleTotalAmount || 0);
    });
    return Object.entries(map)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.length > 10 ? name.slice(0,10)+'…' : name, value }));
  }, [filtered.p]);

  /* ── pie: expense breakdown ── */
  const expPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.e.forEach((e: any) => { map[e.expenseType] = (map[e.expenseType] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered.e]);

  /* ── recent transactions (last 5) ── */
  const recentTxns = useMemo(() => [...purchases].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5), [purchases]);

  const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const periodLabels: Record<Period,string> = { all:'All Time', month:`${MONTHS[selMonth]} ${selYear}`, custom:'Custom' };

  const now    = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  /* ════════ RENDER ════════ */
  return (
    <div className="min-h-screen bg-[#f8f7f5]">

      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
        {/* background texture dots */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize:'24px 24px'}}/>
        {/* orange accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"/>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🐔</span>
                <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">Nanda Poultry Farm</span>
              </div>
              <h1 className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight">
                Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {adminName.split(' ')[0]} 👋
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">{dateStr}</p>
            </div>

            {/* Period toggle */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-2xl p-1 border border-white/10">
                {(['all','month','custom'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${period === p ? 'bg-orange-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}>
                    {p === 'all' ? 'All Time' : p === 'month' ? 'Month' : 'Custom'}
                  </button>
                ))}
              </div>
              {period === 'month' && (
                <div className="flex items-center gap-2">
                  <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]">
                    {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
                  </select>
                  <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]">
                    {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {period === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]" />
                  <span className="text-slate-400 text-xs">to</span>
                  <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                    className="border border-white/20 bg-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 [color-scheme:dark]" />
                </div>
              )}
            </div>
          </div>

          {/* ── Quick summary strip ── */}
          {!loading && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:'Net Sales',   value: fmt(filtered.totalSales),    c:'text-green-400' },
                { label:'Gross Profit',value: fmt(filtered.grossProfit),   c: filtered.grossProfit>=0 ? 'text-emerald-400' : 'text-red-400' },
                { label:'Net Profit',  value: fmt(filtered.netProfit),     c: filtered.netProfit>=0 ? 'text-teal-400' : 'text-red-400' },
                { label:'Transactions',value: String(filtered.p.length),   c:'text-orange-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
                  <p className={`text-lg sm:text-xl font-extrabold ${s.c}`}>{s.value}</p>
                  <p className="text-slate-400 text-xs mt-0.5 font-medium">{s.label} · {periodLabels[period as keyof typeof periodLabels]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-10 h-10 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin"/>
            <p className="text-gray-400 text-sm">Loading dashboard…</p>
          </div>
        ) : (
          <>
            {/* ═══ ROW 1: Primary KPI cards ═══ */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon="💰" label="Total Sales"     value={fmtFull(filtered.totalSales)}     color="green"   sub={`${filtered.p.length} transactions`} />
              <StatCard icon="🛒" label="Total Purchases" value={fmtFull(filtered.totalPurchases)} color="red"     sub={`${(filtered.totalWeight||0).toFixed(0)} kg · ${(filtered.totalBirds||0).toLocaleString()} birds`}/>
              <StatCard icon="📊" label="Gross Profit"    value={fmtFull(filtered.grossProfit)}    color={filtered.grossProfit>=0?'emerald':'red'} sub="Sales − Purchases"/>
              <StatCard icon="🏆" label="Net Profit"      value={fmtFull(filtered.netProfit)}      color={filtered.netProfit>=0?'blue':'red'}    sub={`After ₹${(filtered.totalExpenses/1000).toFixed(0)}K expenses`}/>
            </div>

            {/* ═══ ROW 2: Secondary stats ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon:'💸', label:'Expenses',         value: fmt(filtered.totalExpenses), bg:'bg-purple-50   border-purple-100',   tc:'text-purple-800' },
                { icon:'⚠️', label:'Trader Dues',      value: fmt(outstanding.traders),    bg:'bg-red-50      border-red-100',      tc:'text-red-800',   sub:`${outstanding.traderCount} traders` },
                { icon:'🏭', label:'Company Dues',     value: fmt(outstanding.companies),  bg:'bg-blue-50     border-blue-100',     tc:'text-blue-800',  sub:`${outstanding.companyCount} companies` },
                { icon:'⏳', label:'Pending Payments', value: fmt(pendingTotal),            bg:'bg-yellow-50   border-yellow-100',   tc:'text-yellow-800',sub:`${pendingPayments.length} requests` },
                { icon:'👥', label:'Salespersons',     value: String(userCounts.salespersons), bg:'bg-indigo-50 border-indigo-100', tc:'text-indigo-800' },
                { icon:'🤝', label:'Active Traders',   value: String(userCounts.traders),  bg:'bg-teal-50     border-teal-100',     tc:'text-teal-800' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border rounded-xl p-3.5`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{s.icon}</span>
                    {'sub' in s && s.sub && <span className="text-xs text-gray-400 font-medium">{s.sub}</span>}
                  </div>
                  <p className={`text-base font-extrabold ${s.tc} truncate`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* ═══ ROW 3: Charts ═══ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Area chart: 15-day trend */}
              <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Revenue Trend</h3>
                    <p className="text-xs text-gray-400">Last 15 days — Sales, Purchases & Profit</p>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"/>&nbsp;Sales</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/>&nbsp;Purchase</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/>&nbsp;Profit</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                      <defs>
                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gPurch" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} interval={2}/>
                      <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v)=>`₹${(v/1000).toFixed(0)}K`}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Area type="monotone" dataKey="sales"     stroke="#f97316" strokeWidth={2} fill="url(#gSales)"  name="Sales"/>
                      <Area type="monotone" dataKey="purchases" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gPurch)" name="Purchase"/>
                      <Area type="monotone" dataKey="profit"    stroke="#10b981" strokeWidth={2} fill="url(#gProfit)" name="Profit"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie: expense breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="mb-3">
                  <h3 className="font-bold text-gray-900 text-sm">Expense Breakdown</h3>
                  <p className="text-xs text-gray-400">{periodLabels[period as keyof typeof periodLabels]}</p>
                </div>
                {expPieData.length > 0 ? (
                  <>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expPieData} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value" strokeWidth={2} stroke="#fff">
                            {expPieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {expPieData.slice(0,5).map((d,i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                            <span className="text-gray-600 font-medium truncate max-w-[100px]">{d.name}</span>
                          </div>
                          <span className="text-gray-900 font-bold">{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-gray-300">
                    <span className="text-4xl mb-2">💸</span>
                    <p className="text-xs">No expense data</p>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ ROW 4: Bar + Recent Txns ═══ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Bar: top traders */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Top Traders by Sales</h3>
                    <p className="text-xs text-gray-400">{periodLabels[period as keyof typeof periodLabels]}</p>
                  </div>
                  <Link href="/dashboard/admin/traders" className="text-xs text-orange-500 hover:text-orange-700 font-semibold">View all →</Link>
                </div>
                {traderBarData.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={traderBarData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false}/>
                        <XAxis dataKey="name" tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v)=>`₹${(v/1000).toFixed(0)}K`}/>
                        <Tooltip content={<ChartTip/>} cursor={{ fill:'#f8fafc' }}/>
                        <Bar dataKey="value" name="Sales" radius={[5,5,0,0]}>
                          {traderBarData.map((_,i) => <Cell key={i} fill={i===0?'#f97316':i===1?'#fb923c':'#fed7aa'}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-gray-300">
                    <span className="text-4xl mb-2">📊</span>
                    <p className="text-xs">No transaction data</p>
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Recent Transactions</h3>
                    <p className="text-xs text-gray-400">Latest 5 entries</p>
                  </div>
                  <Link href="/dashboard/admin/transactions" className="text-xs text-orange-500 hover:text-orange-700 font-semibold">View all →</Link>
                </div>
                {recentTxns.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {recentTxns.map((t: any) => (
                      <div key={t._id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/60 transition">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-sm shrink-0">🔄</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-bold text-gray-900 truncate">{t.trader?.name}</p>
                            <span className="text-gray-300">·</span>
                            <p className="text-xs text-gray-400 truncate">{t.company?.name}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(t.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · {t.numberOfBirds?.toLocaleString()} birds · {t.totalWeight?.toFixed(0)}kg</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-green-700">{fmt(t.saleTotalAmount)}</p>
                          <p className={`text-xs font-semibold ${(t.grossProfit||0)>=0?'text-emerald-600':'text-red-500'}`}>{fmt(t.grossProfit||0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                    <span className="text-4xl mb-2">📋</span>
                    <p className="text-xs">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ ROW 5: Pending payments + Quick actions ═══ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Pending payments */}
              <div className="xl:col-span-1 bg-white rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-yellow-800 text-sm">⏳ Pending Payments</h3>
                    <p className="text-xs text-yellow-600">{pendingPayments.length} requests · {fmt(pendingTotal)}</p>
                  </div>
                  <Link href="/dashboard/admin/payments" className="text-xs text-orange-500 hover:text-orange-700 font-semibold">View all →</Link>
                </div>
                {pendingPayments.length > 0 ? (
                  <div className="divide-y divide-yellow-50/60">
                    {pendingPayments.slice(0,4).map(p => (
                      <div key={p._id} className="px-5 py-3 flex items-center justify-between hover:bg-yellow-50/40 transition">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{p.company?.name||p.trader?.name}</p>
                          <p className="text-xs text-gray-400">{p.createdBy?.name} · {new Date(p.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-yellow-700">{fmt(p.amount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.paymentFor==='company'?'bg-red-100 text-red-600':'bg-green-100 text-green-700'}`}>{p.paymentFor}</span>
                        </div>
                      </div>
                    ))}
                    {pendingPayments.length > 4 && (
                      <div className="px-5 py-2.5 text-center">
                        <Link href="/dashboard/admin/payments" className="text-xs text-yellow-600 font-bold hover:text-yellow-800">+{pendingPayments.length-4} more →</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                    <span className="text-3xl mb-1">✅</span>
                    <p className="text-xs">All payments settled</p>
                  </div>
                )}
              </div>

              {/* Quick actions grid */}
              <div className="xl:col-span-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <QuickAction icon="🔄" label="Transactions"    desc="Add & view all purchases"      href="/dashboard/admin/transactions"   color="orange"/>
                  <QuickAction icon="💸" label="Expenses"        desc="Manage business expenses"       href="/dashboard/admin/expenses"       color="purple"/>
                  <QuickAction icon="📋" label="Outstanding"     desc="Trader & company dues"          href="/dashboard/admin/outstanding"    color="red"/>
                  <QuickAction icon="📒" label="Ledger Report"   desc="Trader & company ledger"        href="/dashboard/admin/ledger"         color="emerald"/>
                  <QuickAction icon="👥" label="Users"           desc="Manage salespersons"            href="/dashboard/admin/users"          color="blue"/>
                  <QuickAction icon="🤝" label="Traders"         desc="Add & manage traders"           href="/dashboard/admin/traders"        color="green"/>
                  <QuickAction icon="🏭" label="Companies"       desc="Manage supplier companies"      href="/dashboard/admin/companies"      color="blue"/>
                  <QuickAction icon="💳" label="View Payments"   desc="All payment requests"           href="/dashboard/admin/payments"       color="orange"/>
                </div>
              </div>
            </div>

            {/* ═══ Footer info ═══ */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100 text-xs text-gray-400">
              <span>🐔 Nanda Poultry Farm — Admin Dashboard</span>
              <span>{new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
