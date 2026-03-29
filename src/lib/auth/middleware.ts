import { getServerSession } from 'next-auth';
import { authOptions } from './nextauth';
import { NextResponse } from 'next/server';

export async function requireAuth(allowedRoles?: string[]) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  }
  
  const userRole = (session.user as any).role;
  
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  
  return { error: null, session };
}
