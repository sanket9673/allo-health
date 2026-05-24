import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, warehouseId, quantity } = body;

    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // --- CONCURRENCY FIX ---
    // Atomic update: only increments reserved quantity if there is enough unreserved stock
    const updatedRows = await prisma.$executeRaw`
      UPDATE "Stock"
      SET "reservedQuantity" = "reservedQuantity" + ${quantity},
          "updatedAt" = NOW()
      WHERE "productId" = ${productId} 
        AND "warehouseId" = ${warehouseId}
        AND ("totalQuantity" - "reservedQuantity") >= ${quantity}
    `;

    // If 0 rows updated, it means stock wasn't available (Condition failed)
    if (updatedRows === 0) {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 });
    }

    // Create reservation record valid for 10 minutes
    const expiresAt = addMinutes(new Date(), 10);
    const reservation = await prisma.reservation.create({
      data: {
        productId,
        warehouseId,
        quantity,
        expiresAt,
        status: 'PENDING',
      },
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('Reservation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
