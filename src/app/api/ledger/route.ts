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

function buildDate(sp: URLSearchParams) {
  const period = sp.get('period') || 'all';
  const date   = sp.get('date')  || '';
  const month  = parseInt(sp.get('month') || '0');
  const year   = parseInt(sp.get('year')  || '0');
  const start  = sp.get('start') || '';
  const end    = sp.get('end')   || '';
  if (period === 'day'   && date)           return dayBounds(date);
  if (period === 'month' && month && year)  return { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) };
  if (period === 'range' && start && end)   return { gte: dayBounds(start).gte, lte: dayBounds(end).lte };
  return undefined; // 'all' = no filter
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;

  const role   = (session!.user as any).role as string;
  const userId = parseInt((session!.user as any).id);
  const isSP   = role === 'salesperson';

  const sp          = req.nextUrl.searchParams;
  const partyType   = sp.get('partyType') || 'trader'; // 'trader' | 'company'
  const partyId     = sp.get('partyId') ? parseInt(sp.get('partyId')!) : null;
  const dateWhere   = buildDate(sp);

  if (!partyId) {
    // Return only dropdown lists (used by LedgerView to populate selects)
    const [traders, companies] = await Promise.all([
      isSP
        ? prisma.trader.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
        : prisma.trader.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      isSP
        ? prisma.company.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
        : prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return NextResponse.json({
      rows: [], partyName: '', partyType, finalBalance: 0,
      traders:   traders.map((t: any) => ({ _id: String(t.id), name: t.name })),
      companies: companies.map((c: any) => ({ _id: String(c.id), name: c.name })),
      role,
    });
  }

  // ── 1. Fetch purchases ────────────────────────────────────────────────────
  const purchaseWhere: any = { date: dateWhere ? dateWhere : undefined };
  if (!purchaseWhere.date) delete purchaseWhere.date;
  if (isSP) purchaseWhere.createdBy = userId;
  if (partyType === 'trader')  purchaseWhere.traderId  = partyId;
  if (partyType === 'company') purchaseWhere.companyId = partyId;

  const purchases = await prisma.purchase.findMany({
    where: purchaseWhere,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { creator: { select: { name: true } } },
  });

  // ── 2. Fetch verified payments ────────────────────────────────────────────
  const paymentWhere: any = { status: 'verified' };
  if (dateWhere) paymentWhere.date = dateWhere;
  if (isSP) paymentWhere.createdBy = userId;
  if (partyType === 'trader')  { paymentWhere.paymentFor = 'trader';  paymentWhere.traderId  = partyId; }
  if (partyType === 'company') { paymentWhere.paymentFor = 'company'; paymentWhere.companyId = partyId; }

  const payments = await prisma.payment.findMany({
    where: paymentWhere,
    orderBy: [{ date: 'asc' }, { verifiedAt: 'asc' }],
  });

  // ── 3. Build ledger entries ───────────────────────────────────────────────
  type LedgerRow = {
    rowType:       'txn' | 'payment';
    date:          string;         // ISO
    sortKey:       number;         // timestamp for stable sort

    // Transaction fields (txn rows only)
    vehicleNumber:   string;
    numberOfBirds:   number | null;
    totalWeight:     number | null;
    avgWeight:       number | null;
    rate:            number | null; // saleRatePerKg for trader, purchaseRatePerKg for company
    totalAmount:     number | null; // saleTotalAmount for trader, purchaseTotalAmount for company

    // Payment fields (payment rows only)
    creditDebitAmt:  number | null; // credit for trader, debit for company
    paymentMethod:   string;
    transactionId:   string;

    // Running balance
    balanceDelta:    number;        // + increases outstanding, - decreases it
    closingBalance:  number;        // calculated below
  };

  const rows: LedgerRow[] = [];

  for (const p of purchases) {
    const amount = partyType === 'trader'
      ? (p.saleTotalAmount || 0)
      : (p.purchaseTotalAmount || 0);
    const rate = partyType === 'trader'
      ? (p.saleRatePerKg || 0)
      : (p.purchaseRatePerKg || 0);

    rows.push({
      rowType: 'txn',
      date: p.date.toISOString(),
      sortKey: p.date.getTime() * 1000 + p.createdAt.getTime() % 1000,
      vehicleNumber: p.vehicleNumber || '',
      numberOfBirds: p.numberOfBirds,
      totalWeight:   +p.totalWeight.toFixed(3),
      avgWeight:     p.numberOfBirds > 0 ? +(p.totalWeight / p.numberOfBirds).toFixed(3) : 0,
      rate,
      totalAmount:   +amount.toFixed(2),
      creditDebitAmt: null,
      paymentMethod:  '',
      transactionId:  '',
      balanceDelta: +amount.toFixed(2),  // purchase/sale increases outstanding
      closingBalance: 0, // calculated below
    });
  }

  for (const p of payments) {
    const txnId = p.utrNumber || p.chequeNumber || p.transactionId || '';
    rows.push({
      rowType: 'payment',
      date: p.date.toISOString(),
      sortKey: p.date.getTime() * 1000 + (p.verifiedAt?.getTime() || p.createdAt.getTime()) % 1000,
      vehicleNumber: '',
      numberOfBirds: null,
      totalWeight:   null,
      avgWeight:     null,
      rate:          null,
      totalAmount:   null,
      creditDebitAmt: +(p.amount || 0).toFixed(2),
      paymentMethod:  (p as any).paymentMethod || '',
      transactionId:  txnId,
      balanceDelta: -+(p.amount || 0).toFixed(2), // payment reduces outstanding
      closingBalance: 0,
    });
  }

  // ── 4. Sort chronologically ───────────────────────────────────────────────
  rows.sort((a, b) => a.sortKey - b.sortKey);

  // ── 5. Running closing balance ────────────────────────────────────────────
  let balance = 0;
  for (const row of rows) {
    balance += row.balanceDelta;
    row.closingBalance = +balance.toFixed(2);
  }

  // ── 6. Party name ─────────────────────────────────────────────────────────
  let partyName = '';
  if (partyType === 'trader') {
    const t = await prisma.trader.findUnique({ where: { id: partyId }, select: { name: true } });
    partyName = t?.name || '';
  } else {
    const c = await prisma.company.findUnique({ where: { id: partyId }, select: { name: true } });
    partyName = c?.name || '';
  }

  // ── 7. Dropdown lists ─────────────────────────────────────────────────────
  const [traders, companies] = await Promise.all([
    isSP
      ? prisma.trader.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : prisma.trader.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    isSP
      ? prisma.company.findMany({ where: { isActive: true, purchases: { some: { createdBy: userId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return NextResponse.json({
    rows,
    partyName,
    partyType,
    finalBalance: rows.length > 0 ? rows[rows.length - 1].closingBalance : 0,
    traders:   traders.map((t: any) => ({ _id: String(t.id), name: t.name })),
    companies: companies.map((c: any) => ({ _id: String(c.id), name: c.name })),
    role,
  });
}
