import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function dayBounds(d: string) {
  const dt = new Date(d);
  return {
    gte: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0),
    lte: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999),
  };
}
function monthBounds(m: number, y: number) {
  return { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59, 999) };
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;

  const userId = parseInt((session!.user as any).id);
  const role   = (session!.user as any).role;
  const isSP   = role === 'salesperson';

  const sp            = req.nextUrl.searchParams;
  const filterType    = sp.get('filter')  || 'all';
  const date          = sp.get('date')    || '';
  const month         = parseInt(sp.get('month') || '0');
  const year          = parseInt(sp.get('year')  || '0');
  const start         = sp.get('start')   || '';
  const end           = sp.get('end')     || '';
  const salespersonId = sp.get('salespersonId') ? parseInt(sp.get('salespersonId')!) : null;
  const traderId      = sp.get('traderId')  ? parseInt(sp.get('traderId')!)  : null;
  const companyId     = sp.get('companyId') ? parseInt(sp.get('companyId')!) : null;

  // ── Date filter ──────────────────────────────────────────────────────────
  let dateWhere: any = undefined;
  if (filterType === 'day' && date)             dateWhere = dayBounds(date);
  else if (filterType === 'month' && month && year) dateWhere = monthBounds(month, year);
  else if (filterType === 'range' && start && end)  dateWhere = { gte: dayBounds(start).gte, lte: dayBounds(end).lte };

  // ── Salesperson scoping ──────────────────────────────────────────────────
  const createdByFilter = isSP ? userId : (salespersonId || undefined);

  // ── Purchases ────────────────────────────────────────────────────────────
  const purchaseWhere: any = {};
  if (dateWhere)        purchaseWhere.date      = dateWhere;
  if (createdByFilter)  purchaseWhere.createdBy = createdByFilter;
  if (traderId)         purchaseWhere.traderId  = traderId;
  if (companyId)        purchaseWhere.companyId = companyId;

  const purchases = await prisma.purchase.findMany({
    where: purchaseWhere,
    orderBy: { date: 'desc' },
    include: {
      company: { select: { id: true, name: true, mobileNumber: true } },
      trader:  { select: { id: true, name: true, mobileNumber: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  // ── Confirmed payments ───────────────────────────────────────────────────
  const paymentWhere: any = { status: 'verified' };
  if (createdByFilter)  paymentWhere.createdBy = createdByFilter;
  if (traderId)         paymentWhere.traderId  = traderId;
  if (companyId)        paymentWhere.companyId = companyId;
  if (dateWhere)        paymentWhere.date      = dateWhere;

  const confirmedPayments = await prisma.payment.findMany({
    where: paymentWhere,
    select: { id: true, paymentFor: true, traderId: true, companyId: true, amount: true },
  });

  // ════════════════════════════════════════════════════════════
  // TRADER MAP — uses purchase.outstandingAmount (sale side)
  //   Net = SUM(saleTotalAmount) - SUM(confirmedPayments)
  //   Can go negative = credit balance
  // ════════════════════════════════════════════════════════════
  type PartyBalance = {
    invoiceTotal:      number;
    outstandingNet:    number;
    confirmedPayments: number;
    purchaseCount:     number;
  };

  const emptyBal = (): PartyBalance => ({
    invoiceTotal: 0, outstandingNet: 0, confirmedPayments: 0, purchaseCount: 0,
  });

  const traderMap: Record<number, PartyBalance> = {};

  for (const p of purchases) {
    if (p.traderId) {
      if (!traderMap[p.traderId]) traderMap[p.traderId] = emptyBal();
      traderMap[p.traderId].invoiceTotal += p.saleTotalAmount || 0;
      traderMap[p.traderId].purchaseCount += 1;
    }
  }

  for (const pay of confirmedPayments) {
    if (pay.paymentFor === 'trader' && pay.traderId) {
      if (!traderMap[pay.traderId]) traderMap[pay.traderId] = emptyBal();
      traderMap[pay.traderId].confirmedPayments += pay.amount;
    }
  }

  for (const id of Object.keys(traderMap)) {
    const bal = traderMap[Number(id)];
    bal.outstandingNet = bal.invoiceTotal - bal.confirmedPayments;
  }

  // ════════════════════════════════════════════════════════════
  // COMPANY MAP — purchase side
  //   Net = SUM(purchaseTotalAmount) - SUM(confirmedPayments)
  //   Can go negative = credit balance
  // ════════════════════════════════════════════════════════════
  const companyMap: Record<number, PartyBalance> = {};

  for (const p of purchases) {
    if (p.companyId) {
      if (!companyMap[p.companyId]) companyMap[p.companyId] = emptyBal();
      companyMap[p.companyId].invoiceTotal += p.purchaseTotalAmount || 0;
      companyMap[p.companyId].purchaseCount += 1;
    }
  }

  for (const pay of confirmedPayments) {
    if (pay.paymentFor === 'company' && pay.companyId) {
      if (!companyMap[pay.companyId]) companyMap[pay.companyId] = emptyBal();
      companyMap[pay.companyId].confirmedPayments += pay.amount;
    }
  }

  for (const id of Object.keys(companyMap)) {
    const bal = companyMap[Number(id)];
    bal.outstandingNet = bal.invoiceTotal - bal.confirmedPayments;
  }

  // ── Build party lists ────────────────────────────────────────────────────
  function balanceStatus(net: number): 'outstanding' | 'settled' | 'advance' {
    if (net > 0.01)  return 'outstanding';
    if (net < -0.01) return 'advance';
    return 'settled';
  }

  const traderIds  = Object.keys(traderMap).map(Number);
  const companyIds = Object.keys(companyMap).map(Number);

  const [traderDetails, companyDetails] = await Promise.all([
    traderIds.length ? prisma.trader.findMany({
      where: { id: { in: traderIds } },
      select: { id: true, name: true, mobileNumber: true },
    }) : [],
    companyIds.length ? prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, mobileNumber: true },
    }) : [],
  ]);

  const tradersOut = (traderDetails as any[]).map(t => {
    const bal = traderMap[t.id] || emptyBal();
    return {
      _id: String(t.id), name: t.name, mobileNumber: t.mobileNumber,
      invoiceTotal:      +bal.invoiceTotal.toFixed(2),
      outstandingNet:    +bal.outstandingNet.toFixed(2),
      confirmedPayments: +bal.confirmedPayments.toFixed(2),
      purchaseCount:     bal.purchaseCount,
      status:            balanceStatus(bal.outstandingNet),
    };
  });

  const companiesOut = (companyDetails as any[]).map(c => {
    const bal = companyMap[c.id] || emptyBal();
    return {
      _id: String(c.id), name: c.name, mobileNumber: c.mobileNumber,
      invoiceTotal:      +bal.invoiceTotal.toFixed(2),
      outstandingNet:    +bal.outstandingNet.toFixed(2),
      confirmedPayments: +bal.confirmedPayments.toFixed(2),
      purchaseCount:     bal.purchaseCount,
      status:            balanceStatus(bal.outstandingNet),
    };
  });

  // ── Dropdown data ────────────────────────────────────────────────────────
  const [salespersons, allTraders, allCompanies] = await Promise.all([
    isSP ? [] : prisma.user.findMany({
      where: { role: 'salesperson', isActive: true },
      select: { id: true, name: true }, orderBy: { name: 'asc' },
    }),
    isSP
      ? prisma.trader.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : prisma.trader.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    isSP
      ? prisma.company.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const serP = (p: any) => ({
    ...p, _id: String(p.id), date: p.date?.toISOString(),
    company:   p.company ? { ...p.company,  _id: String(p.company.id)  } : null,
    trader:    p.trader  ? { ...p.trader,   _id: String(p.trader.id)   } : null,
    createdBy: p.creator ? { _id: String(p.creator.id), name: p.creator.name } : null,
  });

  return NextResponse.json({
    traders:      tradersOut,
    companies:    companiesOut,
    purchases:    purchases.map(serP),
    role,
    totals: {
      traderOutstanding:  +tradersOut.reduce((s, t) => s + t.outstandingNet, 0).toFixed(2),
      companyOutstanding: +companiesOut.reduce((s, c) => s + c.outstandingNet, 0).toFixed(2),
    },
    salespersons: salespersons.map((s: any) => ({ ...s, _id: String(s.id) })),
    allTraders:   allTraders.map((t: any)   => ({ ...t, _id: String(t.id) })),
    allCompanies: allCompanies.map((c: any) => ({ ...c, _id: String(c.id) })),
    activeFilters: { filterType, salespersonId, traderId, companyId },
  });
}
