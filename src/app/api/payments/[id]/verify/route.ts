import { notifyUser, notifyAllAdminsAndAccountants } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(['accountant', 'admin']);
  if (error) return error;

  const body = await req.json();
  const { action, transactionId, bankAccount, paymentMethod, chequeNumber, utrNumber, notes, rejectionReason } = body;

  const payment = await prisma.payment.findUnique({ where: { id: parseInt(params.id) } });
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status !== 'pending') return NextResponse.json({ error: 'Already processed' }, { status: 400 });

  const userId = parseInt((session!.user as any).id);

  if (action === 'verify') {
    if (payment.paymentFor === 'company' && (!transactionId || !paymentMethod))
      return NextResponse.json({ error: 'Transaction ID and payment method required for company verification' }, { status: 400 });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'verified', verifiedById: userId, verifiedAt: new Date(),
        ...(notes && { notes }),
        ...(payment.paymentFor === 'company' && {
          transactionId: transactionId || '',
          paymentMethod: paymentMethod as any,
          bankAccountId: bankAccount ? parseInt(bankAccount) : null,
          chequeNumber: chequeNumber || '',
          utrNumber: utrNumber || '',
        }),
      },
    });

    // ── TRADER PAYMENT ────────────────────────────────────────────────────
    if (payment.paymentFor === 'trader' && payment.traderId) {
      let remaining = payment.amount;

      // Get all purchases for this salesperson + trader, oldest first
      const allPurchases = await prisma.purchase.findMany({
        where: { traderId: payment.traderId, createdBy: payment.createdBy },
        orderBy: { date: 'asc' },
        select: { id: true, outstandingAmount: true },
      });

      for (const purchase of allPurchases) {
        if (remaining <= 0) break;
        // Deduct as much as possible — can go below 0 (credit/advance balance)
        const deduct = Math.min(remaining, purchase.outstandingAmount > 0 ? purchase.outstandingAmount : 0);
        if (deduct > 0) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { outstandingAmount: { decrement: deduct } },
          });
          remaining -= deduct;
        }
      }

      // If remaining > 0 after all purchases exhausted → overpayment/advance
      // Apply excess to the most recent purchase making outstandingAmount negative
      if (remaining > 0 && allPurchases.length > 0) {
        const latestPurchase = allPurchases[allPurchases.length - 1];
        await prisma.purchase.update({
          where: { id: latestPurchase.id },
          data: { outstandingAmount: { decrement: remaining } },
        });
      }

      await prisma.trader.update({
        where: { id: payment.traderId },
        data: { outstandingBalance: { decrement: payment.amount } },
      });
    }

    // ── COMPANY PAYMENT ───────────────────────────────────────────────────
    // Company outstanding is tracked separately (not via outstandingAmount)
    // so we only update the company's outstandingBalance here
    if (payment.paymentFor === 'company' && payment.companyId) {
      await prisma.company.update({
        where: { id: payment.companyId },
        data: { outstandingBalance: { decrement: payment.amount } },
      });
    }

    // Notify the salesperson who created the payment
    if (payment.createdBy) {
      await notifyUser({
        userId: payment.createdBy,
        type: 'payment_verified',
        title: '✅ Payment Verified',
        body: `Your ₹${payment.amount.toLocaleString('en-IN')} payment has been verified.`,
        link: '/dashboard/salesperson/payments',
      });
    }
    return NextResponse.json({ payment: { ...updated, _id: String(updated.id) } });

  } else if (action === 'reject') {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'rejected',
        rejectionReason: rejectionReason || '',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });
    // Notify the salesperson
    if (payment.createdBy) {
      await notifyUser({
        userId: payment.createdBy,
        type: 'payment_rejected',
        title: '❌ Payment Rejected',
        body: `Your ₹${payment.amount.toLocaleString('en-IN')} payment was rejected. ${rejectionReason || ''}`.trim(),
        link: '/dashboard/salesperson/payments',
      });
    }
    return NextResponse.json({ payment: { ...updated, _id: String(updated.id) } });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
