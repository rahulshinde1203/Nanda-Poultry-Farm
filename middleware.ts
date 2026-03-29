import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (!token) return NextResponse.redirect(new URL('/login', req.url));

    const role = token.role as string;

    // Role-based route protection
    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }
    if (pathname.startsWith('/dashboard/salesperson') && role !== 'salesperson' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }
    if (pathname.startsWith('/dashboard/accountant') && role !== 'accountant' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/api/(?!auth).*'],
};
