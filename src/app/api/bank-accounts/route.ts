import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function ser(a: any, includeBalance: boolean) {
  const base = {
    _id:               String(a.id),
    bankName:          a.bankName,
    accountHolderName: a.accountHolderName,
    accountNumber:     a.accountNumber,
    ifscCode:          a.ifscCode,
    branchName:        a.branchName,
    upiId:             a.upiId,
    upiQrCode:         a.upiQrCode,
    isActive:          a.isActive,
  };
  if (includeBalance) {
    return { ...base, currentBalance: a.currentBalance };
  }
  return base;
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;
  const role = (session!.user as any).role as string;
  const includeBalance = role !== 'salesperson';
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
  const where = includeInactive ? {} : { isActive: true };
  const accounts = await prisma.bankAccount.findMany({ where, orderBy: { bankName: 'asc' } });
  return NextResponse.json({ accounts: accounts.map(a => ser(a, includeBalance)) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { bankName, accountHolderName, accountNumber, ifscCode, branchName, upiId, upiQrCode, currentBalance } = body;
  if (!bankName || !accountHolderName || !accountNumber || !ifscCode || !branchName)
    return NextResponse.json({ error: 'All required fields must be filled' }, { status: 400 });
  const existing = await prisma.bankAccount.findUnique({ where: { accountNumber } });
  if (existing) return NextResponse.json({ error: 'Account number already exists' }, { status: 409 });
  const account = await prisma.bankAccount.create({
    data: { bankName, accountHolderName, accountNumber, ifscCode: ifscCode.toUpperCase(), branchName,
            upiId: upiId || null, upiQrCode: upiQrCode || null, currentBalance: parseFloat(currentBalance || '0'),
            createdBy: parseInt((session!.user as any).id) },
  });
  return NextResponse.json({ account: ser(account, true) }, { status: 201 });
}
