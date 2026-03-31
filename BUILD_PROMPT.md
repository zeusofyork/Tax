# Full-Stack Tax Preparation Platform — Build Prompt

Use this prompt with an AI coding assistant or development team to reproduce and extend the EasyTax platform with authentication, persistent storage, payment processing, and PII-compliant security.

---

## PROMPT

---

Build me a full-stack tax preparation web application for processing individual federal tax returns (Tax Year 2025). The app must include user authentication, account management, persistent client data storage for repeat customers, integrated payment/invoice processing, and strict security and compliance controls for handling PII (Personally Identifiable Information) and sensitive financial data.

---

### 1. TECH STACK

**Frontend:**
- React 18+ (or Next.js 14+ for SSR/SEO benefits)
- TypeScript (strict mode)
- Tailwind CSS for styling
- React Hook Form + Zod for form validation
- Axios or fetch with interceptors for API calls

**Backend:**
- Node.js with Express.js (or Next.js API routes)
- TypeScript
- Prisma ORM with PostgreSQL database
- Redis for session management and rate limiting

**Auth:**
- NextAuth.js or Passport.js with JWT + refresh tokens
- bcrypt for password hashing (cost factor 12+)
- TOTP-based two-factor authentication (speakeasy or otplib)

**Payments:**
- Stripe API for payment processing and invoicing
- Stripe Elements for PCI-compliant card collection (never touch raw card data)

**Infrastructure:**
- All traffic over HTTPS/TLS 1.2+
- Environment variables via .env (never committed)
- Docker + docker-compose for local dev
- Helmet.js for HTTP security headers

---

### 2. USER AUTHENTICATION & ACCOUNT MANAGEMENT

**Registration:**
- Email + password signup with email verification (send a token-based confirmation link)
- Password requirements: minimum 12 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
- Store passwords hashed with bcrypt (never plaintext)
- On signup, create a `User` record and a linked `TaxProfile` record
- CAPTCHA (hCaptcha or reCAPTCHA v3) on registration to prevent bot abuse

**Login:**
- Email + password login with rate limiting (max 5 failed attempts per 15 minutes, then lockout with email notification)
- JWT access tokens (15-minute expiry) + HTTP-only secure refresh tokens (7-day expiry, rotated on use)
- Mandatory two-factor authentication (TOTP via authenticator app) — enforce on first login after setup
- Session stored server-side in Redis with device fingerprinting
- "Remember this device" option that stores a signed device token (30-day expiry)

**Account Management:**
- Profile page: update name, email (re-verify), phone, address
- Change password (requires current password)
- Enable/disable 2FA
- View login history (IP, device, timestamp, success/failure)
- Account deletion with 30-day grace period (soft delete, then hard purge)
- Password reset via time-limited email link (1 hour expiry, single-use)

**Role-Based Access:**
- `client` — can file their own returns, view their invoices, make payments
- `preparer` — can view/edit assigned client returns, send invoices, manage client list
- `admin` — full access, user management, audit logs, system settings
- Middleware that checks role on every protected route

---

### 3. TAX RETURN PROCESSING (5-STEP WIZARD)

Reproduce the following multi-step tax form wizard:

**Step 1 — Personal Information:**
- First name, last name, SSN, date of birth
- Street address, city, state, ZIP code
- Phone, email
- Filing status: Single, Married Filing Jointly, Married Filing Separately, Head of Household, Qualifying Surviving Spouse
- Number of dependents with detail entry (name, SSN, relationship, DOB)

**Step 2 — Income:**
- W-2 entry (multiple): employer name, EIN, Box 1 wages, Box 2 federal withheld, Box 17 state withheld, Box 3/4 SS wages/withheld, Box 5/6 Medicare wages/withheld
- 1099-NEC (self-employment), 1099-INT (interest), 1099-DIV (dividends + qualified), 1099-G (unemployment), 1099-R (retirement), 1099-MISC
- Other income: alimony, capital gains/losses, rental income, other
- Estimated tax payments already made
- Live gross income preview as user enters data

**Step 3 — Deductions:**
- Standard vs. Itemized toggle with auto-display of standard deduction amount based on filing status
- Itemized (Schedule A): medical/dental (auto-apply 7.5% AGI floor), SALT (capped at $10,000), mortgage interest, charitable contributions, casualty/theft losses, other
- Above-the-line adjustments: student loan interest (cap $2,500), educator expenses (cap $300), HSA deduction, traditional IRA deduction, self-employment tax deduction (auto-calculated at 50% of SE tax)

**Step 4 — Tax Credits:**
- Child Tax Credit ($2,000/child, auto-calculated with AGI phaseout)
- Earned Income Credit (manual entry or worksheet)
- Education credits (AOC / Lifetime Learning)
- Child & Dependent Care Credit
- Saver's Credit
- Residential Energy Credit
- Other credits

**Step 5 — Review & Summary:**
- Full return summary: taxpayer info, income breakdown, adjustments, deductions, tax computation with bracket breakdown, credits, payments, refund or balance due
- Effective and marginal tax rate display
- Print / Save as PDF button
- Export as JSON button
- Submit return button (saves final version, triggers invoice if preparer)

**Tax Calculation Engine (2025 brackets):**
- Implement all 5 filing status bracket schedules for 2025
- Self-employment tax: 15.3% on 92.35% of net SE income, with SS wage base cap at $176,100
- Child Tax Credit phaseout logic
- All calculations must run server-side for integrity (client-side preview is OK but server is authoritative)

---

### 4. CLIENT DATA PERSISTENCE FOR REPEAT CUSTOMERS

**Database Schema (core tables):**

```
User {
  id            UUID PRIMARY KEY
  email         VARCHAR UNIQUE (encrypted at rest)
  passwordHash  VARCHAR
  role          ENUM(client, preparer, admin)
  mfaSecret     VARCHAR (encrypted)
  mfaEnabled    BOOLEAN
  emailVerified BOOLEAN
  createdAt     TIMESTAMP
  updatedAt     TIMESTAMP
  deletedAt     TIMESTAMP (soft delete)
}

TaxProfile {
  id            UUID PRIMARY KEY
  userId        UUID REFERENCES User
  firstName     VARCHAR (encrypted)
  lastName      VARCHAR (encrypted)
  ssn           VARCHAR (encrypted, AES-256)
  dob           DATE (encrypted)
  address       VARCHAR (encrypted)
  city          VARCHAR
  state         VARCHAR
  zip           VARCHAR
  phone         VARCHAR (encrypted)
  filingStatus  VARCHAR
  createdAt     TIMESTAMP
  updatedAt     TIMESTAMP
}

TaxReturn {
  id            UUID PRIMARY KEY
  userId        UUID REFERENCES User
  taxYear       INTEGER
  status        ENUM(draft, submitted, in_review, completed, amended)
  formData      JSONB (encrypted at rest — contains all income, deductions, credits)
  computedResult JSONB (encrypted — contains tax calc output)
  preparerId    UUID REFERENCES User (nullable)
  submittedAt   TIMESTAMP
  createdAt     TIMESTAMP
  updatedAt     TIMESTAMP
}

Dependent {
  id            UUID PRIMARY KEY
  taxReturnId   UUID REFERENCES TaxReturn
  name          VARCHAR (encrypted)
  ssn           VARCHAR (encrypted)
  relationship  VARCHAR
  dob           DATE (encrypted)
}

W2 {
  id            UUID PRIMARY KEY
  taxReturnId   UUID REFERENCES TaxReturn
  employerName  VARCHAR
  ein           VARCHAR
  wages         DECIMAL
  fedWithheld   DECIMAL
  stateWithheld DECIMAL
  ssWages       DECIMAL
  ssWithheld    DECIMAL
  medWages      DECIMAL
  medWithheld   DECIMAL
}

Invoice {
  id            UUID PRIMARY KEY
  taxReturnId   UUID REFERENCES TaxReturn
  userId        UUID REFERENCES User
  amount        DECIMAL
  status        ENUM(draft, sent, paid, overdue, cancelled)
  stripeInvoiceId VARCHAR
  dueDate       DATE
  paidAt        TIMESTAMP
  createdAt     TIMESTAMP
}

AuditLog {
  id            UUID PRIMARY KEY
  userId        UUID REFERENCES User
  action        VARCHAR (e.g., 'login', 'view_return', 'export_data', 'update_ssn')
  resource      VARCHAR
  resourceId    UUID
  ipAddress     VARCHAR
  userAgent     VARCHAR
  metadata      JSONB
  createdAt     TIMESTAMP
}

LoginHistory {
  id            UUID PRIMARY KEY
  userId        UUID REFERENCES User
  ipAddress     VARCHAR
  userAgent     VARCHAR
  success       BOOLEAN
  failureReason VARCHAR
  createdAt     TIMESTAMP
}
```

**Repeat Customer Features:**
- On login, auto-populate personal info from their TaxProfile (pre-fill the wizard)
- Show a dashboard listing all prior-year returns with status
- "Copy from last year" button that pre-fills a new return from the previous year's data (income sources, dependents, etc.)
- Allow clients to update their profile info which persists across returns
- Preparers can search clients by name/email/SSN-last-4 and view their full history

---

### 5. PAYMENT PROCESSING & INVOICING

**Stripe Integration:**
- Use Stripe in server-side mode only — never expose secret keys to the client
- Use Stripe Elements (embedded card form) so raw card numbers never touch your server (PCI SAQ-A compliance)
- Create a Stripe Customer object linked to each User on signup

**Invoice Flow:**
1. Preparer creates an invoice for a completed return (sets amount, due date, line items like "Federal Return Preparation — $150", "State Return — $50")
2. System creates a Stripe Invoice via API and records the `stripeInvoiceId`
3. Client receives email notification with a link to pay
4. Client views invoice in their dashboard and pays via Stripe Elements
5. Stripe webhook (`invoice.paid`) fires → backend updates Invoice status to `paid`, records `paidAt`
6. Receipt auto-generated and available for download

**Invoice Dashboard:**
- Client view: list of all invoices with status badges (draft, sent, paid, overdue)
- Preparer view: create invoices, track payment status, resend reminders
- Admin view: full financial reporting, revenue dashboard

**Webhook Security:**
- Verify all Stripe webhooks using `stripe.webhooks.constructEvent()` with the signing secret
- Idempotency checks to prevent duplicate processing
- Log all webhook events to AuditLog

**Supported Flows:**
- One-time payments for individual returns
- Payment plans (Stripe Installments or custom logic with scheduled charges)
- Refund processing through Stripe API

---

### 6. SECURITY & COMPLIANCE

This application handles SSNs, financial data, and payment information. The following is mandatory:

**Encryption:**
- All PII fields (SSN, name, DOB, address, phone) encrypted at rest using AES-256-GCM
- Encryption keys stored in environment variables or a secrets manager (AWS KMS, Vault) — never in code or database
- Database-level encryption (PostgreSQL TDE or encrypted volumes)
- All data in transit encrypted via TLS 1.2+ (enforce HSTS)

**Authentication Security:**
- Passwords hashed with bcrypt (minimum cost factor 12)
- Mandatory 2FA for all accounts that have accessed tax data
- JWT tokens signed with RS256 (asymmetric) — short-lived access (15 min), HTTP-only secure refresh tokens
- Session invalidation on password change
- Rate limiting: 5 login attempts per 15 min per IP, 10 per account
- Account lockout after repeated failures with email notification

**Input Validation & Sanitization:**
- Validate ALL inputs server-side with Zod schemas (never trust client)
- Sanitize HTML/script content (DOMPurify on client, express-validator on server)
- Parameterized queries only (Prisma handles this) — no raw SQL string concatenation
- SSN format validation: exactly XXX-XX-XXXX pattern
- File upload validation if supporting document uploads (type, size, virus scan)

**API Security:**
- CORS restricted to your domain(s) only
- Helmet.js for security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- CSRF protection on all state-changing requests
- Request size limits (1MB default)
- API rate limiting per user: 100 requests/min general, 10/min for sensitive operations

**Audit Logging:**
- Log every access to PII: who viewed what, when, from where
- Log all authentication events (login, logout, failed attempts, 2FA, password changes)
- Log all data modifications (create, update, delete returns)
- Log all invoice/payment events
- Logs are append-only (no user can delete audit logs)
- Retain audit logs for 7 years (IRS compliance)

**Data Retention & Deletion:**
- Tax returns retained for 7 years (IRS requirement) then auto-purged
- Account deletion: 30-day soft delete grace period, then hard delete all PII with audit record
- SSNs displayed masked (XXX-XX-1234) everywhere except during initial entry
- Export data: clients can request a full data export (GDPR/CCPA compliance)

**PCI Compliance:**
- Never store, process, or transmit raw card numbers on your servers
- Use Stripe Elements exclusively for payment collection
- Maintain PCI SAQ-A eligibility
- Stripe handles all card data — your server only receives tokens

**Additional Compliance:**
- IRS Publication 1345 compliance for tax return preparers
- GLBA (Gramm-Leach-Bliley Act) safeguards for financial data
- SOC 2 readiness: access controls, encryption, audit trails, incident response
- Privacy policy and terms of service pages required
- Cookie consent banner for tracking cookies

**Infrastructure Security:**
- Environment variables for all secrets (DB credentials, API keys, encryption keys, JWT signing keys)
- `.env` files in `.gitignore` — never committed
- Dependency scanning (npm audit, Snyk, or Dependabot)
- Content Security Policy headers blocking inline scripts and external resources
- Database backups encrypted and stored separately
- Principle of least privilege for database users (read-only user for reports, write user for app)

---

### 7. API ROUTES STRUCTURE

```
POST   /api/auth/register          — Create account + send verification email
POST   /api/auth/verify-email      — Confirm email with token
POST   /api/auth/login             — Login (returns JWT + sets refresh cookie)
POST   /api/auth/logout            — Invalidate session
POST   /api/auth/refresh           — Rotate access token
POST   /api/auth/forgot-password   — Send reset link
POST   /api/auth/reset-password    — Reset with token
POST   /api/auth/enable-2fa        — Generate TOTP secret + QR
POST   /api/auth/verify-2fa        — Verify TOTP code

GET    /api/users/me               — Get current user profile
PUT    /api/users/me               — Update profile
DELETE /api/users/me               — Request account deletion
GET    /api/users/me/login-history — View login history

GET    /api/tax-profile            — Get saved tax profile (pre-fill)
PUT    /api/tax-profile            — Update tax profile

GET    /api/returns                — List all returns for user
POST   /api/returns                — Create new draft return
GET    /api/returns/:id            — Get return by ID
PUT    /api/returns/:id            — Update return (auto-save drafts)
POST   /api/returns/:id/submit     — Submit return for review
POST   /api/returns/:id/calculate  — Server-side tax calculation
GET    /api/returns/:id/summary    — Get computed summary
GET    /api/returns/:id/export     — Export return as JSON/PDF

POST   /api/invoices               — Create invoice (preparer only)
GET    /api/invoices               — List invoices
GET    /api/invoices/:id           — Get invoice detail
POST   /api/invoices/:id/send      — Send invoice to client
POST   /api/invoices/:id/pay       — Process payment via Stripe
POST   /api/webhooks/stripe        — Stripe webhook handler

GET    /api/admin/users            — List users (admin only)
GET    /api/admin/audit-log        — View audit logs (admin only)
GET    /api/admin/reports           — Revenue/filing reports (admin only)
```

---

### 8. FRONTEND PAGES & COMPONENTS

```
/                          — Landing page with login/signup CTA
/login                     — Login form with 2FA step
/register                  — Signup form
/verify-email?token=xxx    — Email verification
/forgot-password           — Password reset request
/reset-password?token=xxx  — Password reset form

/dashboard                 — Client home: prior returns, quick actions
/dashboard/profile         — Edit personal info + tax profile
/dashboard/security        — 2FA, password change, login history
/dashboard/returns         — List of all returns
/dashboard/returns/new     — Start new return (5-step wizard)
/dashboard/returns/:id     — View/edit specific return
/dashboard/invoices        — View invoices + pay

/preparer/clients          — Client list (preparer role)
/preparer/returns          — All assigned returns
/preparer/invoices         — Create + manage invoices

/admin/users               — User management
/admin/audit               — Audit log viewer
/admin/reports             — Revenue + filing reports
```

---

### 9. ENVIRONMENT VARIABLES REQUIRED

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/easytax
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=<RS256 private key path>
JWT_REFRESH_SECRET=<separate secret>
ENCRYPTION_KEY=<AES-256 key, 32 bytes hex>
ENCRYPTION_IV_LENGTH=16

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@easytax.com
SMTP_PASS=<password>

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

NEXT_PUBLIC_APP_URL=https://app.easytax.com
NODE_ENV=production

HCAPTCHA_SECRET=<secret>
HCAPTCHA_SITE_KEY=<site key>
```

---

### 10. TESTING REQUIREMENTS

- Unit tests for the tax calculation engine (all filing statuses, edge cases, bracket boundaries)
- Integration tests for auth flows (register, login, 2FA, password reset)
- API tests for all CRUD operations with role-based access checks
- Stripe webhook tests with mock events
- Security tests: SQL injection attempts, XSS payloads, CSRF bypass attempts, rate limit verification
- E2E tests (Playwright or Cypress) for the full return filing flow
- Test with SSN edge cases (all zeros, valid format but fake numbers for test env)

---

### SUMMARY OF KEY REQUIREMENTS

1. **Authentication** — Email/password + mandatory 2FA, JWT with refresh rotation, rate limiting, account lockout
2. **Account Management** — Profile CRUD, password change, login history, soft-delete with purge
3. **Tax Return Wizard** — 5-step form with all income types, deductions (standard/itemized), credits, 2025 brackets
4. **Repeat Customers** — Persistent TaxProfile, return history, "copy from last year" pre-fill
5. **Payments** — Stripe Elements for PCI compliance, invoice creation/sending/payment, webhooks, receipts
6. **Security** — AES-256 encryption at rest, TLS in transit, bcrypt passwords, RBAC, input validation, CORS, CSP, CSRF
7. **Compliance** — 7-year audit logs, SSN masking, data export, GLBA/PCI SAQ-A/SOC 2 readiness, privacy policy
8. **Roles** — Client, Preparer, Admin with middleware-enforced access control
9. **Audit Trail** — Every PII access, auth event, data change, and payment logged immutably

Build this as a production-ready application. Prioritize security at every layer. Never store raw card data. Never log or expose SSNs in plaintext outside the encrypted database fields. All sensitive operations require re-authentication.

---
