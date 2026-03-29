# Nanda Poultry Farm - Deployment Guide

## Prerequisites
- Node.js 18+
- MY SQL

---

## 1. Local Development Setup

### Clone and Install
```bash
git clone <your-repo-url>
cd nanda-poultry-farm
npm install
```

### Environment Variables
Create `.env.local` file:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nanda-poultry
NEXTAUTH_SECRET=your-random-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000
TWILIO_ACCOUNT_SID=your_twilio_sid        # optional
TWILIO_AUTH_TOKEN=your_twilio_token       # optional
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 # optional
```

### Generate NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

### Create Admin User
```bash
npm run seed
```
This creates: `admin@nanda.com` / `Admin@123`

### Run Development Server
```bash
npm run dev
```
Open http://localhost:3000

---

## 2. MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com
2. Create a new cluster (free tier works)
3. Create database user with read/write access
4. Whitelist IP (0.0.0.0/0 for Vercel)
5. Get connection string and add to MONGODB_URI

---

## 3. Vercel Deployment

### Deploy via CLI
```bash
npm install -g vercel
vercel
```

### Deploy via GitHub
1. Push code to GitHub
2. Go to https://vercel.com
3. Import repository
4. Add environment variables in Vercel dashboard:
   - MONGODB_URI
   - NEXTAUTH_SECRET
   - NEXTAUTH_URL (set to your Vercel URL)
   - TWILIO_* (optional)
5. Deploy!

---

## 4. Twilio WhatsApp Setup (Optional)

1. Create Twilio account at https://twilio.com
2. Go to Messaging > Try it Out > Send a WhatsApp message
3. Join the Twilio Sandbox
4. Get credentials from Console Dashboard
5. Add to environment variables

---

## 5. Default Login Credentials

After running seed:
- **Email:** admin@nanda.com
- **Password:** Admin@123

⚠️ **Change admin password immediately after first login!**

---

## 6. User Roles

| Role | Access |
|------|--------|
| Admin | Full access - analytics, user management, all data |
| Salesperson | Purchases, sales, payments recording |
| Accountant | Payment verification, bank statements, expenses, salaries |

---

## 7. Project Structure

```
src/
├── app/
│   ├── api/                   # API routes
│   │   ├── analytics/         # Analytics endpoint
│   │   ├── bank-accounts/     # Bank account CRUD
│   │   ├── bank-statements/   # Statement entries
│   │   ├── companies/         # Company management
│   │   ├── expenses/          # Expense tracking
│   │   ├── payments/          # Payment management + verification
│   │   ├── purchases/         # Purchase records
│   │   ├── reports/           # Report generation
│   │   ├── sales/             # Sales records
│   │   ├── salaries/          # Salary management
│   │   ├── traders/           # Trader management
│   │   ├── users/             # User management
│   │   └── whatsapp/          # WhatsApp messaging
│   ├── dashboard/
│   │   ├── admin/             # Admin pages
│   │   ├── salesperson/       # Salesperson pages
│   │   └── accountant/        # Accountant pages
│   └── login/                 # Authentication
├── components/
│   └── layout/                # Sidebar navigation
├── lib/
│   ├── auth/                  # NextAuth config + middleware
│   └── db/                    # MongoDB connection
├── models/                    # Mongoose schemas
│   ├── User.ts
│   ├── Company.ts
│   ├── Trader.ts
│   ├── Purchase.ts
│   ├── Sale.ts
│   ├── Payment.ts
│   ├── Expense.ts
│   ├── Salary.ts
│   ├── BankAccount.ts
│   └── BankStatement.ts
└── scripts/
    └── seed.ts                # Database seeding
```

---

## 8. Workflow

1. **Admin** sets up companies, traders, bank accounts, creates user accounts
2. **Salesperson** logs in and records daily purchases from companies
3. **Salesperson** records sales to traders
4. **Salesperson** records payment received from traders with transaction ID
5. **Accountant** reviews pending payments and verifies/rejects them
6. **Accountant** adds bank statement entries for reconciliation
7. **Accountant** records expenses and salary payments
8. **Admin** views analytics dashboard for profit insights
9. **Admin** sends WhatsApp confirmation to traders/companies
10. **Admin** generates and downloads Excel/PDF reports

---

## 9. Key Features

- ✅ JWT Authentication with role-based access
- ✅ 3 role dashboards (Admin/Salesperson/Accountant)
- ✅ Company & Trader management
- ✅ Purchase & Sales recording with auto outstanding calculation
- ✅ Payment verification workflow
- ✅ Real-time analytics with Recharts
- ✅ Excel export (XLSX)
- ✅ PDF export (jsPDF + AutoTable)
- ✅ WhatsApp messaging via Twilio
- ✅ Bank account & statement management
- ✅ Expense tracking by category
- ✅ Salary management
- ✅ Responsive UI with Tailwind CSS

---

## 10. Security Notes

- Change default admin password immediately
- Use strong NEXTAUTH_SECRET (32+ chars)
- Enable MongoDB Atlas IP whitelisting for production
- Use HTTPS in production (Vercel handles this automatically)
- Never commit .env files to git
