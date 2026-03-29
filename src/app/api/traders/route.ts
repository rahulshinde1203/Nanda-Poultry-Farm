import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
  const where = includeInactive ? {} : { isActive: true };
  const traders = await prisma.trader.findMany({ where, orderBy: { name: 'asc' } });
  return NextResponse.json({ traders: traders.map((t: any) => ({ ...t, _id: String(t.id) })) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { name, email, mobileNumber, panNumber, panCardPhoto, address } = body;

  if (!name?.trim())           return NextResponse.json({ error: 'Trader name is required' }, { status: 400 });
  if (!email?.trim())          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!mobileNumber?.trim())   return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
  if (!EMAIL_RE.test(email))   return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  if (!/^\d{10}$/.test(mobileNumber))   return NextResponse.json({ error: 'Mobile must be exactly 10 digits' }, { status: 400 });
  if (panNumber && !PAN_RE.test(panNumber.toUpperCase())) return NextResponse.json({ error: 'PAN format must be ABCDE1234F' }, { status: 400 });

  const existing = await prisma.trader.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });

  const trader = await prisma.trader.create({
    data: { name: name.trim(), email: email.toLowerCase(), mobileNumber, whatsappNumber: mobileNumber,
            panNumber: panNumber ? panNumber.toUpperCase() : null, panCardPhoto: panCardPhoto || null,
            address: address?.trim() || null, createdBy: parseInt((session!.user as any).id) },
  });
  return NextResponse.json({ trader: { ...trader, _id: String(trader.id) } }, { status: 201 });
}
