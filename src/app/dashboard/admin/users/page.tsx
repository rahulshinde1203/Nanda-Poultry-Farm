'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

const PWD_RE   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/;
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  name:'', email:'', mobile:'', aadhaarNumber:'', aadhaarPhoto:null as File|null,
  panNumber:'', panPhoto:null as File|null, bankName:'', accountNumber:'',
  ifscCode:'', address:'', password:'', confirmPassword:'', role:'salesperson',
};
type FormState = typeof EMPTY_FORM;
type Errors = Partial<Record<keyof FormState | 'general', string>>;

const toBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

function pwdStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH_LABELS = ['','Very Weak','Weak','Fair','Strong','Very Strong'];
const STRENGTH_COLORS = ['','bg-red-500','bg-orange-400','bg-yellow-400','bg-blue-500','bg-green-500'];

const inp = (err?: string) =>
  `w-full border ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white`;
const lbl  = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5';
const errT = 'text-xs text-red-500 mt-1';

const ROLE_COLORS: Record<string,string> = {
  admin: 'bg-purple-100 text-purple-700',
  accountant: 'bg-blue-100 text-blue-700',
  salesperson: 'bg-orange-100 text-orange-700',
};

/* ─────────────────────────────────────────────────────────
   FILE FIELD  — defined OUTSIDE main component
───────────────────────────────────────────────────────── */
function FileField({ field, label, file, error, onChange, onClear }: {
  field: string;
  label: string;
  file: File | null;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className={lbl}>{label} *</label>
      <div
        onClick={() => ref.current?.click()}
        className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'}`}
      >
        <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={onChange} className="hidden" />
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${file ? 'bg-green-100' : 'bg-gray-100'}`}>
          {file ? '✅' : '📎'}
        </div>
        <div className="flex-1 min-w-0">
          {file
            ? <p className="text-sm font-medium text-green-700 truncate">{file.name}</p>
            : <p className="text-sm text-gray-400">Click to upload · JPG, PNG, PDF · max 5MB</p>
          }
        </div>
        {file && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClear();
              if (ref.current) ref.current.value = '';
            }}
            className="text-gray-400 hover:text-red-500 text-xl shrink-0"
          >
            ×
          </button>
        )}
      </div>
      {error && <p className={errT}>{error}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   USER FORM  — defined OUTSIDE main component
   Receives all state via props, no internal state
───────────────────────────────────────────────────────── */
function UserForm({
  isEdit, editUserName, form, errors, loading, showPwd, showCPwd,
  onBack, onChange, onFileChange, onFileClear, onSubmit,
  setShowPwd, setShowCPwd,
}: {
  isEdit?: boolean;
  editUserName?: string;
  form: FormState;
  errors: Errors;
  loading: boolean;
  showPwd: boolean;
  showCPwd: boolean;
  onBack: () => void;
  onChange: (field: keyof FormState, value: string) => void;
  onFileChange: (field: 'aadhaarPhoto' | 'panPhoto') => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileClear: (field: 'aadhaarPhoto' | 'panPhoto') => void;
  onSubmit: () => void;
  setShowPwd: (v: boolean) => void;
  setShowCPwd: (v: boolean) => void;
}) {
  const pStrength = pwdStrength(form.password);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition">←</button>
          <div>
            <h1 className="text-white font-extrabold text-xl">{isEdit ? 'Edit User' : 'Add New User'}</h1>
            <p className="text-slate-300 text-sm">{isEdit ? `Editing ${editUserName}` : 'Fill all required fields to create account'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">⚠️ {errors.general}</div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-orange-50 border-b border-orange-100 px-5 py-3">
            <h3 className="font-bold text-orange-800 text-sm">👤 Personal Information</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={lbl}>Full Name *</label>
              <input
                value={form.name}
                onChange={e => onChange('name', e.target.value)}
                className={inp(errors.name)}
                placeholder="Enter full name"
                autoComplete="off"
              />
              {errors.name && <p className={errT}>{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Email ID *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => onChange('email', e.target.value)}
                  className={inp(errors.email)}
                  placeholder="email@example.com"
                  autoComplete="off"
                />
                {errors.email && <p className={errT}>{errors.email}</p>}
              </div>
              <div>
                <label className={lbl}>Mobile Number *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">+91</span>
                  <input
                    value={form.mobile}
                    onChange={e => onChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`${inp(errors.mobile)} pl-11`}
                    placeholder="10-digit number"
                    inputMode="numeric"
                  />
                </div>
                {errors.mobile && <p className={errT}>{errors.mobile}</p>}
                {!errors.mobile && form.mobile && (
                  <p className={`text-xs mt-1 ${form.mobile.length === 10 ? 'text-green-600' : 'text-gray-400'}`}>
                    {form.mobile.length}/10 digits
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className={lbl}>Address (Optional)</label>
              <textarea
                value={form.address}
                onChange={e => onChange('address', e.target.value)}
                className={inp()}
                rows={2}
                placeholder="Full address..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3">
            <h3 className="font-bold text-blue-800 text-sm">🪪 Identity Documents</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Aadhaar Card Number *</label>
                <input
                  value={form.aadhaarNumber}
                  onChange={e => onChange('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className={inp(errors.aadhaarNumber)}
                  placeholder="12-digit Aadhaar number"
                  inputMode="numeric"
                />
                {errors.aadhaarNumber && <p className={errT}>{errors.aadhaarNumber}</p>}
                {!errors.aadhaarNumber && form.aadhaarNumber && (
                  <p className={`text-xs mt-1 ${form.aadhaarNumber.length === 12 ? 'text-green-600' : 'text-gray-400'}`}>
                    {form.aadhaarNumber.length}/12 digits
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>PAN Card Number *</label>
                <input
                  value={form.panNumber}
                  onChange={e => onChange('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  className={inp(errors.panNumber)}
                  placeholder="ABCDE1234F"
                  autoComplete="off"
                  spellCheck={false}
                />
                {errors.panNumber && <p className={errT}>{errors.panNumber}</p>}
                {!errors.panNumber && form.panNumber && (
                  <p className={`text-xs mt-1 ${PAN_RE.test(form.panNumber) ? 'text-green-600' : 'text-gray-400'}`}>
                    {PAN_RE.test(form.panNumber) ? '✓ Valid PAN' : 'Format: ABCDE1234F'}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileField
                field="aadhaarPhoto"
                label="Aadhaar Card Photo"
                file={form.aadhaarPhoto}
                error={errors.aadhaarPhoto}
                onChange={onFileChange('aadhaarPhoto')}
                onClear={() => onFileClear('aadhaarPhoto')}
              />
              <FileField
                field="panPhoto"
                label="PAN Card Photo"
                file={form.panPhoto}
                error={errors.panPhoto}
                onChange={onFileChange('panPhoto')}
                onClear={() => onFileClear('panPhoto')}
              />
            </div>
          </div>
        </div>
 
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-5 py-3">
            <h3 className="font-bold text-green-800 text-sm">🏦 Bank Details</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Bank Name *</label>
                <input
                  value={form.bankName}
                  onChange={e => onChange('bankName', e.target.value)}
                  className={inp(errors.bankName)}
                  placeholder="e.g. State Bank of India"
                />
                {errors.bankName && <p className={errT}>{errors.bankName}</p>}
              </div>
              <div>
                <label className={lbl}>Account Number *</label>
                <input
                  value={form.accountNumber}
                  onChange={e => onChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                  className={inp(errors.accountNumber)}
                  placeholder="Bank account number"
                  inputMode="numeric"
                />
                {errors.accountNumber && <p className={errT}>{errors.accountNumber}</p>}
              </div>
            </div>
            <div className="sm:w-1/2">
              <label className={lbl}>IFSC Code *</label>
              <input
                value={form.ifscCode}
                onChange={e => onChange('ifscCode', e.target.value.toUpperCase().slice(0, 11))}
                className={inp(errors.ifscCode)}
                placeholder="e.g. SBIN0001234"
                autoComplete="off"
                spellCheck={false}
              />
              {errors.ifscCode && <p className={errT}>{errors.ifscCode}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-purple-50 border-b border-purple-100 px-5 py-3">
            <h3 className="font-bold text-purple-800 text-sm">⚙️ Account Settings</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="sm:w-1/2">
              <label className={lbl}>Role *</label>
              <select value={form.role} onChange={e => onChange('role', e.target.value)} className={inp()}>
                <option value="salesperson">Salesperson</option>
                <option value="accountant">Accountant</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {!isEdit && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Password *</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => onChange('password', e.target.value)}
                        className={`${inp(errors.password)} pr-10`}
                        placeholder="Create password"
                        maxLength={16}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                      >
                        {showPwd ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {form.password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {Array(5).fill(0).map((_, i) => (
                            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < pStrength ? STRENGTH_COLORS[pStrength] : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        <p className={`text-xs font-medium ${pStrength >= 4 ? 'text-green-600' : pStrength >= 3 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {STRENGTH_LABELS[pStrength]}
                        </p>
                      </div>
                    )}
                    {errors.password && <p className={errT}>{errors.password}</p>}
                  </div>
                  <div>
                    <label className={lbl}>Confirm Password *</label>
                    <div className="relative">
                      <input
                        type={showCPwd ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={e => onChange('confirmPassword', e.target.value)}
                        className={`${inp(errors.confirmPassword)} pr-10`}
                        placeholder="Re-enter password"
                        maxLength={16}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCPwd(!showCPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                      >
                        {showCPwd ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {form.confirmPassword && (
                      <p className={`text-xs mt-1 ${form.password === form.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                        {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Do not match'}
                      </p>
                    )}
                    {errors.confirmPassword && <p className={errT}>{errors.confirmPassword}</p>}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Password Requirements:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { r: form.password.length >= 8 && form.password.length <= 16, l: '8-16 characters' },
                      { r: /[A-Z]/.test(form.password), l: 'Uppercase letter' },
                      { r: /[a-z]/.test(form.password), l: 'Lowercase letter' },
                      { r: /\d/.test(form.password), l: 'Number (0-9)' },
                      { r: /[^A-Za-z0-9]/.test(form.password), l: 'Special character' },
                    ].map(({ r, l }) => (
                      <div key={l} className={`flex items-center gap-1.5 text-xs ${r ? 'text-green-600' : 'text-gray-400'}`}>
                        <span>{r ? '✓' : '○'}</span><span>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 sm:flex-none sm:px-10 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 shadow-sm transition"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isEdit ? 'Saving...' : 'Creating...'}</span>
              : (isEdit ? '💾 Save Changes' : '✅ Create User')
            }
          </button>
          <button onClick={onBack} className="flex-1 sm:flex-none sm:px-8 py-3 border border-gray-200 rounded-xl font-medium text-sm hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-36">{label}</span>
      <span className={`text-sm text-gray-900 font-medium text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function downloadDoc(base64: string, filename: string) {
  const a = document.createElement('a');
  a.href = base64;
  a.download = filename;
  a.click();
}

async function downloadUserPDF(user: any) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Nanda Poultry Farm', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 225);
  doc.text('Staff Information Record', 14, 23);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}`, W - 14, 23, { align: 'right' });

  let y = 46;

  doc.setFillColor(249, 115, 22);
  doc.circle(24, y + 10, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text((user.name?.[0] || 'U').toUpperCase(), 24, y + 14, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(user.name || '', 40, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${user.role?.toUpperCase() || ''} · ${user.isActive ? 'Active' : 'Disabled'}`, 40, y + 15);
  y += 30;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(249, 115, 22);
  doc.text('PERSONAL INFORMATION', 14, y);
  y += 2;
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(14, y, W - 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    body: [
      ['Full Name', user.name || '—'],
      ['Email', user.email || '—'],
      ['Mobile', user.mobile ? `+91 ${user.mobile}` : '—'],
      ['Role', user.role || '—'],
      ['Address', user.address || '—'],
      ['Status', user.isActive ? 'Active' : 'Disabled'],
      ['Joined', user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—'],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [100,116,139], cellWidth: 40 } },
    theme: 'plain',
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('IDENTITY DOCUMENTS', 14, y);
  y += 2;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(14, y, W - 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    body: [
      ['Aadhaar Number', user.aadhaarNumber || '—'],
      ['PAN Number', user.panNumber || '—'],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [100,116,139], cellWidth: 40 } },
    theme: 'plain',
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  if (user.aadhaarPhoto && user.aadhaarPhoto !== 'placeholder' && !user.aadhaarPhoto.startsWith('data:application/pdf')) {
    try {
      doc.setFontSize(8);
      doc.setTextColor(100,116,139);
      doc.setFont('helvetica','bold');
      doc.text('Aadhaar Card Photo:', 14, y + 4);
      y += 6;
      doc.addImage(user.aadhaarPhoto, 14, y, 80, 50);
      y += 56;
    } catch {}
  } else if (user.aadhaarPhoto && user.aadhaarPhoto !== 'placeholder') {
    doc.setFontSize(8);
    doc.setTextColor(100,116,139);
    doc.text('Aadhaar Photo: PDF file (download separately)', 14, y + 4);
    y += 10;
  }

  if (user.panPhoto && user.panPhoto !== 'placeholder' && !user.panPhoto.startsWith('data:application/pdf')) {
    try {
      doc.setFontSize(8);
      doc.setTextColor(100,116,139);
      doc.setFont('helvetica','bold');
      doc.text('PAN Card Photo:', 14, y + 4);
      y += 6;
      doc.addImage(user.panPhoto, 14, y, 80, 50);
      y += 56;
    } catch {}
  } else if (user.panPhoto && user.panPhoto !== 'placeholder') {
    doc.setFontSize(8);
    doc.setTextColor(100,116,139);
    doc.text('PAN Photo: PDF file (download separately)', 14, y + 4);
    y += 10;
  }

  y += 4;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('BANK DETAILS', 14, y);
  y += 2;
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.5);
  doc.line(14, y, W - 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    body: [
      ['Bank Name', user.bankName || '—'],
      ['Account Number', user.accountNumber || '—'],
      ['IFSC Code', user.ifscCode || '—'],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [100,116,139], cellWidth: 40 } },
    theme: 'plain',
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('Nanda Poultry Farm — Confidential Staff Record', 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  const safeName = (user.name || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeName}_profile_${new Date().toISOString().split('T')[0]}.pdf`);
}

function UserDetailModal({ user, onClose, onEdit, onPwd }: {
  user: any; onClose: () => void; onEdit: () => void; onPwd: () => void;
}) {
  const [tab, setTab] = useState<'personal'|'identity'|'bank'>('personal');
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await downloadUserPDF(user);
    } catch {
      toast.error('PDF generation failed');
    }
    setDownloading(false);
  };

  const hasAadhaarImg = user.aadhaarPhoto && user.aadhaarPhoto !== 'placeholder';
  const hasPanImg = user.panPhoto && user.panPhoto !== 'placeholder';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-white font-bold text-base">{user.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold capitalize ${
                    user.role === 'admin' ? 'bg-purple-200 text-purple-800' :
                    user.role === 'accountant' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'
                  }`}>
                    {user.role}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${user.isActive ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="flex border-b border-gray-100">
          {([
            { key: 'personal', label: '👤 Personal' },
            { key: 'identity', label: '🪪 Identity' },
            { key: 'bank', label: '🏦 Bank' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-xs font-bold transition border-b-2 ${
                tab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-1">
          {tab === 'personal' && (
            <>
              <Row label="Full Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Mobile" value={user.mobile ? `+91 ${user.mobile}` : '—'} />
              <Row label="Role" value={<span className="capitalize">{user.role}</span>} />
              <Row label="Address" value={user.address || '—'} />
              <Row label="Status" value={user.isActive ? '✅ Active' : '🚫 Disabled'} />
              <Row label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—'} />
            </>
          )}

          {tab === 'identity' && (
            <>
              <Row label="Aadhaar No." value={user.aadhaarNumber || '—'} mono />
              <Row label="PAN No." value={user.panNumber || '—'} mono />

              <div className="pt-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Aadhaar Card Photo</p>
                    {hasAadhaarImg && (
                      <button
                        onClick={() => downloadDoc(
                          user.aadhaarPhoto,
                          user.aadhaarPhoto.startsWith('data:application/pdf') ? 'aadhaar_card.pdf' : 'aadhaar_card.jpg'
                        )}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                      >
                        ⬇ Download
                      </button>
                    )}
                  </div>
                  {hasAadhaarImg ? (
                    user.aadhaarPhoto.startsWith('data:application/pdf') ? (
                      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Aadhaar Card (PDF)</p>
                          <p className="text-xs text-gray-500">Click Download to save</p>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={user.aadhaarPhoto}
                        alt="Aadhaar"
                        className="w-full max-h-52 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-pointer"
                        onClick={() => downloadDoc(user.aadhaarPhoto, 'aadhaar_card.jpg')}
                      />
                    )
                  ) : <p className="text-sm text-gray-400 italic">No photo uploaded</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">PAN Card Photo</p>
                    {hasPanImg && (
                      <button
                        onClick={() => downloadDoc(
                          user.panPhoto,
                          user.panPhoto.startsWith('data:application/pdf') ? 'pan_card.pdf' : 'pan_card.jpg'
                        )}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                      >
                        ⬇ Download
                      </button>
                    )}
                  </div>
                  {hasPanImg ? (
                    user.panPhoto.startsWith('data:application/pdf') ? (
                      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">PAN Card (PDF)</p>
                          <p className="text-xs text-gray-500">Click Download to save</p>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={user.panPhoto}
                        alt="PAN"
                        className="w-full max-h-52 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-pointer"
                        onClick={() => downloadDoc(user.panPhoto, 'pan_card.jpg')}
                      />
                    )
                  ) : <p className="text-sm text-gray-400 italic">No photo uploaded</p>}
                </div>
              </div>
            </>
          )}

          {tab === 'bank' && (
            <>
              <Row label="Bank Name" value={user.bankName || '—'} />
              <Row label="Account No." value={user.accountNumber || '—'} mono />
              <Row label="IFSC Code" value={user.ifscCode || '—'} mono />
            </>
          )}
        </div>

        <div className="px-5 pb-5 pt-4 border-t border-gray-50 space-y-2">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full py-2.5 bg-gradient-to-r from-slate-700 to-gray-800 hover:from-slate-800 hover:to-gray-900 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating PDF...</>
              : <>📥 Download Full Profile PDF</>}
          </button>
          <div className="flex gap-2">
            <button onClick={onEdit} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition">✏️ Edit</button>
            <button onClick={onPwd} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition">🔑 Password</button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [mode, setMode] = useState<'list'|'add'|'edit'|'password'>('list');
  const [editUser, setEditUser] = useState<any|null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwdErr, setNewPwdErr] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewUser, setViewUser] = useState<any|null>(null);

  const load = () => fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []));
  useEffect(() => { load(); }, []);

  const validate = (f: FormState, isEdit = false): Errors => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = 'Full name is required';
    if (!f.email.trim()) e.email = 'Email is required';
    else if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
    if (!f.mobile.trim()) e.mobile = 'Mobile number is required';
    else if (!/^\d{10}$/.test(f.mobile)) e.mobile = 'Mobile must be exactly 10 digits';
    if (!f.aadhaarNumber.trim()) e.aadhaarNumber = 'Aadhaar number is required';
    else if (!/^\d{12}$/.test(f.aadhaarNumber)) e.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
    if (!isEdit && !f.aadhaarPhoto) e.aadhaarPhoto = 'Aadhaar photo is required';
    if (!f.panNumber.trim()) e.panNumber = 'PAN number is required';
    else if (!PAN_RE.test(f.panNumber)) e.panNumber = 'PAN format must be ABCDE1234F';
    if (!isEdit && !f.panPhoto) e.panPhoto = 'PAN card photo is required';
    if (!f.bankName.trim()) e.bankName = 'Bank name is required';
    if (!f.accountNumber.trim()) e.accountNumber = 'Account number is required';
    if (!f.ifscCode.trim()) e.ifscCode = 'IFSC code is required';
    if (!isEdit) {
      if (!f.password) e.password = 'Password is required';
      else if (!PWD_RE.test(f.password)) e.password = 'Must be 8-16 chars with uppercase, lowercase, number & special char';
      if (f.password !== f.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleChange = useCallback((field: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined, general: undefined }));
  }, []);

  const handleFileChange = useCallback((field: 'aadhaarPhoto' | 'panPhoto') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!['image/jpeg','image/jpg','image/png','application/pdf'].includes(file.type)) {
        toast.error('Only JPG, JPEG, PNG, PDF allowed');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB');
        return;
      }
      setForm(f => ({ ...f, [field]: file }));
      setErrors(er => ({ ...er, [field]: undefined }));
    }, []);

  const handleFileClear = useCallback((field: 'aadhaarPhoto' | 'panPhoto') => {
    setForm(f => ({ ...f, [field]: null }));
  }, []);

  const submitAdd = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error('Please fix the errors below');
      return;
    }
    setLoading(true);
    try {
      const aadhaarB64 = await toBase64(form.aadhaarPhoto!);
      const panB64 = await toBase64(form.panPhoto!);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, aadhaarPhoto: aadhaarB64, panPhoto: panB64, confirmPassword: undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success('User created! 🎉');
        setMode('list');
        setForm(EMPTY_FORM);
        load();
      } else {
        setErrors({ general: d.error || 'Something went wrong' });
      }
    } catch {
      setErrors({ general: 'Upload failed. Try again.' });
    }
    setLoading(false);
  };

  const submitEdit = async () => {
    const errs = validate(form, true);
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error('Please fix the errors below');
      return;
    }
    setLoading(true);
    try {
      const payload: any = { ...form, password: undefined, confirmPassword: undefined };
      if (form.aadhaarPhoto instanceof File) payload.aadhaarPhoto = await toBase64(form.aadhaarPhoto);
      else delete payload.aadhaarPhoto;
      if (form.panPhoto instanceof File) payload.panPhoto = await toBase64(form.panPhoto);
      else delete payload.panPhoto;

      const res = await fetch(`/api/users/${editUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success('User updated!');
        setMode('list');
        load();
      } else {
        setErrors({ general: d.error || 'Update failed' });
      }
    } catch {
      setErrors({ general: 'Something went wrong' });
    }
    setLoading(false);
  };

  const submitPwd = async () => {
    if (!PWD_RE.test(newPwd)) {
      setNewPwdErr('Must be 8-16 chars with uppercase, lowercase, number & special char');
      return;
    }
    if (newPwd !== confirmNewPwd) {
      setNewPwdErr('Passwords do not match');
      return;
    }
    setNewPwdErr('');
    setLoading(true);

    const res = await fetch(`/api/users/${editUser._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPwd }),
    });

    setLoading(false);
    if (res.ok) {
      toast.success('Password changed!');
      setMode('list');
    } else {
      const d = await res.json();
      setNewPwdErr(d.error || 'Failed');
    }
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({
      ...EMPTY_FORM,
      name: u.name,
      email: u.email,
      mobile: u.mobile || '',
      aadhaarNumber: u.aadhaarNumber || '',
      aadhaarPhoto: null,
      panNumber: u.panNumber || '',
      panPhoto: null,
      bankName: u.bankName || '',
      accountNumber: u.accountNumber || '',
      ifscCode: u.ifscCode || '',
      address: u.address || '',
      password: '',
      confirmPassword: '',
      role: u.role,
    });
    setErrors({});
    setMode('edit');
  };

  const openPwd = (u: any) => {
    setEditUser(u);
    setNewPwd('');
    setConfirmNewPwd('');
    setNewPwdErr('');
    setMode('password');
  };

  const openView = async (u: any) => {
    try {
      const res = await fetch(`/api/users/${u._id || u.id}`);
      const d = await res.json();
      setViewUser(d.user || u);
    } catch {
      setViewUser(u);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    toast.success(isActive ? 'User disabled' : 'User enabled');
    load();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.mobile?.includes(q))
      && (roleFilter === 'all' || u.role === roleFilter);
  });

  const pwS = pwdStrength(newPwd);

  if (mode === 'add') {
    return (
      <UserForm
        form={form}
        errors={errors}
        loading={loading}
        showPwd={showPwd}
        showCPwd={showCPwd}
        onBack={() => setMode('list')}
        onChange={handleChange}
        onFileChange={handleFileChange}
        onFileClear={handleFileClear}
        onSubmit={submitAdd}
        setShowPwd={setShowPwd}
        setShowCPwd={setShowCPwd}
      />
    );
  }

  if (mode === 'edit') {
    return (
      <UserForm
        isEdit
        editUserName={editUser?.name}
        form={form}
        errors={errors}
        loading={loading}
        showPwd={showPwd}
        showCPwd={showCPwd}
        onBack={() => setMode('list')}
        onChange={handleChange}
        onFileChange={handleFileChange}
        onFileClear={handleFileClear}
        onSubmit={submitEdit}
        setShowPwd={setShowPwd}
        setShowCPwd={setShowCPwd}
      />
    );
  }

  if (mode === 'password') {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('list')} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition">←</button>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Change Password</h1>
            <p className="text-gray-500 text-sm">Resetting password for <strong>{editUser?.name}</strong></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className={lbl}>New Password *</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setNewPwdErr(''); }}
                className={`${inp(newPwdErr)} pr-10`}
                placeholder="Enter new password"
                maxLength={16}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {newPwd && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className={`flex-1 h-1.5 rounded-full ${i < pwS ? STRENGTH_COLORS[pwS] : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${pwS >= 4 ? 'text-green-600' : 'text-orange-600'}`}>{STRENGTH_LABELS[pwS]}</p>
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Confirm New Password *</label>
            <div className="relative">
              <input
                type={showCPwd ? 'text' : 'password'}
                value={confirmNewPwd}
                onChange={e => { setConfirmNewPwd(e.target.value); setNewPwdErr(''); }}
                className={`${inp(newPwdErr)} pr-10`}
                placeholder="Re-enter new password"
                maxLength={16}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowCPwd(!showCPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
              >
                {showCPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {confirmNewPwd && (
              <p className={`text-xs mt-1 ${newPwd === confirmNewPwd ? 'text-green-600' : 'text-red-500'}`}>
                {newPwd === confirmNewPwd ? '✓ Match' : '✗ Do not match'}
              </p>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="grid grid-cols-2 gap-1">
              {[
                { r: newPwd.length >= 8 && newPwd.length <= 16, l: '8-16 characters' },
                { r: /[A-Z]/.test(newPwd), l: 'Uppercase' },
                { r: /[a-z]/.test(newPwd), l: 'Lowercase' },
                { r: /\d/.test(newPwd), l: 'Number' },
                { r: /[^A-Za-z0-9]/.test(newPwd), l: 'Special char' },
              ].map(({ r, l }) => (
                <div key={l} className={`flex items-center gap-1 text-xs ${r ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{r ? '✓' : '○'}</span><span>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {newPwdErr && <p className="text-sm text-red-600 font-medium">⚠️ {newPwdErr}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={submitPwd}
              disabled={loading}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : '🔐 Change Password'}
            </button>
            <button onClick={() => setMode('list')} className="px-6 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">User Management</h1>
            <p className="text-slate-300 text-sm mt-0.5">{users.length} staff accounts</p>
          </div>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setErrors({});
              setShowPwd(false);
              setShowCPwd(false);
              setMode('add');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition"
          >
            <span>+</span> Add User
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: 'Total Staff', v: users.length, c: 'text-gray-800', bg: 'bg-white border-gray-200' },
            { l: 'Active', v: users.filter(u => u.isActive).length, c: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { l: 'Disabled', v: users.filter(u => !u.isActive).length, c: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          ].map(s => (
            <div key={s.l} className={`${s.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-xl font-extrabold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-gray-400">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, mobile..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shrink-0">
            {['all','admin','accountant','salesperson'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${roleFilter === r ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:hidden space-y-3">
          {filtered.map(u => (
            <div key={u._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {u.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openView(u)} className="flex-1 py-1.5 text-xs font-semibold bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100">👁 View</button>
                <button onClick={() => openEdit(u)} className="flex-1 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">✏️ Edit</button>
                <button onClick={() => openPwd(u)} className="flex-1 py-1.5 text-xs font-semibold bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100">🔑 Password</button>
                <button
                  onClick={() => toggle(u._id, u.isActive)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${u.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {u.isActive ? '🚫 Disable' : '✅ Enable'}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">👥</div><p>No users found</p></div>}
        </div>

        <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-[260px]">Staff Member</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-[160px]">Contact</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-[120px]">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-[120px]">Bank</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-[90px]">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id} className={`border-b border-gray-50 hover:bg-orange-50/30 transition ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{u.mobile || '—'}</p>
                      {u.aadhaarNumber && <p className="text-xs text-gray-400">Aadhaar: ****{u.aadhaarNumber.slice(-4)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-semibold capitalize ${ROLE_COLORS[u.role] || ''}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 font-medium truncate">{u.bankName || '—'}</p>
                      {u.accountNumber && <p className="text-xs text-gray-400">****{u.accountNumber.slice(-4)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs rounded-full font-semibold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openView(u)}
                          title="View Details"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 transition"
                        >
                          👁 View
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit User"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => openPwd(u)}
                          title="Change Password"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
                        >
                          🔑 Pwd
                        </button>
                        <button
                          onClick={() => toggle(u._id, u.isActive)}
                          title={u.isActive ? 'Disable User' : 'Enable User'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${u.isActive ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                      <div className="text-4xl mb-2">👥</div>
                      <p className="font-medium">No users found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewUser && (
        <UserDetailModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onEdit={() => { setViewUser(null); openEdit(viewUser); }}
          onPwd={() => { setViewUser(null); openPwd(viewUser); }}
        />
      )}
    </div>
  );
};