import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function serP(p: any) {
  return { ...p, _id: String(p.id), date: p.date?.toISOString(),
    company: p.company ? { ...p.company, _id: String(p.company.id) } : null,
    trader:  p.trader  ? { ...p.trader,  _id: String(p.trader.id)  } : null,
    createdBy: p.creator ? { _id: String(p.creator.id), name: p.creator.name } : null };
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const role = (session!.user as any).role;
  const userId = parseInt((session!.user as any).id);
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');

  const where: any = {};
  if (role === 'salesperson') where.createdBy = userId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate + 'T23:59:59');
  }

  const purchases = await prisma.purchase.findMany({
    where, orderBy: { date: 'desc' },
    include: { company: { select: { id:true, name:true, mobileNumber:true } },
               trader:  { select: { id:true, name:true, mobileNumber:true } },
               creator: { select: { id:true, name:true } } },
  });
  return NextResponse.json({ purchases: purchases.map(serP) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson']);
  if (error) return error;
  const body = await req.json();
  const { date, company, trader, numberOfBirds, totalWeight, purchaseRatePerKg, saleRatePerKg, vehicleNumber, notes } = body;

  if (!company || !trader || !numberOfBirds || !totalWeight || !purchaseRatePerKg || !saleRatePerKg)
    return NextResponse.json({ error: 'All required fields must be filled' }, { status: 400 });

  const avgWeight   = numberOfBirds > 0 ? +(totalWeight / numberOfBirds).toFixed(3) : 0;
  const purchaseAmt = +(totalWeight * purchaseRatePerKg).toFixed(2);
  const saleAmt     = +(totalWeight * saleRatePerKg).toFixed(2);
  const grossProfit = +(saleAmt - purchaseAmt).toFixed(2);

  const purchase = await prisma.purchase.create({
    data: { date: date ? new Date(date) : new Date(),
            companyId: parseInt(company), traderId: parseInt(trader),
            numberOfBirds: parseInt(numberOfBirds), totalWeight: parseFloat(totalWeight),
            avgWeight, purchaseRatePerKg: parseFloat(purchaseRatePerKg),
            saleRatePerKg: parseFloat(saleRatePerKg), vehicleNumber: vehicleNumber || '',
            purchaseTotalAmount: purchaseAmt, saleTotalAmount: saleAmt,
            grossProfit, outstandingAmount: saleAmt, notes: notes || '',
            createdBy: parseInt((session!.user as any).id) },
    include: { company: { select: { id:true, name:true } }, trader: { select: { id:true, name:true } } },
  });

  // Update outstanding balances
  await prisma.company.update({ where: { id: parseInt(company) }, data: { outstandingBalance: { increment: purchaseAmt } } });
  await prisma.trader.update({  where: { id: parseInt(trader) },  data: { outstandingBalance: { increment: saleAmt } } });

  return NextResponse.json({ purchase: { ...purchase, _id: String(purchase.id) } }, { status: 201 });
}
