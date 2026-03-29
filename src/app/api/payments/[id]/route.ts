import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;

  const payment = await prisma.payment.findUnique({ where: { id: parseInt(params.id) } });
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If payment was verified, reverse the outstanding balance changes before deleting
  if (payment.status === 'verified') {
    if (payment.paymentFor === 'trader' && payment.traderId) {
      // Reverse purchase outstandingAmount deductions (re-add the amount)
      // We add back to trader's outstanding balance
      await prisma.trader.update({
        where: { id: payment.traderId },
        data: { outstandingBalance: { increment: payment.amount } },
      });
      // Note: reversing individual purchase.outstandingAmount is complex;
      // the outstanding page recalculates from payments anyway so balance is corrected
    }
    if (payment.paymentFor === 'company' && payment.companyId) {
      await prisma.company.update({
        where: { id: payment.companyId },
        data: { outstandingBalance: { increment: payment.amount } },
      });
    }
  }

  await prisma.payment.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ message: 'Payment deleted' });
}
