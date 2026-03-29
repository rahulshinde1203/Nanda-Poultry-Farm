import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeCompany(c: any) {
  return { ...c, _id: String(c.id), bankAccounts: (c.bankAccounts||[]).map((b: any) => ({ ...b, _id: String(b.id) })) };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
  const where = includeInactive ? {} : { isActive: true };
  const companies = await prisma.company.findMany({
    where, orderBy: { name: 'asc' },
    include: { bankAccounts: true },
  });
  return NextResponse.json({ companies: companies.map(serializeCompany) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { name, email, mobileNumber, bankAccounts,
          panNumber, panCardPhoto, address, upiId, upiQrCode } = body;

  if (!name?.trim())           return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  if (!email?.trim())          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!mobileNumber?.trim())   return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
  if (!bankAccounts?.length)   return NextResponse.json({ error: 'At least one bank account is required' }, { status: 400 });
  if (!EMAIL_RE.test(email))   return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  if (!/^\d{10}$/.test(mobileNumber))   return NextResponse.json({ error: 'Mobile must be exactly 10 digits' }, { status: 400 });
  if (panNumber && !PAN_RE.test(panNumber.toUpperCase())) return NextResponse.json({ error: 'PAN format must be ABCDE1234F' }, { status: 400 });

  for (let i = 0; i < bankAccounts.length; i++) {
    const b = bankAccounts[i];
    if (!b.bankName?.trim() || !b.accountHolderName?.trim() || !b.accountNumber?.trim() || !b.ifscCode?.trim() || !b.branchName?.trim())
      return NextResponse.json({ error: `Bank account ${i+1}: all fields are required` }, { status: 400 });
    bankAccounts[i].ifscCode = b.ifscCode.toUpperCase();
  }

  const existing = await prisma.company.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });

  const company = await prisma.company.create({
    data: { name: name.trim(), email: email.toLowerCase(), mobileNumber,
            whatsappNumber: mobileNumber,
            panNumber: panNumber ? panNumber.toUpperCase() : null, panCardPhoto: panCardPhoto || null,
            address: address || null, upiId: upiId || null, upiQrCode: upiQrCode || null,
            createdBy: parseInt((session!.user as any).id),
            bankAccounts: { create: bankAccounts } },
    include: { bankAccounts: true },
  });
  return NextResponse.json({ company: serializeCompany(company) }, { status: 201 });
}
