# EasyTax — Individual Tax Return Preparation Platform

Full-stack tax preparation web application with user authentication, MFA, encrypted PII storage, Stripe invoicing, document vault, and 2025 federal tax calculation engine.

## Architecture

```
tax-prep-app/
├── backend/                  # Django 4.x + DRF
│   ├── accounts/             # Auth, MFA, user management
│   ├── clients/              # Tax profiles, dependents
│   ├── documents/            # S3 document vault + virus scanning
│   ├── returns/              # Tax returns + calculation engine
│   ├── invoices/             # Stripe invoicing + webhooks
│   ├── audit/                # Immutable audit logging
│   └── taxprep/              # Django settings, URLs, WSGI
├── frontend/                 # React 18 + Tailwind CSS
│   └── src/
│       ├── pages/            # Landing, Login, Register, Dashboard, etc.
│       ├── components/       # Layout, shared components
│       └── context/          # AuthContext (JWT management)
├── nginx/                    # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci.yml  # Lint, test, build, security scan
```

## Quick Start (Local Development)

### 1. Clone and configure environment

```bash
cp .env.example .env
# Edit .env with your values — at minimum set:
#   DJANGO_SECRET_KEY, DB_PASSWORD, FIELD_ENCRYPTION_KEY,
#   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
```

Generate a Fernet encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

Services:
| Service      | URL                        |
|-------------|----------------------------|
| Frontend    | http://localhost:3000       |
| Backend API | http://localhost:8000/api/  |
| Django Admin| http://localhost:8000/admin/|
| PostgreSQL  | localhost:5432              |
| Redis       | localhost:6379              |

### 3. Create a superuser

```bash
docker compose exec web python manage.py createsuperuser
```

### 4. Run without Docker (manual)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## Stripe Webhook Setup

### Local development (Stripe CLI)
```bash
stripe listen --forward-to localhost:8000/api/invoices/webhooks/stripe/
# Copy the webhook signing secret to .env as STRIPE_WEBHOOK_SECRET
```

### Production
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/invoices/webhooks/stripe/`
3. Select events: `invoice.paid`, `invoice.payment_failed`, `invoice.viewed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## MFA Enrollment Flow

1. User registers and verifies email
2. On first login, user is prompted to set up MFA
3. Navigate to Profile > Security > Enable MFA
4. Scan QR code with Google Authenticator or Authy
5. Enter 6-digit code to confirm enrollment
6. Save backup codes in a secure location
7. All subsequent logins require MFA code

## API Endpoints

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | /api/auth/register/               | Create account                 |
| POST   | /api/auth/verify-email/           | Confirm email                  |
| POST   | /api/auth/login/                  | Login (returns JWT or MFA prompt)|
| POST   | /api/auth/mfa/verify/             | Complete MFA step              |
| POST   | /api/auth/mfa/setup/              | Start MFA enrollment           |
| POST   | /api/auth/mfa/confirm/            | Confirm MFA with code          |
| POST   | /api/auth/password/change/        | Change password                |
| POST   | /api/auth/password/reset/         | Request reset link             |
| GET    | /api/auth/profile/                | Get user profile               |
| GET    | /api/clients/profile/             | Get tax profile (pre-fill)     |
| PUT    | /api/clients/profile/             | Update tax profile             |
| CRUD   | /api/clients/dependents/          | Manage dependents              |
| CRUD   | /api/documents/                   | Upload/list/delete documents   |
| CRUD   | /api/returns/                     | Manage tax returns             |
| POST   | /api/returns/{id}/calculate/      | Run tax engine                 |
| POST   | /api/returns/{id}/submit/         | Submit for review              |
| POST   | /api/returns/{id}/update_status/  | Preparer status update         |
| CRUD   | /api/invoices/                    | Manage invoices                |
| POST   | /api/invoices/{id}/send_invoice/  | Send via Stripe                |
| GET    | /api/audit/logs/                  | Audit log (admin only)         |

## Security Summary

| Layer              | Implementation                                            |
|--------------------|-----------------------------------------------------------|
| Encryption at rest | AES-256 via django-encrypted-model-fields (SSN, DOB, etc.)|
| Encryption transit | TLS 1.2+ enforced, HSTS preload                          |
| Authentication     | JWT (15-min access, 7-day rotating refresh)               |
| MFA                | TOTP (Google Authenticator) + hashed backup codes         |
| Passwords          | bcrypt, min 12 chars, complexity rules                    |
| Rate limiting      | 5 login attempts/15min, 100 API requests/min              |
| PII protection     | Never logged, masked in API responses, scrubbed from logs |
| File uploads       | MIME validation, 10MB limit, ClamAV virus scan            |
| Audit trail        | Immutable, every PII access/auth event/data change logged |
| Payments           | Stripe Elements (PCI SAQ-A), webhook signature verified   |
| CORS               | Whitelist frontend domain only                            |
| CSP                | Script/frame restricted to self + Stripe + reCAPTCHA      |
| SQL injection      | Django ORM only, CI check blocks raw SQL                  |
| Data retention     | 7-year IRS retention, 30-day soft delete for accounts     |

## Deployment Notes

1. Set `DEBUG=False`, `SECURE_SSL_REDIRECT=True` in production
2. Use a managed PostgreSQL with encryption at rest
3. Use a real SMTP provider (SES, SendGrid, Mailgun)
4. Generate unique `DJANGO_SECRET_KEY` and `FIELD_ENCRYPTION_KEY`
5. Configure S3 bucket with server-side encryption and private ACL
6. Set up SSL certificates in `nginx/ssl/` (or use Let's Encrypt)
7. Enable Dependabot or pip-audit for dependency scanning
8. Schedule `purge_deleted_accounts` Celery beat task for GDPR cleanup

## Running Tests

```bash
# Backend
cd backend && pytest -v

# Frontend
cd frontend && npm test
```

## License

Proprietary. All rights reserved.
