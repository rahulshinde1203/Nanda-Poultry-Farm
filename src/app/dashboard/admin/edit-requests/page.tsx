'use client';
import { useEffect, useState } from 'react';

const LABELS: Record<string,string> = { date:'Date',company:'Company',trader:'Trader',numberOfBirds:'No. of Birds',totalWeight:'Total Weight (Kg)',purchaseRatePerKg:'Purchase Rate/Kg',saleRatePerKg:'Sale Rate/Kg',vehicleNumber:'Vehicle Number',notes:'Notes' };
const sc: Record<string,string> = { pending:'bg-yellow-100 text-yellow-700 border border-yellow-200',approved:'bg-green-100 text-green-700 border border-green-200',rejected:'bg-red-100 text-red-700 border border-red-200' };
const fmtDate = (d:string) => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

export default function AdminEditHistoryPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter,   setFilter]   = useState('all');
  const [expanded, setExpanded] = useState<string|null>(null);

  useEffect(()=>{
    const url = filter==='all'?'/api/edit-requests':`/api/edit-requests?status=${filter}`;
    fetch(url).then(r=>r.json()).then(d=>setRequests(d.requests||[]));
  },[filter]);

  const exportCSV = () => {
    const rows = [['Date','Requested By','Vehicle','Status','Fields Changed','Reason','Reviewed By','Review Date','Note'],
      ...requests.map(r=>[fmtDate(r.createdAt),r.requestedBy?.name,r.recordId?.vehicleNumber||'—',r.status,r.changedFields?.join('; '),r.reason,r.reviewedBy?.name||'—',r.reviewedAt?fmtDate(r.reviewedAt):'—',r.reviewNote||'—'])];
    const csv = rows.map(r=>r.map((v:any)=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`edit-history-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Edit History</h1>
            <p className="text-slate-300 text-sm mt-0.5">Audit trail of all transaction change requests</p>
          </div>
          <button onClick={exportCSV} disabled={!requests.length} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition">📥 CSV</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Summary + filter */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {['all','pending','approved','rejected'].map(s=>(
                <button key={s} onClick={()=>setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filter===s?'bg-white shadow-sm text-gray-900 font-bold':'text-gray-500 hover:text-gray-800'}`}>{s==='all'?'All':s}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-4 text-xs text-gray-500">
              {[{l:'Total',v:requests.length,c:'text-gray-700'},{l:'Pending',v:requests.filter(r=>r.status==='pending').length,c:'text-yellow-600'},{l:'Approved',v:requests.filter(r=>r.status==='approved').length,c:'text-green-600'},{l:'Rejected',v:requests.filter(r=>r.status==='rejected').length,c:'text-red-600'}].map(s=>(
                <span key={s.l}><span className={`font-extrabold ${s.c}`}>{s.v}</span> {s.l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="sm:hidden space-y-3">
          {requests.map(req=>(
            <div key={req._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${sc[req.status]}`}>{req.status}</span>
                <span className="text-xs text-gray-400">{fmtDate(req.createdAt)}</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{req.requestedBy?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Vehicle: {req.recordId?.vehicleNumber||'—'}</p>
              <p className="text-xs text-gray-600 mt-1">Changed: {req.changedFields?.join(', ')}</p>
              <p className="text-xs text-amber-700 mt-1 italic">"{req.reason}"</p>
            </div>
          ))}
          {requests.length===0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">No edit requests found</div>}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Request Records</h3>
            <span className="text-xs text-gray-400">{requests.length} records</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Date','Requested By','Vehicle','Fields Changed','Reason','Status','Reviewed By',''].map(h=><th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req=>(
                <>
                  <tr key={req._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(req.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">{req.requestedBy?.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 text-xs">{req.recordId?.vehicleNumber||'—'}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{req.changedFields?.map((f:string)=><span key={f} className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-lg font-medium">{LABELS[f]||f}</span>)}</div></td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px]"><p className="truncate text-xs italic" title={req.reason}>"{req.reason}"</p></td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc[req.status]}`}>{req.status}</span></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{req.reviewedBy?.name||'—'}{req.reviewedAt&&<p className="text-gray-400 text-xs">{fmtDate(req.reviewedAt)}</p>}</td>
                    <td className="px-4 py-3"><button onClick={()=>setExpanded(expanded===req._id?null:req._id)} className="px-3 py-1 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 font-medium transition">{expanded===req._id?'Hide':'View Diff'}</button></td>
                  </tr>
                  {expanded===req._id&&(
                    <tr key={`${req._id}-exp`} className="bg-gray-50/60">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-6 bg-white rounded-xl border border-gray-100 p-4">
                          <div>
                            <p className="text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1">📄 Before</p>
                            {Object.keys(LABELS).map(field=>{const val=req.originalData?.[field];if(val==null&&val!==0)return null;const changed=String(val)!==String(req.requestedData?.[field]??'');return(<div key={field} className={`flex gap-2 text-xs py-0.5 ${changed?'text-red-600':'text-gray-600'}`}><span className="font-semibold w-36 shrink-0 text-gray-500">{LABELS[field]}:</span><span className={changed?'line-through':''}>{field==='date'?new Date(val).toLocaleDateString('en-IN'):String(val)}</span></div>);})}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center gap-1">✏️ After</p>
                            {Object.keys(LABELS).map(field=>{const val=req.requestedData?.[field];if(val==null&&val!==0)return null;const changed=String(val)!==String(req.originalData?.[field]??'');return(<div key={field} className={`flex gap-2 text-xs py-0.5 ${changed?'text-green-700 font-semibold':'text-gray-600'}`}><span className="font-semibold w-36 shrink-0 text-gray-500">{LABELS[field]}:</span><span>{field==='date'?new Date(val).toLocaleDateString('en-IN'):String(val)}</span></div>);})}
                          </div>
                        </div>
                        {req.reviewNote&&<div className="mt-3 pt-2 text-xs text-gray-500">Reviewer Note: <span className="font-semibold text-gray-700">"{req.reviewNote}"</span></div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {requests.length===0&&<tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No edit requests found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
