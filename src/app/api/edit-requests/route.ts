import { notifyAllAdminsAndAccountants } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/middleware';

const FIELD_LABELS: Record<string, string> = {
  date: 'Date', companyId: 'Company', traderId: 'Trader',
  numberOfBirds: 'No. of Birds', totalWeight: 'Total Weight (Kg)',
  purchaseRatePerKg: 'Purchase Rate/Kg', saleRatePerKg: 'Sale Rate/Kg',
  vehicleNumber: 'Vehicle Number', notes: 'Notes',
};

function ser(r: any) {
  return { ...r, _id: String(r.id),
    recordId: r.purchase ? { _id: String(r.purchase.id), ...r.purchase } : String(r.purchaseId),
    requestedBy: r.requester ? { _id: String(r.requester.id), name: r.requester.name, email: r.requester.email } : null,
    reviewedBy: r.reviewer ? { _id: String(r.reviewer.id), name: r.reviewer.name } : null,
  };
}

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth(['admin', 'salesperson', 'accountant']);
  if (error) return error;
  const role   = (session!.user as any).role;
  const userId = parseInt((session!.user as any).id);
  const status = req.nextUrl.searchParams.get('status') as any;

  const where: any = {};
  if (status) where.status = status;
  if (role === 'salesperson') where.requestedBy = userId;

  const requests = await prisma.editRequest.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: {
      purchase: { select: { id:true, date:true, vehicleNumber:true, numberOfBirds:true, totalWeight:true, purchaseTotalAmount:true, saleTotalAmount:true } },
      requester: { select: { id:true, name:true, email:true } },
      reviewer:  { select: { id:true, name:true } },
    },
  });
  return NextResponse.json({ requests: requests.map(ser) });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(['salesperson', 'admin']);
  if (error) return error;
  const body = await req.json();
  const { recordId, requestedData, reason } = body;

  if (!recordId || !requestedData || !reason?.trim())
    return NextResponse.json({ error: 'Record ID, changes, and reason are all required' }, { status: 400 });

  const purchaseId = parseInt(recordId);

  const existing = await prisma.editRequest.findFirst({ where: { purchaseId, status: 'pending' } });
  if (existing) return NextResponse.json({ error: 'A pending edit request already exists for this record.' }, { status: 409 });

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { company: { select: { id:true, name:true } }, trader: { select: { id:true, name:true } } },
  });
  if (!purchase) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

  const trackFields = ['date','companyId','traderId','numberOfBirds','totalWeight','purchaseRatePerKg','saleRatePerKg','vehicleNumber','notes'];
  const changedFields: string[] = [];
  for (const field of trackFields) {
    const orig = field === 'date' ? new Date((purchase as any)[field]).toISOString().split('T')[0] : String((purchase as any)[field] ?? '');
    const req2 = String(requestedData[field] ?? '');
    if (orig !== req2) changedFields.push(FIELD_LABELS[field] || field);
  }
  if (changedFields.length === 0) return NextResponse.json({ error: 'No changes detected' }, { status: 400 });

  const originalSnapshot = {
    date: new Date(purchase.date).toISOString().split('T')[0],
    companyId: purchase.companyId, companyName: purchase.company?.name,
    traderId: purchase.traderId, traderName: purchase.trader?.name,
    numberOfBirds: purchase.numberOfBirds, totalWeight: purchase.totalWeight,
    purchaseRatePerKg: purchase.purchaseRatePerKg, saleRatePerKg: purchase.saleRatePerKg,
    vehicleNumber: purchase.vehicleNumber, notes: purchase.notes,
  };

  const editRequest = await prisma.editRequest.create({
    data: { purchaseId, originalData: originalSnapshot, requestedData,
            changedFields, reason: reason.trim(), requestedBy: parseInt((session!.user as any).id) },
  });
  await notifyAllAdminsAndAccountants({
    type: 'edit_pending',
    title: '✏️ New Edit Request',
    body: `${(session!.user as any).name} submitted a transaction edit request.`,
    link: '/dashboard/accountant/edit-requests',
    excludeUserId: parseInt((session!.user as any).id),
  });
  return NextResponse.json({ editRequest: { ...editRequest, _id: String(editRequest.id) } }, { status: 201 });
}
