import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (role === 'admin') redirect('/dashboard/admin');
  if (role === 'accountant') redirect('/dashboard/accountant');
  redirect('/dashboard/salesperson');
}
