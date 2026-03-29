import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';
import { notifyUser } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;

  const cursor  = req.nextUrl.searchParams.get('cursor');   // last message id for pagination
  const limit   = parseInt(req.nextUrl.searchParams.get('limit') || '50');
  const since   = req.nextUrl.searchParams.get('since');    // ISO date for polling

  const where: any = { isDeleted: false };
  if (since)  where.createdAt = { gt: new Date(since) };
  if (cursor) where.id = { lt: parseInt(cursor) };

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: since ? 'asc' : 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, name: true, role: true } },
      replyTo: {
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  // Fetch all users for mention resolution
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({
    messages: since ? messages : messages.reverse(),
    users,
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;

  const senderId = parseInt((session!.user as any).id);
  const senderName = (session!.user as any).name as string;
  const { text, replyToId, mentions = [] } = await req.json();

  if (!text?.trim()) return NextResponse.json({ error: 'Message text required' }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: {
      senderId,
      text: text.trim(),
      mentions: JSON.stringify(mentions),
      replyToId: replyToId ? parseInt(replyToId) : null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      replyTo: {
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  // Notify mentioned users
  for (const mentionedId of mentions) {
    if (mentionedId !== senderId) {
      await notifyUser({
        userId: mentionedId,
        type: 'new_transaction', // reuse generic type
        title: `💬 ${senderName} mentioned you`,
        body: text.length > 80 ? text.slice(0, 80) + '…' : text,
        link: '/dashboard/chat',
      });
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
