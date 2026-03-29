# 🐔 Nanda Poultry Farm — Trading Management System

A full-stack poultry trading management system built with Next.js 14, TypeScript, Prisma ORM, and MySQL. Manages transactions, payments, outstanding balances, expenses, bank statements, ledger reports, team chat, and notifications across three user roles.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | MySQL via Prisma ORM |
| Auth | NextAuth.js (JWT, credentials-based) |
| Charts | Recharts |
| Export | xlsx, jsPDF, jspdf-autotable |
| Toasts | Sonner |

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+
- MySQL 8+ running locally or remotely

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env.local` in the project root:
```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/nanda_poultry"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-here-min-32-chars"
```

### 3. Push schema to database
```bash
npm run db:push
```

### 4. Seed initial data
```bash
npm run seed
```

### 5. Start development server
```bash
npm run dev
```

---

## 🔐 Login System

The system uses **Login IDs** (not emails) for authentication. Login IDs are auto-generated when admin creates a user.

### Login ID Format
| Role | Format | Example |
|------|--------|---------|
| Admin | `ADM001`, `ADM002` … | `ADM001` |
| Accountant | `ACC001`, `ACC002` … | `ACC001` |
| Salesperson | `SLS001`, `SLS002` … | `SLS001` |

### Default Seeded Accounts
| Login ID | Password | Role |
|----------|----------|------|
| `ADM001` | `Admin@123` | Admin |
| `ACC001` | `Accounts@123` | Accountant |
| `SLS001` | `Sales@123` | Salesperson |

> Email login also works for backward compatibility.

### Password Policy
- 8–16 characters
- At least one uppercase letter, one lowercase letter, one number, one special character

---

## 👥 Roles & Permissions

### Admin
- Full access to all modules
- Create/manage users, traders, companies, bank accounts, expense types
- View all transactions, payments, expenses, edit history
- Access bank statements (read-only), outstanding, ledger (all parties)
- Team Chat

### Accountant
- Verify or reject payment requests
- Add and manage expenses
- Manage bank statements (generate auto-statements, add manual entries)
- Access outstanding, transactions, edit requests, ledger (all parties)
- Team Chat

### Salesperson
- Record purchase & sale transactions
- Submit payment requests (UPI/NEFT/RTGS/IMPS/Cheque — Cash not allowed)
- Request transaction edits (accountant approves)
- View their own outstanding balances
- Ledger report — own traders/companies only
- View farm bank details (account number, IFSC, UPI ID, QR code) to share with traders
- Team Chat

---

## 🧭 Navigation (Sidebar)

### Admin
Dashboard · Users · Companies · Traders · Bank Accounts · Outstanding · Transactions · Expenses · Expense Types · Edit History · View Payments · Ledger Report · Bank Statements 📑 · Team Chat 💬

### Accountant
Dashboard · Verify Payments · Edit Requests · Outstanding · Transactions · Expenses · Bank Statements 📑 · Ledger Report · Team Chat 💬

### Salesperson
Dashboard · Transactions · Payments · Outstanding · Ledger Report · Bank Details · Team Chat 💬

---

## 📅 Dashboard Date Filters

All three dashboards have a unified date filter with exactly **three options**:

| Option | Description |
|--------|-------------|
| **All Time** | No date restriction |
| **Month** | Filter by month + year (default: current month) |
| **Custom** | Pick a start and end date |

Dashboards and all payment/transaction views auto-refresh every **30 seconds** — no manual refresh needed.

---

## 📦 Module Overview

### Transactions (Purchase & Sale)
- Single entry records both the purchase from a company and the sale to a trader
- Fields: Date, Vehicle No, Company, Trader, Birds, Weight, Purchase Rate/kg, Sale Rate/kg
- Auto-calculates gross profit, outstanding amounts
- Salesperson can request an edit; accountant approves or rejects
- Supports CSV and PDF export

### Payments
- Salesperson submits payment requests for traders or companies
- **Trader payments**: Bank account mandatory; Transaction ID/UTR optional (accountant can skip)
- **Company payments**: Accountant fills in transaction details (payment method, UTR, bank) on verification; Transaction ID mandatory
- Accountant verifies or rejects; salesperson is notified either way
- Transaction ID shown across all payment views and exports (checks `utrNumber || chequeNumber || transactionId`)
- Payments pages auto-refresh every 30 seconds

### Outstanding
- Calculated live: `invoiceTotal − confirmedPayments`
- Positive = amount owed (DR), Negative = credit/advance balance (CR), Zero = settled
- Trader outstanding tracks the sale side; Company outstanding tracks the purchase side
- Salesperson sees only their own parties

### Expenses
- Accountant records business expenses
- Bank account mandatory; Transaction ID required for UPI/NEFT/RTGS/IMPS
- Filterable by type, date, bank account

### Bank Statements
- **Auto-generate**: Pulls verified trader payments (credit), company payments (debit), and expenses (debit) for a selected month
- **Manual entries**: Add non-system transactions (bank charges, direct transfers, etc.)
- Filter by period, bank account, and entry type (All / Manual / Trader Payment / Company Payment / Expense)
- Excel export available
- Accessible by Admin (read-only) and Accountant (full management)

### Ledger Report
- Per-party (Trader or Company) running balance statement
- Transaction rows and payment rows shown chronologically with a running closing balance
- DR = amount owed · CR = advance/credit · NIL = settled
- Export to CSV and PDF
- Salesperson: dropdown shows only their own linked parties
- Admin & Accountant: all parties available

### Bank Details (Salesperson)
- Read-only view of farm bank accounts
- Shows: Account Holder, Account Number, IFSC Code, Bank Name, Branch, UPI ID
- Copy individual fields or **Copy All Details** (formats for WhatsApp paste)
- View UPI QR Code in full-screen modal to screenshot and share with traders
- Balance is never shown to salesperson

### Notifications 🔔
- Bell icon in top bar with unread count badge (pulses when unread)
- Auto-refreshes every 15 seconds
- Triggered by: payment verified, payment rejected, edit request approved, edit request rejected, @ mention in chat
- Mark individual or all notifications as read

### Team Chat 💬
- One group channel for the whole team (Admin, Accountant, Salesperson)
- **@ Mentions**: type `@` to open member picker, arrow keys to navigate, Enter to select — tagged person receives a notification
- **Emoji Reactions**: hover any message → pick from 8 quick emojis, click to toggle on/off
- **Reply**: quote any message inline
- **Edit**: edit your own messages (inline, Enter to save)
- **Delete**: own messages; Admin can delete any message
- Messages grouped by date (Today / Yesterday / full date)
- Consecutive messages from same sender collapsed (no repeated avatar/name within 5 min)
- Auto-polls every 3 seconds — no refresh needed
- Load older messages button for pagination

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/               # NextAuth handler
│   │   ├── bank-accounts/      # Farm bank account CRUD
│   │   ├── bank-statements/    # Statement entries + auto-generate
│   │   ├── chat/               # Chat messages (GET/POST/PATCH)
│   │   ├── companies/          # Company CRUD
│   │   ├── edit-requests/      # Edit request workflow
│   │   ├── expense-types/      # Expense category master
│   │   ├── expenses/           # Expense CRUD
│   │   ├── ledger/             # Ledger report (role-scoped)
│   │   ├── notifications/      # Notifications (GET/PATCH)
│   │   ├── outstanding/        # Outstanding calculations
│   │   ├── payments/           # Payment requests + verify
│   │   ├── purchases/          # Transaction records
│   │   ├── traders/            # Trader CRUD
│   │   └── users/              # User management
│   ├── dashboard/
│   │   ├── layout.tsx          # Shell with top bar, notification bell, chat button
│   │   ├── admin/              # All admin pages
│   │   ├── accountant/         # All accountant pages
│   │   └── salesperson/        # All salesperson pages
│   ├── login/                  # Login page
│   └── page.tsx                # Root redirect (role-based)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Role-based sidebar navigation
│   │   └── NotificationBell.tsx # Notification dropdown
│   ├── ChatView.tsx            # Full team chat UI
│   ├── ExpensesView.tsx        # Shared expenses component
│   ├── LedgerView.tsx          # Ledger report component
│   ├── OutstandingView.tsx     # Outstanding component
│   └── TransactionsView.tsx    # Transactions component
└── lib/
    ├── auth/
    │   ├── middleware.ts       # requireAuth helper
    │   └── nextauth.ts        # NextAuth config
    ├── db/
    │   └── prisma.ts          # Prisma client singleton
    └── notifications.ts       # Notification helpers
prisma/
└── schema.prisma              # Full database schema
scripts/
├── seed.ts                    # Seeds default users + expense types
├── copy-env.js                # Copies .env.local for Prisma CLI
└── fix-loginids.js            # One-time loginId migration helper
```

---

## 🔑 npm Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Push Prisma schema changes to MySQL
npm run db:studio    # Open Prisma Studio (GUI for database)
npm run seed         # Seed database with default accounts
```

---

## 🗄 Database Schema

| Table | Description |
|-------|-------------|
| `users` | All staff with roles, KYC docs, bank details |
| `traders` | Buyer/trader master (name, mobile, PAN) |
| `companies` | Supplier/company master (name, mobile, PAN, UPI, bank accounts) |
| `company_bank_accounts` | Company bank accounts (one-to-many) |
| `bank_accounts` | Farm's own bank accounts (with UPI QR) |
| `purchases` | Transaction records — purchase + sale combined |
| `payments` | Payment requests and verification records |
| `expenses` | Business expense records |
| `expense_types` | Expense category master |
| `bank_statements` | Statement entries (manual + auto-generated) |
| `edit_requests` | Transaction edit approval workflow |
| `notifications` | User notification inbox |
| `chat_messages` | Team chat messages (with reactions, replies, mentions) |

---

## ⚠️ Important Notes

1. **Always run `npm run db:push`** after pulling schema changes, before starting the server
2. **Salesperson payments** do not support Cash — only UPI, NEFT, RTGS, IMPS, Cheque
3. **Trader payment UTR** is optional for accountant verification; Company payment UTR is mandatory
4. **Bank account is mandatory** for all expenses
5. **Ledger Report** is the replacement for the old Reports module — it provides per-party running balance exports
6. **Auto-refresh**: dashboards every 30s, payment pages every 30s, notification bell every 15s, chat every 3s
7. **Chat mentions** send a notification to the tagged user

---

## 🐛 Bugs Fixed

- Expense types dropdown showing empty (wrong response key)
- Expenses failing for Cash payments (transactionId wrongly mandatory)
- Bank statements 500 error on missing schema columns (graceful fallback added)
- Salesperson ledger party dropdown bypassing role scoping (now loads via ledger API)
- Admin payments page showing `—` for UTR/cheque numbers (now uses `utrNumber || chequeNumber || transactionId`)
- Companies page crash from orphaned empty `<div>` left by WhatsApp removal
- Traders table `colSpan` mismatch (was 8, corrected to 7)
- Bank statements auto-generate crashing (was querying deleted `advance_payments` table)
- Outstanding route crashing (was querying deleted `advance_payments` table)
- `mobileNumberpanNumber` typo in companies POST API (caused silent DB errors on create)
- Duplicate `🏦` icon for Bank Statements in sidebar (changed to `📑`)

---

*Last updated: March 2026*
# NandaPoultryFarm
