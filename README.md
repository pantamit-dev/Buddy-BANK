# Money Pool (Bank Buddy) — Phase 1 MVP

Money Pool (Bank Buddy) is a financial management system designed for friend groups, travel clubs, and shared social circles. It utilizes LINE Group Chat as the primary communication channel and the LINE Mini App (LIFF) as the secure member dashboard and administrative portal.

## Features (Phase 1 MVP)

- **Strict Group Isolation & RBAC**: Row-Level Security (RLS) ensuring strict isolation across LINE groups. Supported roles: Owner, Treasurer, Member, Viewer.
- **Strict Onboarding Gate**: Members onboard via LINE Mini App (LIFF) and require approval before their slips are accepted.
- **Local Slip OCR**: Embedded Tesseract.js engine parses Thai/English bank transfer slips to extract amount, transfer date/time, and transaction reference numbers.
- **Deterministic In-Chat Slip Approval**: Interactive Flex Message Postback buttons with LINE Loading typing animation (`POST /v2/bot/chat/loading/start`) and atomic database locking against race conditions.
- **Immutable Financial Ledger**: Append-only double-entry accounting ledger where running balances are calculated strictly from verified transactions.
- **Sub-Second Chat Commands**: Deterministic `#` prefix query routing (`#ยอดรวม`, `#ยอดฉัน`, `#ช่วยเหลือ`) without LLM hallucination risks.

---

## Local Development Prerequisites

- **Node.js**: v20+ (Tested on Node v26.13.1)
- **Docker & Docker Compose**: Active Docker daemon for local PostgreSQL, GoTrue Auth, and Storage.

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your LINE Official Account credentials (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`) and LIFF App ID (`NEXT_PUBLIC_LIFF_ID`).

### 3. Start Local Supabase / Postgres Services

```bash
docker compose up -d postgres supabase-auth supabase-storage
```

Migrations and seed data in `supabase/` will automatically initialize.

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000/overview](http://localhost:3000/overview) to inspect the Mini App dashboard.

---

## Testing & Quality Gates

Run the test suite:

```bash
# Run all unit tests (OCR parser, command router, ledger balance)
npm run test:unit

# Run integration tests (Deposit approval state machine and idempotency lock)
npm run test:integration

# Run security tests (RLS isolation)
npm run test:security

# Run all test suites
npm test

# Run TypeScript type check
npm run type-check
```
# Buddy-BANK
