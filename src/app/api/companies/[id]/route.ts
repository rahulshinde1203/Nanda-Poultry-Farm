import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

function ser(c: any) { return { ...c, _id: String(c.id), bankAccounts: (c.bankAccounts||[]).map((b: any) => ({ ...b, _id: String(b.id) })) }; }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const company = await prisma.company.findUnique({ where: { id: parseInt(params.id) }, include: { bankAccounts: true } });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ company: ser(company) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { name, email, mobileNumber, panNumber, panCardPhoto, address, upiId, upiQrCode, isActive, bankAccounts } = body;
  const company = await prisma.company.update({
    where: { id: parseInt(params.id) },
    data: { ...(name && { name }), ...(email && { email: email.toLowerCase() }),
            ...(mobileNumber && { mobileNumber }),
            ...(panNumber !== undefined && { panNumber }), ...(panCardPhoto !== undefined && { panCardPhoto }),
            ...(address !== undefined && { address }), ...(upiId !== undefined && { upiId }),
            ...(upiQrCode !== undefined && { upiQrCode }), ...(isActive !== undefined && { isActive }),
            ...(bankAccounts && { bankAccounts: {
              deleteMany: {},
              create: bankAccounts.map(({ id: _id, companyId: _cid, ...rest }: any) => rest),
            }}),
    },
    include: { bankAccounts: true },
  });
  return NextResponse.json({ company: ser(company) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  await prisma.company.update({ where: { id: parseInt(params.id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Company deactivated' });
}
