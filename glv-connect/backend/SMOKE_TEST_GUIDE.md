# GLV Connect — Lead Intake Smoke Test Guide

Pre-requisites: server running locally with `.env` populated (see required vars below).

## Required env vars before smoke testing

```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
APP_URL, CORPORATE_EMAIL_DOMAINS, LEAD_INGESTION_SECRET
JWT_SECRET, ALLOWED_ORIGINS
```

---

## Step 1 — Health check

```bash
curl http://localhost:8080/health
# Expected: {"ok":true,...}
```

---

## Step 2 — Create a lead (internal)

```bash
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}' > /dev/null

curl -s -b cookies.txt -X POST http://localhost:8080/leads \
  -H 'Content-Type: application/json' \
  -d '{"contact_name":"Smoke Test","country_code":"CO","origin_channel":"WEB","company_name":"Test SA"}'
# Expected: 201 {"id":...,"glv_code":"LEAD-YYYY-NNNN","status":"PENDING_ASSIGNMENT"|"ASSIGNED"}
```

---

## Step 3 — External ingestion without secret (dev mode)

```bash
curl -s -X POST http://localhost:8080/api/leads/external \
  -H 'Content-Type: application/json' \
  -d '{"source":"WEBSITE","external_submission_id":"smoke-001","contact_name":"External Test"}'
# Expected: 201 {"glv_code":...,"idempotent":false}
```

---

## Step 4 — Idempotency (repeat same external_submission_id)

```bash
curl -s -X POST http://localhost:8080/api/leads/external \
  -H 'Content-Type: application/json' \
  -d '{"source":"WEBSITE","external_submission_id":"smoke-001","contact_name":"External Test"}'
# Expected: 200 {"idempotent":true}
```

---

## Step 5 — HMAC signature (production mode)

```bash
SECRET="your_LEAD_INGESTION_SECRET"
BODY='{"source":"WEBSITE","external_submission_id":"smoke-002","contact_name":"HMAC Test"}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -s -X POST http://localhost:8080/api/leads/external \
  -H 'Content-Type: application/json' \
  -H "x-glv-signature: $SIG" \
  -d "$BODY"
# Expected: 201 {"glv_code":...}
```

---

## Step 6 — Inactive agent rejection

```bash
# Attempt to assign an inactive agent via PATCH /leads/:id/assign
# Expected: 400 with error message about inactive account
curl -s -b cookies.txt -X PATCH http://localhost:8080/leads/1/assign \
  -H 'Content-Type: application/json' \
  -d '{"agent_username":"inactive_agent","reason":"test"}'
# Expected: {"error":"...no tiene cuenta activa..."}
```

---

## Step 7 — Pre-production env check in logs

On server startup you should see in console:
- `[PRE-PRODUCTION] Missing env vars: ...` if any required var is absent
- No Railway URL warnings if `APP_URL` is set to your domain
- Error thrown if `MAIL_FROM` is a personal email domain
