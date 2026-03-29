import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function ser(e: any) {
  return { ...e, _id: String(e.id), date: e.date?.toISOString(),
    createdBy: e.creator ? { _id: String(e.creator.id), name: e.creator.name } : null,
    bankAccount: e.bankAccount ? { ...e.bankAccount, _id: String(e.bankAccount.id) } : null };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate   = sp.get('endDate');
  const where: any = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate + 'T23:59:59');
  }
  const expenses = await prisma.expense.findMany({
    where, orderBy: { date: 'desc' },
    include: { creator: { select: { id:true, name:true } }, bankAccount: { select: { id:true, bankName:true, accountNumber:true } } },
  });
  return NextResponse.json({ expenses: expenses.map(ser) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const body = await req.json();
  const { date, expenseType, amount, transactionId, bankAccount, paymentMethod, notes } = body;
  if (!expenseType || !amount || !paymentMethod)
    return NextResponse.json({ error: 'Expense type, amount and payment method are required' }, { status: 400 });
  if (!bankAccount)
    return NextResponse.json({ error: 'Bank account is required' }, { status: 400 });
  const expense = await prisma.expense.create({
    data: { date: date ? new Date(date) : new Date(), expenseType, amount: parseFloat(amount),
            transactionId: transactionId || '', bankAccountId: bankAccount ? parseInt(bankAccount) : null,
            paymentMethod: paymentMethod as any, notes: notes || '',
            createdBy: parseInt((session!.user as any).id) },
    include: { creator: { select: { id:true, name:true } }, bankAccount: true },
  });
  return NextResponse.json({ expense: ser(expense) }, { status: 201 });
}
