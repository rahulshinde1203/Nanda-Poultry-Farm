import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const trader = await prisma.trader.findUnique({ where: { id: parseInt(params.id) } });
  if (!trader) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ trader: { ...trader, _id: String(trader.id) } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { name, email, mobileNumber, panNumber, panCardPhoto, address, isActive } = body;
  const trader = await prisma.trader.update({
    where: { id: parseInt(params.id) },
    data: { ...(name && { name }), ...(email && { email: email.toLowerCase() }),
            ...(mobileNumber && { mobileNumber }),
            ...(panNumber !== undefined && { panNumber }), ...(panCardPhoto !== undefined && { panCardPhoto }),
            ...(address !== undefined && { address }), ...(isActive !== undefined && { isActive }) },
  });
  return NextResponse.json({ trader: { ...trader, _id: String(trader.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  await prisma.trader.update({ where: { id: parseInt(params.id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Trader deactivated' });
}
