import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function serPm(p: any) {
  return { ...p, _id: String(p.id), date: p.date?.toISOString(),
    trader:      p.trader      ? { ...p.trader,      _id: String(p.trader.id) }      : null,
    company:     p.company     ? { ...p.company,     _id: String(p.company.id) }     : null,
    bankAccount: p.bankAccount ? { ...p.bankAccount, _id: String(p.bankAccount.id) } : null,
    createdBy:   p.creator     ? { _id: String(p.creator.id), name: p.creator.name } : null,
    verifiedBy:  p.verifiedBy  ? { _id: String(p.verifiedBy.id), name: p.verifiedBy.name } : null };
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const role = (session!.user as any).role;
  const userId = parseInt((session!.user as any).id);
  const sp = req.nextUrl.searchParams;
  const status   = sp.get('status')     as any;
  const paymentFor = sp.get('paymentFor') as any;

  const where: any = {};
  if (status)      where.status     = status;
  if (paymentFor)  where.paymentFor = paymentFor;
  if (role === 'salesperson') where.createdBy = userId;

  const payments = await prisma.payment.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { trader: { select: { id:true, name:true, mobileNumber:true } },
               company: { select: { id:true, name:true, mobileNumber:true } },
               bankAccount: { select: { id:true, bankName:true, accountNumber:true } },
               creator: { select: { id:true, name:true } },
               verifiedBy: { select: { id:true, name:true } } },
  });
  return NextResponse.json({ payments: payments.map(serPm) });
}

const NEEDS_UTR = ['UPI', 'NEFT', 'RTGS', 'IMPS'];

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson']);
  if (error) return error;
  const body = await req.json();
  const { paymentFor = 'trader', trader, company, amount,
          paymentMethod, bankAccount, chequeNumber, utrNumber, date, notes } = body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return NextResponse.json({ error: 'Amount is required and must be positive' }, { status: 400 });
  if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  if (paymentFor === 'trader'  && !trader)  return NextResponse.json({ error: 'Trader is required' }, { status: 400 });
  if (paymentFor === 'company' && !company) return NextResponse.json({ error: 'Company is required' }, { status: 400 });

  const role = (session!.user as any).role;

  // Salesperson company payment — minimal fields
  if (paymentFor === 'company' && role === 'salesperson') {
    const payment = await prisma.payment.create({
      data: { date: new Date(date), paymentFor: 'company', companyId: parseInt(company),
              amount: parseFloat(amount), notes: notes || '', status: 'pending',
              createdBy: parseInt((session!.user as any).id) },
    });
    return NextResponse.json({ payment: { ...payment, _id: String(payment.id) } }, { status: 201 });
  }

  if (!paymentMethod) return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
  const validMethods = ['UPI','NEFT','RTGS','IMPS','Cheque'];
  if (!validMethods.includes(paymentMethod)) return NextResponse.json({ error: `Payment method must be one of: ${validMethods.join(', ')}` }, { status: 400 });
  if (NEEDS_UTR.includes(paymentMethod) && !utrNumber?.trim())
    return NextResponse.json({ error: `Transaction ID / UTR is required for ${paymentMethod}` }, { status: 400 });
  if (paymentMethod === 'Cheque' && !chequeNumber?.trim())
    return NextResponse.json({ error: 'Cheque number is required for Cheque payments' }, { status: 400 });

  const payment = await prisma.payment.create({
    data: { date: new Date(date), paymentFor: paymentFor as any,
            traderId: paymentFor === 'trader' ? parseInt(trader) : null,
            companyId: paymentFor === 'company' ? parseInt(company) : null,
            amount: parseFloat(amount), paymentMethod: paymentMethod as any,
            bankAccountId: bankAccount ? parseInt(bankAccount) : null,
            chequeNumber: chequeNumber?.trim() || '', utrNumber: utrNumber?.trim() || '',
            notes: notes || '', status: 'pending',
            createdBy: parseInt((session!.user as any).id) },
  });
  return NextResponse.json({ payment: { ...payment, _id: String(payment.id) } }, { status: 201 });
}
