import { notifyUser } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(['accountant', 'admin']);
  if (error) return error;

  const { action, reviewNote } = await req.json();
  if (!action || !['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  const editReq = await prisma.editRequest.findUnique({ where: { id: parseInt(params.id) } });
  if (!editReq) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (editReq.status !== 'pending') return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });

  const userId = parseInt((session!.user as any).id);

  const updated = await prisma.editRequest.update({
    where: { id: editReq.id },
    data: { status: action === 'approve' ? 'approved' : 'rejected',
            reviewedById: userId, reviewedAt: new Date(), reviewNote: reviewNote || '' },
  });

  if (action === 'approve') {
    const purchase = await prisma.purchase.findUnique({ where: { id: editReq.purchaseId } });
    if (purchase) {
      const d = editReq.requestedData as any;
      const oldPurchaseTotal = purchase.purchaseTotalAmount;
      const oldSaleTotal     = purchase.saleTotalAmount;

      const nBirds  = d.numberOfBirds    ? Number(d.numberOfBirds)    : purchase.numberOfBirds;
      const nWeight = d.totalWeight      ? Number(d.totalWeight)      : purchase.totalWeight;
      const pRate   = d.purchaseRatePerKg ? Number(d.purchaseRatePerKg) : purchase.purchaseRatePerKg;
      const sRate   = d.saleRatePerKg    ? Number(d.saleRatePerKg)    : purchase.saleRatePerKg;

      const avgWeight          = nBirds > 0 ? +(nWeight / nBirds).toFixed(3) : 0;
      const purchaseTotalAmount = +(nWeight * pRate).toFixed(2);
      const saleTotalAmount     = +(nWeight * sRate).toFixed(2);
      const grossProfit         = +(saleTotalAmount - purchaseTotalAmount).toFixed(2);

      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          ...(d.date && { date: new Date(d.date) }),
          ...(d.companyId && { companyId: parseInt(d.companyId) }),
          ...(d.traderId  && { traderId:  parseInt(d.traderId) }),
          numberOfBirds: nBirds, totalWeight: nWeight,
          purchaseRatePerKg: pRate, saleRatePerKg: sRate,
          avgWeight, purchaseTotalAmount, saleTotalAmount, grossProfit,
          outstandingAmount: saleTotalAmount,
          ...(d.vehicleNumber !== undefined && { vehicleNumber: d.vehicleNumber }),
          ...(d.notes !== undefined && { notes: d.notes }),
        },
      });

      // Adjust outstanding balances (diff only)
      const purchaseDiff = purchaseTotalAmount - oldPurchaseTotal;
      const saleDiff     = saleTotalAmount     - oldSaleTotal;
      const companyId = d.companyId ? parseInt(d.companyId) : purchase.companyId;
      const traderId  = d.traderId  ? parseInt(d.traderId)  : purchase.traderId;

      if (purchaseDiff !== 0)
        await prisma.company.update({ where: { id: companyId }, data: { outstandingBalance: { increment: purchaseDiff } } });
      if (saleDiff !== 0)
        await prisma.trader.update({ where: { id: traderId }, data: { outstandingBalance: { increment: saleDiff } } });
    }
  }

  // Notify the requester
  await notifyUser({
    userId: editReq.requestedBy,
    type: action === 'approve' ? 'edit_approved' : 'edit_rejected',
    title: action === 'approve' ? '✅ Edit Request Approved' : '❌ Edit Request Rejected',
    body: action === 'approve'
      ? 'Your transaction edit request has been approved.'
      : `Your edit request was rejected. ${reviewNote || ''}`.trim(),
    link: '/dashboard/salesperson/transactions',
  });
  return NextResponse.json({ editRequest: { ...updated, _id: String(updated.id) } });
}
