import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;
  const purchase = await prisma.purchase.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      company: { select: { id:true, name:true } },
      trader:  { select: { id:true, name:true } },
      creator: { select: { id:true, name:true } },
    },
  });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ purchase: { ...purchase, _id: String(purchase.id) } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;

  const purchase = await prisma.purchase.findUnique({ where: { id: parseInt(params.id) } });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { date, company, trader, numberOfBirds, totalWeight,
          purchaseRatePerKg, saleRatePerKg, vehicleNumber, notes } = body;

  const nBirds  = numberOfBirds    ? Number(numberOfBirds)    : purchase.numberOfBirds;
  const nWeight = totalWeight      ? Number(totalWeight)      : purchase.totalWeight;
  const pRate   = purchaseRatePerKg ? Number(purchaseRatePerKg) : purchase.purchaseRatePerKg;
  const sRate   = saleRatePerKg    ? Number(saleRatePerKg)    : purchase.saleRatePerKg;

  const avgWeight          = nBirds > 0 ? +(nWeight / nBirds).toFixed(3) : 0;
  const purchaseTotalAmount = +(nWeight * pRate).toFixed(2);
  const saleTotalAmount     = +(nWeight * sRate).toFixed(2);
  const grossProfit         = +(saleTotalAmount - purchaseTotalAmount).toFixed(2);

  const updated = await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      ...(date    && { date: new Date(date) }),
      ...(company && { companyId: parseInt(company) }),
      ...(trader  && { traderId:  parseInt(trader) }),
      numberOfBirds: nBirds, totalWeight: nWeight,
      purchaseRatePerKg: pRate, saleRatePerKg: sRate,
      avgWeight, purchaseTotalAmount, saleTotalAmount, grossProfit,
      outstandingAmount: saleTotalAmount,
      ...(vehicleNumber !== undefined && { vehicleNumber }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      company: { select: { id:true, name:true } },
      trader:  { select: { id:true, name:true } },
    },
  });

  // Adjust outstanding balances (difference only)
  const purchaseDiff = purchaseTotalAmount - purchase.purchaseTotalAmount;
  const saleDiff     = saleTotalAmount     - purchase.saleTotalAmount;
  const companyId = company ? parseInt(company) : purchase.companyId;
  const traderId  = trader  ? parseInt(trader)  : purchase.traderId;

  if (purchaseDiff !== 0)
    await prisma.company.update({ where: { id: companyId }, data: { outstandingBalance: { increment: purchaseDiff } } });
  if (saleDiff !== 0)
    await prisma.trader.update({ where: { id: traderId }, data: { outstandingBalance: { increment: saleDiff } } });

  return NextResponse.json({ purchase: { ...updated, _id: String(updated.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;

  const purchase = await prisma.purchase.findUnique({ where: { id: parseInt(params.id) } });
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Reverse outstanding balances before deleting
  if (purchase.companyId)
    await prisma.company.update({ where: { id: purchase.companyId }, data: { outstandingBalance: { decrement: purchase.purchaseTotalAmount } } });
  if (purchase.traderId)
    await prisma.trader.update({ where: { id: purchase.traderId }, data: { outstandingBalance: { decrement: purchase.saleTotalAmount } } });

  await prisma.purchase.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ message: 'Purchase deleted' });
}
