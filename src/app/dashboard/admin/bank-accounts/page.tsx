'use client';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

interface BankForm {
  bankName: string; accountHolderName: string; accountNumber: string;
  ifscCode: string; branchName: string; upiId: string;
  upiQrCode: File | null; upiQrCodeExisting: string;
}
type Errors = Record<string, string>;

const EMPTY: BankForm = { bankName:'', accountHolderName:'', accountNumber:'', ifscCode:'', branchName:'', upiId:'', upiQrCode:null, upiQrCodeExisting:'' };
const inp  = (e?: string) => `w-full border ${e ? 'border-red-400 bg-red-50' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white transition`;
const lbl  = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5';
const errT = 'text-xs text-red-500 mt-1';
const toBase64 = (f: File): Promise<string> => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result as string); r.onerror=rej; r.readAsDataURL(f); });

function validate(f: BankForm): Errors {
  const e: Errors = {};
  if (!f.bankName.trim())          e.bankName = 'Bank name is required';
  if (!f.accountHolderName.trim()) e.accountHolderName = 'Account holder name is required';
  if (!f.accountNumber.trim())     e.accountNumber = 'Account number is required';
  if (!f.ifscCode.trim())          e.ifscCode = 'IFSC code is required';
  if (!f.branchName.trim())        e.branchName = 'Branch name is required';
  return e;
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mode, setMode]         = useState<'list'|'add'|'edit'>('list');
  const [editItem, setEditItem] = useState<any|null>(null);
  const [form, setForm]         = useState<BankForm>(EMPTY);
  const [errors, setErrors]     = useState<Errors>({});
  const [loading, setLoading]   = useState(false);
  const [copying, setCopying]       = useState<string|null>(null);
  const [generating, setGenerating] = useState(false);
  const [qrModal, setQrModal]       = useState<any|null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  const load = (withDisabled = showDisabled) => {
    const url = withDisabled ? '/api/bank-accounts?includeInactive=true' : '/api/bank-accounts';
    fetch(url).then(r=>r.json()).then(d=>setAccounts(d.accounts||[]));
  };
  useEffect(()=>{ load(showDisabled); },[showDisabled]);

  const set = (f: keyof BankForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = f === 'ifscCode' ? e.target.value.toUpperCase() : e.target.value;
    setForm(prev => ({...prev, [f]: v}));
    type Errors = Record<string, string | undefined>;
  };

  const handleQr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { toast.error('Only JPG, JPEG, PNG allowed for QR'); return; }
    if (file.size > 5*1024*1024) { toast.error('Max 5MB'); return; }
    setForm(f => ({...f, upiQrCode: file}));
  };

  const submitForm = async (isEdit = false) => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); toast.error('Fix highlighted errors'); return; }
    setLoading(true);
    try {
      const payload: any = {...form, upiQrCode: undefined};
      if (form.upiQrCode instanceof File) payload.upiQrCode = await toBase64(form.upiQrCode);
      else if (form.upiQrCodeExisting) payload.upiQrCode = form.upiQrCodeExisting;
      delete payload.upiQrCodeExisting;
      const url = isEdit ? `/api/bank-accounts/${editItem._id}` : '/api/bank-accounts';
      const res = await fetch(url, { method: isEdit?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) { toast.success(isEdit ? 'Account updated! ✅' : 'Account added! 🎉'); setMode('list'); setForm(EMPTY); setErrors({}); load(); }
      else { setErrors({ general: d.error }); toast.error(d.error); }
    } catch { toast.error('Failed'); }
    setLoading(false);
  };

  const openEdit = (a: any) => {
    setEditItem(a);
    setForm({ bankName:a.bankName||'', accountHolderName:a.accountHolderName||'', accountNumber:a.accountNumber||'',
      ifscCode:a.ifscCode||'', branchName:a.branchName||'', upiId:a.upiId||'',
      upiQrCode:null, upiQrCodeExisting:a.upiQrCode||'' });
    setErrors({}); setMode('edit');
  };

  const deleteAccount = async (id: string) => {
    await fetch(`/api/bank-accounts/${id}`, {method:'DELETE'});
    toast.success('Account deactivated'); load(showDisabled);
  };

  const enableAccount = async (id: string) => {
    await fetch(`/api/bank-accounts/${id}`, {
      method: 'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isActive: true }),
    });
    toast.success('Account enabled ✅'); load(showDisabled);
  };

  /* ── Copy bank details ── */
  const copyDetails = async (a: any) => {
    const text = [
      `Bank Name: ${a.bankName}`,
      `Account Holder: ${a.accountHolderName}`,
      `Account Number: ${a.accountNumber}`,
      `IFSC Code: ${a.ifscCode}`,
      `Branch: ${a.branchName}`,
      ...(a.upiId ? [`UPI: ${a.upiId}`] : []),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopying(a._id); toast.success('Copied to clipboard!');
    setTimeout(() => setCopying(null), 2000);
  };

  const copyAll = async () => {
    const text = accounts.map((a,i) => [
      `--- Account ${i+1} ---`,
      `Bank Name: ${a.bankName}`,
      `Account Holder: ${a.accountHolderName}`,
      `Account Number: ${a.accountNumber}`,
      `IFSC Code: ${a.ifscCode}`,
      `Branch: ${a.branchName}`,
      ...(a.upiId ? [`UPI: ${a.upiId}`] : []),
    ].join('\n')).join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success('All bank details copied!');
  };

  /* ── QR Download ── */
  const downloadQR = (a: any) => {
    const link = document.createElement('a');
    link.href = a.upiQrCode;
    // detect extension from base64 data URL
    const ext = a.upiQrCode.startsWith('data:image/png') ? 'png' : 'jpg';
    link.download = `qr-${a.bankName.replace(/\s+/g,'-').toLowerCase()}-upi.${ext}`;
    link.click();
    toast.success('QR code downloaded!');
  };

  /* ── QR Share via Web Share API / fallback ── */
  const shareQR = async (a: any) => {
    const shareText = `UPI Payment Details\nBank: ${a.bankName}\nAccount Holder: ${a.accountHolderName}\n${a.upiId ? `UPI ID: ${a.upiId}` : ''}`;
    if (navigator.share) {
      try {
        // Convert base64 to blob for sharing
        const res  = await fetch(a.upiQrCode);
        const blob = await res.blob();
        const file = new File([blob], `upi-qr-${a.bankName}.jpg`, { type: blob.type });
        await navigator.share({ title: `UPI QR – ${a.bankName}`, text: shareText, files: [file] });
        toast.success('Shared!');
      } catch {
        // Fallback: share text only
        try { await navigator.share({ title: `UPI – ${a.bankName}`, text: shareText }); toast.success('Shared!'); }
        catch { await navigator.clipboard.writeText(shareText); toast.success('UPI details copied for sharing!'); }
      }
    } else {
      // No Web Share API → copy text
      await navigator.clipboard.writeText(shareText);
      toast.success('UPI details copied — paste to share!');
    }
  };

  /* ── Share via WhatsApp ── */
  const shareWhatsApp = (a: any) => {
    const text = encodeURIComponent([
      `*UPI Payment Details*`,
      `Bank: ${a.bankName}`,
      `Account Holder: ${a.accountHolderName}`,
      ...(a.upiId ? [`UPI ID: ${a.upiId}`] : []),
      `\nPlease use the QR code sent separately.`,
    ].join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  /* ── PDF Export ── */
  const exportPDF = async () => {
    if (!accounts.length) { toast.error('No bank accounts to export'); return; }
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      let y = 15;

      // ── Header band ──
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, W, 38, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('Ashwini Poultry Farm', 14, 18);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 210, 225);
      doc.text('Bank Account Details', 14, 26);

      y = 50;

      // ── Title ──
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('BANK DETAILS', W/2, y, { align: 'center' });
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.8);
      doc.line(W/2 - 30, y+3, W/2 + 30, y+3);
      y += 14;

      // ── Bank accounts ──
      for (let i = 0; i < accounts.length; i++) {
        const a = accounts[i];
        if (y > 240) { doc.addPage(); y = 20; }

        // Account box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(12, y, W - 24, 52 + (a.upiId ? 8 : 0), 3, 3, 'FD');

        // Account header
        doc.setFillColor(249, 115, 22);
        doc.roundedRect(12, y, W-24, 10, 3, 3, 'F');
        doc.rect(12, y+6, W-24, 4, 'F'); // fill bottom corners
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(`Account ${i+1}: ${a.bankName}`, 18, y+7);
        y += 14;

        doc.setTextColor(30, 41, 59);
        const rows = [
          ['Bank Name', a.bankName], ['Account Holder', a.accountHolderName],
          ['Account Number', a.accountNumber], ['IFSC Code', a.ifscCode],
          ['Branch', a.branchName], ...(a.upiId ? [['UPI ID', a.upiId]] : []),
        ];
        doc.setFontSize(8);
        rows.forEach(([k, v]) => {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
          doc.text(k + ':', 18, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
          doc.text(v, 70, y);
          y += 7;
        });
        y += 6;
      }

      // ── Footer ──
      if (y > 230) { doc.addPage(); y = 20; }
      y = Math.max(y + 10, 245);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, y, W-14, y);
      y += 10;

      const footerY = y;
      doc.setFontSize(7); doc.setTextColor(100,116,139);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})}`, W/2, footerY+5, {align:'center'});

      doc.save(`bank-details-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch (e) { console.error(e); toast.error('PDF generation failed'); }
    setGenerating(false);
  };

  /* ── DOC Export (HTML-based .doc) ── */
  const exportDOC = async () => {
    if (!accounts.length) { toast.error('No bank accounts to export'); return; }
    setGenerating(true);
    try {
      const accountsHtml = accounts.map((a, i) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;overflow:hidden;">
          <div style="background:#f97316;color:white;padding:8px 14px;font-weight:bold;font-size:11pt;">
            Account ${i+1}: ${a.bankName}
          </div>
          <div style="padding:12px 14px;">
            <table style="width:100%;border-collapse:collapse;font-size:10pt;">
              ${[['Bank Name',a.bankName],['Account Holder',a.accountHolderName],['Account Number',a.accountNumber],['IFSC Code',a.ifscCode],['Branch',a.branchName],...(a.upiId?[['UPI ID',a.upiId]]:[])].map(([k,v])=>`
              <tr><td style="color:#64748b;font-weight:600;padding:4px 8px 4px 0;width:140px;">${k}</td><td style="color:#1e293b;font-weight:500;padding:4px 0;">${v}</td></tr>`).join('')}
            </table>
            ${a.upiQrCode ? `<div style="margin-top:8px;"><img src="${a.upiQrCode}" style="width:80px;height:80px;" /><p style="font-size:8pt;color:#64748b;">UPI QR Code</p></div>` : ''}
          </div>
        </div>`).join('');

      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
        <head><meta charset="utf-8"/><title>Bank Details</title>
        <style>body{font-family:Arial,sans-serif;margin:40px;color:#1e293b;} h1{color:#1e293b;} .header{background:#1e293b;color:white;padding:20px;margin:-40px -40px 30px;}</style>
        </head><body>
        <div class="header">
          <span style="font-size:18pt;font-weight:bold;">Ashwini Poultry Farm</span><br/>
          <span style="font-size:9pt;color:#cbd5e1;">Bank Account Details</span>
        </div>
        <h2 style="text-align:center;color:#1e293b;border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:24px;">BANK DETAILS</h2>
        ${accountsHtml}
        <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;">
          <div style="text-align:center;color:#64748b;font-size:9pt;">Date: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
        </div>
        </body></html>`;

      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url; a2.download = `bank-details-${new Date().toISOString().split('T')[0]}.doc`;
      a2.click(); URL.revokeObjectURL(url);
      toast.success('DOC downloaded!');
    } catch { toast.error('DOC generation failed'); }
    setGenerating(false);
  };

  /* ─── ADD / EDIT FORM ─── */
  const isEdit = mode === 'edit';
  if (mode === 'add' || mode === 'edit') return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => setMode('list')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white text-lg transition">←</button>
          <div>
            <h1 className="text-white font-extrabold text-xl">{isEdit ? 'Edit Bank Account' : 'Add Bank Account'}</h1>
            <p className="text-slate-300 text-sm">{isEdit ? editItem?.bankName : 'Add a new business bank account'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-16">
        {errors.general && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">⚠️ {errors.general}</div>}

        {/* Required fields */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🏦</span><h3 className="font-bold text-blue-800 text-sm">Bank Account Details</h3>
            <span className="text-xs text-blue-500 ml-auto">* All fields required</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Bank Name *</label>
              <input value={form.bankName} onChange={set('bankName')} className={inp(errors.bankName)} placeholder="e.g. HDFC Bank" />
              {errors.bankName && <p className={errT}>{errors.bankName}</p>}
            </div>
            <div>
              <label className={lbl}>Account Holder Name *</label>
              <input value={form.accountHolderName} onChange={set('accountHolderName')} className={inp(errors.accountHolderName)} placeholder="Name on account" />
              {errors.accountHolderName && <p className={errT}>{errors.accountHolderName}</p>}
            </div>
            <div>
              <label className={lbl}>Account Number *</label>
              <input value={form.accountNumber} onChange={set('accountNumber')} className={inp(errors.accountNumber)} placeholder="Bank account number" />
              {errors.accountNumber && <p className={errT}>{errors.accountNumber}</p>}
            </div>
            <div>
              <label className={lbl}>IFSC Code *</label>
              <input value={form.ifscCode} onChange={set('ifscCode')} className={inp(errors.ifscCode)} placeholder="e.g. HDFC0001234" maxLength={11} />
              {errors.ifscCode && <p className={errT}>{errors.ifscCode}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Branch Name *</label>
              <input value={form.branchName} onChange={set('branchName')} className={inp(errors.branchName)} placeholder="e.g. Pune Main Branch" />
              {errors.branchName && <p className={errT}>{errors.branchName}</p>}
            </div>
          </div>
        </div>

        {/* UPI */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">💸</span><h3 className="font-bold text-green-800 text-sm">UPI Details <span className="text-green-500 font-normal text-xs">(optional)</span></h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>UPI ID</label>
              <input value={form.upiId} onChange={set('upiId')} className={inp()} placeholder="e.g. farm@upi" />
            </div>
            <div>
              <label className={lbl}>UPI QR Code</label>
              <div onClick={() => qrRef.current?.click()}
                className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition
                  ${form.upiQrCode ? 'border-green-400 bg-green-50' : form.upiQrCodeExisting ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'}`}>
                <input ref={qrRef} type="file" accept=".jpg,.jpeg,.png" onChange={handleQr} className="hidden" />
                {form.upiQrCode ? (
                  <img src={URL.createObjectURL(form.upiQrCode)} className="w-14 h-14 object-cover rounded-lg" />
                ) : form.upiQrCodeExisting ? (
                  <img src={form.upiQrCodeExisting} className="w-14 h-14 object-cover rounded-lg" />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📷</div>
                )}
                <div className="flex-1 min-w-0">
                  {form.upiQrCode ? <p className="text-sm font-semibold text-green-700 truncate">{form.upiQrCode.name}</p>
                  : form.upiQrCodeExisting ? <p className="text-sm text-blue-600">QR uploaded · click to replace</p>
                  : <><p className="text-sm text-gray-500 font-medium">Click to upload QR</p><p className="text-xs text-gray-400">JPG, PNG · max 5MB</p></>}
                </div>
                {(form.upiQrCode || form.upiQrCodeExisting) && (
                  <button type="button" onClick={e=>{e.stopPropagation();setForm(f=>({...f,upiQrCode:null,upiQrCodeExisting:''}));if(qrRef.current)qrRef.current.value='';}}
                    className="text-gray-400 hover:text-red-500 text-xl shrink-0">×</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => submitForm(isEdit)} disabled={loading}
            className="flex-1 sm:flex-none sm:px-12 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-extrabold text-sm disabled:opacity-50 shadow-sm transition">
            {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>{isEdit?'Saving...':'Adding...'}</span> : (isEdit ? '💾 Save Changes' : '✅ Add Account')}
          </button>
          <button onClick={() => setMode('list')} className="flex-1 sm:flex-none sm:px-8 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ─── LIST VIEW ─── */
  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-xl sm:text-2xl">Bank Accounts</h1>
            <p className="text-slate-300 text-sm mt-0.5">{accounts.length} business accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDisabled(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                showDisabled ? 'bg-gray-700 text-white border-gray-700' : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
              }`}>
              {showDisabled ? '👁 Hide Disabled' : '👁 Show Disabled'}
            </button>
            <button onClick={() => {setForm(EMPTY);setErrors({});setMode('add');}}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition">
              + Add Account
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Export toolbar */}
        {accounts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-auto">
              <span className="text-lg">📄</span>
              <div>
                <p className="text-sm font-bold text-gray-800">Bank Details Document</p>
                <p className="text-xs text-gray-400">Export accounts as PDF or DOC • {accounts.length} account{accounts.length>1?'s':''}</p>
              </div>
            </div>
            <button onClick={exportPDF} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition">
              {generating ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '📥'} PDF
            </button>
            <button onClick={exportDOC} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition">
              {generating ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '📝'} DOC
            </button>
            <button onClick={copyAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition">
              📋 Copy All
            </button>
          </div>
        )}

        {/* Accounts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((a, i) => (
            <div key={a._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
              {/* Card header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-2xl shrink-0">🏦</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-white truncate">{a.bankName}</h3>
                  <p className="text-blue-200 text-xs truncate">{a.accountHolderName}</p>
                </div>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">#{i+1}</span>
              </div>

              {/* Card body */}
              <div className="px-5 py-4 space-y-2.5">
                {[
                  ['Account No', a.accountNumber],
                  ['IFSC Code', a.ifscCode],
                  ['Branch', a.branchName],
                ].map(([k,v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide w-24 shrink-0">{k}</span>
                    <span className="font-mono text-sm text-gray-800 font-bold text-right">{v}</span>
                  </div>
                ))}

                {/* Balance */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Balance</span>
                  <span className="text-lg font-extrabold text-green-600">₹{(a.currentBalance||0).toLocaleString('en-IN')}</span>
                </div>

                {/* UPI row */}
                {(a.upiId || a.upiQrCode) && (
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
                    {a.upiQrCode ? (
                      <button onClick={() => setQrModal(a)}
                        className="w-14 h-14 rounded-xl border-2 border-violet-200 overflow-hidden shrink-0 hover:border-violet-400 hover:scale-105 transition relative group">
                        <img src={a.upiQrCode} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-violet-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="text-white text-xs font-bold">View</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-xl shrink-0">💸</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">UPI ID</p>
                      <p className="text-sm text-gray-800 font-bold truncate">{a.upiId || '—'}</p>
                      {a.upiQrCode && (
                        <button onClick={() => setQrModal(a)}
                          className="mt-1 text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1">
                          <span>🔍</span> View QR Code
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card actions */}
              <div className="px-4 pb-4 flex gap-1.5 flex-wrap">
                <button onClick={() => openEdit(a)}
                  className="flex-1 min-w-[60px] py-2 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-xl hover:bg-orange-100 transition">✏️ Edit</button>
                <button onClick={() => copyDetails(a)}
                  className={`flex-1 min-w-[60px] py-2 text-xs font-bold rounded-xl border transition ${copying===a._id ? 'bg-green-500 text-white border-green-500' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                  {copying===a._id ? '✓ Done!' : '📋 Copy'}
                </button>
                {a.upiQrCode && (
                  <button onClick={() => setQrModal(a)}
                    className="flex-1 min-w-[60px] py-2 text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-100 transition">
                    🔍 QR
                  </button>
                )}
                {a.isActive ? (
                  <button onClick={() => deleteAccount(a._id)}
                    className="flex-1 min-w-[60px] py-2 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition">🚫 Disable</button>
                ) : (
                  <button onClick={() => enableAccount(a._id)}
                    className="flex-1 min-w-[60px] py-2 text-xs font-bold bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition">✅ Enable</button>
                )}
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-5xl mb-3">🏦</div>
              <p className="font-bold text-gray-500">No bank accounts added yet</p>
              <button onClick={()=>{setForm(EMPTY);setErrors({});setMode('add');}} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">+ Add First Account</button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ══════════════════════════════════════
        QR CODE MODAL
    ══════════════════════════════════════ */}
    {qrModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={() => setQrModal(null)}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal panel */}
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          onClick={e => e.stopPropagation()}>

          {/* Modal header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-white font-extrabold text-base">{qrModal.bankName}</h3>
              <p className="text-violet-200 text-xs mt-0.5">{qrModal.accountHolderName}</p>
            </div>
            <button onClick={() => setQrModal(null)}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white text-lg font-bold transition">×</button>
          </div>

          {/* QR Image */}
          <div className="px-6 py-6 flex flex-col items-center">
            <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-violet-100 mb-4">
              <img src={qrModal.upiQrCode} alt="UPI QR Code"
                className="w-56 h-56 object-contain rounded-xl" />
            </div>

            {/* UPI ID badge */}
            {qrModal.upiId && (
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 mb-5 w-full justify-center">
                <span className="text-violet-500 text-lg">💸</span>
                <div className="text-center">
                  <p className="text-xs text-violet-500 font-semibold uppercase tracking-wide">UPI ID</p>
                  <p className="text-violet-900 font-extrabold text-sm">{qrModal.upiId}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 w-full">
              {/* Download */}
              <button onClick={() => downloadQR(qrModal)}
                className="flex flex-col items-center gap-1.5 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl transition group">
                <span className="text-2xl group-hover:scale-110 transition">⬇️</span>
                <span className="text-xs font-bold text-blue-700">Download</span>
              </button>

              {/* Share (native) */}
              <button onClick={() => shareQR(qrModal)}
                className="flex flex-col items-center gap-1.5 py-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-2xl transition group">
                <span className="text-2xl group-hover:scale-110 transition">📤</span>
                <span className="text-xs font-bold text-orange-700">Share</span>
              </button>

              {/* WhatsApp */}
              <button onClick={() => shareWhatsApp(qrModal)}
                className="flex flex-col items-center gap-1.5 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl transition group">
                <span className="text-2xl group-hover:scale-110 transition">💬</span>
                <span className="text-xs font-bold text-green-700">WhatsApp</span>
              </button>
            </div>

            {/* Copy UPI ID */}
            {qrModal.upiId && (
              <button onClick={async () => { await navigator.clipboard.writeText(qrModal.upiId); toast.success('UPI ID copied!'); }}
                className="mt-3 w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 transition flex items-center justify-center gap-2">
                📋 Copy UPI ID: <span className="text-gray-800 font-mono">{qrModal.upiId}</span>
              </button>
            )}
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-gray-400 pb-4">Tap outside to close</p>
        </div>
      </div>
    )}
  </>
  );
}
