# Allo Engineering – High-Concurrency Inventory Reservation System

This is a full-stack Next.js application built to solve the high-concurrency inventory reservation problem for multi-warehouse retail and D2C brands. 

It ensures that thousands of simultaneous shoppers cannot overdraw physical inventory, while gracefully handling payment timeouts, abandoned carts, and network retries.

### 🚀 Live Demo
**URL:** [INSERT YOUR VERCEL URL HERE]

---

## 🧠 Core Architecture & Solutions

### 1. Correctness Under Concurrency (The Race Condition Fix)
The primary challenge of this exercise is ensuring that if two users attempt to buy the last unit of a SKU at the exact same millisecond, exactly one succeeds and the other receives a `409 Conflict`.

Instead of relying on application-level locks or distributed Redis locks (which introduce network latency and risk deadlocks if a process crashes), I utilized **Atomic Database Updates**. 

In `POST /api/reservations`, I execute a raw PostgreSQL query:
```sql
UPDATE "Stock"
SET "reservedQuantity" = "reservedQuantity" + ${quantity},
    "updatedAt" = NOW()
WHERE "productId" = ${productId} 
  AND "warehouseId" = ${warehouseId}
  AND ("totalQuantity" - "reservedQuantity") >= ${quantity}
```
Because PostgreSQL evaluates the WHERE clause dynamically at the exact moment the row is locked for the update, this guarantees mathematically that stock can never be over-reserved. It is 100% race-condition-free at the database engine level.

### 2. Reservation Expiry Mechanism
To prevent abandoned carts from permanently locking up inventory, reservations are strictly held for 10 minutes.
- **Production Implementation:** A Vercel Cron Job (`vercel.json`) is configured to run every 1 minute.
- It triggers a secure `GET` request to `/api/cron/release-expired`, protected via a `CRON_SECRET`.
- It queries for all `PENDING` reservations where `expiresAt < NOW()`.
- It utilizes a Prisma Transaction to safely mark them as `RELEASED` and decrement the `reservedQuantity`, returning the stock to the available pool.

### 3. Idempotency (Bonus Requirement)
To prevent duplicate reservations or double-charges caused by spotty mobile networks (user spam-clicking "Reserve" or their phone automatically retrying a dropped POST request), I implemented Upstash Redis.
- The frontend generates a `crypto.randomUUID()` on Checkout/Reserve attempts and passes it via the `Idempotency-Key` header.
- The API checks Redis. If a previous successful response exists for that key, it short-circuits and returns the cached HTTP response, skipping the database mutation entirely.
- Successful responses are cached for 24 hours (`SET key response NX EX 86400`).

## 💻 Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (End-to-end type safety)
- **Database:** Supabase (Hosted PostgreSQL) with PgBouncer connection pooling.
- **ORM:** Prisma
- **Caching & Idempotency:** Upstash Redis
- **Styling:** Tailwind CSS (Apple Web Design System UI) + shadcn/ui

## 🛠️ How to Run Locally

### 1. Clone the repository and install dependencies:
```bash
git clone https://github.com/yourusername/allo-health.git
cd allo-health
npm install
```

### 2. Environment Variables:
Create a `.env` file in the root directory and add your keys:
```env
# Supabase Transaction Pooled URL
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct URL (for migrations)
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://[YOUR-UPSTASH-URL].upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"

# Local Cron Security Key
CRON_SECRET="local-dev-secret"
```

### 3. Database Setup & Seed:
```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

### 4. Start the development server:
```bash
npm run dev
```
Visit http://localhost:3000.

## ⚖️ Trade-offs & Future Improvements
Given more time, here is how I would evolve this into a massive-scale production system:

- **Event-Driven Expiry over Cron Polling:**
Currently, the cron job scans the reservations table every minute. At millions of rows, table scans become expensive. In a production system, I would use an Event Scheduler (like AWS EventBridge) or a Redis Delayed Task Queue (BullMQ) to schedule a precise release event exactly 10 minutes after a reservation is created.

- **WebSockets / Server-Sent Events (SSE):**
Currently, the available stock numbers on the UI update when a user navigates or successfully completes an action. I would implement Supabase Realtime (WebSockets) so that shoppers looking at a product page see the "Available Stock" tick down in real-time as other users reserve items, creating FOMO and a better UX.

- **Optimistic UI Updates:**
While the checkout timer is live and accurate, adding React useOptimistic to instantly visually deduct stock on the homepage before the API confirms the reservation would make the app feel perfectly instantaneous.
