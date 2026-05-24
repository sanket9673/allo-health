import { PrismaClient } from '@prisma/client';

import * as dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const w1 = await prisma.warehouse.create({
    data: { name: 'East Coast Hub', location: 'New York, NY' },
  });
  const w2 = await prisma.warehouse.create({
    data: { name: 'West Coast Hub', location: 'Los Angeles, CA' },
  });

  const products = await Promise.all([
    prisma.product.create({ data: { name: 'Ergonomic Chair', sku: 'FURN-CHR-01', price: 199.99 } }),
    prisma.product.create({ data: { name: 'Mechanical Keyboard', sku: 'TECH-KB-02', price: 129.50 } }),
    prisma.product.create({ data: { name: 'Wireless Mouse', sku: 'TECH-MS-03', price: 79.99 } }),
  ]);

  for (const product of products) {
    await prisma.stock.create({
      data: {
        productId: product.id,
        warehouseId: w1.id,
        totalQuantity: Math.floor(Math.random() * 50) + 10,
        reservedQuantity: 0,
      },
    });
    await prisma.stock.create({
      data: {
        productId: product.id,
        warehouseId: w2.id,
        totalQuantity: Math.floor(Math.random() * 30) + 5,
        reservedQuantity: 0,
      },
    });
  }
  console.log('Seeding complete! ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
