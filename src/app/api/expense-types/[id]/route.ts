import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const { name, isActive } = await req.json();
  const type = await prisma.expenseType.update({
    where: { id: parseInt(params.id) },
    data: { ...(name && { name }), ...(isActive !== undefined && { isActive }) },
  });
  return NextResponse.json({ expenseType: { ...type, _id: String(type.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  await prisma.expenseType.update({ where: { id: parseInt(params.id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Deactivated' });
}
