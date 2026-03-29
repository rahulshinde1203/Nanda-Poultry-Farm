'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalespersonReportsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/salesperson/ledger'); }, [router]);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Redirecting to Ledger Report…</p>
    </div>
  );
}
