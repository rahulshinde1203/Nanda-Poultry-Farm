import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth/middleware';

const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const roleFilter = req.nextUrl.searchParams.get('role') as any;
  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    select: {
      id: true, loginId: true, name: true, email: true, mobile: true, aadhaarNumber: true,
      aadhaarPhoto: true, panNumber: true, panPhoto: true, bankName: true,
      accountNumber: true, ifscCode: true, address: true, role: true, isActive: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ users: users.map((u: any) => ({ ...u, _id: String(u.id) })) });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;

  const body = await req.json();
  const { name, email, mobile, aadhaarNumber, aadhaarPhoto, panNumber, panPhoto,
          bankName, accountNumber, ifscCode, address, password, role } = body;

  const missing = ['name','email','mobile','aadhaarNumber','aadhaarPhoto','panNumber','panPhoto','bankName','accountNumber','ifscCode','password','role']
    .filter((f: any) => !body[f]);
  if (missing.length) return NextResponse.json({ error: `Missing fields: ${missing.join(', ')}` }, { status: 400 });
  if (!/^\d{10}$/.test(mobile))       return NextResponse.json({ error: 'Mobile must be exactly 10 digits' }, { status: 400 });
  if (!/^\d{12}$/.test(aadhaarNumber)) return NextResponse.json({ error: 'Aadhaar must be exactly 12 digits' }, { status: 400 });
  if (!PAN_RE.test(panNumber.toUpperCase())) return NextResponse.json({ error: 'PAN must be in format ABCDE1234F' }, { status: 400 });
  if (!PWD_RE.test(password)) return NextResponse.json({ error: 'Password must be 8-16 chars with uppercase, lowercase, number and special char' }, { status: 400 });
  if (!['admin','salesperson','accountant'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  // Auto-generate loginId: role prefix + zero-padded count
  const rolePrefix = role === 'admin' ? 'ADM' : role === 'accountant' ? 'ACC' : 'SLS';
  const count = await prisma.user.count({ where: { role } });
  const generatedLoginId = `${rolePrefix}${String(count + 1).padStart(3, '0')}`;

  const existing = await prisma.user.findFirst({ where: { OR: [{ email: email.toLowerCase() }, { mobile }] } });
  if (existing) {
    if (existing.email === email.toLowerCase()) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Mobile number already exists' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { loginId: generatedLoginId, name, email: email.toLowerCase(), mobile, aadhaarNumber, aadhaarPhoto,
            panNumber: panNumber.toUpperCase(), panPhoto, bankName, accountNumber,
            ifscCode: ifscCode.toUpperCase(), address, password: hash, role },
    select: { id: true, name: true, email: true, role: true, isActive: true, loginId: true },
  });
  return NextResponse.json({ user: { ...user, _id: String(user.id) }, loginId: generatedLoginId }, { status: 201 });
}
