'use client';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

/* ─── types ─── */
interface BankAccount {
  _id?: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}
interface CompanyForm {
  name: string;
  email: string;
  mobileNumber: string;
  bankAccounts: BankAccount[];
  panNumber: string;
  panCardPhoto: File | null;
  panCardPhotoExisting: string;
  address: string;
  upiId: string;
  upiQrCode: File | null;
  upiQrCodeExisting: string;
}
type Errors = Record<string, string | undefined>;

/* ─── helpers ─── */
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

const EMPTY_BANK: BankAccount = { bankName:'', accountHolderName:'', accountNumber:'', ifscCode:'', branchName:'' };
const EMPTY_FORM: CompanyForm = {
  name:'', email:'', mobileNumber:'',
  bankAccounts: [{ ...EMPTY_BANK }], panNumber:'', panCardPhoto:null, panCardPhotoExisting:'',
  address:'', upiId:'', upiQrCode:null, upiQrCodeExisting:'',
};

const inp  = (err?: string) => `w-full border ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white transition`;
const lbl  = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5';
const errT = 'text-xs text-red-500 mt-1';

/* ─── validation ─── */
function validate(f: CompanyForm, isEdit = false): Errors {
  const e: Errors = {};
  if (!f.name.trim())           e.name = 'Company name is required';
  if (!f.email.trim())          e.email = 'Email is required';
  else if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
  if (!f.mobileNumber.trim())   e.mobileNumber = 'Mobile number is required';
  else if (!/^\d{10}$/.test(f.mobileNumber)) e.mobileNumber = 'Mobile must be exactly 10 digits';
  if (f.panNumber && !PAN_RE.test(f.panNumber.toUpperCase())) e.panNumber = 'PAN format must be ABCDE1234F';
  if (f.bankAccounts.length === 0) e.bankAccounts = 'At least one bank account is required';
  f.bankAccounts.forEach((b, i) => {
    if (!b.bankName.trim())           e[`bank_${i}_bankName`]           = 'Bank name required';
    if (!b.accountHolderName.trim())  e[`bank_${i}_accountHolderName`]  = 'Account holder name required';
    if (!b.accountNumber.trim())      e[`bank_${i}_accountNumber`]      = 'Account number required';
    if (!b.ifscCode.trim())           e[`bank_${i}_ifscCode`]           = 'IFSC code required';
    if (!b.branchName.trim())         e[`bank_${i}_branchName`]         = 'Branch name required';
  });
  return e;
}

export default function CompaniesPage() {
  const [companies, setCompanies]   = useState<any[]>([]);
  const [mode, setMode]             = useState<'list'|'add'|'edit'|'detail'>('list');
  const [editItem, setEditItem]     = useState<any|null>(null);
  const [detailItem, setDetailItem] = useState<any|null>(null);
  const [form, setForm]             = useState<CompanyForm>(EMPTY_FORM);
  const [errors, setErrors]         = useState<Errors>({});
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const panPhotoRef  = useRef<HTMLInputElement>(null);
  const upiQrRef     = useRef<HTMLInputElement>(null);

  const load = (withDisabled = showDisabled) => {
    const url = withDisabled ? '/api/companies?includeInactive=true' : '/api/companies';
    fetch(url).then(r=>r.json()).then(d=>setCompanies(d.companies||[]));
  };
  useEffect(() => { load(showDisabled); }, [showDisabled]);

  /* ── file handler ── */
  const handleFile = (field: 'panCardPhoto'|'upiQrCode') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/jpg','image/png','application/pdf'].includes(file.type)) { toast.error('Only JPG, PNG, PDF allowed'); return; }
    if (file.size > 5*1024*1024) { toast.error('Max file size is 5MB'); return; }
    setForm(f => ({ ...f, [field]: file }));
  };

  /* ── set field ── */
  const set = (field: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm(f => {
      const next = { ...f, [field]: v };
      return next;
    });
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  /* ── bank account helpers ── */
  const addBank = () => setForm(f => ({ ...f, bankAccounts: [...f.bankAccounts, { ...EMPTY_BANK }] }));
  const removeBank = (i: number) => {
    if (form.bankAccounts.length === 1) { toast.error('At least one bank account is required'); return; }
    setForm(f => ({ ...f, bankAccounts: f.bankAccounts.filter((_, idx) => idx !== i) }));
  };
  const setBank = (i: number, field: keyof BankAccount) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = field === 'ifscCode' ? e.target.value.toUpperCase() : e.target.value;
    setForm(f => {
      const banks = [...f.bankAccounts];
      banks[i] = { ...banks[i], [field]: v };
      return { ...f, bankAccounts: banks };
    });
    setErrors(er => ({ ...er, [`bank_${i}_${field}`]: undefined }));
  };

  /* ── submit ── */
  const submitForm = async (isEdit = false) => {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); toast.error('Please fix the highlighted errors'); return; }
    setLoading(true);
    try {
      const payload: any = { ...form, panCardPhoto: undefined, upiQrCode: undefined };
      if (form.panCardPhoto instanceof File)  payload.panCardPhoto = await toBase64(form.panCardPhoto);
      else if (form.panCardPhotoExisting)     payload.panCardPhoto = form.panCardPhotoExisting;
      if (form.upiQrCode instanceof File)     payload.upiQrCode = await toBase64(form.upiQrCode);
      else if (form.upiQrCodeExisting)        payload.upiQrCode = form.upiQrCodeExisting;
      if (form.panNumber) payload.panNumber = form.panNumber.toUpperCase();
      delete payload.panCardPhotoExisting; delete payload.upiQrCodeExisting;

      const url = isEdit ? `/api/companies/${editItem._id}` : '/api/companies';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) {
        toast.success(isEdit ? 'Company updated! ✅' : 'Company added! 🎉');
        setMode('list'); setForm(EMPTY_FORM); setErrors({}); load();
      } else {
        if (res.status === 409) setErrors({ email: d.error });
        else setErrors({ general: d.error || 'Something went wrong' });
        toast.error(d.error || 'Save failed');
      }
    } catch { toast.error('Upload failed. Try again.'); }
    setLoading(false);
  };

  const openEdit = (c: any) => {
    setEditItem(c);
    setForm({
      name: c.name||'', email: c.email||'', mobileNumber: c.mobileNumber||'',
      bankAccounts: c.bankAccounts?.length ? c.bankAccounts : [{ ...EMPTY_BANK }],
      panNumber: c.panNumber||'', panCardPhoto: null, panCardPhotoExisting: c.panCardPhoto||'',
      address: c.address||'', upiId: c.upiId||'', upiQrCode: null, upiQrCodeExisting: c.upiQrCode||'',
    });
    setErrors({}); setMode('edit');
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    if (!isActive) {
      await fetch(`/api/companies/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ isActive: true }) });
      toast.success('Company activated'); load();
    } else {
      await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      toast.success('Company deactivated'); load(showDisabled);
    }
  };

  const filtered = companies.filter(c => {
    if (!showDisabled && !c.isActive) return false;
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.mobileNumber?.includes(q);
  });

  /* ──────── FILE UPLOAD WIDGET ──────── */
  const FileUploadWidget = ({ field, label, fileRef, existingUrl, optional = false }:
    { field: 'panCardPhoto'|'upiQrCode'; label: string; fileRef: React.RefObject<HTMLInputElement>; existingUrl?: string; optional?: boolean }) => {
    const current = form[field] as File|null;
    const hasExisting = !!existingUrl;
    return (
      <div>
        <label className={lbl}>{label} {optional ? <span className="text-gray-400 font-normal normal-case">(optional)</span> : '*'}</label>
        <div onClick={() => fileRef.current?.click()}
          className="relative flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition border-gray-200 hover:border-orange-400 hover:bg-orange-50/50">
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile(field)} className="hidden" />
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${current ? 'bg-green-100' : hasExisting ? 'bg-blue-50' : 'bg-gray-100'}`}>
            {current ? '✅' : hasExisting ? '📄' : '📎'}
          </div>
          <div className="flex-1 min-w-0">
            {current ? (
              <p className="text-sm font-semibold text-green-700 truncate">{current.name}</p>
            ) : hasExisting ? (
              <p className="text-sm text-blue-600">Current file uploaded · click to replace</p>
            ) : (
              <p className="text-sm text-gray-400">Click to upload · JPG, PNG, PDF · max 5MB</p>
            )}
          </div>
          {(current || hasExisting) && (
            <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, [field]: null, [`${field}Existing`]: '' })); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-gray-400 hover:text-red-500 text-xl shrink-0">×</button>
          )}
        </div>
      </div>
    );
  };

  /* ──────── FORM VIEW ──────── */
  const isEdit = mode === 'edit';
  if (mode === 'add' || mode === 'edit') return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={() => setMode('list')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition text-lg">←</button>
          <div>
            <h1 className="text-white font-extrabold text-xl">{isEdit ? 'Edit Company' : 'Add New Company'}</h1>
            <p className="text-slate-300 text-sm">{isEdit ? `Editing ${editItem?.name}` : 'Poultry supplier onboarding'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-16">
        {errors.general && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">⚠️ {errors.general}</div>}

        {/* ── Section 1: Basic Info ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-orange-50 border-b border-orange-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🏭</span>
            <h3 className="font-bold text-orange-800 text-sm">Company Information</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Company Name *</label>
              <input value={form.name} onChange={set('name')} className={inp(errors.name)} placeholder="Enter company name" />
              {errors.name && <p className={errT}>{errors.name}</p>}
            </div>
            <div>
              <label className={lbl}>Email ID *</label>
              <input type="email" value={form.email} onChange={set('email')} className={inp(errors.email)} placeholder="company@example.com" />
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
            </div>
            <div>
              <label className={lbl}>Address <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={form.address} onChange={set('address')} className={`${inp()} resize-none`} rows={2} placeholder="Full address..." />
            </div>
          </div>
        </div>

        {/* ── Section 2: Bank Accounts ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏦</span>
              <h3 className="font-bold text-green-800 text-sm">Bank Accounts <span className="text-green-600 font-normal">(at least 1 required)</span></h3>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{form.bankAccounts.length} account{form.bankAccounts.length > 1 ? 's' : ''}</span>
          </div>

          <div className="p-5 space-y-4">
            {errors.bankAccounts && <p className={errT}>{errors.bankAccounts}</p>}

            {form.bankAccounts.map((b, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-2.5 ${i === 0 ? 'bg-green-50 border-b border-green-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold text-white ${i === 0 ? 'bg-green-500' : 'bg-gray-400'}`}>{i + 1}</div>
                    <span className="text-sm font-bold text-gray-700">{b.bankName || `Bank Account ${i + 1}`}</span>
                    {i === 0 && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-medium">Primary</span>}
                  </div>
                  {form.bankAccounts.length > 1 && (
                    <button onClick={() => removeBank(i)} className="text-red-400 hover:text-red-600 text-xs font-semibold hover:bg-red-50 px-2 py-1 rounded-lg transition">🗑 Remove</button>
                  )}
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Bank Name *</label>
                    <input value={b.bankName} onChange={setBank(i,'bankName')} className={inp(errors[`bank_${i}_bankName`])} placeholder="e.g. State Bank of India" />
                    {errors[`bank_${i}_bankName`] && <p className={errT}>{errors[`bank_${i}_bankName`]}</p>}
                  </div>
                  <div>
                    <label className={lbl}>Account Holder Name *</label>
                    <input value={b.accountHolderName} onChange={setBank(i,'accountHolderName')} className={inp(errors[`bank_${i}_accountHolderName`])} placeholder="Name on account" />
                    {errors[`bank_${i}_accountHolderName`] && <p className={errT}>{errors[`bank_${i}_accountHolderName`]}</p>}
                  </div>
                  <div>
                    <label className={lbl}>Account Number *</label>
                    <input value={b.accountNumber} onChange={setBank(i,'accountNumber')} className={inp(errors[`bank_${i}_accountNumber`])} placeholder="Bank account number" />
                    {errors[`bank_${i}_accountNumber`] && <p className={errT}>{errors[`bank_${i}_accountNumber`]}</p>}
                  </div>
                  <div>
                    <label className={lbl}>IFSC Code *</label>
                    <input value={b.ifscCode} onChange={setBank(i,'ifscCode')} className={inp(errors[`bank_${i}_ifscCode`])} placeholder="e.g. SBIN0001234" maxLength={11} />
                    {errors[`bank_${i}_ifscCode`] && <p className={errT}>{errors[`bank_${i}_ifscCode`]}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Branch Name *</label>
                    <input value={b.branchName} onChange={setBank(i,'branchName')} className={inp(errors[`bank_${i}_branchName`])} placeholder="e.g. Mumbai Main Branch" />
                    {errors[`bank_${i}_branchName`] && <p className={errT}>{errors[`bank_${i}_branchName`]}</p>}
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addBank} className="w-full py-2.5 border-2 border-dashed border-green-300 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-50 hover:border-green-400 transition flex items-center justify-center gap-2">
              <span className="text-lg">+</span> Add Another Bank Account
            </button>
          </div>
        </div>

        {/* ── Section 3: PAN & UPI ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="font-bold text-blue-800 text-sm">PAN & UPI <span className="text-blue-500 font-normal text-xs">(optional)</span></h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>PAN Card Number <span className="text-gray-400 font-normal">(optional)</span></label>
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
              <label className={lbl}>UPI ID <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.upiId} onChange={set('upiId')} className={inp()} placeholder="e.g. company@upi" />
            </div>
            <FileUploadWidget field="panCardPhoto" label="PAN Card Photo" fileRef={panPhotoRef} existingUrl={form.panCardPhotoExisting} optional />
            <FileUploadWidget field="upiQrCode" label="UPI QR Code" fileRef={upiQrRef} existingUrl={form.upiQrCodeExisting} optional />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button onClick={() => submitForm(isEdit)} disabled={loading}
            className="flex-1 sm:flex-none sm:px-12 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-extrabold text-sm disabled:opacity-50 shadow-sm transition">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isEdit ? 'Saving...' : 'Creating...'}
              </span>
            ) : (isEdit ? '💾 Save Changes' : '✅ Add Company')}
          </button>
          <button onClick={() => setMode('list')} className="flex-1 sm:flex-none sm:px-8 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ──────── DETAIL VIEW ──────── */
  if (mode === 'detail' && detailItem) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setMode('list')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition text-lg">←</button>
            <div>
              <h1 className="text-white font-extrabold text-xl">{detailItem.name}</h1>
              <p className="text-slate-300 text-sm">{detailItem.email}</p>
            </div>
          </div>
          <button onClick={() => openEdit(detailItem)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm">✏️ Edit</button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2">📋 Company Details</h3>
          {[['Company Name', detailItem.name],['Email', detailItem.email],['Mobile', '+91 ' + detailItem.mobileNumber],['Address', detailItem.address || '—'],['PAN Number', detailItem.panNumber || '—'],['UPI ID', detailItem.upiId || '—']].map(([k,v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium w-28 shrink-0">{k}</span>
              <span className="text-gray-800 font-semibold text-right">{v}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-1 border-t">
            <span className="text-gray-400 font-medium">Outstanding</span>
            <span className={`font-extrabold ${detailItem.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{(detailItem.outstandingBalance||0).toLocaleString('en-IN', {minimumFractionDigits:2})}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 text-sm border-b pb-2 mb-3">🏦 Bank Accounts ({(detailItem.bankAccounts||[]).length})</h3>
          <div className="space-y-3">
            {(detailItem.bankAccounts||[]).map((b: BankAccount, i: number) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold text-white ${i===0?'bg-green-500':'bg-gray-400'}`}>{i+1}</div>
                  <span className="font-bold text-gray-800 text-sm">{b.bankName}</span>
                  {i===0 && <span className="text-xs bg-green-100 text-green-600 px-1.5 rounded">Primary</span>}
                </div>
                {[['Holder',b.accountHolderName],['Account','****'+b.accountNumber.slice(-4)],['IFSC',b.ifscCode],['Branch',b.branchName]].map(([k,v]) => (
                  <div key={k} className="flex justify-between text-xs text-gray-600"><span className="text-gray-400">{k}</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ──────── LIST VIEW ──────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Companies</h1>
            <p className="text-slate-300 text-sm mt-0.5">{companies.length} poultry suppliers</p>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setMode('add'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition">
            <span>+</span> Add Company
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { l:'Total Suppliers',  v: companies.length,                                               c:'text-gray-800',  bg:'bg-white border-gray-200' },
            { l:'With Outstanding', v: companies.filter(c=>c.outstandingBalance>0).length,             c:'text-red-600',   bg:'bg-red-50 border-red-200' },
            { l:'Total Outstanding',v:`₹${companies.reduce((s,c)=>s+(c.outstandingBalance||0),0).toLocaleString('en-IN')}`, c:'text-red-700', bg:'bg-red-50 border-red-200'},
          ].map(s => (
            <div key={s.l} className={`${s.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-lg font-extrabold truncate ${s.c}`}>{s.v}</p>
              <p className="text-xs text-gray-400">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Search + Disabled toggle */}
        <div className="flex gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company name, email, mobile..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm" />
          <button
            onClick={() => setShowDisabled(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm whitespace-nowrap ${
              showDisabled ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {showDisabled ? '👁 Hide Disabled' : '👁 Show Disabled'}
          </button>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
<div key={c._id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition group ${!c.isActive ? "border-red-200 opacity-60" : "border-gray-100"}`}>
              {/* Card header */}
              <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 px-4 py-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-gray-900 truncate">{c.name}</h3>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full font-bold shrink-0 ${c.outstandingBalance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  ₹{(c.outstandingBalance||0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600"><span className="text-base">📱</span><span>{c.mobileNumber}</span></div>
                {c.panNumber && <div className="flex items-center gap-2 text-gray-500 text-xs"><span>🪪</span><span>PAN: {c.panNumber}</span></div>}
                {c.upiId    && <div className="flex items-center gap-2 text-gray-500 text-xs"><span>💸</span><span>{c.upiId}</span></div>}
                {c.address  && <div className="flex items-center gap-2 text-gray-400 text-xs"><span>📍</span><span className="truncate">{c.address}</span></div>}

                {/* Bank accounts mini display */}
                {c.bankAccounts?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-semibold mb-1">🏦 {c.bankAccounts.length} Bank Account{c.bankAccounts.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-600 font-medium truncate">{c.bankAccounts[0].bankName} · ****{c.bankAccounts[0].accountNumber?.slice(-4)}</p>
                  </div>
                )}
              </div>

              {/* Card footer actions */}
              <div className="px-4 pb-3 flex gap-2">
                <button onClick={() => { setDetailItem(c); setMode('detail'); }}
                  className="flex-1 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">👁 View</button>
                <button onClick={() => openEdit(c)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition">✏️ Edit</button>
                <button onClick={() => toggleActive(c._id, c.isActive)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${c.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                  {c.isActive ? '🚫 Disable' : '✅ Enable'}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-4xl mb-3">🏭</div>
              <p className="font-semibold text-gray-500">{search ? 'No companies match your search' : 'No companies added yet'}</p>
              {!search && <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setMode('add'); }} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">+ Add First Company</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
