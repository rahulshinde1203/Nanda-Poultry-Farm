import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const body = await req.json();
  const { date, expenseType, amount, transactionId, bankAccount, paymentMethod, notes } = body;
  const expense = await prisma.expense.update({
    where: { id: parseInt(params.id) },
    data: { ...(date && { date: new Date(date) }), ...(expenseType && { expenseType }),
            ...(amount !== undefined && { amount: parseFloat(amount) }),
            ...(transactionId !== undefined && { transactionId: transactionId || '' }),
            ...(bankAccount !== undefined && { bankAccountId: bankAccount ? parseInt(bankAccount) : null }),
            ...(paymentMethod && { paymentMethod: paymentMethod as any }),
            ...(notes !== undefined && { notes }) },
  });
  return NextResponse.json({ expense: { ...expense, _id: String(expense.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  await prisma.expense.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ message: 'Deleted' });
}
