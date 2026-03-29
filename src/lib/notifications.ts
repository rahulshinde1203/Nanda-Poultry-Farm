import prisma from '@/lib/db/prisma';

type NotifType =
  | 'payment_verified'
  | 'payment_rejected'
  | 'payment_pending'
  | 'edit_approved'
  | 'edit_rejected'
  | 'edit_pending'
  | 'new_transaction';

export async function createNotification({
  userId,
  type,
  title,
  body,
  link = '',
}: {
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, link },
    });
  } catch { /* non-blocking */ }
}

export async function notifyAllAdminsAndAccountants({
  type,
  title,
  body,
  link = '',
  excludeUserId,
}: {
  type: NotifType;
  title: string;
  body: string;
  link?: string;
  excludeUserId?: number;
}) {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['admin', 'accountant'] },
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, type, title, body, link })),
    });
  } catch { /* non-blocking */ }
}

export async function notifyUser({
  userId,
  type,
  title,
  body,
  link = '',
}: {
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
}) {
  return createNotification({ userId, type, title, body, link });
}
