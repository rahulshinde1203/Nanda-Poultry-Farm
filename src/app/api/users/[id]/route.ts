import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  const user = await prisma.user.findUnique({
    where: { id: parseInt(params.id) },
    select: { id:true,name:true,email:true,mobile:true,aadhaarNumber:true,aadhaarPhoto:true,
              panNumber:true,panPhoto:true,bankName:true,accountNumber:true,ifscCode:true,
              address:true,role:true,isActive:true,createdAt:true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ user: { ...user, _id: String(user.id) } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  const body = await req.json();
  const { name, mobile, aadhaarNumber, aadhaarPhoto, panNumber, panPhoto,
          bankName, accountNumber, ifscCode, address, role, isActive, password } = body;
  const data: any = {};
  if (name)          data.name = name;
  if (mobile)        data.mobile = mobile;
  if (aadhaarNumber) data.aadhaarNumber = aadhaarNumber;
  if (aadhaarPhoto)  data.aadhaarPhoto = aadhaarPhoto;
  if (panNumber)     data.panNumber = panNumber.toUpperCase();
  if (panPhoto)      data.panPhoto = panPhoto;
  if (bankName)      data.bankName = bankName;
  if (accountNumber) data.accountNumber = accountNumber;
  if (ifscCode)      data.ifscCode = ifscCode.toUpperCase();
  if (address !== undefined) data.address = address;
  if (role)          data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (password)      data.password = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: parseInt(params.id) },
    data,
    select: { id:true, name:true, email:true, role:true, isActive:true },
  });
  return NextResponse.json({ user: { ...user, _id: String(user.id) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth(['admin']);
  if (error) return error;
  await prisma.user.update({ where: { id: parseInt(params.id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'User deactivated' });
}
