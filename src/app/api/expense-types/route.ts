import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET() {
  const { error } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;
  const types = await prisma.expenseType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ expenseTypes: types.map(t => ({ ...t, _id: String(t.id) })) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'accountant']);
  if (error) return error;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const existing = await prisma.expenseType.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: 'Expense type already exists' }, { status: 409 });
  const type = await prisma.expenseType.create({
    data: { name: name.trim(), createdBy: parseInt((session!.user as any).id) },
  });
  return NextResponse.json({ expenseType: { ...type, _id: String(type.id) } }, { status: 201 });
}
