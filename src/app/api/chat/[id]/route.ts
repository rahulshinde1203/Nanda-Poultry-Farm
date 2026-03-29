import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth(['admin', 'accountant', 'salesperson']);
  if (error) return error;

  const userId = parseInt((session!.user as any).id);
  const role   = (session!.user as any).role as string;
  const msgId  = parseInt(params.id);
  const body   = await req.json();

  const message = await prisma.chatMessage.findUnique({ where: { id: msgId } });
  if (!message || message.isDeleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ── REACT ─────────────────────────────────────────────────────────────
  if (body.action === 'react') {
    const { emoji } = body;
    if (!emoji) return NextResponse.json({ error: 'emoji required' }, { status: 400 });

    const reactions = (message.reactions as Record<string, number[]>) || {};
    const current   = reactions[emoji] || [];

    if (current.includes(userId)) {
      // Toggle off
      reactions[emoji] = current.filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...current, userId];
    }

    const updated = await prisma.chatMessage.update({
      where: { id: msgId },
      data: { reactions: JSON.stringify(reactions) },
      include: { sender: { select: { id: true, name: true, role: true } }, replyTo: { include: { sender: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json({ message: updated });
  }

  // ── EDIT ──────────────────────────────────────────────────────────────
  if (body.action === 'edit') {
    if (message.senderId !== userId) return NextResponse.json({ error: 'Can only edit your own messages' }, { status: 403 });
    if (!body.text?.trim()) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    const updated = await prisma.chatMessage.update({
      where: { id: msgId },
      data: { text: body.text.trim(), isEdited: true },
      include: { sender: { select: { id: true, name: true, role: true } }, replyTo: { include: { sender: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json({ message: updated });
  }

  // ── DELETE ────────────────────────────────────────────────────────────
  if (body.action === 'delete') {
    const canDelete = message.senderId === userId || role === 'admin';
    if (!canDelete) return NextResponse.json({ error: 'Cannot delete this message' }, { status: 403 });

    await prisma.chatMessage.update({
      where: { id: msgId },
      data: { isDeleted: true, text: '' },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
