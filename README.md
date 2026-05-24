# Allo Engineering – Inventory Reservation System

This is a full-stack Next.js application built to solve the high-concurrency inventory reservation problem for D2C brands.

## 🚀 Live Demo
**URL:** [INSERT YOUR VERCEL URL HERE]

## 🧠 Core Problem Solved: Concurrency & Race Conditions
The primary challenge of this exercise is ensuring that thousands of simultaneous users cannot overdraw inventory. 

Instead of relying on application-level or distributed locks (which introduce latency and complexity), I utilized **Atomic Database Updates**.
In `POST /api/reservations`, I execute a raw Postgres query:
```sql
UPDATE "Stock"
SET "reservedQuantity" = "reservedQuantity" + ${quantity}
WHERE "totalQuantity" - "reservedQuantity" >= ${quantity}
```
Because PostgreSQL evaluates the WHERE clause dynamically at the moment the row is locked for the update, this guarantees mathematically that stock can never be over-reserved, rendering the application completely race-condition-free.

⏱️ Reservation Expiry Mechanism
To prevent abandoned carts from permanently locking up inventory, reservations are valid for 10 minutes.
Production Implementation: A Vercel Cron Job (vercel.json) is configured to run every 1 minute.
It triggers a secure GET request to /api/cron/release-expired.
The endpoint queries for all PENDING reservations where expiresAt < NOW().
It utilizes a Prisma Transaction to safely mark them as RELEASED and decrement the reservedQuantity, returning the stock to the available pool.

🔁 Bonus: Idempotency
To prevent duplicate reservations and network retries from causing double charges or double reservations, Upstash Redis is implemented.
The frontend generates a crypto.randomUUID() on Checkout/Reserve attempts and passes it via the Idempotency-Key header.
The API checks Redis (SET key response NX EX 86400). If a previous response exists for that key, it short-circuits and returns the cached HTTP response, skipping the database mutation entirely.

🛠️ How to run locally
1. Clone and install dependencies:
```bash
npm install
```

2. Environment Variables:
Create a .env file in the root directory:
```env
DATABASE_URL="your_supabase_pooled_url"
DIRECT_URL="your_supabase_direct_url"
UPSTASH_REDIS_REST_URL="your_upstash_url"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"
CRON_SECRET="local-dev-secret"
```

3. Database Setup & Seed:
Run the following to push the schema and seed the database with Warehouses, Products, and Stock:
```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

4. Start the server:
```bash
npm run dev
```

⚖️ Trade-offs & Future Improvements
If I had more time, I would consider the following:
Websockets / Server-Sent Events: Currently, stock levels on the frontend require a manual page reload to update (unless you click reserve). I would implement Supabase Realtime so the frontend stock numbers tick down live as other users reserve items.
Cron Job Scale: Running a cron job every 1 minute works for this scale. However, at a massive scale, scanning the whole table for expired items could become slow. I would consider moving to an event-driven architecture (e.g., AWS EventBridge or a Redis TTL expiry event) to precisely trigger releases.
