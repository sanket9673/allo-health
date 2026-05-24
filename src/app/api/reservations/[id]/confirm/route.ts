import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // --- IDEMPOTENCY CHECK ---
    const idempotencyKey = request.headers.get('idempotency-key');
    if (redis && idempotencyKey) {
      const cachedResponse = await redis.get(idempotencyKey);
      if (cachedResponse) return NextResponse.json(cachedResponse, { status: 200 });
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (reservation.status !== 'PENDING') return NextResponse.json({ error: 'Already processed' }, { status: 400 });
    if (new Date() > reservation.expiresAt) return NextResponse.json({ error: 'Reservation expired' }, { status: 410 });

    const result = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      }),
      prisma.stock.update({
        where: {
          productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId },
        },
        data: {
          totalQuantity: { decrement: reservation.quantity },
          reservedQuantity: { decrement: reservation.quantity },
        },
      }),
    ]);

    // --- SAVE TO REDIS ---
    if (redis && idempotencyKey) {
      await redis.set(idempotencyKey, result[0], { ex: 86400 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}
