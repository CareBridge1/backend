# CareNow PayLater - Backend

A Node.js + Express + TypeScript REST API powering the CareNow healthcare installment payment platform.

## Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT (jsonwebtoken)
- **Payments:** Interswitch API

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your database URL and Interswitch credentials
```

### 3. Setup database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run development server
```bash
npm run dev
```

Server runs on `http://localhost:4000`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Register hospital |
| POST | /api/auth/login | No | Login |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/payment-links | Yes | Create payment link |
| GET | /api/payment-links | Yes | List hospital's links |
| GET | /api/payment-links/:id | No | Get link (patient view) |
| POST | /api/payment-links/:id/pay | No | Initiate payment |
| POST | /api/transactions/verify | No | Verify transaction |

## Interswitch Integration

The app runs in **demo mode** when `INTERSWITCH_CLIENT_ID` is not set. In demo mode, payments are simulated with mock URLs.

For production, configure your Interswitch credentials from the [Developer Portal](https://sandbox.interswitchng.com).
