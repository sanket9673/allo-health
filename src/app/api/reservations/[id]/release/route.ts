import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation || reservation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invalid or already processed' }, { status: 400 });
    }

    const result = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
      }),
      prisma.stock.update({
        where: {
          productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId },
        },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      }),
    ]);

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to release' }, { status: 500 });
  }
}
