import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiredReservations = await prisma.reservation.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    });

    if (expiredReservations.length === 0) return NextResponse.json({ message: 'Clean' });

    for (const reservation of expiredReservations) {
      await prisma.$transaction([
        prisma.reservation.update({ where: { id: reservation.id }, data: { status: 'RELEASED' } }),
        prisma.stock.update({
          where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
          data: { reservedQuantity: { decrement: reservation.quantity } },
        }),
      ]);
    }
    return NextResponse.json({ message: `Released ${expiredReservations.length}` });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to run cron' }, { status: 500 });
  }
}
