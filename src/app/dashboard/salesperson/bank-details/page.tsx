'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function BankDetailsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [qrModal,  setQrModal]  = useState<any | null>(null);
  const [copying,  setCopying]  = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bank-accounts')
      .then(r => r.ok ? r.json() : { accounts: [] })
      .then(d => { setAccounts(d.accounts || []); setLoading(false); });
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopying(key);
      toast.success('Copied!');
      setTimeout(() => setCopying(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-semibold transition border ${
        copying === id
          ? 'bg-green-100 text-green-700 border-green-300'
          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'
      }`}
    >
      {copying === id ? '✓' : 'Copy'}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-800 px-5 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-white font-extrabold text-xl sm:text-2xl">🏦 Bank Details</h1>
          <p className="text-slate-300 text-sm mt-0.5">Share these details with traders for payments</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <div className="text-4xl mb-3">🏦</div>
            <p className="text-gray-500 font-medium">No bank accounts found</p>
            <p className="text-gray-400 text-sm mt-1">Contact admin to add bank accounts</p>
          </div>
        )}

        {accounts.map(acc => (
          <div key={acc._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Card header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🏦</div>
                <div>
                  <h2 className="text-white font-extrabold text-base leading-tight">{acc.bankName}</h2>
                  <p className="text-white/80 text-xs">{acc.branchName}</p>
                </div>
              </div>
              {acc.upiQrCode && (
                <button
                  onClick={() => setQrModal(acc)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition border border-white/30"
                >
                  📷 View QR
                </button>
              )}
            </div>

            {/* Details grid */}
            <div className="p-5 space-y-3">

              <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Holder</span>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-gray-900">{acc.accountHolderName}</span>
                  <CopyBtn text={acc.accountHolderName} id={`holder-${acc._id}`} />
                </div>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Number</span>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-gray-900 font-mono tracking-wider">{acc.accountNumber}</span>
                  <CopyBtn text={acc.accountNumber} id={`acno-${acc._id}`} />
                </div>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">IFSC Code</span>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-gray-900 font-mono">{acc.ifscCode}</span>
                  <CopyBtn text={acc.ifscCode} id={`ifsc-${acc._id}`} />
                </div>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank Name</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700">{acc.bankName}</span>
                  <CopyBtn text={acc.bankName} id={`bank-${acc._id}`} />
                </div>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Branch</span>
                <span className="text-sm text-gray-700">{acc.branchName}</span>
              </div>

              {acc.upiId && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">UPI ID</span>
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-orange-600">{acc.upiId}</span>
                    <CopyBtn text={acc.upiId} id={`upi-${acc._id}`} />
                  </div>
                </div>
              )}

              {/* Copy all button */}
              <button
                onClick={() => {
                  const lines = [
                    `Bank: ${acc.bankName}`,
                    `Account Holder: ${acc.accountHolderName}`,
                    `Account Number: ${acc.accountNumber}`,
                    `IFSC Code: ${acc.ifscCode}`,
                    `Branch: ${acc.branchName}`,
                    ...(acc.upiId ? [`UPI ID: ${acc.upiId}`] : []),
                  ].join('\n');
                  copy(lines, `all-${acc._id}`);
                }}
                className={`w-full mt-1 py-2.5 rounded-xl text-sm font-bold transition border ${
                  copying === `all-${acc._id}`
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-500 hover:text-white hover:border-orange-500'
                }`}
              >
                {copying === `all-${acc._id}` ? '✓ Copied All Details!' : '📋 Copy All Details'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">UPI QR Code</h3>
                <p className="text-white/80 text-xs">{qrModal.bankName}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-5 text-center space-y-4">
              <img
                src={qrModal.upiQrCode}
                alt="UPI QR Code"
                className="w-56 h-56 object-contain mx-auto rounded-xl border border-gray-100 bg-gray-50"
              />
              {qrModal.upiId && (
                <div className="bg-orange-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">UPI ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-600">{qrModal.upiId}</span>
                    <CopyBtn text={qrModal.upiId} id={`modal-upi-${qrModal._id}`} />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400">Show or screenshot this QR to share with traders</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
