'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const adminLinks = [
  { href: '/dashboard/admin',               label: 'Dashboard',       icon: '📊' },
  { href: '/dashboard/admin/users',          label: 'Users',           icon: '👥' },
  { href: '/dashboard/admin/companies',      label: 'Companies',       icon: '🏭' },
  { href: '/dashboard/admin/traders',        label: 'Traders',         icon: '🤝' },
  { href: '/dashboard/admin/bank-accounts',  label: 'Bank Accounts',   icon: '🏦' },
  { href: '/dashboard/admin/outstanding',    label: 'Outstanding',     icon: '📋' },
  { href: '/dashboard/admin/transactions',   label: 'Transactions',    icon: '🔄' },
  { href: '/dashboard/admin/expenses',       label: 'Expenses',        icon: '💸' },
  { href: '/dashboard/admin/expense-types',  label: 'Expense Types',   icon: '🏷️' },
  { href: '/dashboard/admin/edit-requests',  label: 'Edit History',    icon: '📝' },
  { href: '/dashboard/admin/payments',       label: 'View Payments',   icon: '💳' },
  { href: '/dashboard/admin/ledger',         label: 'Ledger Report',   icon: '📒' },
  { href: '/dashboard/admin/bank-statements',label: 'Bank Statements', icon: '📑' },
  { href: '/dashboard/admin/chat',           label: 'Team Chat',       icon: '💬' },
];

const salespersonLinks = [
  { href: '/dashboard/salesperson',                  label: 'Dashboard',     icon: '🏠' },
  { href: '/dashboard/salesperson/transactions',     label: 'Transactions',  icon: '🔄' },
  { href: '/dashboard/salesperson/payments',         label: 'Payments',      icon: '💳' },
  { href: '/dashboard/salesperson/outstanding',      label: 'Outstanding',   icon: '📊' },
  { href: '/dashboard/salesperson/ledger',           label: 'Ledger Report', icon: '📒' },
  { href: '/dashboard/salesperson/bank-details',     label: 'Bank Details',  icon: '🏦' },
  { href: '/dashboard/salesperson/chat',             label: 'Team Chat',     icon: '💬' },
];

const accountantLinks = [
  { href: '/dashboard/accountant',                     label: 'Dashboard',       icon: '📊' },
  { href: '/dashboard/accountant/payments',            label: 'Verify Payments', icon: '✅' },
  { href: '/dashboard/accountant/edit-requests',       label: 'Edit Requests',   icon: '✏️' },
  { href: '/dashboard/accountant/outstanding',         label: 'Outstanding',     icon: '📋' },
  { href: '/dashboard/accountant/transactions',        label: 'Transactions',    icon: '🔄' },
  { href: '/dashboard/accountant/expenses',            label: 'Expenses',        icon: '💸' },
  { href: '/dashboard/accountant/bank-statements',     label: 'Bank Statements', icon: '📑' },
  { href: '/dashboard/accountant/ledger',              label: 'Ledger Report',   icon: '📒' },
  { href: '/dashboard/accountant/chat',                label: 'Team Chat',       icon: '💬' },
];

const linksByRole: Record<string, typeof adminLinks> = { admin: adminLinks, salesperson: salespersonLinks, accountant: accountantLinks };

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || 'salesperson';
  const links = linksByRole[role] || [];

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col">
      <div className="p-5 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐔</span>
          <div>
            <h2 className="text-white font-bold text-sm leading-tight">Nanda Poultry</h2>
            <p className="text-gray-400 text-xs capitalize">{role} Portal</p>
          </div>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl lg:hidden">×</button>}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(link => (
          <Link key={link.href} href={link.href} onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === link.href ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}>
            <span className="text-base">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {session?.user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-gray-400 text-xs truncate capitalize">{role}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full text-center py-2 text-gray-400 hover:text-white text-sm transition-colors hover:bg-gray-800 rounded-lg">Sign Out</button>
      </div>
    </aside>
  );
}
