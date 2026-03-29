'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const LABELS: Record<string, string> = { date: 'Date', company: 'Company', trader: 'Trader', numberOfBirds: 'No. of Birds', totalWeight: 'Total Weight (Kg)', purchaseRatePerKg: 'Purchase Rate/Kg', saleRatePerKg: 'Sale Rate/Kg', vehicleNumber: 'Vehicle Number', notes: 'Notes' };

export default function AccountantEditRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => fetch(`/api/edit-requests?status=${filter}`).then(r => r.json()).then(d => setRequests(d.requests || []));
  useEffect(() => { load(); }, [filter]);

  const handleReview = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/edit-requests/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: reviewAction, reviewNote }) });
    const d = await res.json(); setLoading(false);
    if (res.ok) { toast.success(reviewAction === 'approve' ? '✅ Approved & record updated!' : '❌ Request rejected'); setReviewing(null); setReviewNote(''); load(); }
    else toast.error(d.error || 'Failed');
  };

  const sc: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700 border-yellow-200', approved: 'bg-green-100 text-green-700 border-green-200', rejected: 'bg-red-100 text-red-700 border-red-200' };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-white font-extrabold text-xl sm:text-2xl">Edit Requests</h1>
          <p className="text-slate-300 text-sm mt-0.5">Review and approve or reject transaction change requests</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
          {(['pending','approved','rejected','all'] as const).map(s=>(
            <button key={s} onClick={()=>setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filter===s?'bg-orange-500 text-white shadow-sm':'text-gray-500 hover:text-gray-800'}`}>{s==='all'?'All':s}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-4 text-xs text-gray-500">
          <span><span className="font-bold text-yellow-600">{requests.filter(r=>r.status==='pending').length}</span> Pending</span>
          <span><span className="font-bold text-green-600">{requests.filter(r=>r.status==='approved').length}</span> Approved</span>
          <span><span className="font-bold text-red-600">{requests.filter(r=>r.status==='rejected').length}</span> Rejected</span>
        </div>
      </div>

      <div className="space-y-4">
        {requests.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-400">No {filter} requests</p>
          </div>
        )}

        {requests.map(req => (
          <div key={req._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${sc[req.status]}`}>{req.status.toUpperCase()}</span>
                <span className="font-semibold text-gray-900 text-sm">{req.requestedBy?.name}</span>
                <span className="text-xs text-gray-400">{fmtDate(req.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500">Vehicle: <span className="font-mono font-medium text-gray-700">{req.recordId?.vehicleNumber || '—'}</span></p>
            </div>

            {/* Reason */}
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Reason for Change</p>
              <p className="text-sm text-amber-900">"{req.reason}"</p>
            </div>

            {/* Fields diff */}
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Changed: <span className="text-orange-600 normal-case font-semibold">{req.changedFields?.join(', ')}</span></p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                  <thead><tr className="bg-gray-50"><th className="text-left font-semibold text-gray-500 uppercase px-3 py-2">Field</th><th className="text-left font-semibold text-red-500 uppercase px-3 py-2">Before</th><th className="text-left font-semibold text-green-600 uppercase px-3 py-2">After</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.keys(LABELS).map(field => {
                      const orig = req.originalData?.[field];
                      const req_ = req.requestedData?.[field];
                      const changed = String(orig ?? '') !== String(req_ ?? '');
                      if (!orig && !req_) return null;
                      return (
                        <tr key={field} className={changed ? 'bg-orange-50/40' : ''}>
                          <td className="px-3 py-2 text-gray-600 font-medium">{LABELS[field]}</td>
                          <td className={`px-3 py-2 ${changed ? 'text-red-600 line-through' : 'text-gray-600'}`}>{field === 'date' && orig ? new Date(orig).toLocaleDateString('en-IN') : String(orig ?? '—')}</td>
                          <td className={`px-3 py-2 ${changed ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>{field === 'date' && req_ ? new Date(req_).toLocaleDateString('en-IN') : String(req_ ?? '—')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reviewed info */}
            {req.status !== 'pending' && (
              <div className={`px-5 py-3 border-t text-xs ${req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className="font-semibold text-gray-600">{req.status === 'approved' ? '✅' : '❌'} Reviewed by {req.reviewedBy?.name} on {fmtDate(req.reviewedAt)}</p>
                {req.reviewNote && <p className="text-gray-500 mt-0.5">Note: "{req.reviewNote}"</p>}
              </div>
            )}

            {/* Action */}
            {req.status === 'pending' && (
              <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50">
                {reviewing === req._id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setReviewAction('approve')} className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${reviewAction === 'approve' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-200'}`}>✓ Approve</button>
                      <button onClick={() => setReviewAction('reject')} className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${reviewAction === 'reject' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200'}`}>✗ Reject</button>
                    </div>
                    <input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note (optional)..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(req._id)} disabled={loading} className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 ${reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>{loading ? 'Processing...' : `Confirm ${reviewAction === 'approve' ? 'Approval' : 'Rejection'}`}</button>
                      <button onClick={() => { setReviewing(null); setReviewNote(''); }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-white">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setReviewing(req._id)} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-sm">Review This Request</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
