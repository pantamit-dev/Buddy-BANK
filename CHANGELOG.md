# Changelog

All notable changes to the **Money Pool (Bank Buddy)** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0-beta] - 2026-11-22 (Release: v.beta)

### 🚀 Highlights & Milestones
- **System Maturity:** Reached near 100% completion of core system scope encompassing Phase 1 (MVP & Ledger), Phase 2 (Fraud & Automation), and Phase 3 (Voting & Reporting).
- **Test Coverage & Quality Gate:** 16 test suites passing (135 automated unit, integration, and security tests) with zero TypeScript errors.

### ✨ Added
- **High-Performance Local OCR (OpenThai 2.1):**
  - Offline neural OCR engine (PP-OCRv6 + Thai CTC recognizer) with CPU acceleration via OpenVINO & ONNX Runtime (100–300ms execution).
  - Robust multi-bank slip extraction supporting KBank, SCB, KTB, BBL, BAY, TTB, GSB, and PromptPay.
  - Multi-pattern reference code extraction handling stylized/loopless fonts and Thai Buddhist calendar (พ.ศ.) timestamps.
  - Graceful fallback pipeline to Tesseract.js in case of local server downtime.
- **Dynamic Service Discovery & All-in-One Automation:**
  - `scripts/start-all.py`: Single command orchestrating OCR daemon, dynamic ngrok/Cloudflare tunnel, Supabase `system_settings` live synchronization, and Next.js application.
  - Cloud Vercel Serverless automatically discovers live local OCR tunnel URL from Supabase without manual environment variable redeployments.
- **Deterministic LINE In-Chat Approval:**
  - Instant LINE loading animation (`POST /v2/bot/chat/loading/start`) upon button click.
  - Idempotent database lock protecting against simultaneous multi-click race conditions.
  - Human-friendly Thai locale date/time formatting on review Flex Cards.
- **Double-Entry Financial Ledger:**
  - Immutable, append-only `ledger_entries` with strictly derived running balances.
  - Complete separation between raw slips and verified financial transactions.
- **Multi-Layered Slip Fraud Detection:**
  - SHA-256 exact binary file hashing for immediate duplicate rejection.
  - Perceptual Hashing (pHash) detecting resized, cropped, or filtered duplicate slips.
  - Heuristic risk scoring engine evaluating transfer anomalies.
  - Pluggable `VerificationProviderInterface` ready for third-party bank clearing APIs.
- **Democratic Group Voting Workflow:**
  - Withdrawal proposal submissions with invoice/receipt attachment.
  - Interactive LINE group voting cards (`[เห็นชอบ]` / `[ไม่เห็นชอบ]`) with quorum evaluation based on `voting_quorum_percent`.
  - Automatic ledger debit execution upon quorum fulfillment.
- **Dynamic Financial Rules Engine:**
  - Dynamic JSON Schema rules evaluating member deposit status (`on_track`, `due_soon`, `overdue`).
- **Asynchronous Reports Engine:**
  - Asynchronous generation and download of audit-ready Excel (`exceljs`) and PDF reports.
- **LINE Mini App (LIFF 2.x) Portal:**
  - Comprehensive user views: Overview & Financial Goals, My Deposits timeline, Member Roster & RBAC, Slip Review Dashboard, Settings, and Financial Reports.
  - AI Financial Copilot with strict privacy boundaries preventing unauthorized disclosure of private balances in public group chats.

### 🔒 Security & Infrastructure
- Supabase PostgreSQL Row Level Security (RLS) isolating all data strictly by `group_id`.
- HMAC-SHA256 signature verification on all incoming LINE webhooks.
- Multi-tier Role-Based Access Control (RBAC): Owner, Treasurer, Member, Viewer.
