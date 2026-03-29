'use client';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

/* ─── types ─── */
interface TraderForm {
  name: string;
  email: string;
  mobileNumber: string;
  panNumber: string;
  panCardPhoto: File | null;
  panCardPhotoExisting: string;
  address: string;
}
type Errors = Record<string, string | undefined>;

/* ─── constants ─── */
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY: TraderForm = {
  name:'', email:'', mobileNumber:'',
  panNumber:'', panCardPhoto:null, panCardPhotoExisting:'', address:'',
};

const toBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

const inp  = (err?: string) => `w-full border ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white transition`;
const lbl  = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5';
const errT = 'text-xs text-red-500 mt-1';

/* ─── validation ─── */
function validate(f: TraderForm, isEdit = false): Errors {
  const e: Errors = {};
  if (!f.name.trim())           e.name          = 'Trader name is required';
  if (!f.email.trim())          e.email         = 'Email is required';
  else if (!EMAIL_RE.test(f.email)) e.email     = 'Enter a valid email address';
  if (!f.mobileNumber.trim())   e.mobileNumber  = 'Mobile number is required';
  else if (!/^\d{10}$/.test(f.mobileNumber)) e.mobileNumber = 'Mobile must be exactly 10 digits';
  if (f.panNumber && !PAN_RE.test(f.panNumber.toUpperCase())) e.panNumber = 'PAN format must be ABCDE1234F';
  return e;
}

export default function TradersPage() {
  const [traders, setTraders]     = useState<any[]>([]);
  const [mode, setMode]           = useState<'list'|'add'|'edit'|'detail'>('list');
  const [editItem, setEditItem]   = useState<any|null>(null);
  const [detailItem, setDetailItem] = useState<any|null>(null);
  const [form, setForm]           = useState<TraderForm>(EMPTY);
  const [errors, setErrors]       = useState<Errors>({});
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState<'name'|'outstanding'>('name');
  const [showDisabled, setShowDisabled] = useState(false);
  const panRef = useRef<HTMLInputElement>(null);

  const load = (withDisabled = showDisabled) => {
    const url = withDisabled ? '/api/traders?includeInactive=true' : '/api/traders';
    fetch(url).then(r=>r.json()).then(d=>setTraders(d.traders||[]));
  };
  useEffect(() => { load(showDisabled); }, [showDisabled]);

  /* ── field helpers ── */
  const set = (field: keyof TraderForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm(f => {
      const next = { ...f, [field]: v };
      return next;
    });
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/jpg','image/png','application/pdf'].includes(file.type)) { toast.error('Only JPG, PNG, PDF allowed'); return; }
    if (file.size > 5*1024*1024) { toast.error('Max file size is 5MB'); return; }
    setForm(f => ({ ...f, panCardPhoto: file }));
  };

  /* ── submit ── */
  const submitForm = async (isEdit = false) => {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); toast.error('Please fix the highlighted errors'); return; }
    setLoading(true);
    try {
      const payload: any = { ...form, panCardPhoto: undefined };
      if (form.panCardPhoto instanceof File) payload.panCardPhoto = await toBase64(form.panCardPhoto);
      else if (form.panCardPhotoExisting)    payload.panCardPhoto = form.panCardPhotoExisting;
      delete payload.panCardPhotoExisting;
      if (form.panNumber) payload.panNumber = form.panNumber.toUpperCase();

      const url = isEdit ? `/api/traders/${editItem._id}` : '/api/traders';
      const res = await fetch(url, { method: isEdit?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const d   = await res.json();
      if (res.ok) {
        toast.success(isEdit ? 'Trader updated! ✅' : 'Trader added! 🎉');
        setMode('list'); setForm(EMPTY); setErrors({}); load();
      } else {
        if (res.status === 409) setErrors({ email: d.error });
        else setErrors({ general: d.error || 'Something went wrong' });
        toast.error(d.error || 'Save failed');
      }
    } catch { toast.error('Upload failed. Try again.'); }
    setLoading(false);
  };

  const openEdit = (t: any) => {
    setEditItem(t);
    setForm({
      name: t.name||'', email: t.email||'', mobileNumber: t.mobileNumber||'',
      panNumber: t.panNumber||'', panCardPhoto: null, panCardPhotoExisting: t.panCardPhoto||'',
      address: t.address||'',
    });
    setErrors({}); setMode('edit');
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    if (!isActive) {
      await fetch(`/api/traders/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: true }) });
      toast.success('Trader activated');
    } else {
      await fetch(`/api/traders/${id}`, { method:'DELETE' });
      toast.success('Trader deactivated');
    }
    load(showDisabled);
  };

  const filtered = traders
    .filter(t => {
      if (!showDisabled && !t.isActive) return false;
      const q = search.toLowerCase();
      return !q || t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) || t.mobileNumber?.includes(q);
    })
    .sort((a,b) => sortBy === 'outstanding'
      ? (b.outstandingBalance||0) - (a.outstandingBalance||0)
      : a.name.localeCompare(b.name));

  const totalOutstanding = traders.reduce((s,t) => s+(t.outstandingBalance||0), 0);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  /* ──── FORM VIEW ──── */
  const isEdit = mode === 'edit';
  if (mode === 'add' || mode === 'edit') return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => setMode('list')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition text-lg">←</button>
          <div>
            <h1 className="text-white font-extrabold text-xl">{isEdit ? 'Edit Trader' : 'Add New Trader'}</h1>
            <p className="text-slate-300 text-sm">{isEdit ? `Editing ${editItem?.name}` : 'Register a new chicken buyer'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-16">
        {errors.general && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">⚠️ {errors.general}</div>}

        {/* ── Section 1: Basic Info ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-yellow-50 border-b border-yellow-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🤝</span>
            <h3 className="font-bold text-yellow-800 text-sm">Trader Information</h3>
            <span className="text-xs text-yellow-600 ml-auto">* Required fields</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Trader Name *</label>
              <input value={form.name} onChange={set('name')} className={inp(errors.name)} placeholder="Enter full name or business name" />
              {errors.name && <p className={errT}>{errors.name}</p>}
            </div>

            <div>
              <label className={lbl}>Email ID *</label>
              <input type="email" value={form.email} onChange={set('email')} className={inp(errors.email)} placeholder="trader@example.com" />
              {errors.email && <p className={errT}>{errors.email}</p>}
            </div>

            <div>
              <label className={lbl}>Mobile Number *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">+91</span>
                <input value={form.mobileNumber}
                  onChange={e => { if (/^\d{0,10}$/.test(e.target.value)) set('mobileNumber')(e); }}
                  className={`${inp(errors.mobileNumber)} pl-10`} placeholder="10-digit number" maxLength={10} />
              </div>
              {errors.mobileNumber && <p className={errT}>{errors.mobileNumber}</p>}
              {!errors.mobileNumber && form.mobileNumber.length > 0 && (
                <p className={`text-xs mt-1 ${form.mobileNumber.length === 10 ? 'text-green-600' : 'text-gray-400'}`}>
                  {form.mobileNumber.length}/10 {form.mobileNumber.length === 10 ? '✓' : ''}
                </p>
              )}
            </div>

            <div>
              <label className={lbl}>Address <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <textarea value={form.address} onChange={set('address')} className={`${inp()} resize-none`} rows={2} placeholder="Full address..." />
            </div>
          </div>
        </div>

        {/* ── Section 2: PAN ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🪪</span>
            <h3 className="font-bold text-blue-800 text-sm">PAN Card <span className="text-blue-500 font-normal text-xs">(optional)</span></h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>PAN Card Number</label>
              <input value={form.panNumber} maxLength={10}
                onChange={e => { setForm(f => ({...f, panNumber: e.target.value.toUpperCase()})); setErrors(er => ({...er, panNumber: undefined})); }}
                className={inp(errors.panNumber)} placeholder="ABCDE1234F" />
              {errors.panNumber && <p className={errT}>{errors.panNumber}</p>}
              {!errors.panNumber && form.panNumber && (
                <p className={`text-xs mt-1 ${PAN_RE.test(form.panNumber) ? 'text-green-600' : 'text-gray-400'}`}>
                  {PAN_RE.test(form.panNumber) ? '✓ Valid PAN format' : 'Format: ABCDE1234F'}
                </p>
              )}
            </div>

            <div>
              <label className={lbl}>PAN Card Photo</label>
              <div onClick={() => panRef.current?.click()}
                className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition
                  ${form.panCardPhoto ? 'border-green-400 bg-green-50' : form.panCardPhotoExisting ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'}`}>
                <input ref={panRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} className="hidden" />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
                  ${form.panCardPhoto ? 'bg-green-100' : form.panCardPhotoExisting ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  {form.panCardPhoto ? '✅' : form.panCardPhotoExisting ? '📄' : '📎'}
                </div>
                <div className="flex-1 min-w-0">
                  {form.panCardPhoto ? (
                    <><p className="text-sm font-semibold text-green-700 truncate">{form.panCardPhoto.name}</p>
                    <p className="text-xs text-green-500">{(form.panCardPhoto.size/1024).toFixed(1)} KB</p></>
                  ) : form.panCardPhotoExisting ? (
                    <p className="text-sm text-blue-600">File uploaded · click to replace</p>
                  ) : (
                    <><p className="text-sm text-gray-500 font-medium">Click to upload</p>
                    <p className="text-xs text-gray-400">JPG, PNG, PDF · max 5MB</p></>
                  )}
                </div>
                {(form.panCardPhoto || form.panCardPhotoExisting) && (
                  <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({...f, panCardPhoto:null, panCardPhotoExisting:''})); if(panRef.current) panRef.current.value=''; }}
                    className="text-gray-400 hover:text-red-500 text-xl shrink-0 transition">×</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Buttons ── */}
        <div className="flex gap-3 pt-1">
          <button onClick={() => submitForm(isEdit)} disabled={loading}
            className="flex-1 sm:flex-none sm:px-12 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-extrabold text-sm disabled:opacity-50 shadow-sm transition">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isEdit ? 'Saving...' : 'Adding...'}
              </span>
            ) : (isEdit ? '💾 Save Changes' : '✅ Add Trader')}
          </button>
          <button onClick={() => setMode('list')} className="flex-1 sm:flex-none sm:px-8 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ──── DETAIL VIEW ──── */
  if (mode === 'detail' && detailItem) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setMode('list')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white text-lg transition">←</button>
            <div>
              <h1 className="text-white font-extrabold text-xl">{detailItem.name}</h1>
              <p className="text-slate-300 text-sm">{detailItem.email}</p>
            </div>
          </div>
          <button onClick={() => openEdit(detailItem)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm">✏️ Edit</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Outstanding banner */}
        <div className={`rounded-2xl p-4 flex items-center justify-between shadow-sm border ${detailItem.outstandingBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide ${detailItem.outstandingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>Outstanding Balance</p>
            <p className={`text-2xl font-extrabold ${detailItem.outstandingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(detailItem.outstandingBalance||0)}</p>
          </div>
          <span className="text-4xl">{detailItem.outstandingBalance > 0 ? '⚠️' : '✅'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2">📋 Contact Details</h3>
            {[
              ['Trader Name', detailItem.name],
              ['Email',       detailItem.email],
              ['Mobile',      '+91 ' + (detailItem.mobileNumber||'—')],
              ['Address',     detailItem.address || '—'],
            ].map(([k,v]) => (
              <div key={k} className="flex gap-3 text-sm">
                <span className="text-gray-400 font-medium w-24 shrink-0">{k}</span>
                <span className="text-gray-800 font-semibold break-all">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2">🪪 KYC Details</h3>
            <div className="flex gap-3 text-sm">
              <span className="text-gray-400 font-medium w-24 shrink-0">PAN Number</span>
              <span className="text-gray-800 font-semibold">{detailItem.panNumber || <span className="text-gray-400 italic">Not provided</span>}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-2">PAN Card Photo</p>
              {detailItem.panCardPhoto ? (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2.5">
                  <span className="text-green-600 text-lg">📄</span>
                  <span className="text-green-700 text-sm font-medium">Photo uploaded</span>
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">Not uploaded</p>
              )}
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-gray-400 font-medium w-24 shrink-0">Added on</span>
              <span className="text-gray-600">{new Date(detailItem.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-gray-400 font-medium w-24 shrink-0">Status</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${detailItem.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {detailItem.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ──── LIST VIEW ──── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Traders</h1>
            <p className="text-slate-300 text-sm mt-0.5">{traders.length} registered buyers · customers</p>
          </div>
          <button onClick={() => { setForm(EMPTY); setErrors({}); setMode('add'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition">
            <span className="text-base">+</span> Add Trader
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l:'Total Traders',    v: traders.length,                                              c:'text-gray-800',  bg:'bg-white border-gray-200' },
            { l:'Active',           v: traders.filter(t=>t.isActive).length,                        c:'text-green-700', bg:'bg-green-50 border-green-200' },
            { l:'With Outstanding', v: traders.filter(t=>t.outstandingBalance>0).length,            c:'text-red-600',   bg:'bg-red-50 border-red-200' },
            { l:'Total Due',        v: fmt(totalOutstanding),                                       c:'text-red-700',   bg:'bg-red-50 border-red-200' },
          ].map(s => (
            <div key={s.l} className={`${s.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-lg font-extrabold truncate ${s.c}`}>{s.v}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, mobile..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm" />
            {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>}
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {[{v:'name',l:'A–Z'},  {v:'outstanding',l:'By Due'}].map(s=>(
              <button key={s.v} onClick={() => setSortBy(s.v as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${sortBy===s.v ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-800'}`}>{s.l}</button>
            ))}
          </div>
          <button
            onClick={() => setShowDisabled(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm ${
              showDisabled ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {showDisabled ? '👁 Hide Disabled' : '👁 Show Disabled'}
          </button>
        </div>

        {/* ── MOBILE CARDS ── */}
        <div className="sm:hidden space-y-3">
          {filtered.map(t => (
            <div key={t._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="w-11 h-11 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
                  {t.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 truncate">{t.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-extrabold ${t.outstandingBalance>0?'text-red-600':'text-green-600'}`}>{fmt(t.outstandingBalance||0)}</p>
                  <p className="text-xs text-gray-400">{t.outstandingBalance>0?'due':'clear'}</p>
                </div>
              </div>
              <div className="px-4 pb-3 space-y-1 text-sm text-gray-600">
                <p>📱 {t.mobileNumber} {t.panNumber && <span className="ml-3 text-xs text-gray-400">🪪 {t.panNumber}</span>}</p>
                {t.address && <p className="text-xs text-gray-400 truncate">📍 {t.address}</p>}
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={()=>{setDetailItem(t);setMode('detail');}} className="flex-1 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition">👁 View</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => openEdit(t)} className="flex-1 py-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 transition">✏️ Edit</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => toggleActive(t._id, t.isActive)} className={`flex-1 py-2.5 text-xs font-semibold transition ${t.isActive?'text-red-600 hover:bg-red-50':'text-green-700 hover:bg-green-50'}`}>{t.isActive?'Disable':'Enable'}</button>
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-4xl mb-3">🤝</div>
              <p className="font-semibold text-gray-500">{search ? 'No traders match your search' : 'No traders added yet'}</p>
              {!search && <button onClick={()=>{setForm(EMPTY);setErrors({});setMode('add');}} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">+ Add First Trader</button>}
            </div>
          )}
        </div>

        {/* ── DESKTOP TABLE ── */}
        <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Trader List</h3>
            <span className="text-xs text-gray-400">{filtered.length} of {traders.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Trader','Mobile','Email','PAN','Outstanding','Status','Actions'].map(h =>
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t._id} className={`border-b border-gray-50 hover:bg-yellow-50/30 transition ${!t.isActive?'opacity-50':''}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                          {t.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900">{t.name}</p>
                {!t.isActive && <span className="px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-md shrink-0">Disabled</span>}
              </div>
                          {t.address && <p className="text-xs text-gray-400 truncate max-w-[140px]">📍 {t.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{t.mobileNumber}</td>
                    <td className="px-4 py-3.5 text-gray-600 text-xs">{t.email}</td>
                    <td className="px-4 py-3.5">
                      {t.panNumber
                        ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-lg font-mono">{t.panNumber}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-extrabold ${t.outstandingBalance>0?'text-red-600':'text-green-600'}`}>
                        {fmt(t.outstandingBalance||0)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${t.isActive?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                        {t.isActive?'Active':'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>{setDetailItem(t);setMode('detail');}} className="px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">👁</button>
                        <button onClick={() => openEdit(t)} className="px-2.5 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition">✏️</button>
                        <button onClick={() => toggleActive(t._id, t.isActive)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${t.isActive?'bg-red-50 text-red-600 border-red-200 hover:bg-red-100':'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                          {t.isActive?'Off':'On'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                    <div className="text-4xl mb-2">🤝</div>
                    <p className="font-semibold">{search ? 'No traders match your search' : 'No traders yet'}</p>
                  </td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total ({filtered.length} traders)</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-red-700">{fmt(filtered.reduce((s,t)=>s+(t.outstandingBalance||0),0))}</td>
                    <td colSpan={2} />
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
