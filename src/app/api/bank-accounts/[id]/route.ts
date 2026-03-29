import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const account = await prisma.bankAccount.update({
    where: { id: parseInt(params.id) },
    data: { ...body, ...(body.ifscCode && { ifscCode: body.ifscCode.toUpperCase() }) },
  });
  return NextResponse.json({ account: { ...account, _id: String(account.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  await prisma.bankAccount.update({ where: { id: parseInt(params.id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Deactivated' });
}
