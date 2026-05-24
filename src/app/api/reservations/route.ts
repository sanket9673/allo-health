import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { redis } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, warehouseId, quantity } = body;

    // --- IDEMPOTENCY CHECK ---
    const idempotencyKey = request.headers.get('idempotency-key');
    if (redis && idempotencyKey) {
      // Check if we already processed this request
      const cachedResponse = await redis.get(idempotencyKey);
      if (cachedResponse) {
        console.log("Returning cached response for idempotency key:", idempotencyKey);
        return NextResponse.json(cachedResponse, { status: 200 });
      }
    }

    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // --- CONCURRENCY FIX (ATOMIC UPDATE) ---
    const updatedRows = await prisma.$executeRaw`
      UPDATE "Stock"
      SET "reservedQuantity" = "reservedQuantity" + ${quantity},
          "updatedAt" = NOW()
      WHERE "productId" = ${productId} 
        AND "warehouseId" = ${warehouseId}
        AND ("totalQuantity" - "reservedQuantity") >= ${quantity}
    `;

    if (updatedRows === 0) {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 });
    }

    // Create reservation record
    const expiresAt = addMinutes(new Date(), 10);
    const reservation = await prisma.reservation.create({
      data: { productId, warehouseId, quantity, expiresAt, status: 'PENDING' },
    });

    // --- SAVE SUCCESSFUL RESPONSE TO REDIS ---
    if (redis && idempotencyKey) {
      // Store the result for 24 hours (86400 seconds)
      await redis.set(idempotencyKey, reservation, { ex: 86400 });
    }

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('Reservation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
