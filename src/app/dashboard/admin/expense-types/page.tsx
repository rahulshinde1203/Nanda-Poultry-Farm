'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ExpenseTypesPage() {
  const [types,   setTypes]   = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => fetch('/api/expense-types').then(r=>r.json()).then(d=>setTypes(d.expenseTypes||[]));
  useEffect(()=>{ load(); },[]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newName.trim()) return; setLoading(true);
    const res = await fetch('/api/expense-types', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:newName.trim() }) });
    const d = await res.json(); setLoading(false);
    if (res.ok) { toast.success(`"${newName.trim()}" added!`); setNewName(''); load(); }
    else toast.error(d.error || 'Failed');
  };

  const update = async () => {
    if (!editing) return;
    const res = await fetch(`/api/expense-types/${editing.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:editing.name }) });
    if (res.ok) { toast.success('Updated!'); setEditing(null); load(); }
    else toast.error('Failed to update');
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/expense-types/${id}`, { method:'DELETE' });
    toast.success('Expense type removed'); setDeleting(null); load();
  };

  const inp = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white font-extrabold text-xl sm:text-2xl">Expense Types</h1>
          <p className="text-slate-300 text-sm mt-0.5">Manage expense categories used across the system</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Add form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 text-sm mb-3">➕ Add New Type</h3>
          <form onSubmit={add} className="flex gap-3">
            <input required value={newName} onChange={e=>setNewName(e.target.value)}
              className={`${inp} flex-1`} placeholder="Enter expense type name..." />
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold text-sm disabled:opacity-50 transition">
              {loading ? '...' : '+ Add'}
            </button>
          </form>
        </div>

        {/* Delete confirm */}
        {deleting && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setDeleting(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e=>e.stopPropagation()}>
              <div className="text-3xl mb-3">🗑️</div>
              <h3 className="font-bold text-gray-900 mb-2">Remove Expense Type?</h3>
              <p className="text-gray-500 text-sm mb-5">This type will be deactivated and hidden from selections.</p>
              <div className="flex gap-3">
                <button onClick={()=>deactivate(deleting)} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700">Remove</button>
                <button onClick={()=>setDeleting(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Active Types</h3>
            <span className="text-xs text-gray-400">{types.length} types</span>
          </div>
          {types.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="text-3xl mb-2">🏷️</div>
              <p className="text-gray-400 text-sm">No expense types yet. Add your first type above.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {types.map(t => (
                <div key={t._id} className="px-5 py-3 flex items-center justify-between group hover:bg-gray-50/50 transition">
                  {editing?.id === t._id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input value={editing!.name} onChange={e=>setEditing({ id: editing!.id, name: e.target.value })}
                        className={`${inp} flex-1`} onKeyDown={e=>e.key==='Enter'&&update()} autoFocus />
                      <button onClick={update} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition">Save</button>
                      <button onClick={()=>setEditing(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-orange-400 rounded-full shrink-0"></span>
                        <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={()=>setEditing({id:t._id,name:t.name})}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">✏️</button>
                        <button onClick={()=>setDeleting(t._id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Remove">🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
