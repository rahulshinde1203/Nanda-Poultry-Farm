'use client';
import TransactionsView from '@/components/TransactionsView';
export default function AdminTransactionsPage() {
  return <TransactionsView readOnly={true} canDelete={true} />;
}
